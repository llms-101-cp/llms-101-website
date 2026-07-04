/**
 * llms101.com — Validate-and-Publish (weekly content pipeline, 2026-07-04)
 *
 * This script deliberately reverses the old "Nothing is ever auto-published"
 * principle: Craig decided on 2026-07-04 that the weekly pipeline should
 * validate and publish automatically, with his review happening POST-HOC on
 * the live site and `git revert <publish commit>` as the correction
 * mechanism. See ARCHITECTURE.md for the full decision record.
 *
 * For each entry in a week folder's _manifest.json it runs:
 *   a. Schema validation (articles mirror REQUIRED_ARTICLE_FIELDS from
 *      scripts/generate-indices.js; nodes get the full node schema).
 *   b. A fact-check pass — one web_search-enabled API call per item acting
 *      as a critic. Any blocking finding holds the item back.
 *   c. Nodes only: a layout simulation replicating index.html's exact
 *      perRow / row-width / margin-shift math for the post-insert child
 *      count of the manifest's targetBranch.
 *   d. Nodes only: a defensive splice of the node id into the named
 *      TREE.{targetBranch} array in index.html, with mandatory guards.
 *      ANY guard failure aborts the node publish and leaves index.html
 *      untouched.
 *   e. Placement + one commit for the whole week, pushed directly to main.
 *      That commit is the audit trail and the single `git revert` point.
 *      indexing.yml fires on the article path automatically — this script
 *      does not duplicate its work.
 *
 * A failure in ANY step holds back THAT item only; other items still
 * publish, and every failure reason goes into the published-report email.
 * The email sends even on partial failure — it is Craig's review trigger.
 *
 * Model cards are never published by this script: models.html is a shared
 * hand-coded file with no dynamic system (see ARCHITECTURE.md), so those
 * drafts are always held back for manual paste.
 *
 * Run:  node scripts/validate-and-publish.js [weekFolder] [--dry-run] [--offline]
 *   weekFolder  defaults to the most recent folder in drafts/ that has a
 *               _manifest.json (lexicographic max — folder names are ISO
 *               dates so that is also chronological).
 *   --dry-run   run every validation but write nothing, commit nothing,
 *               email nothing. Prints the report to stdout.
 *   --offline   dev-only: skip the fact-check API call (no ANTHROPIC_API_KEY
 *               needed). Implies --dry-run and CANNOT publish — this is a
 *               testing convenience, never a guard bypass.
 *
 * Env: ANTHROPIC_API_KEY (fact-check), RESEND_API_KEY + REVIEW_EMAIL (report)
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTOMATION_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(AUTOMATION_ROOT, '..');
const DRAFTS_DIR = path.join(AUTOMATION_ROOT, 'drafts');
const INDEX_HTML = path.join(REPO_ROOT, 'index.html');

const SITE_BASE = 'https://llms101.com';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Schema requirements ─────────────────────────────────────────────────────

// Mirrors REQUIRED_ARTICLE_FIELDS in scripts/generate-indices.js exactly.
// KEEP THESE IN SYNC MANUALLY — no shared import is possible between the two
// scripts locations (see ARCHITECTURE.md "Two completely separate scripts
// locations"). If generate-indices.js's list changes, update this one too.
const REQUIRED_ARTICLE_FIELDS = ['title', 'date', 'category', 'read_time', 'summary', 'body'];

// The full Mind Map node schema — matches NODE_DATA's shape in index.html
// and the schema documented in ARCHITECTURE.md.
const REQUIRED_NODE_FIELDS = ['label', 'sub', 'tag', 'theme', 'hasChildren', 'title', 'body', 'examples', 'sources'];

// Branches loadCMSData() actually fetches. TREE.roles is EXCLUDED on purpose:
// roles are hardcoded in index.html and never fetched, so a published roles
// node JSON would never load — validation must mirror that exclusion.
const FETCHED_TREE_BRANCHES = ['root', 'math', 'training', 'arch', 'prompting', 'themes'];

// Branches a node may be spliced into. 'root' is excluded (adding a new
// top-level branch is a design decision, not a weekly content publish) and
// 'roles' is excluded per the note above.
const VALID_TARGET_BRANCHES = ['math', 'training', 'arch', 'prompting', 'themes'];

// ─── Layout constants — KEEP IN MANUAL SYNC with index.html ─────────────────
// These mirror the values used by initLayout() (index.html ~lines 704-706 and
// ~2065-2123). If index.html's layout math changes, this simulation must
// change with it or its verdicts are meaningless.
const LAYOUT = {
  W: 160, H: 60, GAP: 30,
  CW: 1400, MARGIN: 50,
  BRANCH_Y: 207,
  CHILD_Y_OFFSET: 80,   // children start at parent.y + H + 80
  VGAP_EXTRA: 12,       // vGap = GAP + 12
  CANVAS_MIN_H: 900     // the PR #17 Math.max clamp floor
};

// ─── JS-aware block extraction (handles ', ", ` strings and CRLF) ───────────

function extractObjectLiteral(source, anchorRegex) {
  const m = anchorRegex.exec(source);
  if (!m) return null;
  const start = source.indexOf('{', m.index + m[0].length - 1);
  if (start === -1) return null;
  let depth = 0, quote = null, escapeNext = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && quote) { escapeNext = true; continue; }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { text: source.slice(start, i + 1), start, end: i + 1 };
    }
  }
  return null;
}

function parseTreeFromHtml(html) {
  const block = extractObjectLiteral(html, /const TREE = \{/);
  if (!block) throw new Error('Could not locate the `const TREE = {` block in index.html');
  let tree;
  try {
    tree = vm.runInNewContext(`(${block.text})`, {}, { timeout: 2000 });
  } catch (err) {
    throw new Error(`TREE block did not parse as a JS object: ${err.message}`);
  }
  return { tree, block };
}

function nodeDataHasId(html, id) {
  const block = extractObjectLiteral(html, /let NODE_DATA = \{/);
  if (!block) throw new Error('Could not locate the `let NODE_DATA = {` block in index.html');
  try {
    const nodeData = vm.runInNewContext(`(${block.text})`, {}, { timeout: 5000 });
    return Object.prototype.hasOwnProperty.call(nodeData, id);
  } catch {
    // Fallback if the object literal ever stops vm-evaluating cleanly:
    // look for a top-level-looking key. Less exact, still id-anchored.
    const keyRe = new RegExp(`[{,\\s]['"]?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*:\\s*\\{`);
    return keyRe.test(block.text);
  }
}

// ─── Layout simulation (mirrors initLayout() exactly) ───────────────────────

function rowShape(childCount) {
  const perRow = childCount <= 4 ? childCount : 3;
  const rows = [];
  for (let done = 0; done < childCount; done += perRow) {
    rows.push(Math.min(perRow, childCount - done));
  }
  return rows.join('/');
}

function simulateBranchLayout(tree, branchId) {
  const { W, H, GAP, CW, MARGIN, BRANCH_Y, CHILD_Y_OFFSET, VGAP_EXTRA } = LAYOUT;
  const branchIds = tree.root;
  const spacingFactor = branchIds.length > 4 ? 1.4 : 1.5;
  const totalBW = branchIds.length * W + (branchIds.length - 1) * GAP * spacingFactor;
  const bStartX = (CW - totalBW) / 2;
  const bIdx = branchIds.indexOf(branchId);
  if (bIdx === -1) return { ok: false, problems: [`branch '${branchId}' is not in TREE.root`] };
  const parent = { x: bStartX + bIdx * (W + GAP * spacingFactor), y: BRANCH_Y };

  const children = tree[branchId] || [];
  const perRow = children.length <= 4 ? children.length : 3;
  const hGap = GAP;
  const vGap = GAP + VGAP_EXTRA;
  const numRows = Math.ceil(children.length / perRow);

  const positions = [];
  const problems = [];

  for (let row = 0; row < numRows; row++) {
    const rowCount = Math.min(perRow, children.length - row * perRow);
    const rowTotalW = rowCount * W + (rowCount - 1) * hGap;
    if (rowTotalW > CW - 2 * MARGIN) {
      problems.push(`row ${row} is ${rowTotalW}px wide — wider than the usable canvas (${CW - 2 * MARGIN}px); the edge clamps would conflict`);
    }
    let rowStartX = parent.x + W / 2 - rowTotalW / 2;
    if (rowStartX < MARGIN) rowStartX = MARGIN;
    if (rowStartX + rowTotalW > CW - MARGIN) rowStartX = CW - MARGIN - rowTotalW;

    for (let col = 0; col < rowCount; col++) {
      const index = row * perRow + col;
      positions.push({
        id: children[index],
        x: rowStartX + col * (W + hGap),
        y: parent.y + H + CHILD_Y_OFFSET + row * (H + vGap)
      });
    }
  }

  // Bounds: every child box fully inside the canvas margins.
  for (const p of positions) {
    if (p.x < MARGIN || p.x + W > CW - MARGIN) {
      problems.push(`'${p.id}' is out of horizontal bounds (x=${p.x})`);
    }
  }

  // Overlap: pairwise axis-aligned box check among this branch's children.
  // (Only one branch is ever expanded at a time on the live map, so
  // cross-branch overlap cannot render — within-branch overlap is the bug
  // class the 2026-06-29 row-collision fix addressed.)
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i], b = positions[j];
      const overlap = a.x < b.x + W && b.x < a.x + W && a.y < b.y + H && b.y < a.y + H;
      if (overlap) problems.push(`'${a.id}' and '${b.id}' overlap (${a.x},${a.y}) vs (${b.x},${b.y})`);
    }
  }

  return { ok: problems.length === 0, problems, positions, shape: rowShape(children.length) };
}

// ─── Defensive TREE splice ───────────────────────────────────────────────────

/**
 * Insert `id` into the named TREE.{branch} array in index.html source text.
 * Idempotent: if the id is already in that branch's array, returns the
 * input unchanged (byte-for-byte) — per the tracker pipeline's
 * non-idempotency lesson.
 * Pure string edit on the raw source, so CRLF line endings are preserved
 * (the file has \r\n throughout — never normalize it).
 */
