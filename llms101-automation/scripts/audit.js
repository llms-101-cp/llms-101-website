/**
 * llms101.com — Monthly Content Audit Script
 *
 * Fetches each static page, extracts the text content,
 * runs it through Claude for staleness detection,
 * and emails a prioritised Staleness Report.
 *
 * Run: node scripts/audit.js
 * Env: ANTHROPIC_API_KEY, RESEND_API_KEY, REVIEW_EMAIL
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { buildAuditPrompt, buildReportSummaryPrompt } from '../prompts/audit-templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE_BASE = 'https://llms101.com';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Pages to audit ──────────────────────────────────────────────────────────
//
// Each entry defines a page to fetch and audit.
// 'selector_hint' tells the text extractor which section matters most.
// Add or remove pages here as the site grows.

const PAGES_TO_AUDIT = [
  {
    id: 'homepage-explainers',
    title: 'Homepage — AI for Beginners explainers',
    url: `${SITE_BASE}/`,
    decay_rate: 'slow',       // conceptual content — stable
    last_audited: null
  },
  {
    id: 'model-directory',
    title: 'Model Directory',
    url: `${SITE_BASE}/models`,
    decay_rate: 'fast',       // model landscape changes constantly
    last_audited: null
  },
  {
    id: 'model-tracker',
    title: 'Model Tracker',
    url: `${SITE_BASE}/tracker`,
    decay_rate: 'fast',
    last_audited: null
  },
  {
    id: 'ai-trends',
    title: 'AI Trends',
    url: `${SITE_BASE}/trends`,
    decay_rate: 'fast',
    last_audited: null
  },
  {
    id: 'resources',
    title: 'Interesting Resources / Reading List',
    url: `${SITE_BASE}/`,      // resources section is on homepage
    decay_rate: 'medium',
    last_audited: null
  },
  {
    id: 'full-guide',
    title: 'Full Text Guide',
    url: `${SITE_BASE}/guide`,
    decay_rate: 'medium',
    last_audited: null
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch a page and extract readable text, stripping HTML tags.
 * Returns truncated text (Claude has a context limit, and most pages
 * have enough signal in the first 4000 words).
 */
