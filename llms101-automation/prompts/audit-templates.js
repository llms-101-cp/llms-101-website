/**
 * llms101.com — Content Audit Prompt Templates
 *
 * Used by the monthly audit job to scan static pages for staleness.
 * Each prompt returns structured JSON flagging specific issues.
 */

export const AUDITOR_CONTEXT = `
You are a content auditor for llms101.com — a beginner-friendly guide to large language models.

Your job is to review existing site content and identify anything that may have become
outdated, inaccurate, or misleading given the current state of AI (as of your knowledge cutoff).

The AI landscape moves extremely fast. Be particularly alert to:
- Model names, versions, and capability claims
- Superlatives: "the most powerful", "state of the art", "only X can do Y"
- Statistics and benchmark numbers
- Pricing and access claims (free tiers change)
- Company/product status (acquisitions, shutdowns, pivots)
- Links that may be dead or redirected
- Framing that was accurate 12 months ago but may now be misleading

Return structured JSON only. Be specific — vague flags like "this might be outdated"
are not actionable. Point to the exact claim and explain precisely why it's a concern.
`.trim();

/**
 * Audits a single page or section of content.
 * @param {string} pageId - identifier for the page (e.g. 'homepage-explainers')
 * @param {string} pageTitle - human-readable title
 * @param {string} content - the raw text content to audit
 * @param {string} auditDate - ISO date string of when the audit is running
 */
export function buildAuditPrompt(pageId, pageTitle, content, auditDate) {
  return {
    system: AUDITOR_CONTEXT,
    user: `
Audit the following content from llms101.com for staleness and accuracy issues.

Page: "${pageTitle}" (id: ${pageId})
Audit date: ${auditDate}

---CONTENT START---
${content}
---CONTENT END---

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "page_id": "${pageId}",
  "page_title": "${pageTitle}",
  "audit_date": "${auditDate}",
  "overall_health": "One of: good | needs-review | outdated",
  "summary": "1-2 sentence overall assessment of the page's freshness.",
  "flags": [
    {
      "priority": "One of: red | yellow | green",
      "category": "One of: model-claim | capability-claim | statistic | access-pricing | company-status | dead-link | framing | other",
      "quote": "The exact phrase or sentence from the content that is potentially stale (under 30 words)",
      "issue": "Specific explanation of what may have changed or why this is a concern.",
      "suggested_fix": "Concrete suggestion for how to update or verify this claim.",
      "verified_needed": true
    }
  ],
  "strengths": ["1-3 things that are still accurate and well-framed — worth noting so they aren't accidentally changed"],
  "last_review_recommended": "One of: immediate | within-1-month | within-3-months | within-6-months"
}

Priority guide:
- red: Likely wrong or misleading RIGHT NOW. Readers could be misinformed.
- yellow: Probably still accurate but worth verifying. May have changed.
- green: Unlikely to be wrong but flagged for completeness (e.g. a statistic that should have a date).

If the content looks fully accurate and fresh, return an empty flags array and overall_health: "good".
Flag only genuine concerns — do not invent issues.
    `.trim()
  };
}

/**
 * Generates a digest summary across all page audits for the email report.
 * @param {Array} auditResults - array of parsed audit JSON objects
 * @param {string} auditDate - ISO date string
 */
export function buildReportSummaryPrompt(auditResults, auditDate) {
  const flagCounts = auditResults.reduce((acc, r) => {
    (r.flags || []).forEach(f => { acc[f.priority] = (acc[f.priority] || 0) + 1; });
    return acc;
  }, {});

  return {
    system: AUDITOR_CONTEXT,
    user: `
Write a short executive summary for the monthly content audit of llms101.com.

Audit date: ${auditDate}
Pages audited: ${auditResults.length}
Red flags: ${flagCounts.red || 0}
Yellow flags: ${flagCounts.yellow || 0}
Green flags: ${flagCounts.green || 0}

Pages with issues:
${auditResults
  .filter(r => r.flags && r.flags.length > 0)
  .map(r => `- ${r.page_title}: ${r.flags.length} flag(s), health: ${r.overall_health}`)
  .join('\n')}

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "headline": "One sentence capturing the overall state of the site's content health.",
  "urgency": "One of: action-needed | monitor | all-clear",
  "top_priorities": ["Up to 3 most important things to fix, in plain English"],
  "narrative": "2-3 sentence plain-English summary suitable for the email body. Honest but not alarming."
}
    `.trim()
  };
}
