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

/**
 * TRACK 2C: Model Tracker rows (tracker.html) — structured JSON, NOT raw HTML
 *
 * Deliberately follows the Trends-article lesson, not the Model-card lesson:
 * ARCHITECTURE.md already documents that asking Claude to reproduce a full
 * HTML/CSS template exactly (Track 2 v1-v4, early Trends attempts) was
 * fragile — required exact CSS reproduction, risked truncation, needed
 * manual layout judgment calls. Model cards get away with raw-HTML output
 * because it's a single one-off block reviewed visually every time. Tracker
 * rows are a 9-row REPEATING structure refreshed on a schedule with no
 * guaranteed human visual review before the PR is opened — so this asks for
 * structured JSON per row, and a deterministic JS template (see
 * renderTrackerRow in generate-tracker.js) renders the actual HTML. This
 * makes row count, required fields, and CSS class names independently
 * checkable in code before anything is written to tracker.html.
 *
 * CRITICAL: requires the web_search tool enabled on this API call — this is
 * the one thing that actually fixes the staleness problem this script
 * exists to prevent (see ARCHITECTURE.md "STALENESS RISK" notes, both under
 * Model cards and under Model Tracker). Without it, this script reproduces
 * the exact bug that caused the 2026-06-27 tracker.html refresh in the
 * first place — confidently wrong because the underlying knowledge is
 * stale, not because the prompt is bad.
 */

export const TRACKER_ROW_COUNT = 12;

export const VALID_COST_CLASSES = ['cost-free', 'cost-low', 'cost-standard', 'cost-premium'];
export const VALID_TIER_CLASSES = ['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5'];
export const VALID_OPEN_BADGES = ['Closed API', 'Open weights'];

export function buildModelTrackerPrompt(previousRowsSummary) {
  return {
    system: `
You are researching and writing content for llms101.com's Model Tracker page —
a beginner-friendly, human-preference-based ranking of current frontier AI
models. Audience is smart but non-technical. Voice: clear, direct, honest
about trade-offs, no hype.

You MUST use the web_search tool to verify the current state of frontier
models before writing anything. Do not rely on your training data for model
names, version numbers, release dates, pricing, or context window sizes —
this space changes weekly and your training data will be stale. Search for
each lab's current flagship model specifically (OpenAI, Anthropic, Google
DeepMind, xAI, DeepSeek, Meta) before writing its row. If a model you
considered including was deprecated, superseded, or access-restricted since
your training cutoff, do not include it — search to confirm current status.
`.trim(),
    user: `
Research and produce exactly ${TRACKER_ROW_COUNT} rows for the Model Tracker
page, ranking current frontier AI models.

Last time this page was refreshed, the lineup was:
${previousRowsSummary}

Re-verify all of this against live search — do not assume last month's
lineup is still current. Labs ship new versions on a roughly monthly
cadence; check whether any of the above models have been superseded,
discontinued, or had a successor released. Also check whether a model that
isn't on last month's list now belongs there.

Cover this same spread of categories, scaled up for ${TRACKER_ROW_COUNT}
rows (adjust which specific model fills each slot based on what you find —
do not just relabel last month's models):
- 3-4 closed frontier "Tier 1" models (the current best from OpenAI,
  Anthropic, Google, and optionally xAI)
- 2-3 open-weight models genuinely competitive at the frontier -- don't
  reduce the open-weight ecosystem to a single representative; cover more
  than one of DeepSeek, Llama, Qwen, Mistral, or whichever else currently
  leads open-weight quality
- 1 mid-tier "best value" closed model per major lab as relevant
- 1-2 budget/speed-optimised models for high-volume use cases. Prefer the
  budget/fast sibling of each lab's CURRENT flagship generation (e.g. the
  model currently serving as the ChatGPT default fast tier), not an older
  generation's budget model that merely satisfies the category label --
  verify via web_search which sibling is most current before choosing.
- 1-2 notable specialized or emerging models that don't fit neatly into
  the above -- e.g. a strong coding-specialized model, or a competitive
  model from a lab not otherwise represented in this list (Mistral,
  Cohere, Perplexity, or similar)

Do NOT include any model whose access is currently suspended, restricted to
a small preview group, or otherwise not generally available to a typical
paying customer — this page is about what people can actually use today.

═══════════════════════════════════════════════════════════════

Return ONLY a valid JSON array of exactly ${TRACKER_ROW_COUNT} objects, no
markdown fences, no preamble. Each object must have exactly these fields:

{
  "rank": <integer 1-${TRACKER_ROW_COUNT}, must be sequential with no gaps or repeats>,
  "family": "<maker name, e.g. 'Anthropic', 'Google DeepMind', 'xAI'>",
  "name": "<model name as shown to readers, e.g. 'Claude Opus 4.8'>",
  "flagship": "<short tagline under 40 chars, e.g. 'Flagship intelligence model'>",
  "tier_emoji": "<🏆 for rank 1, 🥈 for rank 2, 🥉 for rank 3, empty string for rank 4+>",
  "tier_label": "<e.g. 'Tier 1 — Top', 'Tier 2 — Best value Claude' — your honest qualitative judgment>",
  "tier_class": "<one of: tier-1, tier-2, tier-3, tier-4, tier-5 — use tier-1 for closed frontier top-tier (gold), tier-2 for solid all-rounder/balanced (neutral), tier-3 for open-weight or disruptor/value plays (green), tier-4 for speed/cost-leader (blue), tier-5 unused unless you have a 5th distinct category>",
  "is_top3": <true only for ranks 1-3, controls gold rank-number styling>,
  "best_for": "<1-2 sentences, factual, specific, under 220 characters — what should a reader actually use this model for>",
  "cost_label": "<one of: Free*, Ultra-low, Low, Standard, Premium>",
  "cost_class": "<one of: cost-free, cost-low, cost-standard, cost-premium — cost-low covers both Ultra-low and Low labels>",
  "open_badge": "<one of: 'Closed API', 'Open weights'>",
  "tags": "<space-separated subset of: top writing coding cheap open — used for the page's filter buttons, include 'top' only for genuinely top-tier rows>",
  "homepage_url": "<the official product/model page on the maker's own website, verified via web_search -- don't guess from memory. Search for the page dedicated specifically to this model first (labs commonly have per-model docs pages, e.g. a /docs/models/{model-name} path) and use the maker's general product-family page ONLY if no model-specific page exists -- a page that merely technically qualifies is not enough; always link the most specific official page you can verify (verified example: https://www.anthropic.com/claude/opus is Anthropic's actual current page for Opus). Must be the maker's own domain, not a news article, review, or third-party aggregator. Must start with https://>"
}

Do not use em dashes or curly quotes in any text field — plain hyphens and
straight quotes only, to avoid encoding issues when this is saved as JSON.
    `.trim()
  };
}

