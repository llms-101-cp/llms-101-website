/**
 * llms101.com — Weekly Content Generation Script
 *
 * Reads the content calendar, calls the Claude API for each piece,
 * saves drafts as JSON files, then sends a review email.
 *
 * Run: node scripts/generate.js
 * Env: ANTHROPIC_API_KEY, RESEND_API_KEY, REVIEW_EMAIL
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildTermPrompt,
  buildModelPrompt,
  buildDigestPrompt,
  buildResourcePrompt
} from '../prompts/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
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

async function saveDraft(weekOf, type, slug, content) {
  const draftsDir = path.join(ROOT, 'drafts', weekOf);
  await fs.mkdir(draftsDir, { recursive: true });
  const filename = `${type}-${slug}.json`;
  await fs.writeFile(
    path.join(draftsDir, filename),
    JSON.stringify({ ...content, _draft: true, _generated_at: new Date().toISOString() }, null, 2),
    'utf8'
  );
  log(`Draft saved: drafts/${weekOf}/${filename}`);
  return filename;
}

// ─── Claude API call ─────────────────────────────────────────────────────────

async function generateContent(prompt, label) {
  log(`Generating: ${label}`);

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }]
  });

  const raw = message.content[0].text.trim();

  // Strip any markdown code fences the model might have added
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    log(`ERROR: Failed to parse JSON for "${label}". Raw output saved for debugging.`);
    await fs.writeFile(
      path.join(ROOT, `drafts/error-${Date.now()}.txt`),
      `LABEL: ${label}\n\nRAW OUTPUT:\n${raw}`,
      'utf8'
    );
    throw err;
  }
}

// ─── Build prompt by type ────────────────────────────────────────────────────

function getPrompt(item, weekOf) {
  switch (item.type) {
    case 'term':
      return buildTermPrompt(item.topic);
    case 'model':
      return buildModelPrompt(item.topic);
    case 'digest':
      return buildDigestPrompt(weekOf);
    case 'resource':
      return buildResourcePrompt(item.topic, item.url || '');
    default:
      throw new Error(`Unknown content type: ${item.type}`);
  }
}

// ─── Email notification ───────────────────────────────────────────────────────

async function sendReviewEmail(weekOf, drafts) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config found — skipping notification.');
    return;
  }

  const draftList = drafts
    .map(d => `  • ${d.label}: ${d.filename}`)
    .join('\n');

  const reviewUrl = `https://llms101.com/admin/review?week=${weekOf}`;

  const body = `
Your weekly llms101.com content is ready for review.

Week of: ${weekOf}
Drafts generated:
${draftList}

Review and approve here:
${reviewUrl}

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
      subject: `[llms101] Weekly content ready for review — ${weekOf}`,
      text: body
    })
  });

  if (res.ok) {
    log(`Review email sent to ${process.env.REVIEW_EMAIL}`);
  } else {
    log(`WARNING: Email failed — ${res.status} ${res.statusText}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting weekly content generation');

  const calendar = await readCalendar();

  if (calendar.weeks.length === 0) {
    log('ERROR: Content calendar is empty. Add weeks to content-calendar/calendar.json');
    process.exit(1);
  }

  // Pick the week to generate (first upcoming, or override)
  const weekOverride = process.env.WEEK_OVERRIDE;
  let weekEntry;

  if (weekOverride) {
    weekEntry = calendar.weeks.find(w => w.week_of === weekOverride);
    if (!weekEntry) {
      log(`ERROR: No calendar entry found for week_override=${weekOverride}`);
      process.exit(1);
    }
  } else {
    weekEntry = calendar.weeks[0];
  }

  const weekOf = weekEntry.week_of;
  log(`Generating content for week of ${weekOf}`);

  const generatedDrafts = [];

  // Generate type_a
  try {
    const promptA = getPrompt(weekEntry.type_a, weekOf);
    const contentA = await generateContent(promptA, `${weekEntry.type_a.type}: ${weekEntry.type_a.topic}`);
    const filenameA = await saveDraft(weekOf, weekEntry.type_a.type, contentA.slug || 'draft', contentA);
    generatedDrafts.push({ label: `${weekEntry.type_a.type}: ${weekEntry.type_a.topic}`, filename: filenameA });
  } catch (err) {
    log(`ERROR generating type_a: ${err.message}`);
  }

  // Small delay to be kind to the API
  await new Promise(r => setTimeout(r, 2000));

  // Generate type_b
  try {
    const promptB = getPrompt(weekEntry.type_b, weekOf);
    const contentB = await generateContent(promptB, `${weekEntry.type_b.type}: ${weekEntry.type_b.topic}`);
    const filenameB = await saveDraft(weekOf, weekEntry.type_b.type, contentB.slug || 'draft', contentB);
    generatedDrafts.push({ label: `${weekEntry.type_b.type}: ${weekEntry.type_b.topic}`, filename: filenameB });
  } catch (err) {
    log(`ERROR generating type_b: ${err.message}`);
  }

  // Move the week from upcoming to completed in the calendar
  if (!weekOverride) {
    calendar.weeks.shift();
    calendar.completed.push({ ...weekEntry, _completed_at: new Date().toISOString() });
    await writeCalendar(calendar);
    log('Calendar updated: week moved to completed');
  }

  // Send review email
  await sendReviewEmail(weekOf, generatedDrafts);

  log(`Done. ${generatedDrafts.length} draft(s) generated for week of ${weekOf}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
