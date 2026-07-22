/**
 * llms101.com — Fortnightly Full-Site Review (added 2026-07-21)
 *
 * Closes the review-cadence gap documented in ARCHITECTURE.md: Trends/Mind
 * Map get a weekly pass and the Tracker gets a monthly pass, but
 * `models.html` and the static `content/pages/*.json` pages (about,
 * beginners, contact, resources) had never been reviewed on any cadence at
 * all — the reason the Claude card sat stale for ~3 weeks after Fable 5 was
 * restored, and Kimi K3's launch went uncovered.
 *
 * Four checks, one run:
 *   1. Static pages (about/beginners/contact/resources) — fact-checked and,
 *      on a blocking finding, corrected through the SAME schema → fact-check
 *      → repair-once → publish|hold gate the weekly pipeline uses (Craig's
 *      2026-07-21 decision: these auto-publish, unlike model cards).
 *      `resources.json` additionally gets a mechanical link-rot check whose
 *      failures are folded in as synthetic blocking findings.
 *   2. `models.html` — fact-checked per card. Never auto-spliced (shared
 *      hand-coded file, no dynamic system — same rule as the weekly
 *      pipeline's model-card handling). A stale card gets a suggested
 *      replacement block written to drafts/ for manual review and paste.
 *   3. Tracker + Trends — a lighter, report-only spot-audit for anything
 *      time-sensitive that slipped through since the last dedicated
 *      weekly/monthly pass. Corrections still flow through THOSE pipelines,
 *      not this one.
 *   4. One report email (same Resend pattern as the weekly/monthly reports)
 *      and one commit for the run, covering whatever static-page
 *      corrections actually published — the single `git revert` point.
 *
 * Reuses rather than reinvents: `validateSchema`/`factCheck`/`repairDraft`
 * from validate-and-publish.js (already generic over contentType),
 * `gatherCoverage` from plan-week.js, `buildModelCardPrompt` from
 * prompts/track2-trends.js, `appendToChangelog`, `callWithRetry`.
 *
 * Scheduling: GitHub Actions cron has no native "every 2 weeks" primitive.
 * .github/workflows/fortnightly-review.yml fires every Wednesday 15:00 UTC;
 * `isScheduledWeek()` below gates every other one via ISO-week parity
 * against a fixed anchor date, so the job is a silent no-op (exit 0, no
 * email) on the off week. `workflow_dispatch` (or `--force` locally) always
 * runs regardless of parity, for manual testing.
 *
 * Run: node scripts/fortnightly-review.js [--dry-run] [--offline] [--force]
 *   --dry-run  run every check but write nothing, commit nothing, email
 *              nothing (prints the report to stdout instead).
 *   --offline  dev-only: skip every web_search API call. Implies --dry-run.
 *   --force    bypass the biweekly parity gate (workflow_dispatch passes
 *              this automatically; use it locally to test off-cycle).
 *
 * Env: ANTHROPIC_API_KEY (fact-check/repair/generation),
 *      RESEND_API_KEY + REVIEW_EMAIL (report email)
 */

import fs from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { callWithRetry } from './api-retry.js';
import { appendToChangelog } from './changelog-append.js';
import { validateSchema, factCheck, repairDraft } from './validate-and-publish.js';
import { gatherCoverage } from './plan-week.js';
import { buildModelCardPrompt } from '../prompts/track2-trends.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTOMATION_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(AUTOMATION_ROOT, '..');
const DRAFTS_DIR = path.join(AUTOMATION_ROOT, 'drafts');
const PAGES_DIR = path.join(REPO_ROOT, 'content', 'pages');
const MODELS_HTML = path.join(REPO_ROOT, 'models.html');
const TRACKER_HTML = path.join(REPO_ROOT, 'tracker.html');

const SITE_BASE = 'https://llms101.com';
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search' };

