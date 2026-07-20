/**
 * llms101.com — Self-planning stage (added 2026-07-05, Craig's decision:
 * extend the pipeline's autonomy to topic selection, with manual queuing
 * as the standing override).
 *
 * Invoked by generate.js when calendar.weeks[] is empty. Editorial
 * priority, strictly:
 *   1. Queue (calendar.weeks[]) — hand-queued weeks always win. This
 *      module is never reached while the queue has entries.
 *   2. Backlog (content-calendar/topic-backlog.json) — Craig's soft
 *      steering. The top entry is turned into a full week entry.
 *   3. Self-plan — only when queue AND backlog are both empty: one
 *      web_search-enabled planning call proposes the week.
 *
 * The output is schema-identical to a hand-queued week entry (generation
 * cannot tell the difference), plus audit fields: `_planned_by`
 * ("backlog" | "auto") and `rationale` (2-3 sentences). Both ride into
 * calendar completed[] permanently, so every auto-planned week is
 * reviewable after the fact.
 *
 * Fail-stop: if planning or validation fails, the caller sends the
 * "nothing generated this week" email and exits. The planner NEVER
 * retry-loops, and generation never runs on an invalid plan.
 *
 * CLI (editorial safety net — commits nothing, mutates nothing):
 *   node scripts/plan-week.js --plan-only            # real priority order
 *   node scripts/plan-week.js --plan-only --source=auto   # force tier 3
 */

import fs from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTOMATION_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(AUTOMATION_ROOT, '..');
const BACKLOG_PATH = path.join(AUTOMATION_ROOT, 'content-calendar', 'topic-backlog.json');
const CALENDAR_PATH = path.join(AUTOMATION_ROOT, 'content-calendar', 'calendar.json');
const DRAFTS_DIR = path.join(AUTOMATION_ROOT, 'drafts');

// Mirrors THEME_TO_TREE_BRANCH in generate.js — keep in manual sync.
const THEME_TO_TREE_BRANCH = {
  math: 'math',
  train: 'training',
  arch: 'arch',
  prompt: 'prompting',
  theme: 'themes'
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Coverage gathering (from the repo, never from assumptions) ─────────────

function extractTree(html) {
  const anchor = /const TREE = \{/.exec(html);
  if (!anchor) throw new Error('Could not locate const TREE in index.html');
  const start = html.indexOf('{', anchor.index);
  let depth = 0, quote = null, escapeNext = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && quote) { escapeNext = true; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return vm.runInNewContext(`(${html.slice(start, i + 1)})`, {}, { timeout: 2000 });
    }
  }
  throw new Error('Unbalanced TREE block');
}

export async function gatherCoverage() {
  const html = await fs.readFile(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const tree = extractTree(html);
  const treeIds = new Set(Object.values(tree).filter(Array.isArray).flat());

  const nodeFiles = readdirSync(path.join(REPO_ROOT, 'content', 'nodes'))
    .filter(f => f.endsWith('.json'))
    .map(f => path.basename(f, '.json'));

  let articles = [];
  try {
    const idx = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'content', 'articles_index.json'), 'utf8'));
    articles = idx.map(a => ({ title: a.title ?? '', slug: a.slug ?? '' }));
  } catch { /* empty index is fine */ }

  // Permanent standalone Trends pages count as coverage too.
  const standaloneSlugs = readdirSync(path.join(REPO_ROOT, 'trends'))
    .filter(f => f.endsWith('.html') && !f.startsWith('view-'))
    .map(f => path.basename(f, '.html'));

  const calendar = JSON.parse(await fs.readFile(CALENDAR_PATH, 'utf8'));
  const recentCompleted = (calendar.completed ?? []).slice(-8).map(w => ({
    week_of: w.week_of,
    nodeId: w.node?.id ?? null,
    articleTopic: w.trendsArticle?.topic ?? null
  }));

  return { tree, treeIds, nodeFiles, articles, standaloneSlugs, recentCompleted };
}

// ─── Plan validation — generation never runs on an invalid plan ─────────────

