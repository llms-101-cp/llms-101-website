/**
 * llms101.com — TRACK 2: Trends Article Generation (REBUILT)
 *
 * This replaces the earlier standalone-HTML-per-article approach entirely.
 * Confirmed via direct investigation of the live codebase: the REAL article
 * system is content/articles/{slug}.json -> indexing.yml -> generate-indices.js
 * -> articles_index.json -> trends.html (listing) + view-article.html (detail).
 *
 * This is simpler and safer than generating full HTML:
 *   - No CSS template to reproduce exactly
 *   - No layout-component judgment calls (callouts, before/after blocks etc.)
 *   - No risk of truncated/malformed HTML breaking page layout
 *   - A malformed JSON response fails loudly (JSON.parse throws) rather than
 *     silently producing a broken page
 *
 * Model cards remain unchanged — still a single HTML block, still copy-paste
 * only, since models.html is a genuinely different, shared-file situation.
 */

export const SITE_VOICE = `
You are a content writer for llms101.com — a beginner-friendly guide to large language models.
The audience is smart but non-technical. Voice: clear, direct, conversational, honest about
complexity, no hype, no doom. All claims must be factually accurate.
`.trim();

/**
 * TRACK 2A: Trends Article — single JSON file
 *
 * Matches the EXACT schema read by view-article.html's renderer and the
 * Decap CMS "articles" collection config:
 *   title, slug, date, category, read_time, summary, body,
 *   before_label, before, after_label, after (before/after optional)
 *
 * The body field uses MARKDOWN — confirmed via live testing that marked.js
 * renders it correctly, and the CSS in view-article.html already has
 * dedicated styling for h2, strong, ul/ol/li, and blockquote.
 */
export function buildTrendsArticlePrompt(topic, notes, relatedArticleSlugs) {
  return {
    system: SITE_VOICE,
    user: `
Write a Trends article for llms101.com about: "${topic}"

Notes / angle for this article: ${notes}

This article will be saved as a single JSON file and rendered dynamically by
the site's article viewer, which parses the body field as MARKDOWN (using
marked.js). Use real markdown syntax — it will render correctly.

═══════════════════════════════════════════════════════════════
WRITING GUIDELINES
═══════════════════════════════════════════════════════════════

1. Write 700-900 words in the body field, using markdown:
   - 4-6 "## Section Heading" headings to break up the article
   - **bold** for key terms or important phrases (sparingly — not every sentence)
   - A bullet or numbered list where it genuinely helps (not forced into every article)
   - Plain paragraphs for everything else — 2-4 sentences each, not walls of text

2. Open with a short, direct paragraph before the first heading — this is the
   "lede" that sets up what the article covers, in plain English.

3. If a before/after comparison genuinely suits this topic (e.g. "the old way
   vs the new way", "2023 pricing vs 2026 pricing"), fill in the before/after
   fields. If it doesn't suit the topic naturally, OMIT those four fields
   entirely rather than forcing a weak comparison.

4. Where relevant, you may reference these EXISTING related articles by their
   slug if linking out would help the reader (mention by name in prose, not
   as markdown links — the viewer's "Continue reading" section handles actual
   links separately): ${relatedArticleSlugs.join(', ')}

5. Do not use em dashes or curly quotes anywhere — use plain hyphens and
   straight quotes to avoid encoding issues when this is saved as JSON.

═══════════════════════════════════════════════════════════════

Return ONLY valid JSON in this exact structure — no preamble, no markdown
code fences around the JSON itself (the body field's markdown content is
fine, just don't wrap the whole JSON response in triple-backtick fences):

{
  "title": "Article title — plain language, no jargon, under 70 characters",
  "slug": "url-friendly-slug-matching-the-title",
  "date": "Today's date in ISO format, e.g. 2026-06-29",
  "category": "One of: Trend Spotlight | Explainer | Deep Dive | Model Update | Quarterly",
  "read_time": "e.g. '5 min read' — estimate based on actual word count",
  "summary": "1-2 sentences, under 220 characters. This is the hook shown on the /trends listing card — make it earn the click.",
  "before_label": "OPTIONAL — short label, e.g. 'The old way' or '2023 pricing'. Omit entirely with before/after/after_label if no comparison suits this topic.",
  "before": "OPTIONAL — 1-2 sentences, under 160 characters, describing the old state.",
  "after_label": "OPTIONAL — short label, e.g. 'The new way' or '2026 pricing'.",
  "after": "OPTIONAL — 1-2 sentences, under 160 characters, describing the new state.",
  "body": "The full 700-900 word article as a MARKDOWN string. Use \\n\\n between paragraphs and headings. Real markdown syntax: ## for headings, **bold** for emphasis, - for bullet points."
}
    `.trim()
  };
}