// Spec scope explicitly lists about/beginners/contact/resources — methodology
// is newer, meta (not date-sensitive factual content) content and out of
// this list; see ARCHITECTURE.md fortnightly section.
const STATIC_PAGE_IDS = ['about', 'beginners', 'contact', 'resources'];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Ordinal date formatting — same formula as the sitewide fix (2026-07-21) ─

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Biweekly gate ───────────────────────────────────────────────────────────
// First fortnightly Wednesday. Every OTHER Wednesday from this anchor is a
// scheduled run; the ones in between are a silent no-op under cron.

const ANCHOR_WEDNESDAY = new Date('2026-07-22T00:00:00Z');

export function isScheduledWeek(now = new Date()) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diffWeeks = Math.floor((now.getTime() - ANCHOR_WEDNESDAY.getTime()) / msPerWeek);
  return ((diffWeeks % 2) + 2) % 2 === 0;
}

// ─── Static-page link-rot check (resources.json only) ───────────────────────

export function extractUrls(bodyMarkdown) {
  const matches = [...String(bodyMarkdown ?? '').matchAll(/href="(https?:\/\/[^"]+)"/g)];
  return [...new Set(matches.map(m => m[1]))];
}

export async function checkLinkRot(urls, { timeoutMs = 8000 } = {}) {
  const dead = [];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res;
      try {
        res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
        }
      } catch (headErr) {
        res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      }
      if (!res.ok) dead.push({ url, detail: `HTTP ${res.status}` });
    } catch (err) {
      dead.push({ url, detail: err.name === 'AbortError' ? 'timed out' : err.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return dead;
}

// ─── models.html card extraction (read-only — nothing is spliced back) ──────

function extractBalancedDiv(html, startIdx) {
  const tagRegex = /<div\b[^>]*>|<\/div>/g;
  tagRegex.lastIndex = startIdx;
  let depth = 0, match;
  while ((match = tagRegex.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(startIdx, tagRegex.lastIndex);
  }
  return null;
}

export function extractModelCards(html) {
  const cards = [];
  const startRegex = /<div class="mcard"[^>]*>/g;
  let m;
  while ((m = startRegex.exec(html))) {
    const block = extractBalancedDiv(html, m.index);
    if (!block) continue;
    const company = (block.match(/<span class="mcard-company">([^<]*)<\/span>/) || [])[1] ?? '';
    const name = ((block.match(/<div class="mcard-name">([\s\S]*?)<\/div>/) || [])[1] ?? '')
      .replace(/<[^>]+>/g, '').trim();
    const models = ((block.match(/<div class="mcard-models">([\s\S]*?)<\/div>/) || [])[1] ?? '').trim();
    const seo = ((block.match(/<div class="seo-content">\s*<p>([\s\S]*?)<\/p>/) || [])[1] ?? '').trim();
    cards.push({ company, name, models, seo, html: block });
    startRegex.lastIndex = m.index + block.length;
  }
  return cards;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── Direct web_search-enabled generation (model-card refresh drafts) ───────

function lastTextBlock(message) {
  const textBlocks = message.content.filter(b => b.type === 'text').map(b => b.text);
  return (textBlocks[textBlocks.length - 1] ?? '').trim();
}

// All text blocks joined, not just the last. "Last block only" (the
// convention elsewhere in this pipeline, meant to skip a model's
// pre-tool-call "I'll research..." narration) breaks the other direction
// too: observed live 2026-07-21, the model sometimes appends a SEPARATE
// final text block of caveats/notes AFTER the real payload (e.g. "I
// couldn't verify the retirement claims, so I only listed..." with no HTML
// at all) — taking only that last block silently discarded the actual
// generated card, which lived in an earlier block. Concatenating and
// letting the caller extract its specific payload (a balanced div, a JSON
// object) from the full text is robust to narration landing on either side.
function allTextBlocks(message) {
  return message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function generateWithWebSearch(client, prompt, label, { maxTokens = 4000 } = {}) {
  const message = await callWithRetry(
    () => client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: maxTokens,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      tools: [WEB_SEARCH_TOOL]
    }),
    label,
    { log }
  );
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`generation truncated (max_tokens) — not safe to use: ${label}`);
  }
  return allTextBlocks(message);
}

// Extracts a single balanced <div class="mcard" ...>...</div> block from
// anywhere in a (possibly prose-wrapped) response, reusing the same
// balanced-tag walk extractModelCards() uses to read models.html itself.
export function extractCardHtml(text) {
  const idx = text.indexOf('<div class="mcard"');
  if (idx === -1) return null;
  return extractBalancedDiv(text, idx);
}

// Same bracket-depth-counting approach as generate-tracker.js's
// extractJsonArray / validate-and-publish.js's extractJsonObject — a greedy
// regex mis-extracts if the model appends citation-style brackets after the
// JSON closes, which is plausible with web_search enabled. No shared import
// exists for this (each caller's exact extraction target — array vs object —
// differs), so this is the object-shaped copy for the spot-audit call.
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

// ─── Check 1: static pages — fact-check, link-rot (resources only), repair, publish ─

async function checkStaticPages(client, { dryRun }) {
  const results = [];
  for (const id of STATIC_PAGE_IDS) {
    const filePath = path.join(PAGES_DIR, `${id}.json`);
    const entry = { contentType: 'page', filename: `${id}.json` };
    const result = { id, status: 'clean', reasons: [], linkRot: [], originalFactCheck: null, factCheck: null, newData: null };
    results.push(result);

    // Each page's check is isolated — a failure here (parse error, a repair
    // response that isn't valid JSON, an API error) holds back THAT page
    // only, same principle validate-and-publish.js uses per manifest item.
    // Without this isolation, one page's failure previously aborted the
    // entire run (checkModelCards + the spot-audit never even started) —
    // caught during the second live dispatch, 2026-07-21, when resources.json's
    // repair response came back as prose instead of JSON.
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      log(`Checking static page: ${id}`);
      const fc = await factCheck(client, entry, data);
      result.factCheck = fc;
      let blocking = fc.findings.filter(f => f.severity === 'blocking');

      if (id === 'resources') {
        const urls = extractUrls(data.body);
        const dead = await checkLinkRot(urls);
        result.linkRot = dead;
        for (const d of dead) {
          blocking.push({ severity: 'blocking', claim: d.url, issue: `link appears dead (${d.detail})` });
        }
      }

      if (blocking.length === 0) {
        log(`  clean — no blocking findings`);
        continue;
      }

      result.originalFactCheck = { verdict: 'fail', findings: blocking };
      log(`  ${blocking.length} blocking finding(s) — attempting repair`);
      const repaired = await repairDraft(client, entry, data, blocking);

      const schemaCheck = validateSchema(entry, repaired);
      if (!schemaCheck.ok) {
        result.status = 'held';
        result.reasons.push(`repaired draft failed schema: ${schemaCheck.blocking.join('; ')}`);
        log(`  HELD — repaired draft failed schema validation`);
        continue;
      }

      const fc2 = await factCheck(client, entry, repaired);
      result.factCheck = fc2;
      if (fc2.verdict === 'fail') {
        result.status = 'held_after_repair';
        log(`  HELD AFTER REPAIR — still failing fact-check on round 2`);
        continue;
      }

      result.status = 'corrected';
      result.newData = repaired;
      if (!dryRun) {
        await fs.writeFile(filePath, JSON.stringify(repaired, null, 2) + '\n', 'utf8');
      }
      log(`  corrected${dryRun ? ' [DRY RUN — not written]' : ' and written'}`);
    } catch (err) {
      result.status = 'held';
      result.reasons.push(`error during check/repair: ${err.message}`);
      log(`  HELD — ${err.message}`);
    }
  }
  return results;
}