/**
 * Validates a parsed tracker-rows response before it's allowed anywhere near
 * tracker.html. Throws with a specific reason on failure — callers should
 * treat any throw here as "do not write this to disk", same pattern as
 * generate-indices.js's REQUIRED_ARTICLE_FIELDS validation.
 */
export function validateTrackerRows(rows) {
  if (!Array.isArray(rows)) {
    throw new Error(`Expected a JSON array, got ${typeof rows}`);
  }
  if (rows.length !== TRACKER_ROW_COUNT) {
    throw new Error(`Expected exactly ${TRACKER_ROW_COUNT} rows, got ${rows.length}`);
  }

  const requiredFields = [
    'rank', 'family', 'name', 'flagship', 'tier_emoji', 'tier_label',
    'tier_class', 'is_top3', 'best_for', 'cost_label', 'cost_class',
    'open_badge', 'tags', 'homepage_url'
  ];

  rows.forEach((row, i) => {
    const missing = requiredFields.filter(f => row[f] === undefined || row[f] === null);
    if (missing.length > 0) {
      throw new Error(`Row ${i} (rank ${row.rank}) missing field(s): ${missing.join(', ')}`);
    }
    if (!VALID_TIER_CLASSES.includes(row.tier_class)) {
      throw new Error(`Row ${i} (rank ${row.rank}) has invalid tier_class: "${row.tier_class}"`);
    }
    if (!VALID_COST_CLASSES.includes(row.cost_class)) {
      throw new Error(`Row ${i} (rank ${row.rank}) has invalid cost_class: "${row.cost_class}"`);
    }
    if (!VALID_OPEN_BADGES.includes(row.open_badge)) {
      throw new Error(`Row ${i} (rank ${row.rank}) has invalid open_badge: "${row.open_badge}"`);
    }
    if (row.best_for.length > 280) {
      throw new Error(`Row ${i} (rank ${row.rank}) best_for is ${row.best_for.length} chars — too long, likely a generation error`);
    }
    if (!row.homepage_url.startsWith('https://')) {
      throw new Error(`Row ${i} (rank ${row.rank}) homepage_url must start with https://: "${row.homepage_url}"`);
    }
    try {
      new URL(row.homepage_url);
    } catch {
      throw new Error(`Row ${i} (rank ${row.rank}) homepage_url is not a well-formed URL: "${row.homepage_url}"`);
    }
  });

  const ranks = rows.map(r => r.rank).sort((a, b) => a - b);
  const expected = Array.from({ length: TRACKER_ROW_COUNT }, (_, i) => i + 1);
  if (JSON.stringify(ranks) !== JSON.stringify(expected)) {
    throw new Error(`Ranks are not exactly 1..${TRACKER_ROW_COUNT} with no gaps/repeats: got [${ranks.join(',')}]`);
  }

  return true; // all checks passed
}
