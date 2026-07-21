/**
 * llms101.com — Monthly Model Tracker Refresh
 *
 * Run: node scripts/generate-tracker.js
 * Env: ANTHROPIC_API_KEY
 *
 * What this does NOT do: auto-merge anything. It writes a new tracker.html
 * to disk on a fresh branch; the GitHub Action wrapper (see
 * .github/workflows/monthly-tracker-refresh.yml) commits, pushes, and opens
 * a PR. A human still clicks merge. See ARCHITECTURE.md "Model Tracker
 * automation" section for why that checkpoint stays — getting AI model
 * rankings publicly wrong is the kind of mistake that's both likely
 * (model landscape changes weekly) and visible (it's a public page), and
 * the human review step costs about 30 seconds per month.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { buildModelTrackerPrompt, validateTrackerRows, TRACKER_ROW_COUNT } from '../prompts/track2-trends.js';
import { appendToChangelog } from './changelog-append.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..'); // repo root (this file lives in llms101-automation/scripts/)
const TRACKER_PATH = path.join(ROOT, 'tracker.html');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Ordinal date formatting for the "Updated" hero badge ──────────────────
// Matches the site-wide ordinal format adopted 2026-07-21 (e.g. "27th June
// 2026") — see ARCHITECTURE.md's fortnightly review section. This is a
// small local copy rather than a shared import: tracker.html/models.html's
// equivalent formatter lives inline in browser <script> blocks with no
// module system to import from, so every copy is kept in manual sync.
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function formatOrdinalDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${ordinal(d.getUTCDate())} ${d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

// ─── HTML-escape any model-generated text before it touches the template ───
// This is not cosmetic: row text comes from an LLM response, not a trusted
// constant. An unescaped &, <, or > in a model name or best_for sentence
// (e.g. "Pro & Flash variants", "scores <5% on X") would silently corrupt
// the page's HTML rather than fail loudly — caught by testing against real
// data, where "Speed & cost leader" round-tripped as a raw & instead of the
// &amp; the original hand-written file used.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Render one row's data into the exact HTML structure tracker.html uses ──

export function renderTrackerRow(row) {
  const rankSpanClass = row.is_top3 ? 'rank-num top' : 'rank-num';
  const tierLabelEsc = escapeHtml(row.tier_label);
  const tierBadgeText = row.tier_emoji ? `${row.tier_emoji} ${tierLabelEsc}` : tierLabelEsc;
  const nameEsc = escapeHtml(row.name);
  const urlEsc = escapeHtml(row.homepage_url);
  const familyEsc = escapeHtml(row.family);
  const flagshipEsc = escapeHtml(row.flagship);
  const bestForEsc = escapeHtml(row.best_for);

  return `    <!-- #${row.rank} ${nameEsc} -->
    <div class="trow" data-tags="${row.tags}">
      <div class="rank-col"><span class="${rankSpanClass}">${row.rank}</span></div>
      <div class="trow-main">
        <div class="trow-left">
          <div class="model-family">${familyEsc}</div>
          <div class="model-name"><a href="${urlEsc}" target="_blank" rel="noopener">${nameEsc}</a></div>
          <div class="model-flagship">${flagshipEsc}</div>
          <span class="tier-badge ${row.tier_class}">${tierBadgeText}</span>
        </div>
        <div class="trow-right">
          <div class="bestfor-mini-label">Best for</div>
          <div class="bestfor-mini">${bestForEsc}</div>
        </div>
      </div>
      <div class="trow-meta">
        <span class="cost-vibe ${row.cost_class}">${row.cost_label}</span>
        <span class="open-badge">${row.open_badge}</span>
      </div>
    </div>`;
}

export function renderTrackerList(rows) {
  return rows.map(renderTrackerRow).join('\n\n');
}

// ─── Build the animation-delay CSS rules for however many rows we have ─────

export function buildAnimationDelayCSS(rowCount) {
  const lines = [];
  for (let i = 1; i <= rowCount; i++) {
    // Match the original file's CSS style exactly: ".04s" not "0.04s"
    const delay = (i * 0.04).toFixed(2).replace(/^0\./, '.');
    lines.push(`.trow:nth-child(${i}){animation-delay:${delay}s}`);
  }
  return lines.join('\n');
}

// ─── Splice rendered rows + updated CSS + dateModified into tracker.html ───

export function applyTrackerUpdate(currentHTML, rows, todayISO) {
  // Replace the tracker-list contents using a regex so LF/CRLF both work
  const listRegex = /(<div class="tracker-list" id="tracker-list">)([\s\S]*?)(\r?\n\s*<\/div><!-- \/tracker-list -->)/;
  if (!listRegex.test(currentHTML)) {
    throw new Error('Could not find tracker-list block in tracker.html — has the page structure changed?');
  }
  const newListInner = '\n\n' + renderTrackerList(rows);
  let updated = currentHTML.replace(listRegex, (_, open, _content, close) => open + newListInner + close);

  // Replace the per-row animation-delay rules. They live as a contiguous
  // block of `.trow:nth-child(N){animation-delay:...}` lines in the <style>.
  const delayBlockRegex = /(\.trow:nth-child\(\d+\)\{animation-delay:[\d.]+s\}\r?\n?)+/;
  const newDelayBlock = buildAnimationDelayCSS(rows.length) + '\n';
  if (!delayBlockRegex.test(updated)) {
    throw new Error('Could not find the .trow:nth-child animation-delay block in tracker.html — has the CSS changed?');
  }
  updated = updated.replace(delayBlockRegex, newDelayBlock);

  // Update dateModified in the JSON-LD block
  updated = updated.replace(/"dateModified":\s*"[\d-]+"/, `"dateModified": "${todayISO}"`);

  // Update the "Updated ..." hero badge so it never drifts out of sync with
  // the row content it describes (previously a static, hand-edited string
  // that this script never touched — fixed 2026-07-21).
  const badgeRegex = /(<span class="updated-badge">Updated )[^<]*(<\/span>)/;
  if (!badgeRegex.test(updated)) {
    throw new Error('Could not find the .updated-badge span in tracker.html — has the hero markup changed?');
  }
  updated = updated.replace(badgeRegex, (_, open, close) => `${open}${formatOrdinalDate(todayISO)}${close}`);

  return updated;
}

// ─── Extract the first complete [...] array from text, tracking bracket depth ─
// A greedy regex like /(\[[\s\S]*\])/ mis-extracts when the model appends
// trailing citation-style brackets after the JSON array (plausible with
// web_search enabled). This walks the string character-by-character so it
// stops at exactly the closing bracket that matches the opening one.

function extractJsonArray(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0, inString = false, escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// ─── Anthropic API call with web_search enabled ─────────────────────────────

async function generateTrackerRows(previousRowsSummary) {
  const prompt = buildModelTrackerPrompt(previousRowsSummary);
  log('Calling Anthropic API with web_search enabled...');

  const message = await client.messages.create({
    model: 'claude-opus-4-8', // verified current as of 2026-06-27 — re-check this against
                              // docs.claude.com if this script hasn't run in a while and
                              // errors with a model-not-found message; Anthropic ships new
                              // Opus versions roughly every 6-10 weeks
    max_tokens: 4000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
  });

  if (message.stop_reason === 'max_tokens') {
    throw new Error('Generation hit max_tokens — likely truncated. Not safe to parse.');
  }

  // With web_search enabled the model emits an early text block ("I'll research...")
  // before its first tool call, then the final JSON in a later text block after
  // all searches complete. Use only the LAST text block so we don't prepend prose
  // to the JSON, then strip any code-fence wrapper and extract the bare array.
  const textBlocks = message.content.filter(b => b.type === 'text').map(b => b.text);
  const lastText = (textBlocks[textBlocks.length - 1] ?? '').trim();
  const fenceStripped = lastText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  // Belt-and-suspenders: if any leading/trailing prose survived, extract the array
  // using bracket-depth counting rather than a greedy regex (which would mis-extract
  // if the model appends citation-style brackets after the JSON array closes).
  const cleaned = extractJsonArray(fenceStripped) ?? fenceStripped;

  let rows;
  try {
    rows = JSON.parse(cleaned);
  } catch (err) {
    log('ERROR: JSON parse failed. Raw response saved to drafts/errors/.');
    await saveError(lastText);
    throw err;
  }

  validateTrackerRows(rows); // throws on any schema problem — caller does not catch this
  rows.sort((a, b) => a.rank - b.rank);
  return rows;
}

async function saveError(raw) {
  const errorDir = path.join(ROOT, 'llms101-automation', 'drafts', 'errors');
  await fs.mkdir(errorDir, { recursive: true });
  await fs.writeFile(
    path.join(errorDir, `tracker-error-${Date.now()}.txt`),
    raw,
    'utf8'
  );
}

// ─── Summarize current rows from the live file, to feed back to the model ──
// so it knows what it's checking for staleness against, rather than
// re-researching from a blank slate every month.

function extractCurrentRowsSummary(html) {
  // model-name may contain a plain text node or <a href="...">name</a> — strip any inner tags
  const names = [...html.matchAll(/<div class="model-name">([\s\S]*?)<\/div>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const families = [...html.matchAll(/<div class="model-family">([^<]*)<\/div>/g)].map(m => m[1]);
  return families.map((f, i) => `- ${f}: ${names[i]}`).join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting monthly Model Tracker refresh');

  const currentHTML = await fs.readFile(TRACKER_PATH, 'utf8');
  const previousRowsSummary = extractCurrentRowsSummary(currentHTML);
  log(`Current lineup before refresh:\n${previousRowsSummary}`);

  const rows = await generateTrackerRows(previousRowsSummary);
  log(`Got ${rows.length} validated rows. New lineup:\n${rows.map(r => `  #${r.rank} ${r.family} — ${r.name}`).join('\n')}`);

  const todayISO = new Date().toISOString().slice(0, 10);
  const updatedHTML = applyTrackerUpdate(currentHTML, rows, todayISO);

  await fs.writeFile(TRACKER_PATH, updatedHTML, 'utf8');
  log(`Wrote updated tracker.html (dateModified: ${todayISO})`);

  // Append a changelog entry so the tracker PR includes a /updates line.
  // The workflow stages content/changelog.json alongside tracker.html.
  // Fail-soft: a failed append is logged but does not abort the run.
  const modelNames = rows.slice(0, 3).map(r => r.name).join(', ');
  const cl = await appendToChangelog(
    [{ area: 'Tracker', text: `Monthly Model Tracker updated — top models include ${modelNames} and ${rows.length - 3} more.` }],
    todayISO,
    ROOT,
    { log }
  );
  if (cl.warning) {
    log(`WARNING: changelog append skipped — ${cl.warning}. Add the entry to /updates manually after merging the PR.`);
  }

  log('Done. The GitHub Action wrapper handles branch/commit/push/PR from here.');
}

// Only auto-run when executed directly (not when imported for tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