// ─── Check 2: models.html — report + draft only, never auto-spliced ─────────

async function checkModelCards(client, weekLabel, { dryRun }) {
  const html = await fs.readFile(MODELS_HTML, 'utf8');
  const cards = extractModelCards(html);
  log(`Found ${cards.length} model cards in models.html`);
  const results = [];

  for (const card of cards) {
    const entry = { contentType: 'model-card', filename: card.company || card.name };
    const result = { company: card.company, name: card.name, factCheck: null, draftFile: null, error: null };
    results.push(result);

    // Isolated per card — same reasoning as checkStaticPages: one card's
    // failure should not lose the report for every other card or abort the
    // spot-audit that runs after this function returns.
    try {
      log(`Checking model card: ${card.company} — ${card.name}`);
      const fc = await factCheck(client, entry, {
        name: card.name, maker: card.company, models: card.models, description: card.seo
      });
      result.factCheck = fc;
      const blocking = fc.findings.filter(f => f.severity === 'blocking');

      if (blocking.length === 0) {
        log(`  clean`);
        continue;
      }

      log(`  ${blocking.length} blocking finding(s) — drafting a suggested replacement card`);
      const notes = blocking.map(f => `${f.claim} — ${f.issue}`).join('\n');
      const prompt = buildModelCardPrompt(card.name, card.company, notes);
      const rawResponse = await generateWithWebSearch(client, prompt, `model card refresh: ${card.name}`);
      const extracted = extractCardHtml(rawResponse);
      if (!extracted) {
        log(`  WARNING: no <div class="mcard"> found in the generation response for ${card.name} — writing the raw response instead so nothing is silently lost; review manually.`);
      }
      const draftHtml = extracted ?? rawResponse;

      if (!dryRun) {
        const draftDir = path.join(DRAFTS_DIR, `fortnightly-${weekLabel}`);
        await fs.mkdir(draftDir, { recursive: true });
        const draftPath = path.join(draftDir, `model-card-${slugify(card.name)}.html`);
        await fs.writeFile(draftPath, draftHtml, 'utf8');
        result.draftFile = path.relative(REPO_ROOT, draftPath);
        log(`  draft written to ${result.draftFile} — review and paste manually`);
      }
    } catch (err) {
      result.error = err.message;
      log(`  ERROR checking ${card.name} — ${err.message}`);
    }
  }
  return results;
}

