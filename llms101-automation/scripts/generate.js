/**
 * llms101.com — Weekly Content Generation (Two-Track System)
 *
 * TRACK 1 (low risk): Mind Map nodes + static pages → JSON files,
 *   auto-saved as drafts, reviewed in dashboard, dropped into content/nodes/
 *   or content/pages/ once approved. Matches the site's existing dynamic loader.
 *
 * TRACK 2 (higher risk): Trends articles + Model cards → HTML,
 *   generated from strict templates, MUST be visually previewed before use.
 *   Trends downloads as a standalone file. Model cards are copy-paste only —
 *   never auto-spliced into the shared models.html file.
 *
 * Run: node scripts/generate.js
 * Env: ANTHROPIC_API_KEY, RESEND_API_KEY, REVIEW_EMAIL
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { buildNodePrompt, buildPagePrompt, buildResourceAdditionPrompt } from '../prompts/track1-json.js';
import { buildTrendsArticlePrompt, buildModelCardPrompt } from '../prompts/track2-html.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Existing real Trends articles — used for "Further reading" links so we never
// generate broken cross-links to articles that don't exist.
const EXISTING_TRENDS_ARTICLES = [
  '/trends/agentic-ai-explained',
  '/trends/ai-cost-collapse',
  '/trends/context-window-arms-race',
  '/trends/deepseek-r1-what-it-proved',
  '/trends/reasoning-models-explained',
  '/trends/state-of-llms-q2-2026'
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function slugify(str) {
  return (str || 'untitled')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/['']/g, '')                                // strip curly/straight apostrophes
    .replace(/[—–]/g, '-')                                // em/en dash -> hyphen
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

async function generateJSON(prompt, label) {
  log(`[Track 1] Generating: ${label}`);
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }]
  });
  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    log(`ERROR: JSON parse failed for "${label}" — saving raw output for inspection`);
    await saveError(label, raw);
    throw err;
  }
}

async function generateHTML(prompt, label) {
  log(`[Track 2] Generating: ${label}`);
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    // Full HTML articles need significantly more headroom than JSON content:
    // the repeated CSS template alone runs ~1500-2000 tokens before any article
    // content begins, plus a genuine 700-900 word article with multiple content
    // blocks. 4000 was too low and caused silent mid-tag truncation — raised to
    // 8000 to give comfortable headroom for the largest expected output.
    max_tokens: 8000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }]
  });

  // Flag if the response was cut off before finishing, so we never silently
  // ship a truncated article again.
  if (message.stop_reason === 'max_tokens') {
    log(`WARNING: HTML generation for "${label}" hit the token limit and was truncated.`);
    await saveError(label, message.content[0].text + '\n\n[TRUNCATED — stop_reason: max_tokens]');
    throw new Error(`Generation truncated for ${label} — hit max_tokens limit`);
  }

  const raw = message.content[0].text.trim();
  // Strip markdown fences if Claude added them despite instructions
  const cleaned = raw.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '').trim();

  if (!cleaned.startsWith('<!DOCTYPE') && !cleaned.startsWith('<div')) {
    log(`WARNING: HTML output for "${label}" doesn't start as expected — flagging for manual review`);
  }

  // Basic sanity check: a complete article must close its own html tag.
  // This catches truncation even in the rare case stop_reason doesn't flag it.
  if (cleaned.startsWith('<!DOCTYPE') && !cleaned.includes('</html>')) {
    log(`ERROR: HTML output for "${label}" is missing closing </html> — likely truncated.`);
    await saveError(label, cleaned + '\n\n[INCOMPLETE — missing closing </html> tag]');
    throw new Error(`Generation appears incomplete for ${label} — no closing </html> tag found`);
  }

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
        data: content
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

// ─── Track 2: HTML drafts ─────────────────────────────────────────────────────

async function runTrack2(weekOf, calendarEntry) {
  const drafts = [];

  if (calendarEntry.trendsArticle) {
    try {
      const prompt = buildTrendsArticlePrompt(
        calendarEntry.trendsArticle.topic,
        calendarEntry.trendsArticle.notes,
        EXISTING_TRENDS_ARTICLES
      );
      const html = await generateHTML(prompt, `trends: ${calendarEntry.trendsArticle.topic}`);
      const slug = slugify(calendarEntry.trendsArticle.topic);
      drafts.push({
        track: 2,
        contentType: 'trends-article',
        targetPath: `trends/${slug}.html`,
        filename: `${slug}.html`,
        html,
        requiresVisualReview: true
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Save drafts ───────────────────────────────────────────────────────────────

async function saveDrafts(weekOf, drafts) {
  const dir = path.join(ROOT, 'drafts', weekOf);
  await fs.mkdir(dir, { recursive: true });

  for (const draft of drafts) {
    const filePath = path.join(dir, draft.filename);
    if (draft.track === 1) {
      await fs.writeFile(filePath, JSON.stringify(draft.data, null, 2), 'utf8');
    } else {
      await fs.writeFile(filePath, draft.html, 'utf8');
    }
    log(`Saved: drafts/${weekOf}/${draft.filename}`);
  }

  // Write a manifest so the dashboard knows what's in this week's batch
  await fs.writeFile(
    path.join(dir, '_manifest.json'),
    JSON.stringify(
      drafts.map(d => ({
        track: d.track,
        contentType: d.contentType,
        targetPath: d.targetPath,
        filename: d.filename,
        requiresVisualReview: d.requiresVisualReview || false,
        requiresManualPaste: d.requiresManualPaste || false
      })),
      null, 2
    ),
    'utf8'
  );
}

// ─── Review email ──────────────────────────────────────────────────────────────

async function sendReviewEmail(weekOf, drafts) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — skipping notification.');
    return;
  }

  const track1Items = drafts.filter(d => d.track === 1);
  const track2Items = drafts.filter(d => d.track === 2);

  const body = `
Your weekly llms101.com content is ready for review.

Week of: ${weekOf}

TRACK 1 — JSON content (low risk, ready to drop in once approved):
${track1Items.map(d => `  • ${d.contentType}: ${d.filename} → ${d.targetPath}`).join('\n') || '  (none this week)'}

TRACK 2 — HTML content (REQUIRES VISUAL REVIEW before use):
${track2Items.map(d => `  • ${d.contentType}: ${d.filename} → ${d.targetPath}`).join('\n') || '  (none this week)'}

${track2Items.length > 0 ? '⚠ Track 2 items must be visually previewed in the dashboard before downloading or pasting. Do not skip the preview step.' : ''}

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
      subject: `[llms101] Weekly content ready — ${track1Items.length} JSON + ${track2Items.length} HTML`,
      text: body
    })
  });

  if (res.ok) log(`Review email sent to ${process.env.REVIEW_EMAIL}`);
  else log(`WARNING: Email failed — ${res.status}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting weekly content generation (two-track system)');

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
    log('WARNING: No drafts were generated this week — check calendar entry structure.');
  } else {
    await saveDrafts(weekOf, allDrafts);
  }

  calendar.weeks.shift();
  calendar.completed = calendar.completed || [];
  calendar.completed.push({ ...weekEntry, _completed_at: new Date().toISOString() });
  await writeCalendar(calendar);

  await sendReviewEmail(weekOf, allDrafts);

  log(`Done. ${track1Drafts.length} Track 1 (JSON) + ${track2Drafts.length} Track 2 (HTML) drafts generated.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
