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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..'); // repo root (this file lives in llms101-automation/scripts/)
const TRACKER_PATH = path.join(ROOT, 'tracker.html');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
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
  const familyEsc = escapeHtml(row.family);
  const flagshipEsc = escapeHtml(row.flagship);
  const bestForEsc = escapeHtml(row.best_for);

  return `    <!-- #${row.rank} ${nameEsc} -->
    <div class="trow" data-tags="${row.tags}">
      <div class="rank-col"><span class="${rankSpanClass}">${row.rank}</span></div>
      <div class="trow-main">
        <div class="trow-left">
          <div class="model-family">${familyEsc}</div>
          <div class="model-name">${nameEsc}</div>
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

  return updated;
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
  // Belt-and-suspenders: if any leading/trailing prose survived, pull out the [...] array.
  const arrayMatch = fenceStripped.match(/(\[[\s\S]*\])/);
  const cleaned = arrayMatch ? arrayMatch[1] : fenceStripped;

  let rows;
  try {
    rows = JSON.parse(cleaned);
  } catch (err) {
    log('ERROR: JSON parse failed. Raw response saved to drafts/errors/.');
    await saveError(raw);
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
  const names = [...html.matchAll(/<div class="model-name">([^<]*)<\/div>/g)].map(m => m[1]);
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
  log('Done. The GitHub Action wrapper handles branch/commit/push/PR from here.');
}

// Only auto-run when executed directly (not when imported for tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