// ─── Check 3: Tracker + Trends spot-audit — report only ─────────────────────

async function spotAuditTrackerAndTrends(client) {
  const coverage = await gatherCoverage();
  const trackerHtml = await fs.readFile(TRACKER_HTML, 'utf8');
  const trackerNames = [...trackerHtml.matchAll(/<div class="model-name">([\s\S]*?)<\/div>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim());

  const todayISO = new Date().toISOString().slice(0, 10);
  const system = `You are a lightweight currency spot-checker for llms101.com, an
educational site about large language models. Today's date is ${todayISO}.
The site's Model Tracker refreshes monthly and Trends refreshes weekly — you
are NOT re-reviewing either in full, only checking whether something
genuinely time-sensitive has emerged since the last pass that a reasonably
informed reader would expect this site to already reflect (a major model
launch, a deprecation, a significant price change). Use web_search.`;

  const user = `CURRENT TRACKER ROWS (${trackerNames.length}):
${trackerNames.map(n => `- ${n}`).join('\n')}

EXISTING TRENDS ARTICLE TITLES:
${coverage.articles.map(a => `- ${a.title}`).join('\n') || '(none indexed)'}

RECENT COMPLETED WEEKLY TOPICS:
${coverage.recentCompleted.map(w => `- ${w.week_of}: ${w.articleTopic ?? '(no article)'}`).join('\n') || '(none)'}

Is there anything time-sensitive missing from this picture — a launch,
deprecation, or price change significant enough that its absence would look
like an oversight to an informed reader? Do NOT flag anything already
reflected above, and do NOT flag minor/speculative items.

Return ONLY valid JSON, no markdown fences:
{ "findings": [ { "area": "Tracker" | "Trends", "issue": "..." } ] }
An empty findings array is the expected result most fortnights.`;

  const message = await callWithRetry(
    () => client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [WEB_SEARCH_TOOL]
    }),
    'spot-audit: tracker+trends',
    { log }
  );
  if (message.stop_reason === 'max_tokens') {
    throw new Error('spot-audit response hit max_tokens — not safe to parse');
  }
  const raw = lastTextBlock(message);
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const cleaned = extractJsonObject(fenceStripped) ?? fenceStripped;
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed.findings) ? parsed.findings : [];
}

