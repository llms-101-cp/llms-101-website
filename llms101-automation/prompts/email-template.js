/**
 * llms101.com — Newsletter HTML Email Template
 *
 * Generates the final HTML email from assembled section data.
 * Designed to render well in Gmail, Apple Mail, Outlook.
 * Uses table-based layout for maximum email client compatibility.
 */

/**
 * Returns a complete HTML email string.
 * @param {Object} edition - the full assembled newsletter edition
 */
export function buildEmailHtml(edition) {
  const {
    meta,
    news,
    concept,
    tools,
    reads,
    fromSite
  } = edition;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${meta.subject_line}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
  body, table, td { margin:0; padding:0; border:0; }
  body { background:#f0ece4; font-family: Georgia, 'Libre Baskerville', serif; }
  img { display:block; border:0; }
  a { color:#1a1814; }
  @media (max-width: 600px) {
    .email-body { padding: 0 16px !important; }
    .two-col td { display:block !important; width:100% !important; }
  }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f0ece4">
<tr><td align="center" style="padding:32px 16px 40px;">

  <!-- Outer container -->
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- ─── Masthead ─── -->
    <tr>
      <td bgcolor="#1a1814" style="padding:28px 40px 24px;border-radius:4px 4px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-family:'Libre Baskerville',Georgia,serif;font-size:26px;color:#f0ece4;letter-spacing:-0.5px;line-height:1;">
                LLMs <span style="color:#c85a1e;">101</span>
              </div>
              <div style="font-family:Courier,'Courier New',monospace;font-size:10px;color:#6b6760;letter-spacing:3px;text-transform:uppercase;margin-top:5px;">
                Issue #${meta.issue_number} &nbsp;·&nbsp; Week of ${formatDate(meta.week_of)}
              </div>
            </td>
            <td align="right" valign="middle">
              <div style="font-family:Courier,'Courier New',monospace;font-size:10px;color:#6b6760;letter-spacing:1px;text-transform:uppercase;">
                Plain English AI
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ─── Opening note ─── -->
    <tr>
      <td bgcolor="#ffffff" style="padding:32px 40px 28px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        <p style="font-family:'Libre Baskerville',Georgia,serif;font-size:16px;line-height:1.75;color:#1a1814;margin:0;">
          ${meta.opening_note}
        </p>
      </td>
    </tr>

    <!-- Section divider -->
    ${sectionDivider('The week, plainly')}

    <!-- ─── News section ─── -->
    <tr>
      <td bgcolor="#ffffff" style="padding:0 40px 8px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        ${news.intro ? `<p style="font-family:Courier,'Courier New',monospace;font-size:12px;color:#6b6760;margin:0 0 24px;font-style:italic;">${news.intro}</p>` : ''}
        ${news.items.map(item => newsItem(item)).join('')}
      </td>
    </tr>

    <!-- Section divider -->
    ${sectionDivider('One thing to understand')}

    <!-- ─── Concept explainer ─── -->
    <tr>
      <td bgcolor="#f5f2ec" style="padding:32px 40px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        <div style="font-family:'Libre Baskerville',Georgia,serif;font-size:19px;font-weight:700;color:#1a1814;margin-bottom:6px;">
          ${concept.concept}
        </div>
        <div style="font-family:Courier,'Courier New',monospace;font-size:12px;color:#c85a1e;margin-bottom:20px;font-style:italic;">
          ${concept.teaser}
        </div>
        <div style="font-family:Georgia,'Libre Baskerville',serif;font-size:15px;line-height:1.8;color:#2a2825;">
          ${concept.body.split('\n\n').map(p =>
            `<p style="margin:0 0 16px;">${p.trim()}</p>`
          ).join('')}
        </div>
        <div style="margin-top:24px;padding:14px 18px;background:#1a1814;border-radius:3px;">
          <span style="font-family:Courier,'Courier New',monospace;font-size:10px;color:#6b6760;letter-spacing:2px;text-transform:uppercase;">Take away</span><br>
          <span style="font-family:Georgia,serif;font-size:14px;color:#f0ece4;line-height:1.5;">${concept.takeaway}</span>
        </div>
      </td>
    </tr>

    <!-- Section divider -->
    ${sectionDivider('Tools worth your time')}

    <!-- ─── Tools ─── -->
    <tr>
      <td bgcolor="#ffffff" style="padding:8px 40px 24px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        ${tools.items.map(tool => toolItem(tool)).join('')}
      </td>
    </tr>

    <!-- Section divider -->
    ${sectionDivider('Worth reading this week')}

    <!-- ─── Reads ─── -->
    <tr>
      <td bgcolor="#ffffff" style="padding:8px 40px 24px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        ${reads.items.map(read => readItem(read)).join('')}
      </td>
    </tr>

    <!-- Section divider -->
    ${sectionDivider('From the site')}

    <!-- ─── From the site ─── -->
    <tr>
      <td bgcolor="#f5f2ec" style="padding:28px 40px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        ${fromSite.items.map(item => `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td>
                <div style="font-family:Courier,'Courier New',monospace;font-size:10px;color:#c85a1e;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${item.label}</div>
                <div style="font-family:'Libre Baskerville',Georgia,serif;font-size:15px;font-weight:700;margin-bottom:4px;">
                  <a href="${item.url}" style="color:#1a1814;text-decoration:none;">${item.title} →</a>
                </div>
                <div style="font-family:Georgia,serif;font-size:13px;color:#6b6760;line-height:1.6;">${item.one_liner}</div>
              </td>
            </tr>
          </table>
        `).join('')}

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #d8d3c8;">
          <p style="font-family:Georgia,'Libre Baskerville',serif;font-size:14px;line-height:1.7;color:#2a2825;margin:0;font-style:italic;">
            ${fromSite.sign_off}
          </p>
        </div>
      </td>
    </tr>

    <!-- ─── Footer ─── -->
    <tr>
      <td bgcolor="#1a1814" style="padding:24px 40px;border-radius:0 0 4px 4px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-family:Courier,'Courier New',monospace;font-size:11px;color:#6b6760;line-height:1.7;">
                <a href="https://llms101.com" style="color:#c85a1e;text-decoration:none;">llms101.com</a>
                &nbsp;·&nbsp;
                <a href="https://llms101.com/guide" style="color:#6b6760;text-decoration:none;">Full guide</a>
                &nbsp;·&nbsp;
                <a href="https://llms101.com/models" style="color:#6b6760;text-decoration:none;">Model directory</a>
                <br><br>
                You're receiving this because you subscribed to LLMs 101.<br>
                <a href="{{unsubscribe_url}}" style="color:#6b6760;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="{{preferences_url}}" style="color:#6b6760;">Manage preferences</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Component builders ───────────────────────────────────────────────────────

function sectionDivider(label) {
  return `
    <tr>
      <td bgcolor="#1a1814" style="padding:0 40px;border-left:1px solid #e0dbd0;border-right:1px solid #e0dbd0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:14px 0 10px;border-top:2px solid #c85a1e;">
              <span style="font-family:Courier,'Courier New',monospace;font-size:10px;color:#6b6760;letter-spacing:3px;text-transform:uppercase;">${label}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function newsItem(item) {
  const categoryColors = {
    'model-release': '#1a5c3a',
    'research': '#1a3a5c',
    'policy': '#5c3a1a',
    'product': '#3a1a5c',
    'industry': '#4a4a4a',
    'safety': '#5c1a1a'
  };
  const color = categoryColors[item.category] || '#4a4a4a';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-left:3px solid ${color};padding-left:16px;">
      <tr>
        <td>
          <div style="font-family:'Libre Baskerville',Georgia,serif;font-size:15px;font-weight:700;color:#1a1814;margin-bottom:6px;line-height:1.4;">
            ${item.headline}
          </div>
          <div style="font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#2a2825;margin-bottom:8px;">
            ${item.what_happened}
          </div>
          <div style="font-family:Courier,'Courier New',monospace;font-size:12px;color:#c85a1e;line-height:1.6;">
            ${item.what_it_means}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function toolItem(tool) {
  const freeColors = {
    'genuinely-useful': '#2a6b3a',
    'limited-but-fair': '#6b5a2a',
    'basically-a-trial': '#6b2a2a',
    'none': '#4a4a4a'
  };
  const freeLabels = {
    'genuinely-useful': 'Free tier: genuinely useful',
    'limited-but-fair': 'Free tier: limited but fair',
    'basically-a-trial': 'Free tier: basically a trial',
    'none': 'Paid only'
  };

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;padding-bottom:20px;border-bottom:1px solid #e8e4dc;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <a href="${tool.url}" style="font-family:'Libre Baskerville',Georgia,serif;font-size:15px;font-weight:700;color:#1a1814;text-decoration:none;">
                  ${tool.name} ↗
                </a>
              </td>
              <td style="padding-left:12px;">
                <span style="font-family:Courier,'Courier New',monospace;font-size:9px;color:${freeColors[tool.free_tier] || '#4a4a4a'};letter-spacing:1px;text-transform:uppercase;">
                  ${freeLabels[tool.free_tier] || ''}
                </span>
              </td>
            </tr>
          </table>
          <div style="font-family:Georgia,serif;font-size:13px;color:#6b6760;margin:4px 0 8px;">
            ${tool.what_it_does}
          </div>
          <div style="font-family:Georgia,serif;font-size:14px;line-height:1.65;color:#2a2825;margin-bottom:6px;">
            ${tool.our_take}
          </div>
          <div style="font-family:Courier,'Courier New',monospace;font-size:11px;color:#6b6760;">
            <span style="color:#2a6b3a;">✓ For: ${tool.best_for}</span>
            &nbsp;&nbsp;
            <span style="color:#6b2a2a;">✕ Not for: ${tool.not_for}</span>
          </div>
        </td>
      </tr>
    </table>
  `;
}

function readItem(read) {
  const difficultyLabel = {
    'accessible': '● Accessible',
    'moderate': '●● Moderate',
    'technical': '●●● Technical'
  };

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;padding-bottom:20px;border-bottom:1px solid #e8e4dc;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
            <tr>
              <td>
                <span style="font-family:Courier,'Courier New',monospace;font-size:9px;color:#6b6760;letter-spacing:1px;text-transform:uppercase;background:#f0ece4;padding:2px 6px;border-radius:2px;">
                  ${read.type}
                </span>
              </td>
              <td style="padding-left:8px;">
                <span style="font-family:Courier,'Courier New',monospace;font-size:9px;color:#6b6760;letter-spacing:1px;">
                  ${read.time_to_consume}
                </span>
              </td>
              <td style="padding-left:8px;">
                <span style="font-family:Courier,'Courier New',monospace;font-size:9px;color:#6b6760;letter-spacing:1px;">
                  ${difficultyLabel[read.difficulty] || ''}
                </span>
              </td>
            </tr>
          </table>
          <a href="${read.url}" style="font-family:'Libre Baskerville',Georgia,serif;font-size:15px;font-weight:700;color:#1a1814;text-decoration:none;line-height:1.4;display:block;margin-bottom:4px;">
            ${read.title} ↗
          </a>
          <div style="font-family:Courier,'Courier New',monospace;font-size:11px;color:#6b6760;margin-bottom:8px;">
            ${read.source}
          </div>
          <div style="font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#2a2825;">
            ${read.why_this_week}
          </div>
        </td>
      </tr>
    </table>
  `;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Generate a plain-text version for email clients that prefer it.
 */
export function buildEmailText(edition) {
  const { meta, news, concept, tools, reads, fromSite } = edition;

  return [
    `LLMs 101 — Issue #${meta.issue_number}`,
    `Week of ${formatDate(meta.week_of)}`,
    `${'─'.repeat(50)}`,
    '',
    meta.opening_note,
    '',
    `THE WEEK, PLAINLY`,
    `${'─'.repeat(30)}`,
    ...(news.items.map(item => [
      `\n${item.headline}`,
      item.what_happened,
      item.what_it_means,
    ].join('\n'))),
    '',
    `ONE THING TO UNDERSTAND: ${concept.concept}`,
    `${'─'.repeat(30)}`,
    concept.teaser,
    '',
    concept.body,
    '',
    `Take away: ${concept.takeaway}`,
    '',
    `TOOLS WORTH YOUR TIME`,
    `${'─'.repeat(30)}`,
    ...(tools.items.map(item => [
      `\n${item.name} — ${item.url}`,
      item.what_it_does,
      item.our_take,
      `For: ${item.best_for} | Not for: ${item.not_for}`,
    ].join('\n'))),
    '',
    `WORTH READING THIS WEEK`,
    `${'─'.repeat(30)}`,
    ...(reads.items.map(item => [
      `\n${item.title} (${item.time_to_consume})`,
      item.url,
      item.why_this_week,
    ].join('\n'))),
    '',
    `FROM THE SITE`,
    `${'─'.repeat(30)}`,
    ...(fromSite.items.map(item => `${item.label}: ${item.title}\n${item.url}\n${item.one_liner}`)),
    '',
    fromSite.sign_off,
    '',
    `${'─'.repeat(50)}`,
    `llms101.com | Unsubscribe: {{unsubscribe_url}}`,
  ].join('\n');
}
