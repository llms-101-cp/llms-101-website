/**
 * llms101.com — Weekly Content Generation (Two-Track System, v5)
 *
 * TRACK 1 (low risk): Mind Map nodes + static pages → JSON files.
 *
 * TRACK 2 (rebuilt): Trends articles now generate as a SINGLE JSON file
 *   matching the real, confirmed-working Decap CMS schema:
 *     content/articles/{slug}.json
 *   This is picked up automatically by the existing indexing.yml workflow,
 *   which rebuilds articles_index.json, which trends.html and
 *   view-article.html both read. No HTML generation, no CSS template to
 *   reproduce, no truncation risk — just a JSON object.
 *
 *   Model cards remain a single HTML block, copy-paste only, since
 *   models.html is a genuinely different shared-file situation.
 *
 * v6 (2026-07-04): generation-time changes for the validate-and-publish
 *   pipeline (see scripts/validate-and-publish.js):
 *   - All content-generation API calls now run with the web_search tool
 *     enabled (same pattern as generate-tracker.js) so drafts are grounded
 *     in current facts, not training-data memory — this attacks the
 *     staleness problem at the source.
 *   - Node drafts now carry a `targetBranch` manifest field naming the
 *     TREE.{branch} array in index.html the node belongs to, derived
 *     deterministically from the calendar entry's theme. If no branch can
 *     be determined confidently it is emitted as null, which the publisher
 *     treats as a validation failure — never a guess.
 *   - The "drafts ready for review" email is gone: validate-and-publish.js
 *     now sends the single published-report email instead.
 *
 * Run: node scripts/generate.js
 * Env: ANTHROPIC_API_KEY
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { buildNodePrompt, buildPagePrompt } from '../prompts/track1-json.js';
import { buildTrendsArticlePrompt, buildModelCardPrompt } from '../prompts/track2-trends.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Real, currently-existing standalone Trends articles in trends/ — used so
// Claude can reference them by name in prose where relevant. These are
// separate from the JSON-driven articles and unaffected by this pipeline.
const EXISTING_TRENDS_SLUGS = [
  'agentic-ai-explained',
  'ai-cost-collapse',
  'context-window-arms-race',
  'deepseek-r1-what-it-proved',
  'reasoning-models-explained',
  'state-of-llms-q2-2026'
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function slugify(str) {
  return (str || 'untitled')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function readCalendar() {
  const raw = await fs.readFile(path.join(ROOT, 'content-calendar/calendar.json'), 'utf8');
  return JSON.parse(raw);
}

async function writeCalendar(calendar) {
  await fs.writeFile(
    path.join(ROOT, 'content-calendar/calendar.json'),
    JSON.stringify(calendar, null, 2),
    'utf8'
  );
}

// ─── Claude API calls ─────────────────────────────────────────────────────────

// Server-side web_search tool, same pattern generate-tracker.js already uses.
// With this enabled the model emits an early "I'll research..." text block
// before its first search, then the real output in a later text block — so
// callers must use the LAST text block, never content[0].
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search' };

function lastTextBlock(message) {
  const textBlocks = message.content.filter(b => b.type === 'text').map(b => b.text);
  return (textBlocks[textBlocks.length - 1] ?? '').trim();
}

// Extract the first complete {...} object from text, tracking brace depth.
// Same reasoning as generate-tracker.js's extractJsonArray: a greedy regex
// mis-extracts when the model appends citation-style trailing brackets after
// the JSON closes, which is plausible with web_search enabled.
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

async function generateJSON(prompt, label, maxTokens = 3500) {
  log(`Generating (web_search enabled): ${label}`);
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: maxTokens,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    tools: [WEB_SEARCH_TOOL]
  });
  const raw = lastTextBlock(message);
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const cleaned = extractJsonObject(fenceStripped) ?? fenceStripped;

  if (message.stop_reason === 'max_tokens') {
    log(`WARNING: "${label}" hit the token limit and may be truncated.`);
    await saveError(label, raw + '\n\n[POSSIBLY TRUNCATED — stop_reason: max_tokens]');
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    log(`ERROR: JSON parse failed for "${label}"`);
    await saveError(label, raw);
    throw err;
  }
}

async function generateHTML(prompt, label) {
  log(`Generating (web_search enabled): ${label}`);
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    tools: [WEB_SEARCH_TOOL]
  });

  if (message.stop_reason === 'max_tokens') {
    log(`WARNING: HTML generation for "${label}" hit the token limit and was truncated.`);
    await saveError(label, lastTextBlock(message) + '\n\n[TRUNCATED — stop_reason: max_tokens]');
    throw new Error(`Generation truncated for ${label}`);
  }

  const raw = lastTextBlock(message);
  const cleaned = raw.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '').trim();
  return cleaned;
}

async function saveError(label, raw) {
  const errorDir = path.join(ROOT, 'drafts/errors');
  await fs.mkdir(errorDir, { recursive: true });
  await fs.writeFile(
    path.join(errorDir, `error-${Date.now()}.txt`),
    `LABEL: ${label}\n\nRAW:\n${raw}`,
    'utf8'
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Track 1: JSON drafts ─────────────────────────────────────────────────────

// Deterministic theme → TREE.{branch} mapping for the publisher's TREE splice.
// `roles` is deliberately absent: TREE.roles is hardcoded in index.html and
// excluded from loadCMSData()'s fetch list, so a dynamically published roles
// node would never load — the publisher must refuse it, not guess.
// If the calendar entry's theme isn't in this map, targetBranch is null and
// validate-and-publish.js treats that as a validation failure for the node.
const THEME_TO_TREE_BRANCH = {
  math: 'math',
  train: 'training',
  arch: 'arch',
  prompt: 'prompting',
  theme: 'themes'
};

async function runTrack1(weekOf, calendarEntry) {
  const drafts = [];

  if (calendarEntry.node) {
    try {
      const prompt = buildNodePrompt(
        calendarEntry.node.id,
        calendarEntry.node.parentContext,
        calendarEntry.node.theme
      );
      const content = await generateJSON(prompt, `node: ${calendarEntry.node.id}`);
      const targetBranch = THEME_TO_TREE_BRANCH[calendarEntry.node.theme] ?? null;
      if (targetBranch === null) {
        log(`WARNING: no TREE branch could be derived from theme "${calendarEntry.node.theme}" — emitting targetBranch: null (publisher will hold this node back).`);
      }
      drafts.push({
        track: 1,
        contentType: 'node',
        targetPath: `content/nodes/${calendarEntry.node.id}.json`,
        filename: `${calendarEntry.node.id}.json`,
        data: content,
        targetBranch,
        extraStep: `Publisher adds '${calendarEntry.node.id}' to TREE.${targetBranch ?? '{branch}'} in index.html automatically (validate-and-publish.js).`
      });
    } catch (err) {
      log(`ERROR generating node: ${err.message}`);
    }
    await sleep(2000);
  }

  if (calendarEntry.page) {
    try {
      const prompt = buildPagePrompt(calendarEntry.page.id, calendarEntry.page.updateBrief);
      const content = await generateJSON(prompt, `page: ${calendarEntry.page.id}`);
      drafts.push({
        track: 1,
        contentType: 'page',
        targetPath: `content/pages/${calendarEntry.page.id}.json`,
        filename: `${calendarEntry.page.id}.json`,
        data: content
      });
    } catch (err) {
      log(`ERROR generating page: ${err.message}`);
    }
    await sleep(2000);
  }

  return drafts;
}

// ─── Track 2: Trends articles (single JSON) + Model cards (HTML block) ──────

async function runTrack2(weekOf, calendarEntry) {
  const drafts = [];

  if (calendarEntry.trendsArticle) {
    const topic = calendarEntry.trendsArticle.topic;
    const notes = calendarEntry.trendsArticle.notes;

    try {
      const prompt = buildTrendsArticlePrompt(topic, notes, EXISTING_TRENDS_SLUGS);
      const articleData = await generateJSON(prompt, `trends article: ${topic}`, 3000);
      const slug = articleData.slug || slugify(topic);

      drafts.push({
        track: 2,
        contentType: 'trends-article',
        targetPath: `content/articles/${slug}.json`,
        filename: `${slug}.json`,
        data: articleData,
        requiresVisualReview: true,
        note: 'Upload this single file to content/articles/. The existing indexing.yml workflow rebuilds articles_index.json automatically, and the article becomes visible on /trends within a minute or two.'
      });
    } catch (err) {
      log(`ERROR generating trends article: ${err.message}`);
    }
    await sleep(2000);
  }

  if (calendarEntry.modelCard) {
    try {
      const prompt = buildModelCardPrompt(
        calendarEntry.modelCard.name,
        calendarEntry.modelCard.maker,
        calendarEntry.modelCard.notes
      );
      const html = await generateHTML(prompt, `model card: ${calendarEntry.modelCard.name}`);
      drafts.push({
        track: 2,
        contentType: 'model-card',
        targetPath: 'models.html (manual paste into #model-grid)',
        filename: `model-card-${slugify(calendarEntry.modelCard.name)}.html`,
        html,
        requiresVisualReview: true,
        requiresManualPaste: true
      });
    } catch (err) {
      log(`ERROR generating model card: ${err.message}`);
    }
    await sleep(2000);
  }

  return drafts;
}

// ─── Save drafts ───────────────────────────────────────────────────────────────

async function saveDrafts(weekOf, drafts) {
  const dir = path.join(ROOT, 'drafts', weekOf);
  await fs.mkdir(dir, { recursive: true });

  const manifestEntries = [];

  for (const draft of drafts) {
    if (draft.track === 1 || draft.contentType === 'trends-article') {
      await fs.writeFile(path.join(dir, draft.filename), JSON.stringify(draft.data, null, 2), 'utf8');
      log(`Saved: drafts/${weekOf}/${draft.filename}`);
      manifestEntries.push({
        track: draft.track,
        contentType: draft.contentType,
        targetPath: draft.targetPath,
        filename: draft.filename,
        requiresVisualReview: draft.requiresVisualReview || false,
        extraStep: draft.extraStep || null,
        note: draft.note || null,
        // Only meaningful for nodes; null means "generation could not
        // determine a branch confidently" and the publisher holds it back.
        ...(draft.contentType === 'node' ? { targetBranch: draft.targetBranch ?? null } : {})
      });
    } else {
      await fs.writeFile(path.join(dir, draft.filename), draft.html, 'utf8');
      log(`Saved: drafts/${weekOf}/${draft.filename}`);
      manifestEntries.push({
        track: 2,
        contentType: draft.contentType,
        targetPath: draft.targetPath,
        filename: draft.filename,
        requiresVisualReview: draft.requiresVisualReview || false,
        requiresManualPaste: draft.requiresManualPaste || false
      });
    }
  }

  await fs.writeFile(
    path.join(dir, '_manifest.json'),
    JSON.stringify(manifestEntries, null, 2),
    'utf8'
  );
}

// ─── Planner-failure email (final resort — the planner replaced the old
// empty-calendar hard failure, but if the planner itself errors Craig
// still needs to hear about it) ───────────────────────────────────────────────

async function sendPlannerFailureEmail(reason) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — cannot send planner-failure notification.');
    return;
  }
  const body = `Nothing was generated this week.

The calendar queue was empty and the self-planning stage failed:

  ${reason}

No content was generated and nothing was published. Fix the cause (or
just queue a week in llms101-automation/content-calendar/calendar.json —
a hand-queued week always wins) and re-run the workflow.

This is an automated message from the llms101 content pipeline.`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'llms101-bot@llms101.com',
      to: process.env.REVIEW_EMAIL,
      subject: '[llms101] Weekly run: nothing generated — planner failed',
      text: body
    })
  });
  if (res.ok) log('Planner-failure email sent.');
  else log(`WARNING: planner-failure email failed — HTTP ${res.status}: ${await res.text().catch(() => '(no body)')}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting weekly content generation (v5 — Trends articles as JSON)');

  const calendar = await readCalendar();
  if (calendar.weeks.length === 0) {
    // Self-planning stage (2026-07-05): queue > backlog > self-plan.
    // Hand-queued weeks always win — this only runs when the queue is
    // empty. Fail-stop: a planning/validation failure emails Craig and
    // exits; it never retry-loops and never generates from an invalid plan.
    log('Calendar queue is empty — invoking the self-planning stage (queue > backlog > self-plan).');
    try {
      const { planWeek } = await import('./plan-week.js');
      const planned = await planWeek();
      calendar.weeks.unshift(planned.weekEntry);
      if (planned.consumeBacklog) await planned.consumeBacklog();
      log(`Planned week ${planned.weekEntry.week_of} (source: ${planned.plannedBy}). Rationale: ${planned.rationale}`);
    } catch (err) {
      log(`ERROR: self-planning failed — ${err.message}`);
      await sendPlannerFailureEmail(err.message);
      process.exit(1);
    }
  }

  const weekEntry = calendar.weeks[0];
  const weekOf = weekEntry.week_of;
  log(`Generating content for week of ${weekOf}`);

  const track1Drafts = await runTrack1(weekOf, weekEntry);
  const track2Drafts = await runTrack2(weekOf, weekEntry);
  const allDrafts = [...track1Drafts, ...track2Drafts];

  if (allDrafts.length === 0) {
    // Every track that was scheduled produced an error (API failure, parse
    // failure, etc.) — there is nothing to publish. Do NOT advance the
    // calendar (the week entry stays in weeks[] for the next retry), and
    // exit 1 so the workflow step fails loudly rather than falling through
    // to validate-and-publish picking up a stale folder.
    log('FATAL: All content generation failed this week — 0 drafts written. The week entry remains in the queue for retry. Exiting 1.');
    process.exit(1);
  }

  await saveDrafts(weekOf, allDrafts);

  // Sentinel read by validate-and-publish's resolveWeekFolder so it knows
  // which week was just produced and refuses to fall back to an older folder.
  await fs.writeFile(path.join(ROOT, 'drafts', '.last-generated-week'), weekOf, 'utf8');

  calendar.weeks.shift();
  calendar.completed = calendar.completed || [];
  calendar.completed.push({ ...weekEntry, _completed_at: new Date().toISOString() });
  await writeCalendar(calendar);

  // No email here any more: validate-and-publish.js sends the single
  // published-report email after the publish step, covering both what went
  // live and what was held back (and why).
  log(`Done. ${allDrafts.length} draft item(s) generated for week of ${weekOf}.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