// ─── Check 3b: unmerged monthly-tracker PR detector — report only ───────────
// The monthly tracker refresh is deliberately PR-merge-gated (ARCHITECTURE.md
// D1) but has NO reminder of its own, so a generated PR can sit unmerged and
// the public tracker silently goes stale. That is exactly what happened with
// PR #18 (opened by the July 1 run, still unmerged ~3 weeks later on
// 2026-07-21, while four major model launches piled up uncovered). This check
// surfaces any open PR on a `tracker-refresh-*` branch in the report email so
// it can't rot unnoticed again. Fail-soft: any gh/parse error returns null
// (distinct from [] = "ran, none open") and never aborts the run.
const STALE_TRACKER_PR_DAYS = 7; // older than this is flagged as an alarm, not just noted

function checkUnmergedTrackerPRs() {
  let raw;
  try {
    raw = execFileSync('gh', [
      'pr', 'list', '--state', 'open',
      '--json', 'number,title,createdAt,headRefName,url',
      '--limit', '50'
    ], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (err) {
    log(`WARNING: could not list open PRs to check for an unmerged tracker refresh — ${err.message}. (Needs gh on PATH + GH_TOKEN with pull-requests:read.)`);
    return null;
  }
  try {
    const prs = JSON.parse(raw);
    const now = Date.now();
    return prs
      .filter(pr => pr.headRefName && pr.headRefName.startsWith('tracker-refresh-'))
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        createdAt: pr.createdAt,
        ageDays: Math.floor((now - new Date(pr.createdAt).getTime()) / 86_400_000)
      }))
      .sort((a, b) => b.ageDays - a.ageDays);
  } catch (err) {
    log(`WARNING: could not parse gh pr list output for the tracker-PR check — ${err.message}.`);
    return null;
  }
}

// ─── Report email ────────────────────────────────────────────────────────────