/**
 * TRACK 2B: Model Card (single HTML block, NOT a full page) — unchanged
 * models.html is a genuinely different situation: a shared file with
 * hand-coded cards, not a dynamic JSON-driven system. Copy-paste only.
 */
export function buildModelCardPrompt(modelName, maker, notes) {
  return {
    system: SITE_VOICE,
    user: `
Write ONE model card block for the llms101.com Models directory.

Model: "${modelName}"
Maker: "${maker}"
Notes: ${notes}

═══════════════════════════════════════════════════════════════
CRITICAL: This must be a single, complete <div class="mcard"> block matching
this EXACT structure and CSS class names — copy the skeleton exactly, only
change the content inside each element. Do not add new CSS classes.
═══════════════════════════════════════════════════════════════

TEMPLATE TO FILL (this is a real example from the live site):

<div class="mcard" data-tags="{{SPACE_SEPARATED_TAGS_FROM: closed open budget reasoning}}">
  <div class="mcard-header">
    <div class="mcard-top">
      <span class="mcard-company">{{MAKER_NAME}}</span>
      <span class="status-badge {{STATUS_CLASS_FROM: status-dominant status-strong status-rising status-disruptor}}">{{STATUS_LABEL}}</span>
    </div>
    <div class="mcard-name">{{MODEL_FAMILY_NAME}}</div>
    <div class="mcard-models">{{COMMA_SEPARATED_MODEL_VARIANTS}}</div>
  </div>
  <div class="mcard-body">
    <div class="superpower-label">Core superpower</div>
    <div class="superpower">{{ONE_SENTENCE_SUPERPOWER}}</div>
    <div class="tradeoff-label">Key trade-off</div>
    <div class="tradeoff">{{ONE_SENTENCE_HONEST_TRADEOFF}}</div>
    <div class="bars">
      <div class="bar-row">
        <span class="bar-label">Speed</span>
        <div class="bar-track"><div class="bar-fill speed" style="width:{{SPEED_PERCENT}}%"></div></div>
        <span class="bar-score">{{SPEED_SCORE}}/10</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Reasoning</span>
        <div class="bar-track"><div class="bar-fill" style="width:{{REASONING_PERCENT}}%"></div></div>
        <span class="bar-score">{{REASONING_SCORE}}/10</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Cost</span>
        <div class="bar-track"><div class="bar-fill cost" style="width:{{COST_PERCENT}}%"></div></div>
        <span class="bar-score">{{COST_LABEL}}</span>
      </div>
    </div>
    <div class="bestfor">
      <div class="bestfor-label">Best non-technical use</div>
      <div class="bestfor-text">{{SPECIFIC_USE_CASE_SENTENCE}}</div>
    </div>
    <div class="cost-tier">
      <span class="cost-label">Cost tier</span>
      <div class="cost-dots">{{COST_DOTS — repeat <div class="cost-dot active"></div> for filled dots and <div class="cost-dot"></div> for empty, 5 total}}</div>
      <span class="cost-tier-name">{{COST_TIER_NAME}}</span>
    </div>
  </div>
  <div class="seo-content">
    <p>{{2-3 SENTENCE SEO PARAGRAPH — factual, mentions specific model variants, context window size if known, and primary use case}}</p>
  </div>
</div>

═══════════════════════════════════════════════════════════════

Scoring guidance:
- Speed/Reasoning percent and score should be internally consistent (e.g. 85% ≈ 8.5/10)
- Cost percent: higher = cheaper (matches existing cards: free/open models score 90%+, premium closed models score 40-55%)
- Be honest and specific in the trade-off — vague trade-offs are not useful to readers

Return ONLY the raw HTML for this single div block — no markdown fences, no preamble,
no explanation, no surrounding page HTML. Start directly with <div class="mcard".
    `.trim()
  };
}