export function spliceTreeBranch(html, branch, id) {
  const treeBlock = extractObjectLiteral(html, /const TREE = \{/);
  if (!treeBlock) throw new Error('Could not locate the `const TREE = {` block');

  const branchRe = new RegExp(`(\\b${branch}:\\s*\\[)([^\\]]*)(\\])`);
  const m = branchRe.exec(treeBlock.text);
  if (!m) throw new Error(`Could not find branch array '${branch}: [...]' inside the TREE block`);

  // Already present in this branch? Idempotent no-op.
  const existingIds = m[2].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  if (existingIds.includes(id)) return html;

  const newArrayText = `${m[1]}${m[2]},'${id}'${m[3]}`;
  const newTreeText = treeBlock.text.slice(0, m.index) + newArrayText + treeBlock.text.slice(m.index + m[0].length);
  return html.slice(0, treeBlock.start) + newTreeText + html.slice(treeBlock.end);
}

/**
 * Run every mandatory guard for a node publish. Returns { ok, problems,
 * newHtml } — newHtml is only meaningful when ok is true. index.html on
 * disk is NOT touched here; the caller writes it only after ok.
 */
export async function guardedTreeSplice(html, branch, id) {
  const problems = [];

  // Guard 0: the PR #17 min-height clamp must still be present. If it is
  // gone, the connector viewBox bug is back and no layout change is safe.
  if (!html.includes('Math.max(maxY + H + 100, 900)')) {
    problems.push('The PR #17 canvas-height clamp `Math.max(maxY + H + 100, 900)` is missing from index.html — refusing to touch the file');
    return { ok: false, problems };
  }

  // Guard 1: TREE parses and the target branch exists.
  let before;
  try {
    before = parseTreeFromHtml(html);
  } catch (err) {
    problems.push(err.message);
    return { ok: false, problems };
  }
  if (!VALID_TARGET_BRANCHES.includes(branch)) {
    problems.push(`targetBranch '${branch}' is not a valid splice target (${VALID_TARGET_BRANCHES.join(', ')}) — roles is hardcoded/never fetched, root is not a content decision`);
    return { ok: false, problems };
  }
  if (!Array.isArray(before.tree[branch])) {
    problems.push(`TREE.${branch} does not exist or is not an array`);
    return { ok: false, problems };
  }

  // Guard 2: the id must not already exist in a DIFFERENT branch.
  for (const [b, ids] of Object.entries(before.tree)) {
    if (b !== branch && Array.isArray(ids) && ids.includes(id)) {
      problems.push(`'${id}' already exists in TREE.${b} — refusing to create a duplicate in TREE.${branch}`);
      return { ok: false, problems };
    }
  }

  const alreadyPresent = before.tree[branch].includes(id);

  // The splice itself (pure string edit; no-op if already present).
  let newHtml;
  try {
    newHtml = spliceTreeBranch(html, branch, id);
  } catch (err) {
    problems.push(`Splice failed: ${err.message}`);
    return { ok: false, problems };
  }

  // Guard 3: post-edit, the TREE block must still parse as valid JS.
  let after;
  try {
    after = parseTreeFromHtml(newHtml);
  } catch (err) {
    problems.push(`Post-splice TREE no longer parses: ${err.message}`);
    return { ok: false, problems };
  }

  // Guard 4: the id appears exactly once across ALL branches.
  const occurrences = Object.values(after.tree)
    .filter(Array.isArray)
    .reduce((n, ids) => n + ids.filter(x => x === id).length, 0);
  if (occurrences !== 1) {
    problems.push(`After splice, '${id}' appears ${occurrences} times across TREE branches (must be exactly 1)`);
    return { ok: false, problems };
  }

  // Guard 5: no other branch changed, and the target branch grew by exactly
  // the expected amount.
  for (const [b, ids] of Object.entries(before.tree)) {
    if (!Array.isArray(ids)) continue;
    const afterIds = after.tree[b];
    if (b === branch) {
      const expected = alreadyPresent ? ids.length : ids.length + 1;
      if (afterIds.length !== expected) {
        problems.push(`TREE.${b} has ${afterIds.length} ids after splice, expected ${expected}`);
      }
    } else if (JSON.stringify(afterIds) !== JSON.stringify(ids)) {
      problems.push(`TREE.${b} changed during the splice — it must not`);
    }
  }
  if (problems.length) return { ok: false, problems };

  // Guard 6: every id in the FETCHED branches must resolve to real content.
  // NOTE — deviation from the original spec, because the repo contradicts
  // it: content/nodes/ holds only a handful of JSON files; most nodes live
  // inline in index.html's NODE_DATA and loadCMSData() silently falls back
  // to those. So the real invariant is: every fetched-branch id resolves to
  // content/nodes/{id}.json OR an inline NODE_DATA entry — and the id being
  // published must specifically have its JSON file (that IS its content).
  for (const b of FETCHED_TREE_BRANCHES) {
    for (const nodeId of after.tree[b] ?? []) {
      const hasFile = existsSync(path.join(REPO_ROOT, 'content', 'nodes', `${nodeId}.json`));
      const hasInline = nodeDataHasId(newHtml, nodeId);
      if (!hasFile && !hasInline) {
        problems.push(`TREE.${b} id '${nodeId}' resolves to neither content/nodes/${nodeId}.json nor an inline NODE_DATA entry — it would render as a broken node`);
      }
    }
  }
  if (!existsSync(path.join(REPO_ROOT, 'content', 'nodes', `${id}.json`))) {
    problems.push(`content/nodes/${id}.json does not exist — the node file must be placed before the TREE splice is committed`);
  }
  if (problems.length) return { ok: false, problems };

  // Guard 7: idempotency — applying the splice to the already-spliced text
  // must be a byte-for-byte no-op (the tracker's non-idempotency lesson).
  const twice = spliceTreeBranch(newHtml, branch, id);
  if (twice !== newHtml) {
    problems.push('Idempotency check failed: applying the splice twice changed the file again (double-insert risk)');
    return { ok: false, problems };
  }

  return { ok: true, problems: [], newHtml };
}

// ─── Schema validation ───────────────────────────────────────────────────────

function missingFields(data, fields) {
  return fields.filter(f =>
    data[f] === undefined || data[f] === null ||
    (typeof data[f] !== 'boolean' && !Array.isArray(data[f]) && String(data[f]).trim() === '') ||
    (Array.isArray(data[f]) && data[f].length === 0)
  );
}

function validateSchema(entry, data) {
  const problems = [];
  if (entry.contentType === 'trends-article') {
    const missing = missingFields(data, REQUIRED_ARTICLE_FIELDS);
    if (missing.length) problems.push(`missing required article field(s): ${missing.join(', ')}`);
    const fileSlug = path.basename(entry.filename, '.json');
    if (data.slug && data.slug !== fileSlug) {
      // Not blocking: generate-indices.js derives the live slug from the
      // filename, so the filename wins — but flag it for the email.
      problems.push(`NOTE: slug field '${data.slug}' differs from filename slug '${fileSlug}' (the filename wins on the live site)`);
    }
  } else if (entry.contentType === 'node') {
    const missing = missingFields(data, REQUIRED_NODE_FIELDS);
    if (missing.length) problems.push(`missing required node field(s): ${missing.join(', ')}`);
    if (data.sources && Array.isArray(data.sources)) {
      for (const s of data.sources) {
        if (!s || !s.label || !s.url || !/^https:\/\//.test(s.url)) {
          problems.push(`node source entry is malformed (needs label + https URL): ${JSON.stringify(s)}`);
        }
      }
    }
    if (typeof data.hasChildren !== 'boolean') problems.push('hasChildren must be a boolean');
  } else if (entry.contentType === 'page') {
    const missing = missingFields(data, ['title', 'body']);
    if (missing.length) problems.push(`missing required page field(s): ${missing.join(', ')}`);
  }
  // Blocking problems are everything not prefixed NOTE:
  const blocking = problems.filter(p => !p.startsWith('NOTE:'));
  const notes = problems.filter(p => p.startsWith('NOTE:'));
  return { ok: blocking.length === 0, blocking, notes };
}

// ─── Fact-check pass ─────────────────────────────────────────────────────────

function lastTextBlock(message) {
  const textBlocks = message.content.filter(b => b.type === 'text').map(b => b.text);
  return (textBlocks[textBlocks.length - 1] ?? '').trim();
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

async function factCheck(client, entry, data) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const contentText = JSON.stringify(data, null, 2);

  const system = `You are a rigorous fact-checker for llms101.com, an educational site about
large language models. You verify content BEFORE it is published to the live
site with no human pre-review — you are the last line of defence. Use the
web_search tool to verify claims against current, authoritative sources.
Today's date is ${todayISO}.`;

  const user = `Fact-check this ${entry.contentType} draft before automatic publication.

Verify, using web_search where needed:
1. Model names and versions presented as CURRENT — the single most common
   failure mode of this pipeline is content that describes a superseded
   model lineup as the current one.
2. Dates and chronology.
3. Quantitative claims (benchmark numbers, prices, parameter counts,
   percentages, multipliers).
4. Any "as of <date>" statement. House rule: an explicit date is REQUIRED —
   bare "as of writing" or "as of today" with no date is a BLOCKING finding.
5. Source links: do the cited papers/pages plausibly exist and match their
   labels?

Judgment standard: content that is historically framed ("in 2023...", "at
the time...") is fine. Content that presents a stale state of the world as
current is blocking. Minor style issues are not findings at all. Borderline
factual concerns that would not embarrass the site are severity "note".

CONTENT TO CHECK:
${contentText}

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "verdict": "pass" | "fail",
  "findings": [
    { "severity": "blocking" | "note", "claim": "the claim in question", "issue": "what is wrong or worth knowing, with the correct fact if you found one" }
  ]
}
"fail" if and only if there is at least one blocking finding. An empty
findings array with verdict "pass" is the expected result for clean content.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-8', // same convention as generate-tracker.js — re-check against
                              // docs.claude.com if this errors model-not-found after a while
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
  });

  if (message.stop_reason === 'max_tokens') {
    throw new Error('fact-check response hit max_tokens — not safe to parse');
  }

  const raw = lastTextBlock(message);
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const cleaned = extractJsonObject(fenceStripped) ?? fenceStripped;
  const result = JSON.parse(cleaned);

  if (!result || (result.verdict !== 'pass' && result.verdict !== 'fail') || !Array.isArray(result.findings)) {
    throw new Error(`fact-check returned an unexpected shape: ${cleaned.slice(0, 200)}`);
  }
  // Enforce the verdict rule ourselves rather than trusting the model's own
  // bookkeeping: any blocking finding means fail, no blocking findings means
  // the stated verdict stands.
  const hasBlocking = result.findings.some(f => f.severity === 'blocking');
  result.verdict = hasBlocking ? 'fail' : result.verdict;
  return result;
}

// ─── Week folder resolution ──────────────────────────────────────────────────

async function resolveWeekFolder(argFolder) {
  if (argFolder) {
    const p = path.join(DRAFTS_DIR, argFolder);
    if (!existsSync(path.join(p, '_manifest.json'))) {
      throw new Error(`drafts/${argFolder}/_manifest.json not found`);
    }
    return argFolder;
  }
  const entries = await fs.readdir(DRAFTS_DIR, { withFileTypes: true });
  const candidates = entries
    .filter(e => e.isDirectory() && existsSync(path.join(DRAFTS_DIR, e.name, '_manifest.json')))
    .map(e => e.name)
    .sort();
  if (!candidates.length) throw new Error('No drafts folder with a _manifest.json found');
  return candidates[candidates.length - 1];
}

// ─── Live URL helper ─────────────────────────────────────────────────────────

function liveUrlFor(entry) {
  if (entry.contentType === 'trends-article') {
    return `${SITE_BASE}/trends/view-article.html?article=${path.basename(entry.filename, '.json')}`;
  }
  if (entry.contentType === 'node') {
    return `${SITE_BASE}/`; // the Mind Map — the node appears under its TREE branch
  }
  if (entry.contentType === 'page') {
    return `${SITE_BASE}/`;
  }
  return null;
}

// ─── Published-report email ──────────────────────────────────────────────────

async function sendReportEmail(week, results, commitSha, fatalError) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — skipping published-report email.');
    return;
  }

  const published = results.filter(r => r.status === 'published');
  const held = results.filter(r => r.status === 'held');

  const sections = [];
  sections.push(`llms101.com weekly publish report — week of ${week}`);
  sections.push('');

  if (fatalError) {
    sections.push(`*** PIPELINE ERROR: ${fatalError} ***`);
    sections.push('Items below reflect progress up to the failure point.');
    sections.push('');
  }

  if (published.length) {
    sections.push(`PUBLISHED (${published.length}) — now live, review on the site:`);
    for (const r of published) {
      sections.push(`  • ${r.contentType}: ${r.filename} → ${r.targetPath}`);
      if (r.liveUrl) sections.push(`    live: ${r.liveUrl}`);
      if (r.layout) sections.push(`    map layout: ${r.layout.branch} ${r.layout.before} → ${r.layout.after}`);
      for (const n of r.notes ?? []) sections.push(`    note: ${n}`);
      const noteFindings = (r.factCheck?.findings ?? []).filter(f => f.severity === 'note');
      for (const f of noteFindings) sections.push(`    fact-check note: ${f.claim} — ${f.issue}`);
    }
    sections.push('');
  }

  if (held.length) {
    sections.push(`HELD BACK (${held.length}) — NOT published:`);
    for (const r of held) {
      sections.push(`  • ${r.contentType}: ${r.filename}`);
      for (const reason of r.reasons ?? []) sections.push(`    reason: ${reason}`);
      for (const f of (r.factCheck?.findings ?? [])) {
        sections.push(`    fact-check [${f.severity}]: ${f.claim} — ${f.issue}`);
      }
    }
    sections.push('');
  }

  if (!published.length && !held.length) {
    sections.push('No manifest items were processed.');
    sections.push('');
  }

  if (commitSha) {
    sections.push(`Publish commit: ${commitSha}`);
    sections.push(`  https://github.com/llms-101-cp/llms-101-website/commit/${commitSha}`);
    sections.push('');
    sections.push('To undo the ENTIRE week in one step:');
    sections.push(`  git revert ${commitSha}   (or use the Revert button on the commit page above)`);
  } else if (published.length) {
    sections.push('WARNING: items were placed but no publish commit SHA was captured — check the workflow log.');
  } else {
    sections.push('Nothing was committed this week.');
  }
  sections.push('');
  sections.push(`Status view: ${SITE_BASE}/admin/review.html?week=${week}`);
  sections.push('');
  sections.push('This email is the review trigger — the site is already live with the content above.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'llms101-bot@llms101.com',
      to: process.env.REVIEW_EMAIL,
      subject: `[llms101] Published: week ${week} — ${published.length} live, ${held.length} held${fatalError ? ' — PIPELINE ERROR' : ''}`,
      text: sections.join('\n')
    })
  });

  if (res.ok) log(`Published-report email sent to ${process.env.REVIEW_EMAIL}`);
  else log(`WARNING: report email failed — HTTP ${res.status}`);
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const dryRun = args.includes('--dry-run') || offline; // --offline can never publish
  const folderArg = args.find(a => !a.startsWith('--'));

  const week = await resolveWeekFolder(folderArg);
  const weekDir = path.join(DRAFTS_DIR, week);
  log(`Validate-and-publish for drafts/${week}${dryRun ? ' [DRY RUN]' : ''}${offline ? ' [OFFLINE — fact-check skipped, publish disabled]' : ''}`);

  const manifest = JSON.parse(await fs.readFile(path.join(weekDir, '_manifest.json'), 'utf8'));
  const client = offline ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const results = [];
  let indexHtml = await fs.readFile(INDEX_HTML, 'utf8');
  let indexHtmlDirty = false;
  const filesToStage = [];
  let fatalError = null;
  let commitSha = null;

  try {
    for (const entry of manifest) {
      const result = {
        filename: entry.filename,
        contentType: entry.contentType,
        targetPath: entry.targetPath,
        note: entry.note ?? null,
        status: 'held',
        reasons: [],
        notes: [],
        factCheck: null,
        layout: null,
        liveUrl: null
      };
      results.push(result);

      // Model cards never auto-publish: models.html is a shared hand-coded
      // file with no dynamic system.
      if (entry.contentType === 'model-card') {
        result.reasons.push('model cards are manual-paste only (models.html is a shared hand-coded file — see ARCHITECTURE.md); review and paste by hand');
        continue;
      }

      // Load + JSON-parse the draft.
      let data;
      try {
        data = JSON.parse(await fs.readFile(path.join(weekDir, entry.filename), 'utf8'));
      } catch (err) {
        result.reasons.push(`draft file failed to load/parse: ${err.message}`);
        continue;
      }

      // a. Schema validation.
      const schema = validateSchema(entry, data);
      result.notes.push(...schema.notes);
      if (!schema.ok) {
        result.reasons.push(...schema.blocking);
        continue;
      }

      // Node-specific pre-checks before spending an API call.
      if (entry.contentType === 'node') {
        if (!entry.targetBranch) {
          result.reasons.push('manifest has no targetBranch (or it is null) — generation could not determine a branch confidently, and the publisher never guesses');
          continue;
        }
        if (!VALID_TARGET_BRANCHES.includes(entry.targetBranch)) {
          result.reasons.push(`targetBranch '${entry.targetBranch}' is not a publishable branch (${VALID_TARGET_BRANCHES.join(', ')})`);
          continue;
        }
      }

      // b. Fact-check pass.
      if (offline) {
        result.factCheck = { verdict: 'skipped-offline', findings: [] };
        result.notes.push('fact-check skipped (--offline dev run — publishing disabled)');
      } else {
        try {
          result.factCheck = await factCheck(client, entry, data);
        } catch (err) {
          result.reasons.push(`fact-check pass errored: ${err.message} — holding back rather than publishing unverified content`);
          continue;
        }
        if (result.factCheck.verdict === 'fail') {
          result.reasons.push('fact-check FAILED — see findings');
          continue;
        }
      }

      // c + d. Node-only: layout simulation, then guarded TREE splice.
      if (entry.contentType === 'node') {
        const nodeId = path.basename(entry.filename, '.json');
        const { tree } = parseTreeFromHtml(indexHtml);
        const beforeShape = rowShape((tree[entry.targetBranch] ?? []).length);

        const simTree = { ...tree, [entry.targetBranch]: [...(tree[entry.targetBranch] ?? []), nodeId] };
        const sim = simulateBranchLayout(simTree, entry.targetBranch);
        if (!sim.ok) {
          result.reasons.push(...sim.problems.map(p => `layout simulation: ${p}`));
          continue;
        }
        result.layout = { branch: entry.targetBranch, before: beforeShape, after: sim.shape };

        // Place the node JSON first — guard 6 requires the published id's
        // file to exist. In dry-run, simulate placement for the guard by
        // writing nothing and waiving only that one existence check is NOT
        // acceptable (guards are guards), so dry-run stages a temp copy.
        const targetAbs = path.join(REPO_ROOT, entry.targetPath);
        if (!dryRun) {
          await fs.mkdir(path.dirname(targetAbs), { recursive: true });
          await fs.copyFile(path.join(weekDir, entry.filename), targetAbs);
        } else if (!existsSync(targetAbs)) {
          // Dry run: place the file, then remember to remove it afterwards.
          await fs.mkdir(path.dirname(targetAbs), { recursive: true });
          await fs.copyFile(path.join(weekDir, entry.filename), targetAbs);
          result._dryRunPlacedFile = targetAbs;
        }

        const splice = await guardedTreeSplice(indexHtml, entry.targetBranch, nodeId);
        if (!splice.ok) {
          result.reasons.push(...splice.problems.map(p => `TREE splice guard: ${p}`));
          // Roll back the placed node file so a failed splice leaves nothing behind.
          if (!dryRun) await fs.rm(targetAbs, { force: true });
          continue;
        }

        indexHtml = splice.newHtml;
        indexHtmlDirty = true;
        filesToStage.push(entry.targetPath, 'index.html');
        result.status = 'published';
        result.liveUrl = liveUrlFor(entry);
        continue;
      }

      // e. Placement for articles and pages.
      const targetAbs = path.join(REPO_ROOT, entry.targetPath);
      if (!dryRun) {
        await fs.mkdir(path.dirname(targetAbs), { recursive: true });
        await fs.copyFile(path.join(weekDir, entry.filename), targetAbs);
      }
      filesToStage.push(entry.targetPath);
      result.status = 'published';
      result.liveUrl = liveUrlFor(entry);
    }

    // Write the (possibly spliced) index.html once, after all items.
    if (indexHtmlDirty && !dryRun) {
      await fs.writeFile(INDEX_HTML, indexHtml, 'utf8');
      log('index.html updated (TREE splice applied)');
    }

    // Publish report file — committed alongside the content so the
    // dashboard's read-only status view can render it.
    const report = {
      week,
      generatedAt: new Date().toISOString(),
      dryRun,
      items: results.map(({ _dryRunPlacedFile, ...r }) => r)
    };
    const reportRel = `llms101-automation/drafts/${week}/_publish_report.json`;
    if (!dryRun) {
      await fs.writeFile(path.join(REPO_ROOT, reportRel), JSON.stringify(report, null, 2), 'utf8');
      filesToStage.push(reportRel);
    } else {
      console.log('\n===== DRY RUN REPORT =====\n' + JSON.stringify(report, null, 2));
    }

    // One commit for the whole week — the audit trail and single revert point.
    const published = results.filter(r => r.status === 'published');
    if (!dryRun && published.length) {
      const counts = {};
      for (const r of published) counts[r.contentType] = (counts[r.contentType] ?? 0) + 1;
      const countsText = Object.entries(counts)
        .map(([t, n]) => `${n} ${t.replace('trends-article', 'article')}${n > 1 ? 's' : ''}`)
        .join(', ');
      git('add', ...new Set(filesToStage));
      git('commit', '-m', `publish: weekly content ${week} (${countsText})`);
      commitSha = git('rev-parse', 'HEAD');
      git('push', 'origin', 'HEAD:main');
      log(`Publish commit ${commitSha} pushed to main`);
    } else if (!dryRun) {
      // Nothing publishable — still commit the report so the dashboard shows why.
      git('add', reportRel);
      try {
        git('commit', '-m', `publish: weekly content ${week} (nothing published — all items held)`);
        commitSha = git('rev-parse', 'HEAD');
        git('push', 'origin', 'HEAD:main');
      } catch {
        log('No changes to commit (report unchanged).');
      }
    }
  } catch (err) {
    fatalError = err.message;
    log(`FATAL: ${err.message}`);
  } finally {
    // Clean up any dry-run-placed node files.
    for (const r of results) {
      if (r._dryRunPlacedFile) await fs.rm(r._dryRunPlacedFile, { force: true });
    }
  }

  // The email is Craig's review trigger — it must send even on partial failure.
  if (!dryRun) {
    try {
      await sendReportEmail(week, results, commitSha, fatalError);
    } catch (err) {
      log(`WARNING: report email threw: ${err.message}`);
    }
  }

  const publishedCount = results.filter(r => r.status === 'published').length;
  const heldCount = results.filter(r => r.status === 'held').length;
  log(`Done. ${publishedCount} published, ${heldCount} held back.${dryRun ? ' (dry run — nothing written)' : ''}`);

  if (fatalError) process.exit(1);
}

// Only auto-run when executed directly (not when imported for tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