function titleCase(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

async function sendReportEmail(weekLabel, { pageResults, modelCardResults, spotAuditFindings, trackerPRs, commitSha, fatalError }) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — skipping fortnightly report email.');
    return;
  }

  const sections = [];
  sections.push(`llms101.com fortnightly full-site review — ${weekLabel}`);
  sections.push('');

  if (fatalError) {
    sections.push(`*** PIPELINE ERROR: ${fatalError} ***`);
    sections.push('Results below reflect progress up to the failure point.');
    sections.push('');
  }

  sections.push('STATIC PAGES (about / beginners / contact / resources):');
  for (const r of pageResults) {
    sections.push(`  • ${titleCase(r.id)}: ${r.status}`);
    if (r.linkRot?.length) {
      for (const d of r.linkRot) sections.push(`    dead link: ${d.url} — ${d.detail}`);
    }
    if (r.originalFactCheck) {
      for (const f of r.originalFactCheck.findings) sections.push(`    finding: ${f.claim} — ${f.issue}`);
    }
    if (r.reasons?.length) {
      for (const reason of r.reasons) sections.push(`    reason: ${reason}`);
    }
    const notes = (r.factCheck?.findings ?? []).filter(f => f.severity === 'note');
    for (const n of notes) sections.push(`    note: ${n.claim} — ${n.issue}`);
  }
  sections.push('');

  sections.push('MODEL CARDS (models.html — report only, never auto-published):');
  if (!modelCardResults.length) {
    sections.push('  (no cards found — check models.html structure)');
  }
  for (const r of modelCardResults) {
    if (r.error) {
      sections.push(`  • ${r.company} — ${r.name}: ERROR — ${r.error}`);
      continue;
    }
    const blocking = (r.factCheck?.findings ?? []).filter(f => f.severity === 'blocking');
    if (!blocking.length) {
      sections.push(`  • ${r.company} — ${r.name}: clean`);
      continue;
    }
    sections.push(`  • ${r.company} — ${r.name}: STALE`);
    for (const f of blocking) sections.push(`    finding: ${f.claim} — ${f.issue}`);
    if (r.draftFile) sections.push(`    suggested replacement drafted: ${r.draftFile} (review and paste manually)`);
  }
  sections.push('');

  sections.push('TRACKER + TRENDS SPOT-AUDIT (report only — corrections go through their own pipelines):');
  if (!spotAuditFindings.length) {
    sections.push('  Nothing flagged.');
  } else {
    for (const f of spotAuditFindings) sections.push(`  • [${f.area}] ${f.issue}`);
  }
  sections.push('');

  sections.push('UNMERGED TRACKER PR CHECK (the monthly tracker is merge-gated with no reminder of its own):');
  if (trackerPRs === null) {
    sections.push('  Could not check — see the workflow log (needs gh + GH_TOKEN with pull-requests:read).');
  } else if (!trackerPRs.length) {
    sections.push('  None open — the monthly tracker refresh is either current or its latest PR was merged.');
  } else {
    for (const pr of trackerPRs) {
      const stale = pr.ageDays >= STALE_TRACKER_PR_DAYS;
      sections.push(`  ${stale ? '*** STALE' : '•'} tracker PR #${pr.number} open ${pr.ageDays} day(s): "${pr.title}"${stale ? ' — review/merge or close+re-run ***' : ' (awaiting review)'}`);
      sections.push(`    ${pr.url}`);
    }
  }
  sections.push('');

  const corrected = pageResults.filter(r => r.status === 'corrected');
  if (commitSha) {
    sections.push(`Publish commit (${corrected.length} static page correction(s)): ${commitSha}`);
    sections.push(`  https://github.com/llms-101-cp/llms-101-website/commit/${commitSha}`);
    sections.push(`  To undo: git revert ${commitSha}`);
  } else if (corrected.length) {
    sections.push('WARNING: pages were corrected but no commit SHA was captured — check the workflow log.');
  } else {
    sections.push('Nothing published this run — no static-page corrections were needed.');
  }
  sections.push('');
  sections.push('This email is the review trigger for any auto-published static-page');
  sections.push('correction above. Model-card drafts (if any) still need manual paste.');

  const staleTrackerPR = Array.isArray(trackerPRs) && trackerPRs.some(pr => pr.ageDays >= STALE_TRACKER_PR_DAYS);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'llms101-bot@llms101.com',
      to: process.env.REVIEW_EMAIL,
      subject: `[llms101] Fortnightly review ${weekLabel} — ${corrected.length} page(s) corrected, ${modelCardResults.filter(r => r.draftFile).length} card draft(s), ${spotAuditFindings.length} spot-audit finding(s)${staleTrackerPR ? ' — STALE TRACKER PR' : ''}${fatalError ? ' — PIPELINE ERROR' : ''}`,
      text: sections.join('\n')
    })
  });

  if (res.ok) {
    log(`Fortnightly report email sent to ${process.env.REVIEW_EMAIL}`);
  } else {
    const detail = await res.text().catch(() => '(no body)');
    log(`WARNING: report email failed — HTTP ${res.status}: ${detail}`);
  }
}

