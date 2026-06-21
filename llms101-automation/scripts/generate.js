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
 * Run: node scripts/generate.js
 * Env: ANTHROPIC_API_KEY, RESEND_API_KEY, REVIEW_EMAIL
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

async function generateJSON(prompt, label, maxTokens = 2500) {
  log(`Generating: ${label}`);
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: maxTokens,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }]
  });
  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

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
  log(`Generating: ${label}`);
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }]
  });

  if (message.stop_reason === 'max_tokens') {
    log(`WARNING: HTML generation for "${label}" hit the token limit and was truncated.`);
    await saveError(label, message.content[0].text + '\n\n[TRUNCATED — stop_reason: max_tokens]');
    throw new Error(`Generation truncated for ${label}`);
  }

  const raw = message.content[0].text.trim();
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
      drafts.push({
        track: 1,
        contentType: 'node',
        targetPath: `content/nodes/${calendarEntry.node.id}.json`,
        filename: `${calendarEntry.node.id}.json`,
        data: content,
        extraStep: `Also add '${calendarEntry.node.id}' to the correct TREE.{branch} array in index.html, or it won't appear on the map.`
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
        note: draft.note || null
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

// ─── Review email ──────────────────────────────────────────────────────────────

async function sendReviewEmail(weekOf, drafts) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — skipping notification.');
    return;
  }

  const lines = drafts.map(d => `  • ${d.contentType}: ${d.filename} → ${d.targetPath}`);

  const body = `
Your weekly llms101.com content is ready for review.

Week of: ${weekOf}

${lines.join('\n') || '(no drafts generated)'}

Trends articles are now a single JSON file — upload to content/articles/
and the existing indexing.yml workflow handles the rest automatically.

Review here: https://llms101.com/admin/review?week=${weekOf}

This is an automated message from the llms101 content pipeline.
  `.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'llms101-bot@llms101.com',
      to: process.env.REVIEW_EMAIL,
      subject: `[llms101] Weekly content ready — ${drafts.length} item(s)`,
      text: body
    })
  });

  if (res.ok) log(`Review email sent to ${process.env.REVIEW_EMAIL}`);
  else log(`WARNING: Email failed — ${res.status}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting weekly content generation (v5 — Trends articles as JSON)');

  const calendar = await readCalendar();
  if (calendar.weeks.length === 0) {
    log('ERROR: Content calendar is empty.');
    process.exit(1);
  }

  const weekEntry = calendar.weeks[0];
  const weekOf = weekEntry.week_of;
  log(`Generating content for week of ${weekOf}`);

  const track1Drafts = await runTrack1(weekOf, weekEntry);
  const track2Drafts = await runTrack2(weekOf, weekEntry);
  const allDrafts = [...track1Drafts, ...track2Drafts];

  if (allDrafts.length === 0) {
    log('WARNING: No drafts were generated this week.');
  } else {
    await saveDrafts(weekOf, allDrafts);
  }

  calendar.weeks.shift();
  calendar.completed = calendar.completed || [];
  calendar.completed.push({ ...weekEntry, _completed_at: new Date().toISOString() });
  await writeCalendar(calendar);

  await sendReviewEmail(weekOf, allDrafts);

  log(`Done. ${allDrafts.length} draft item(s) generated for week of ${weekOf}.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