async function fetchPageText(url) {
  log(`Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'llms101-audit-bot/1.0 (content freshness check)' }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();

  // Strip scripts, styles, nav, footer — keep substantive content
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Cap at ~6000 chars to keep API costs low and responses focused
  return cleaned.length > 6000 ? cleaned.slice(0, 6000) + '\n[... content truncated for audit ...]' : cleaned;
}

/**
 * Call Claude to audit one page.
 */
async function auditPage(page, auditDate) {
  log(`Auditing: ${page.title}`);

  let pageText;
  try {
    pageText = await fetchPageText(page.url);
  } catch (err) {
    log(`WARNING: Could not fetch ${page.url} — ${err.message}`);
    return {
      page_id: page.id,
      page_title: page.title,
      audit_date: auditDate,
      overall_health: 'unknown',
      summary: `Could not fetch page for audit: ${err.message}`,
      flags: [],
      strengths: [],
      last_review_recommended: 'within-1-month',
      _fetch_error: err.message
    };
  }

  const prompt = buildAuditPrompt(page.id, page.title, pageText, auditDate);

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
    log(`ERROR: Failed to parse audit JSON for "${page.title}"`);
    return {
      page_id: page.id,
      page_title: page.title,
      audit_date: auditDate,
      overall_health: 'unknown',
      summary: 'Audit parse error — check raw output.',
      flags: [],
      strengths: [],
      last_review_recommended: 'within-1-month',
      _parse_error: raw.slice(0, 500)
    };
  }
}

// ─── Save audit results ───────────────────────────────────────────────────────

async function saveAuditResults(auditDate, results, summary) {
  const auditDir = path.join(ROOT, 'audits', auditDate);
  await fs.mkdir(auditDir, { recursive: true });

  // Individual page results
  for (const result of results) {
    await fs.writeFile(
      path.join(auditDir, `${result.page_id}.json`),
      JSON.stringify(result, null, 2),
      'utf8'
    );
  }

  // Summary
  await fs.writeFile(
    path.join(auditDir, '_summary.json'),
    JSON.stringify({ auditDate, summary, pageCount: results.length }, null, 2),
    'utf8'
  );

  log(`Audit results saved to audits/${auditDate}/`);
}

// ─── Build HTML email ─────────────────────────────────────────────────────────

function priorityIcon(p) {
  return p === 'red' ? '🔴' : p === 'yellow' ? '🟡' : '🟢';
}

function healthLabel(h) {
  return h === 'good' ? '✅ Good' : h === 'needs-review' ? '⚠️ Needs review' : h === 'outdated' ? '❌ Outdated' : '❓ Unknown';
}

function buildEmailHtml(auditDate, summary, results) {
  const redFlags = results.flatMap(r => (r.flags || []).filter(f => f.priority === 'red'));
  const yellowFlags = results.flatMap(r => (r.flags || []).filter(f => f.priority === 'yellow'));

  const flagRows = results
    .filter(r => r.flags && r.flags.length > 0)
    .flatMap(r =>
      r.flags.map(f => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;color:#6b6760;">${r.page_title}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;">${priorityIcon(f.priority)} ${f.category}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;font-style:italic;color:#444;">"${f.quote}"</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;">${f.issue}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;color:#2a6b3a;">${f.suggested_fix}</td>
        </tr>
      `)
    ).join('');

  const pageRows = results.map(r => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;">${r.page_title}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;">${healthLabel(r.overall_health)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;font-size:13px;color:#6b6760;">${r.summary || '—'}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'IBM Plex Mono',Courier,monospace;background:#f5f2ec;margin:0;padding:0;">
  <div style="max-width:760px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="background:#1a1814;color:#f5f2ec;padding:24px 32px;border-radius:4px 4px 0 0;">
      <div style="font-family:Georgia,serif;font-size:22px;">llms<span style="color:#c85a1e;">101</span>.com</div>
      <div style="font-size:11px;color:#6b6760;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Monthly content audit — ${auditDate}</div>
    </div>

    <!-- Summary banner -->
    <div style="background:${summary.urgency === 'action-needed' ? '#c85a1e' : summary.urgency === 'monitor' ? '#b8a040' : '#2a6b3a'};color:white;padding:16px 32px;font-size:13px;">
      <strong>${summary.headline}</strong>
    </div>

    <!-- Narrative -->
    <div style="background:white;padding:28px 32px;border:1px solid #e8e4dc;border-top:none;">
      <p style="font-size:14px;line-height:1.7;color:#1a1814;margin:0 0 20px;">${summary.narrative}</p>

      <div style="display:flex;gap:24px;margin-bottom:8px;">
        <div style="text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#c85a1e;">${redFlags.length}</div>
          <div style="font-size:11px;color:#6b6760;text-transform:uppercase;letter-spacing:1px;">Red flags</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#b8a040;">${yellowFlags.length}</div>
          <div style="font-size:11px;color:#6b6760;text-transform:uppercase;letter-spacing:1px;">Yellow flags</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#1a1814;">${results.length}</div>
          <div style="font-size:11px;color:#6b6760;text-transform:uppercase;letter-spacing:1px;">Pages audited</div>
        </div>
      </div>

      ${summary.top_priorities && summary.top_priorities.length > 0 ? `
        <div style="margin-top:24px;padding:16px;background:#f5f2ec;border-radius:3px;border-left:3px solid #c85a1e;">
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b6760;margin-bottom:10px;">Top priorities</div>
          ${summary.top_priorities.map(p => `<div style="font-size:13px;color:#1a1814;margin-bottom:6px;">→ ${p}</div>`).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Page health overview -->
    <div style="background:white;padding:28px 32px;border:1px solid #e8e4dc;border-top:none;margin-top:2px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b6760;margin-bottom:16px;">Page health overview</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f2ec;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Page</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Health</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Summary</th>
          </tr>
        </thead>
        <tbody>${pageRows}</tbody>
      </table>
    </div>

    <!-- Flags detail -->
    ${flagRows ? `
    <div style="background:white;padding:28px 32px;border:1px solid #e8e4dc;border-top:none;margin-top:2px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b6760;margin-bottom:16px;">All flags — detailed</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f2ec;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Page</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Type</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Flagged text</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Issue</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6760;">Suggested fix</th>
          </tr>
        </thead>
        <tbody>${flagRows}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="padding:20px 32px;font-size:11px;color:#6b6760;text-align:center;border-top:1px solid #e8e4dc;margin-top:2px;">
      Automated audit by llms101-bot · Full results saved in /audits/${auditDate}/ in your repo
    </div>

  </div>
</body>
</html>
  `.trim();
}

// ─── Send email ───────────────────────────────────────────────────────────────

async function sendAuditEmail(auditDate, summary, results) {
  if (!process.env.RESEND_API_KEY || !process.env.REVIEW_EMAIL) {
    log('No email config — skipping notification. Audit results saved to /audits/');
    return;
  }

  const html = buildEmailHtml(auditDate, summary, results);
  const redCount = results.flatMap(r => (r.flags || []).filter(f => f.priority === 'red')).length;

  const subjectPrefix = redCount > 0
    ? `[llms101 AUDIT] ⚠ ${redCount} red flag(s) need attention`
    : `[llms101 AUDIT] Monthly content audit — ${auditDate}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'llms101-bot@llms101.com',
      to: process.env.REVIEW_EMAIL,
      subject: subjectPrefix,
      html
    })
  });

  if (res.ok) {
    log(`Audit email sent to ${process.env.REVIEW_EMAIL}`);
  } else {
    const err = await res.text();
    log(`WARNING: Email failed — ${res.status}: ${err}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const auditDate = new Date().toISOString().split('T')[0];
  log(`Starting monthly content audit for ${auditDate}`);

  const results = [];

  for (const page of PAGES_TO_AUDIT) {
    try {
      const result = await auditPage(page, auditDate);
      results.push(result);
      const flagCount = (result.flags || []).length;
      log(`  → ${result.overall_health} | ${flagCount} flag(s)`);
    } catch (err) {
      log(`ERROR auditing ${page.title}: ${err.message}`);
      results.push({
        page_id: page.id,
        page_title: page.title,
        audit_date: auditDate,
        overall_health: 'unknown',
        summary: `Audit error: ${err.message}`,
        flags: [],
        strengths: [],
        last_review_recommended: 'within-1-month'
      });
    }

    // Polite delay between API calls
    await sleep(3000);
  }

  // Generate summary across all pages
  log('Generating summary report...');
  const summaryPrompt = buildReportSummaryPrompt(results, auditDate);
  const summaryMessage = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    system: summaryPrompt.system,
    messages: [{ role: 'user', content: summaryPrompt.user }]
  });

  let summary;
  try {
    const raw = summaryMessage.content[0].text.trim();
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    summary = JSON.parse(cleaned);
  } catch {
    summary = {
      headline: 'Monthly audit complete.',
      urgency: 'monitor',
      top_priorities: [],
      narrative: `Audit ran across ${results.length} pages. Check individual results in /audits/${auditDate}/.`
    };
  }

  // Save everything to repo
  await saveAuditResults(auditDate, results, summary);

  // Email the report
  await sendAuditEmail(auditDate, summary, results);

  const redCount = results.flatMap(r => (r.flags || []).filter(f => f.priority === 'red')).length;
  const yellowCount = results.flatMap(r => (r.flags || []).filter(f => f.priority === 'yellow')).length;

  log(`Audit complete. ${results.length} pages | 🔴 ${redCount} red | 🟡 ${yellowCount} yellow`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