function normalize(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Word-set Dice coefficient — "normalized string similarity is enough".
function similarity(a, b) {
  const wa = new Set(normalize(a).split(' ').filter(w => w.length > 2));
  const wb = new Set(normalize(b).split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return (2 * common) / (wa.size + wb.size);
}

export function validatePlan(entry, coverage) {
  const problems = [];

  if (!entry || typeof entry !== 'object') return ['plan is not an object'];
  if (!entry.node && !entry.trendsArticle) {
    problems.push('plan has neither a node nor a trendsArticle — nothing to generate');
  }

  if (entry.node) {
    const { id, theme, parentContext } = entry.node;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id ?? '')) {
      problems.push(`node.id '${id}' is not kebab-case`);
    }
    if (coverage.treeIds.has(id)) {
      problems.push(`node.id '${id}' already exists in TREE`);
    }
    if (coverage.nodeFiles.includes(id)) {
      problems.push(`node.id '${id}' already exists as content/nodes/${id}.json`);
    }
    const branch = THEME_TO_TREE_BRANCH[theme];
    if (!branch) {
      problems.push(`node.theme '${theme}' does not map to a TREE branch (valid: ${Object.keys(THEME_TO_TREE_BRANCH).join(', ')})`);
    } else if (!Array.isArray(coverage.tree[branch])) {
      problems.push(`derived branch '${branch}' does not exist in TREE`);
    }
    if (!parentContext) problems.push('node.parentContext is missing');
  }

  if (entry.trendsArticle) {
    const topic = entry.trendsArticle.topic ?? '';
    if (!topic.trim()) problems.push('trendsArticle.topic is empty');
    if (!entry.trendsArticle.notes) problems.push('trendsArticle.notes is missing');
    const existing = [
      ...coverage.articles.map(a => a.title),
      ...coverage.articles.map(a => a.slug.replace(/-/g, ' ')),
      ...coverage.standaloneSlugs.map(s => s.replace(/-/g, ' ')),
      ...coverage.recentCompleted.map(w => w.articleTopic).filter(Boolean)
    ];
    for (const prior of existing) {
      const score = similarity(topic, prior);
      if (score >= 0.6) {
        problems.push(`trendsArticle.topic '${topic}' near-duplicates existing coverage '${prior}' (similarity ${score.toFixed(2)})`);
      }
    }
  }

  return problems;
}

// ─── week_of label — next Monday, skipping any label that already has a
// drafts folder (labels are queue keys AND folder names; see ARCHITECTURE's
// week_of-is-a-label note) ──────────────────────────────────────────────────

export function computeWeekOf(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 1); // next Monday, strictly future
  let label = d.toISOString().slice(0, 10);
  while (existsSync(path.join(DRAFTS_DIR, label))) {
    d.setUTCDate(d.getUTCDate() + 7);
    label = d.toISOString().slice(0, 10);
  }
  return label;
}

// ─── Tier 3: the self-planning API call ─────────────────────────────────────