// ─── Git helper (mirrors validate-and-publish.js) ────────────────────────────

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const dryRun = args.includes('--dry-run') || offline;
  const force = args.includes('--force');

  if (!force && !isScheduledWeek()) {
    log('Off-cycle week under the biweekly gate — nothing to do this Wednesday. Pass --force to override.');
    return;
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  log(`Starting fortnightly full-site review for ${todayISO}${dryRun ? ' [DRY RUN]' : ''}${offline ? ' [OFFLINE]' : ''}`);

  let pageResults = [], modelCardResults = [], spotAuditFindings = [], trackerPRs = null;
  let fatalError = null;
  let commitSha = null;
  let changelogWarning = null;

  if (offline) {
    log('OFFLINE mode — skipping every web_search-dependent check (no ANTHROPIC_API_KEY call made).');
  } else {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    try {
      pageResults = await checkStaticPages(client, { dryRun });
      modelCardResults = await checkModelCards(client, todayISO, { dryRun });
      spotAuditFindings = await spotAuditTrackerAndTrends(client);
    } catch (err) {
      fatalError = err.message;
      log(`ERROR during review: ${err.stack}`);
    }

    // Runs regardless of whether the API checks above threw — it's a cheap
    // `gh` call with no dependency on the Anthropic client, and it's the one
    // check that specifically catches the "generated tracker PR silently sits
    // unmerged" failure. Fail-soft internally (returns null on any error).
    trackerPRs = checkUnmergedTrackerPRs();
    if (Array.isArray(trackerPRs) && trackerPRs.length) {
      log(`Unmerged tracker PR(s) open: ${trackerPRs.map(p => `#${p.number} (${p.ageDays}d)`).join(', ')}`);
    }

    // Commit + push the drafts/report folder (model-card suggested
    // replacements + the audit-trail JSON) FIRST, before the page-correction
    // commit below — these are real work product from paid API calls that
    // the report email only describes, not contains. Previously written to
    // disk but never committed at all, so every draft from a run was lost
    // the moment the runner was destroyed (caught on the third live
    // dispatch, 2026-07-21, after the earlier push-order and isolation bugs
    // were fixed — see ARCHITECTURE.md's Fortnightly Full-Site Review
    // section). Doing this before the page-correction commit means the
    // drafts survive even if that later commit/push has its own trouble.
    if (!dryRun) {
      const reportDir = path.join(DRAFTS_DIR, `fortnightly-${todayISO}`);
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(
        path.join(reportDir, '_fortnightly_report.json'),
        JSON.stringify({ week: todayISO, pageResults, modelCardResults, spotAuditFindings, trackerPRs, fatalError }, null, 2),
        'utf8'
      );
      try {
        const relReportDir = path.relative(REPO_ROOT, reportDir);
        git('add', relReportDir);
        const draftsStatus = git('status', '--porcelain');
        if (draftsStatus) {
          git('commit', '-m', `fortnightly review: drafts + report (${todayISO})`);
          const draftsCommitSha = git('rev-parse', 'HEAD');
          git('push', 'origin', 'HEAD:main');
          log(`Committed and pushed fortnightly drafts/report: ${draftsCommitSha}`);
        }
      } catch (err) {
        log(`WARNING: could not commit/push the fortnightly drafts/report folder — ${err.message}. Model-card drafts and the audit-trail JSON exist only on this runner and will be lost.`);
        if (!fatalError) fatalError = `drafts/report commit failed: ${err.message}`;
      }
    }

    const corrected = pageResults.filter(r => r.status === 'corrected');
    if (!dryRun && corrected.length) {
      const changelogItems = corrected.map(r => ({
        area: 'Site',
        text: `${titleCase(r.id)} page updated — corrected stale facts found during the fortnightly review.`
      }));
      const cl = await appendToChangelog(changelogItems, todayISO, REPO_ROOT, { log });
      changelogWarning = cl.warning;

      const relPaths = corrected.map(r => path.relative(REPO_ROOT, path.join(PAGES_DIR, `${r.id}.json`)));
      git('add', ...relPaths);
      if (cl.staged) git('add', 'content/changelog.json');

      const status = git('status', '--porcelain');
      if (status) {
        git('commit', '-m', `fortnightly review: ${corrected.length} static page correction(s) (${todayISO})`);
        commitSha = git('rev-parse', 'HEAD');
        log(`Committed ${corrected.length} static page correction(s): ${commitSha}`);
        // Push immediately, in the same script invocation — same reasoning as
        // validate-and-publish.js's git('push', ...) calls: this commit must
        // reach origin before anything later in the run can fail and abort
        // the job, or the correction is committed only on the ephemeral
        // runner and lost when it's destroyed (exactly what happened
        // 2026-07-21's first live dispatch, when a later API-credit error
        // aborted the job before a separate workflow-level push step ran).
        try {
          git('push', 'origin', 'HEAD:main');
          log('Pushed correction commit to origin/main.');
        } catch (pushErr) {
          log(`WARNING: push failed — ${pushErr.message}. The correction commit exists locally on this runner only and will be lost when the job ends.`);
          if (!fatalError) fatalError = `push failed after commit ${commitSha}: ${pushErr.message}`;
        }
      }
    }
  }

  if (!offline) {
    await sendReportEmail(todayISO, { pageResults, modelCardResults, spotAuditFindings, trackerPRs, commitSha, fatalError });
  }

  log('Fortnightly review complete.');
  if (fatalError) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
