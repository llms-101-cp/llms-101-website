/**
 * llms101.com — Newsletter Generation Script
 * "LLMs 101" Monday edition
 *
 * Generates all five sections, assembles them into a cohesive edition,
 * renders the HTML email, and creates a draft in Beehiiv.
 *
 * Run: node scripts/newsletter.js
 * Env: ANTHROPIC_API_KEY, BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID,
 *      RESEND_API_KEY, REVIEW_EMAIL
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildWeeklyNewsPrompt,
  buildConceptPrompt,
  buildToolsPrompt,
  buildReadsPrompt,
  buildFromSitePrompt,
  buildAssemblyPrompt
} from '../prompts/newsletter-templates.js';
import { buildEmailHtml, buildEmailText } from '../prompts/email-template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Config ───────────────────────────────────────────────────────────────────

// The concept to explain this week — read from calendar or env override
const CONCEPT_OVERRIDE = process.env.CONCEPT_OVERRIDE || null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function readCalendar() {
  const raw = await fs.readFile(
    path.join(ROOT, 'content-calendar/calendar.json'), 'utf8'
  );
  return JSON.parse(raw);
}

async function readIssueCounter() {
  const counterPath = path.join(ROOT, 'content-calendar/issue-counter.json');
  try {
    const raw = await fs.readFile(counterPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    // First run
    return { last_issue: 0 };
  }
}

async function incrementIssueCounter(counter) {
  const counterPath = path.join(ROOT, 'content-calendar/issue-counter.json');
  counter.last_issue += 1;
  await fs.writeFile(counterPath, JSON.stringify(counter, null, 2), 'utf8');
  return counter.last_issue;
}

// ─── Claude API call ─────────────────────────────────────────────────────────

async function generate(prompt, label) {
  log(`Generating: ${label}`);

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
    log(`ERROR: Failed to parse JSON for "${label}"`);
    const errorDir = path.join(ROOT, 'drafts/errors');
    await fs.mkdir(errorDir, { recursive: true });
    await fs.writeFile(
      path.join(errorDir, `error-${Date.now()}.txt`),
      `LABEL: ${label}\n\nRAW:\n${raw}`,
      'utf8'
    );
    throw new Error(`JSON parse failed for ${label}: ${err.message}`);
  }
}

// ─── Save draft ───────────────────────────────────────────────────────────────

async function saveDraft(weekOf, issueNumber, edition, html, text) {
  const dir = path.join(ROOT, 'drafts/newsletter', weekOf);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(
    path.join(dir, 'edition.json'),
    JSON.stringify(edition, null, 2),
    'utf8'
  );

  await fs.writeFile(path.join(dir, 'email.html'), html, 'utf8');
  await fs.writeFile(path.join(dir, 'email.txt'), text, 'utf8');

  log(`Newsletter draft saved to drafts/newsletter/${weekOf}/`);
}

// ─── Push to Beehiiv ─────────────────────────────────────────────────────────
//
// Beehiiv API docs: https://developers.beehiiv.com/docs/v2
// This creates a draft post — it will NOT send until you click Send in Beehiiv.

async function pushToBeehiiv(meta, html, text) {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !pubId) {
    log('No Beehiiv config — skipping. Draft saved locally.');
    return null;
  }

  log('Pushing draft to Beehiiv...');

  const res = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subject: meta.subject_line,
      preview_text: meta.preview_text,
      content_html: html,
      content_text: text,
      status: 'draft',             // Never auto-sends — always a draft
      platform: 'email',
      audience: 'all'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    log(`WARNING: Beehiiv push failed — ${res.status}: ${err}`);
    return null;
  }

  const data = await res.json();
  const postUrl = `https://app.beehiiv.com/posts/${data.data?.id}`;
  log(`Beehiiv draft created: ${postUrl}`);
  return postUrl;
}

// ─── Send review email ────────────────────────────────────────────────────────

async function sendReviewEmail(weekOf, issueNumber, meta, beehiivUrl) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — skipping notification.');
    return;
  }

  const reviewLink = beehiivUrl
    ? `Review and send in Beehiiv:\n${beehiivUrl}`
    : `Draft saved locally in: drafts/newsletter/${weekOf}/`;

  const body = `
LLMs 101 — Issue #${issueNumber} is ready for review.

Week of: ${weekOf}
Subject line: ${meta.subject_line}

Sections generated:
  ✓ The week, plainly (3-4 news items)
  ✓ One thing to understand: ${meta.concept || 'see draft'}
  ✓ Tools worth your time (4-5 tools)
  ✓ Worth reading this week (2-3 reads)
  ✓ From the site

${reviewLink}

This is an automated message from the llms101 newsletter pipeline.
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
      subject: `[llms101] Newsletter #${issueNumber} ready — "${meta.subject_line}"`,
      text: body
    })
  });

  if (res.ok) {
    log(`Review email sent to ${process.env.REVIEW_EMAIL}`);
  } else {
    log(`WARNING: Email failed — ${res.status}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting newsletter generation');

  // Get week and issue number
  const calendar = await readCalendar();
  const weekEntry = calendar.weeks[0];
  const weekOf = weekEntry?.week_of || new Date().toISOString().split('T')[0];

  const counter = await readIssueCounter();
  const issueNumber = await incrementIssueCounter(counter);

  log(`Generating Issue #${issueNumber} for week of ${weekOf}`);

  // Determine this week's concept
  const concept = CONCEPT_OVERRIDE
    || weekEntry?.type_a?.topic
    || 'Retrieval-Augmented Generation (RAG)';

  // ── Generate all five sections ──────────────────────────────────────────────

  const news = await generate(buildWeeklyNewsPrompt(weekOf), 'news');
  await sleep(2500);

  const conceptSection = await generate(buildConceptPrompt(concept, weekOf), `concept: ${concept}`);
  await sleep(2500);

  const tools = await generate(buildToolsPrompt(weekOf), 'tools');
  await sleep(2500);

  const reads = await generate(buildReadsPrompt(weekOf), 'reads');
  await sleep(2500);

  // Stub "from the site" content — in production this would pull from
  // the week's generated web content (term, model profile etc.)
  const newWebContent = [
    {
      label: 'New term',
      title: conceptSection.concept,
      url: `https://llms101.com/terms/${conceptSection.slug}`
    }
  ];

  const fromSite = await generate(
    buildFromSitePrompt(weekOf, newWebContent),
    'from-the-site'
  );
  await sleep(2500);

  // ── Assemble into a cohesive edition ───────────────────────────────────────

  const sections = { news, concept: conceptSection, tools, reads, fromSite };

  const meta = await generate(
    buildAssemblyPrompt(sections, weekOf, issueNumber),
    'assembly/meta'
  );
  meta.concept = concept; // carry through for email

  // ── Build the full edition object ──────────────────────────────────────────

  const edition = { meta, ...sections };

  // ── Render email ────────────────────────────────────────────────────────────

  log('Rendering HTML email...');
  const html = buildEmailHtml(edition);
  const text = buildEmailText(edition);

  // ── Save locally ────────────────────────────────────────────────────────────

  await saveDraft(weekOf, issueNumber, edition, html, text);

  // ── Push to Beehiiv ─────────────────────────────────────────────────────────

  const beehiivUrl = await pushToBeehiiv(meta, html, text);

  // ── Send review notification ────────────────────────────────────────────────

  await sendReviewEmail(weekOf, issueNumber, meta, beehiivUrl);

  log(`Done. Issue #${issueNumber} generated successfully.`);
  log(`Subject: "${meta.subject_line}"`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