function lastTextBlock(message) {
  const blocks = message.content.filter(b => b.type === 'text').map(b => b.text);
  return (blocks[blocks.length - 1] ?? '').trim();
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

async function selfPlan(client, coverage) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const system = `You are the editorial planner for llms101.com — a beginner-friendly guide to
large language models for a smart but NON-TECHNICAL audience. The site
explains; it does not chase researcher news. Today is ${todayISO}. Use the
web_search tool to ground your choice in what actually happened in the AI
world in the last 2-4 weeks that a curious non-technical reader would care
about.`;

  const user = `Plan ONE week of content. Choose a topic that (a) matters to a
non-technical audience right now, (b) the site does not already cover, and
(c) will still be worth reading in a month.

EXISTING MIND MAP NODE IDS (do not duplicate):
${[...coverage.treeIds].join(', ')}

EXISTING ARTICLE TITLES (do not near-duplicate):
${coverage.articles.map(a => `- ${a.title}`).join('\n')}
${coverage.standaloneSlugs.map(s => `- ${s.replace(/-/g, ' ')}`).join('\n')}

RECENTLY COMPLETED WEEKS (avoid repeats and near-repeats):
${coverage.recentCompleted.map(w => `- node: ${w.nodeId ?? '—'} | article: ${w.articleTopic ?? '—'}`).join('\n')}

VALID node.theme VALUES and the map branch each one targets:
${Object.entries(THEME_TO_TREE_BRANCH).map(([t, b]) => `- "${t}" → TREE.${b}`).join('\n')}

Return ONLY valid JSON, no markdown fences, in exactly this shape (omit
"node" entirely — set it to null — if no sensible new map node exists for
the topic; the article is the required part):
{
  "node": { "id": "kebab-case-new-id", "parentContext": "short description of the branch it joins", "theme": "one of the valid values above" } | null,
  "trendsArticle": { "topic": "Article title, plain language", "notes": "2-3 sentence brief for the writer: the angle, what to ground via live search, what to avoid" },
  "rationale": "2-3 sentences: why this topic, why now, for this audience."
}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
  });

  if (message.stop_reason === 'max_tokens') {
    throw new Error('planning call hit max_tokens — not safe to parse');
  }
  const raw = lastTextBlock(message);
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const cleaned = extractJsonObject(fenceStripped) ?? fenceStripped;
  return JSON.parse(cleaned);
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Returns { weekEntry, plannedBy, rationale, consumeBacklog } where
 * weekEntry is schema-identical to a hand-queued calendar entry plus the
 * audit fields. `consumeBacklog()` (present only for backlog-sourced
 * plans) removes the used entry from topic-backlog.json — the caller
 * invokes it only on a real run, never in --plan-only.
 */
export async function planWeek({ client = null, forceSource = null } = {}) {
  const coverage = await gatherCoverage();

  // Tier 2: backlog.
  let backlog = { topics: [] };
  if (existsSync(BACKLOG_PATH)) {
    backlog = JSON.parse(await fs.readFile(BACKLOG_PATH, 'utf8'));
  }

  let source, planned, rationale;
  if (forceSource !== 'auto' && (backlog.topics ?? []).length > 0) {
    source = 'backlog';
    const top = backlog.topics[0];
    planned = { node: top.node ?? null, trendsArticle: top.trendsArticle ?? null };
    rationale = `From the topic backlog: ${top.brief}`;
  } else {
    // Tier 3: self-plan.
    source = 'auto';
    if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    log('Backlog empty (or auto forced) — running the self-planning call (web_search enabled)...');
    const proposal = await selfPlan(client, coverage);
    planned = { node: proposal.node ?? null, trendsArticle: proposal.trendsArticle ?? null };
    rationale = proposal.rationale ?? '(planner returned no rationale)';
  }

  const problems = validatePlan(planned, coverage);
  if (problems.length) {
    throw new Error(`planned week failed validation (source: ${source}): ${problems.join('; ')}`);
  }

  const weekEntry = {
    week_of: computeWeekOf(),
    ...(planned.node ? { node: planned.node } : {}),
    ...(planned.trendsArticle ? { trendsArticle: planned.trendsArticle } : {}),
    _planned_by: source,
    rationale
  };

  const result = { weekEntry, plannedBy: source, rationale };
  if (source === 'backlog') {
    result.consumeBacklog = async () => {
      backlog.topics.shift();
      await fs.writeFile(BACKLOG_PATH, JSON.stringify(backlog, null, 2), 'utf8');
    };
  }
  return result;
}

// ─── CLI: --plan-only (editorial safety net — commits and mutates nothing) ──

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.includes('--plan-only')) {
    console.error('This script is invoked by generate.js. For a dry run, pass --plan-only [--source=auto].');
    process.exit(2);
  }
  const forceSource = args.includes('--source=auto') ? 'auto' : null;
  planWeek({ forceSource })
    .then(({ weekEntry, plannedBy, rationale }) => {
      log(`PROPOSED WEEK (source: ${plannedBy}) — nothing has been committed or consumed:`);
      console.log(JSON.stringify(weekEntry, null, 2));
      log(`Rationale: ${rationale}`);
      log('To make this real: leave the queue empty and let Sunday\'s run consume it, or hand-edit calendar.json to override.');
    })
    .catch(err => {
      console.error('Planning failed (fail-stop, no retry):', err.message);
      process.exit(1);
    });
}
