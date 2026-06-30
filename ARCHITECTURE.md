# LLMs101.com — Architecture Reference

**Read this file FIRST before making any changes to content systems.**
**Last verified: 2026-06-25, via direct Claude Code repo inspection + live testing.**

This document exists because a lot of today's work was wasted rediscovering
things that should have been known upfront. Don't repeat that — read this,
trust it, and update it whenever something here turns out to be wrong or
something changes.

---

## The four real content systems (confirmed, not assumed)

There are FOUR genuinely different systems for managing content on this
site. They are NOT interchangeable. Using the wrong pattern for the wrong
content type is what caused most of today's problems.

### 1. Mind Map nodes — DYNAMIC, JSON-driven ✅ confirmed working

- **Storage:** `content/nodes/{id}.json`
- **Loader:** `index.html` → `loadCMSData()` → fetches `/content/nodes/root.json`
  as a connectivity test, then fetches every ID in `TREE` if that succeeds
- **Schema:** `{ label, sub, tag, theme, hasChildren, title, body, examples, sources }`
- **CRITICAL GOTCHA:** Adding a new node JSON file is NOT enough. You must
  ALSO add the node's id to the correct `TREE.{branch}` array hardcoded
  inside `index.html`'s `<script>` block, or it will never appear on the
  visual map even though the data loads fine.
- **CRITICAL GOTCHA #2:** The root node file MUST be named exactly
  `root.json`. It was previously misnamed `large-language-models.json`,
  which silently broke the ENTIRE dynamic loading system for ALL node
  types (not just the root) until fixed 2026-06-21.

### 2. Static pages (Beginners/Resources/About/Contact) — DYNAMIC, JSON-driven ✅ confirmed working

- **Storage:** `content/pages/{beginners|resources|about|contact}.json`
- **Loader:** `index.html` → `loadCMSData()` → fetches each page's JSON,
  parses `body` field as Markdown via `marked.js`, injects into the page
- **Schema:** `{ title, body }` — body is Markdown, NOT HTML

### 3. Trends articles — DYNAMIC, JSON-driven ✅ fixed and confirmed working 2026-06-21

- **Storage:** `content/articles/{slug}.json` (NOT date-prefixed — that was
  the old Decap convention but isn't required)
- **Pipeline:** file added/changed in `content/articles/**`
  → `indexing.yml` GitHub Action fires automatically
  → runs `scripts/generate-indices.js`
  → rebuilds `content/articles_index.json`
  → `trends.html` reads that index and PREPENDS dynamic article cards
    above 5 permanent hardcoded cards (fixed 2026-06-21 — used to REPLACE
    them, which silently deleted all 5 real articles the first time a
    real dynamic article existed)
  → clicking a dynamic card goes to `/trends/view-article.html?article={slug}`
  → `view-article.html` fetches the index, finds the matching `file` field,
    fetches that JSON, renders `body` as Markdown via `marked.js`
- **Schema:** `{ title, slug, date, category, read_time, summary, body,
  before_label?, before?, after_label?, after? }` — body is Markdown
- **CRITICAL GOTCHA:** `generate-indices.js` MUST write a `file` field
  (e.g. `"content/articles/{slug}.json"`) for every index entry, or
  `view-article.html`'s lookup fails. This was missing and caused
  `view-article.html` to fall back to a fragile, mostly-broken
  date-guessing cascade (now removed entirely).
- **CRITICAL GOTCHA #2:** `scripts/generate-indices.js` MUST use ES module
  syntax (`import`/`export`), NOT CommonJS (`require`). The repo's
  `package.json` has `"type": "module"`, which makes `require()` crash
  with `ReferenceError: require is not defined in ES module scope`.
- **CRITICAL GOTCHA #3 (fixed 2026-06-25):** A `content/articles/{slug}.json`
  file missing required fields (`date`, `category`, `read_time`, `summary`)
  used to fail completely silently. `generate-indices.js` just copied
  whatever keys existed, and `trends.html` has no fallback for `date` or
  `summary` specifically, so a missing field rendered the literal string
  `undefined` directly on the live `/trends` card. **Fixed:**
  `generate-indices.js` now validates every article against
  `REQUIRED_ARTICLE_FIELDS` (`title`, `date`, `category`, `read_time`,
  `summary`, `body`), excludes any file that fails from the index, prints
  a `::error::` annotation naming the missing fields, and exits non-zero
  so the GitHub Action shows red. `indexing.yml`'s commit step now has
  `if: always()` so valid articles still get indexed even when an invalid
  one is sitting in the same push.
- **The 5 hardcoded fallback cards in trends.html** (Agentic AI, AI Cost
  Collapse, Reasoning Models, DeepSeek R1, Context Window) are real,
  permanent, hand-built standalone HTML files in `trends/`. They are NOT
  part of the dynamic system and should never be converted to it without
  good reason — they work fine as-is.
- **NEVER generate a full standalone HTML file per article going forward.**
  This was tried earlier today (Track 2 v1-v4), worked but was fragile —
  required reproducing the entire CSS template exactly, risked truncation
  at low token limits, required manual layout judgment calls. The JSON
  approach above is simpler, safer, and is the REAL existing system.

### 4. Model cards (`models.html`) — STATIC, hand-coded HTML only ⚠️ no dynamic system exists

- **Storage:** Hardcoded `<div class="mcard">` blocks directly inside
  `models.html`, inside `<div id="model-grid">`
- **No dynamic loading, no JSON, no CMS integration of any kind.**
- Adding/editing a model card means manually editing the shared file.
- **DO NOT attempt to "fix" this by building a dynamic system unless
  explicitly asked** — it works as a static file and converting it is a
  bigger, riskier change than it's worth without a clear reason.
- When generating a new card via automation, it must be reviewed visually
  and pasted in manually — never auto-spliced into the shared file.
- **STALENESS RISK (confirmed 2026-06-25):** `generate.js` calls the
  Anthropic API with no `web_search` tool attached, so model-card content
  is generated purely from training knowledge and can already be stale by
  review time. A generated Grok card referenced a "Grok-2 / Grok-2 mini /
  Grok-3" lineup when the actual current flagship was Grok 4.3 — caught
  only by manually web-searching before pasting it in. Always verify
  model-specific facts (current version names, pricing, context windows)
  independently before approving a model-card draft. The existing OpenAI,
  Anthropic, and Google cards likely have the same staleness problem
  (GPT-4o/o3, Claude 4, Gemini 2.5) — not yet refreshed, known gap.

---

## Quarterly Reports — pipeline fixed 2026-06-26, awaiting first real report

- **Storage:** `content/reports/{slug}.json` (collection exists in Decap
  config, indexed by `generate-indices.js` into `reports_index.json`)
- **Status as of 2026-06-26:** `content/reports/` is still empty — no real
  report has been authored through the dynamic system yet (the current
  quarter, Q2 2026, is already covered by the legacy standalone page below).
  But the pipeline itself is now fixed and ready for the first real entry,
  whenever Craig publishes one via Decap (likely Q3 2026, after quarter end).
- **The 3 existing quarterly reports are real, permanent standalone HTML
  pages** in `trends/` (`state-of-llms-q2-2026.html`, `-q1-2026.html`,
  `-q4-2025.html`) — same pattern and same reasoning as the 5 permanent
  hardcoded Trends articles. They predate the dynamic system, were never
  given `content/reports/*.json` entries, and don't need to be — they work
  fine as-is. **Do not delete or "migrate" them.**
- **Bugs found and fixed during this pass (none caused a live failure yet,
  because no real dynamic report had ever been added — but every one of
  them would have broken on the first real report):**
  1. `generate-indices.js` always built a `view-article.html` URL for the
     `url` field regardless of collection — a real report would have linked
     to the wrong viewer entirely. Now branches by `collectionFolder`.
  2. `generate-indices.js` sorted reports by `year` alone — Q1/Q2/Q3/Q4 of
     the same year would sort in arbitrary (directory-read) order, not
     chronological. Now sorts on a computed `_sort_key` (`year-quarter`).
  3. `generate-indices.js` had no required-field validation for reports —
     the same "renders literal `undefined` on the live page" bug already
     fixed for articles on 2026-06-25 was never extended to reports. Added
     `REQUIRED_REPORT_FIELDS` validation, same pattern as articles.
  4. `trends.html`'s `loadCMSContent()` used to unconditionally **replace**
     the featured block and the entire sidebar report list the moment
     `reports_index.json` had *any* entries — the exact "replace instead of
     merge" mistake that once deleted the 5 real Trends articles. Fixed:
     sidebar now prepends dynamic reports above the 3 legacy ones; the
     featured slot only swaps if the newest dynamic report's `date` is
     actually more recent than the hardcoded fallback's real date
     (`data-fallback-date="2026-06-01"` on `#featured-section`).
  5. `view-report.html`'s "More quarterly reports" footer linked all 3
     legacy reports through `/trends/view-report.html?report={slug}` — a
     route that 404s with "Report not found" for all three, since no
     `content/reports/{slug}.json` backs them. Fixed to link to the real
     standalone pages, and made the list dynamic (merges `reports_index.json`
     with the legacy list, excluding whichever report is currently open).
- **Tested:** `generate-indices.js` changes verified against fixtures (3
  out-of-order reports sorted correctly, one deliberately broken report —
  missing `summary` — correctly excluded with a loud `::error::` and
  non-zero exit). The `trends.html`/`view-report.html` JS changes were
  syntax-checked and logic-reviewed but **not yet verified live** — that
  needs a real (or deliberately temporary/throwaway) entry in
  `content/reports/` pushed through the actual pipeline once these changes
  are merged.
- **Not yet done:** no automation/generation track exists for reports (no
  `EXISTING_REPORTS`-style awareness in `llms101-automation/`, unlike
  articles' `EXISTING_TRENDS_SLUGS`). Given the quarterly (not weekly)
  cadence, this may not be worth automating — reports are rare enough to
  author by hand in Decap. Revisit only if that assumption stops holding.

---

## The automation pipeline (`llms101-automation/`)

```
llms101-automation/
├── .github/workflows/weekly-content.yml   ← Monday 6am UTC cron + manual trigger
├── content-calendar/calendar.json         ← weeks[0] consumed each run, moved to completed[]
├── drafts/{week}/                         ← generated output lands here, never auto-published
├── prompts/
│   ├── track1-json.js                     ← Mind Map nodes + static pages
│   └── track2-trends.js                   ← Trends articles (JSON) + Model cards (HTML block)
├── scripts/generate.js                    ← orchestrates both tracks
└── dashboard/review.html  (deployed to /admin/review.html)
```

- **Nothing is ever auto-published.** Every run produces drafts only. A
  human must review in the dashboard, approve, download, and manually
  upload to the correct location in the main repo. This is intentional.
- **The dashboard fetches from GitHub's raw content API** (public repo,
  no auth needed) — `raw.githubusercontent.com/{owner}/{repo}/main/...`
- **Calendar only reads `weeks[0]`.** If it's missing or malformed, the
  whole run fails with no graceful "nothing scheduled" path. Always keep
  at least one well-formed entry in `weeks[]`.
- **`EXISTING_TRENDS_SLUGS` array in `generate.js` is hardcoded** — it
  lists the real standalone HTML articles so Claude can reference them by
  name. If you add a new permanent hardcoded article to `trends/`, add its
  slug here too, or future-generated articles won't know it exists.
- **`week_of` in `calendar.json` is a queue label, not a real date
  (confirmed 2026-06-25).** `generate.js` doesn't check it against today's
  date — it always pops `calendar.weeks[0]` and tags the output folder
  with whatever `week_of` string that entry happens to carry, whenever the
  script is run (manually or via cron). On 2026-06-21, several weeks were
  drained back-to-back during testing, including one labeled
  `2026-07-06` — so a "future-dated" drafts folder can sit in the repo
  for days before that date, unreviewed, and an old review-notification
  email can still link straight to it. Don't infer anything about when a
  batch was actually generated or reviewed from its `week_of` label —
  check `_completed_at` in `calendar.json`'s `completed[]` array instead.
- **Track 1 (`page`/`node`) and Track 2 (`trendsArticle`) drafts can look
  superficially identical (confirmed 2026-06-25).** Both are JSON files
  with plausible-sounding filenames, and a calendar week doesn't always
  have a `trendsArticle` entry at all. A `page` draft meant for
  `content/pages/{id}.json` was mistakenly uploaded to
  `content/articles/{id}.json` (the Trends folder) because nothing about
  the filename itself signalled which folder it belonged in. The dashboard
  *does* show the correct `targetPath` on each card and in the download
  toast — read it every time, don't assume from the filename or content
  topic alone.
- **Fixed 2026-06-26:** `admin/review.html`'s rendered preview for Trends
  articles used to use quiet fallbacks (`d.summary ? ... : ''`, `d.date || ''`,
  `d.category || 'Explainer'`) that hid missing required fields instead of
  surfacing them. The real live consequence of a missing required field isn't
  "renders a bit thin" — `generate-indices.js` excludes the entry from
  `articles_index.json` entirely, so it never appears on `/trends` at all and
  the indexing GitHub Action fails loudly. The dashboard preview now mirrors
  that: a `REQUIRED_ARTICLE_FIELDS` constant (kept in manual sync with the one
  in `scripts/generate-indices.js` — no shared import is possible between
  these two environments) drives a loud `⛔ Missing required field(s)` banner
  naming exactly which fields are absent and what will happen if uploaded
  as-is. Fallback values that previously masked gaps (`'Explainer'`,
  `'Untitled'`, empty strings) were replaced with explicit
  `[MISSING: fieldname]` markers in the preview itself. `approve()` and the
  Approve button are both now gated on zero missing fields, not just the
  visual-review checkbox, so an incomplete draft can no longer be approved
  and uploaded only to silently vanish on the live site.

---

## Model Tracker (`tracker.html`) — STATIC, no dynamic system exists ⚠️ refreshed 2026-06-27

- **Storage:** Hardcoded `<div class="trow">` blocks directly inside
  `tracker.html`, inside `<div id="tracker-list">`. Same hand-coded pattern
  as `models.html`'s `#model-grid` — confirmed via direct repo inspection
  on 2026-06-27, not assumed from a prior session's summary.
- **No dynamic loading, no JSON, no CMS integration of any kind.** A
  full-repo grep for "tracker" across `scripts/`, `llms101-automation/`,
  all GitHub workflows, and `admin/config.yml` returned zero matches
  outside the page itself — there is no scaffolding to build on here,
  unlike Trends articles or model cards which had partial groundwork
  already.
- **STALENESS RISK (same root cause as models.html, confirmed 2026-06-27):**
  All 8 rows were stale, including one entry (GPT-4o) referencing a model
  that had been fully discontinued (deprecated February 2026) rather than
  merely superseded. Refreshed via independent live web search against
  each lab's own announcement or docs pages — not training-data memory —
  to current flagships: Claude Opus 4.8, GPT-5.5 (Thinking/Pro) +
  GPT-5.5 Instant, Gemini 3.1 Pro + Gemini 3.5 Flash, Grok 4.3 (newly added
  as a 9th row, for consistency with the Grok card already on
  `models.html`), DeepSeek V4, Claude Sonnet 4.6, Llama 4 Maverick.
- **Removed the ↑/↓/→ "change" indicators in this refresh.** They implied
  real month-over-month tracking that never existed — they were
  hand-authored vibes with no historical data behind them. Restoring them
  with *real* data is one of the strongest arguments for the Model Tracker
  automation decision below, once a pipeline exists that can actually diff
  month N against month N-1.
- **Automation decision: built 2026-06-27.** Static file format kept (no new
  JSON schema, no new index, no new fetch logic in `tracker.html` itself —
  matches `models.html`'s pattern), but generation, insertion, and PR
  creation are now fully automated via `.github/workflows/monthly-tracker-refresh.yml`
  (cron: 1st of each month) and `llms101-automation/scripts/generate-tracker.js`.
  This is a new, more-automated pattern than Track 1/2's existing
  draft-for-manual-paste flow: the script writes directly to `tracker.html`
  on a fresh branch, and the workflow opens a PR. **The one thing not
  automated is the merge** — every other Track 1/2 content type requires
  manual review-and-upload via `admin/review.html`; Tracker requires only a
  PR review-and-merge click. `generate-tracker.js` is the only generation
  script in this repo that calls the Anthropic API with the `web_search`
  tool enabled — this is the actual fix for the staleness problem, not just
  a publishing-automation upgrade. If this script's API calls ever start
  failing with a model-not-found error, check whether `claude-opus-4-8` has
  been superseded (Anthropic ships new Opus versions roughly every 6-10
  weeks) and update the model string in `generateTrackerRows()`.
- **Why the merge checkpoint stays.** The site's established principle is
  "nothing auto-publishes without a human look" — this pipeline extends
  that rather than departing from it. Even with `web_search` enabled,
  search results can be stale, contradictory, or SEO-noise, and a wrong
  public AI-model ranking is both a likely failure mode (the landscape
  changes weekly) and a visible one. Schema validation catches malformed
  output but cannot catch plausible-but-wrong content. The human check
  costs about 30 seconds per month; if trust builds over several clean
  runs, full auto-merge is a one-line addition — but that decision belongs
  to Craig after watching a few PRs prove themselves.
- **Debugging history, 2026-06-27 (same day as the build).** Six real bugs
  were found and fixed between building the pipeline and getting one clean
  end-to-end run, in this order:
  1. `applyTrackerUpdate`'s splice logic duplicated a blank line on every
     run (non-idempotent — would have grown by 2 newlines per month
     forever). Found via byte-diff testing against the real file before any
     live run. Fixed in the same PR that built the pipeline.
  2. `generateTrackerRows` joined ALL text content blocks from the
     `web_search`-enabled response, including the model's early
     "I'll research..." planning narration before its first search — so
     `JSON.parse` choked on leading prose. First real production failure.
     Fixed in `e49aee7`: use only the last text block.
  3. The fix for #2 introduced a `ReferenceError` in the catch block
     (`saveError(raw)` referenced a variable that no longer existed after
     the rename) — meaning the diagnostic file was never written when
     parsing failed, so the actual failure content was lost. Fixed in
     `9687b3c`: `saveError(lastText)`.
  4. The fix for #2 used a greedy regex (`/(\[[\s\S]*\])/`) to extract the
     JSON array, which mis-extracts if the model appends citation-style
     trailing brackets after the array closes (plausible given
     `web_search`'s whole purpose is citations) — it would grab everything
     up to the LAST `]` in the text, swallowing trailing prose into invalid
     JSON. Fixed in `c139866`: replaced with `extractJsonArray()`, a
     bracket-depth-counting walker that stops at the bracket matching the
     opener, ignoring anything after.
  5. Re-triggering the workflow on the same calendar day (this debugging
     session re-ran it many times in a few hours) collided with the
     existing dated branch name — `git push` was rejected as non-fast-
     forward. Fixed in `4cd08e7`: `git push --force` to the bot's own
     disposable branch (safe — never touches `main` or a human branch),
     plus check `gh pr list` first and skip `gh pr create` if a PR for
     that branch is already open, so re-runs update the existing PR's diff
     instead of erroring or duplicating.
  6. The fix for #5 used `gh pr list ... -q '.[0].number'`, which renders
     as the literal string `"null"` (not empty) when no PR exists — making
     `[ -n "$EXISTING_PR" ]` true and **silently skipping `gh pr create` on
     every normal month** where no PR exists yet, the single most common
     case. This would have made the automation look healthy (no error)
     while quietly never opening a PR, ever, going forward. Fixed in
     `63e7125`: `.[0].number // empty`, the standard jq idiom for this.
  All six fixes were committed directly to `main` rather than through a PR
  (despite being asked to route at least one through a PR) — worth a
  conscious decision on whether that's fine for script-only changes
  specifically, or whether to actually enforce PR-for-everything going
  forward, rather than leaving it to keep happening by default.
- **Pipeline status (updated 2026-06-27, end of day): both PR-creation
  paths are now verified live.** The "PR already exists, skip create" path
  was verified during the PR #3 debugging cycle. The "cold create" path —
  a genuinely fresh branch with no existing PR — was verified for the
  first time during the PR #4 run (see below): `gh pr create` fired
  successfully on a clean branch once PR #3 had been merged. Both halves
  of the force-push/skip-or-create logic added in `4cd08e7` / `63e7125`
  have now actually been exercised, not just reasoned about.
- **RESOLVED 2026-06-27: curation pattern in the generated rankings.**
  Across both real `web_search`-driven generations that day, Anthropic
  occupied 3 of 9 rows (Opus 4.8, Sonnet 4.6, Haiku 4.5) and Meta/Llama had
  zero representation, despite the prompt explicitly listing Llama as a
  valid open-weight option. Decision: option 3 — merged PR #3 as-is (every
  row individually defensible; the pattern was about aggregate balance,
  which schema validation can't catch and only a human read of the full
  set can), and treated the prompt fix as a separate follow-up rather than
  blocking the merge. A per-maker cap was explicitly considered and
  explicitly rejected as the fix — see the PR #4 bullet below for what was
  actually changed instead and whether it worked.
- **Pipeline changes landed 2026-06-27 (next-cycle, not retroactive to PR #3).**
  Two changes shipped together, bundled by timing not dependency:
  1. **12-row expansion.** `TRACKER_ROW_COUNT` raised from 9 to 12.
     Category guidance updated to match: 3-4 closed frontier Tier 1 models,
     2-3 open-weight frontier models (explicitly plural — the old "1 open-weight"
     language was part of why Llama got zero representation across both real
     runs), 1-2 mid-tier/best-value, 1-2 budget/speed, 1-2 specialized or
     emerging. A per-maker cap was explicitly considered and explicitly rejected
     — nothing in the guidance limits how many rows any one company can have.
     Whether the expanded category language actually broadens coverage is
     unverified; watch the first couple of real runs.
  2. **Model-name hyperlinks.** Each tracker row now links the model name to
     its official homepage. Added `homepage_url` field to the JSON schema
     (required, validated: must start with `https://` and pass `new URL()`).
     The prompt instructs the model to verify the URL via `web_search` rather
     than guessing from memory. `renderTrackerRow` wraps the name in
     `<a href="..." target="_blank" rel="noopener">`. CSS added to
     `tracker.html`: `.model-name a{color:inherit;text-decoration:none}` /
     `.model-name a:hover{color:var(--gold);text-decoration:underline}`.
     Known limitation: validation confirms the URL is well-formed and starts
     with `https://` but does NOT live-fetch it — a plausible-looking URL
     can still 404. Also fixed `extractCurrentRowsSummary` in
     `generate-tracker.js` to strip inner tags when reading back model names
     (the old `[^<]*` regex would have silently produced empty strings for
     every name once rows contained `<a href="...">name</a>`).
- **PR #4 — first real run of the expanded pipeline, 2026-06-27.** Before
  any live API call: 8/8 mock tests passed (valid rows, wrong row count,
  missing `homepage_url`, `http://` instead of `https://`, `javascript:`
  scheme, malformed URL, `&`-escaping, link structure). `extractCurrentRowsSummary`
  was also fixed in the same change — the old `[^<]*` regex for reading
  back model names would have silently produced empty strings for every
  name once `model-name` divs contain `<a href="...">name</a>` instead of
  plain text; switched to `[\s\S]*?` plus stripping inner tags, verified
  against real content.

  Real run result: 12 rows generated, all names hyperlinked, open-weight
  coverage broadened from 1 row to 3 — DeepSeek V4-Pro, Kimi K2.6 (Moonshot
  AI), Qwen3.6-27B (Alibaba) — genuine diversification across three
  different labs rather than the same concentration at a larger scale.
  Anthropic's share moved from 3/9 (33%) to 3/12 (25%) — same absolute row
  count, smaller proportion, with three entirely new labs (Moonshot,
  Qwen, Mistral) appearing for the first time. One real data point, not a
  guarantee this holds every month — worth watching, not assuming fixed.

  PR #4 reviewed and merged the same day. Two non-blocking quality notes
  from that review, independently verified (both models are real, current,
  non-hallucinated releases — the issue is relevance/specificity, not
  factual accuracy), worth tightening in the prompt next cycle rather than
  re-litigating now:
  - The OpenAI "budget" slot picked GPT-5.4 mini (real, but an
    older-generation, more developer/API-focused model) over GPT-5.5
    Instant — correctly used for the same slot last cycle, and OpenAI's
    actual current ChatGPT default. Worth nudging the prompt to prefer
    whichever sibling of the current flagship generation is most current,
    not just whichever happens to satisfy "budget/speed-optimised."
  - GPT-5.4 mini's `homepage_url` pointed to a generic docs index page
    (`platform.openai.com/docs/models`) when a model-specific page
    (`platform.openai.com/docs/models/gpt-5.4-mini`) existed and would
    have satisfied the "prefer the most specific page" instruction better.
    Worth emphasizing "most specific, not just any page that technically
    qualifies" more strongly in the prompt.

---

## Site-wide staleness audit (started 2026-06-27)

Prompted by how stale `tracker.html` and `models.html` both turned out to
be: if hand-coded pages drift that badly, the rest of the site's static
text — the Mind Map (`index.html`), `guide.html`, static `content/pages/*`
— was worth checking too, not assumed fine by default.

**Division of labor that worked well:** Claude Code did inventory and
mechanical edits; a chat session did live-search verification before
anything was trusted. Worth repeating this split for the remaining work
below, rather than letting either side skip the other's part.

**Process note:** the first pass at this skipped the verify-before-edit
checkpoint — Claude Code went straight to making content edits instead of
stopping after inventory to report back first, as instructed. The edits
themselves then needed a full retroactive fact-check before they could be
trusted, including catching and fixing two real errors that had already
landed (see below). No content went live unverified, but the checkpoint
existed for a reason and got skipped once. Worth being explicit about that
boundary again if delegating this kind of audit further.

**Completed 2026-06-27 — `index.html` + `guide.html`, OpenAI/Anthropic/
Google/context-window sections (PR #5, merged 11:31 UTC):**
- GPT-4o/o1/o3/GPT-4.1 → GPT-5 family (GPT-5.5 flagship, GPT-5.4 workhorse,
  o-series folded into GPT-5.4 Thinking mode).
- Claude 3.5 Sonnet/Claude 3 Opus → current Claude 4.x lineup (Opus 4.8,
  Sonnet 4.6, Haiku 4.5).
- Gemini 2.0 family → Gemini 3.1 Pro / 3.5 Flash.
- Context-window figures updated to reflect the ~1M-token convergence
  across frontier models.
- Two errors caught and fixed only because they were independently
  verified rather than trusted on the first pass: the correction round
  itself introduced "GPT-5.3 Instant" as the current ChatGPT default,
  which was already stale by ~7 weeks (GPT-5.5 Instant replaced it
  2026-05-05) — a reminder that "default model" claims are exactly the
  kind of fact that flips on a specific date and is easy to land one
  generation behind on. Separately, Fable 5 was initially described as
  "the most capable publicly available model," which was false at time of
  writing — Fable 5 and Mythos 5 have been suspended for all users since
  2026-06-12 under a US export-control directive, not restored as of this
  writing. Both fixed before merge; Claude Opus 4.8 is correctly identified
  as the most capable model currently accessible to the public.

**Completed 2026-06-27 — `models.html` refresh + expansion (PR #6):**
7 cards → 10. 6 cards refreshed (OpenAI, Anthropic, Google, Llama,
DeepSeek, Mistral); Grok got a hyperlink added only (content already
refreshed 2026-06-25); 3 new cards added: Muse Spark (Meta's new
proprietary model — distinct from Llama, needed its own card to explain
the open→closed pivot), Qwen (Alibaba's open-weight range), Kimi (Moonshot
AI, agentic coding specialist).

Speed/Reasoning/Cost bars are wired to a single Artificial Analysis
Intelligence Index snapshot (fetched 2026-06-27) using a consistent
methodology across every card: Reasoning = sqrt(Intelligence Index) ×
(9.5 / sqrt(max index in set)), **square-root-compressed** rather than
raw-linear so models well behind the literal frontier (e.g. Llama,
Intelligence Index 14) don't visually read as "barely functional" on a
benchmark deliberately built from the hardest academic tests. Speed =
tokens/sec normalised to Gemini 3.5 Flash at 174 t/s. Cost width = 5 +
95 × (max price − this price) / (max price − min price), bounded by
DeepSeek ($0.18/1M) and OpenAI ($4.35/1M). Do not "fix" the compression
back to linear without understanding this — it would misrepresent
open/efficient models. Muse Spark's Speed and Cost bars are genuinely
0-width (no speed or pricing data exists yet, not a research gap).

**Completed 2026-06-27 — Mind Map node fixes (`index.html`'s `NODE_DATA`):**
Reviewed all 34 remaining nodes (4 — `openai`, `anthropic-model`,
`google-model`, `context-window` — were already fixed in an earlier pass).
Found most genuinely evergreen (math/concept nodes, career-role nodes,
`dense`'s historical architecture reference). Four nodes had genuine
current-state staleness: `open-models` (full rewrite — Llama 3/DeepSeek
V3/generic Qwen presented as current, same pattern as the stale
`models.html` cards), `open-closed`/`reasoning`/`moe` (example-list updates
only, core concept explanations were already evergreen). Deliberately left
`training`/`data`/`synthetic`'s specific illustrative figures (Llama 3
training cost, data volume, GPT-4/Phi-3 synthetic-data relationship)
untouched — these are order-of-magnitude examples, not "current state"
claims, and don't need to track every model generation.

Also checked all 11 external links in `content/pages/resources.json` for
link rot — none found, no changes made.

**Completed 2026-06-28 — Q2 quarterly report rewrite
(`trends/state-of-llms-q2-2026.html`):** The original June 1 article was
describing Claude 4 Opus, o3, GPT-4o, and Gemini 2.5 Pro as current, with
Llama 4/Qwen 3 as "next quarter" watch items — all stale by late June.
Treated as a genuine end-of-quarter retrospective. Three real stories that
defined the actual quarter: (1) Fable 5 launched June 9, suspended
worldwide June 12 by US Commerce Department export-control directive —
the first time a government order reached a live commercial AI API rather
than chips or weights; (2) open-weight field (DeepSeek V4, Qwen3.6,
Kimi K2.6/K2.7 Code) reached genuine near-frontier parity on independent
benchmarks; (3) Meta reversed its open-weights strategy with Muse Spark.
All dates and model names verified via live web search before writing, not
carried over from training data. Also updated JSON-LD `dateModified` and
`about` array, and meta/og description tags.

**Completed 2026-06-28 — static Trends articles audit (PR #10,
`trends-audit-2026-06-28`):** Audited all 8 remaining hand-coded HTML
articles in `trends/` (the ones outside the dynamic JSON pipeline and
GitHub Action automation). 5 were stale and updated; 3 were confirmed
clean and left untouched.

*Fixed (5):*
- `context-window-arms-race.html` — lede and BA block updated to reflect
  tri-lab convergence at 1M tokens (GPT-5.5/Claude Opus 4.8/Gemini 3.1
  Pro); Anthropic long-context pricing elimination noted; growth figure
  corrected to 250x in three years.
- `reasoning-models-explained.html` — reframed from separate o-series
  model line to built-in Thinking mode; o3 sunset path noted; model list
  updated to current lineup (GPT-5.5, Claude Opus 4.8/Sonnet 4.6, Gemini
  3.1 Pro, DeepSeek V4).
- `ai-cost-collapse.html` — GPT-4o (retired Feb 2026) replaced with
  GPT-5.4 nano pricing; parenthetical added noting the retirement as a
  data point in the cost-collapse story. **Known deferred item:** three
  inconsistent multipliers remain in this article (title says "100x in two
  years", body now says "300x+ in under three years", lede implies
  10,000x). Reconciling them was scoped out of this pass — they are
  internally inconsistent but none is actively wrong.
- `state-of-llms-q4-2025.html` — three factual bugs fixed: summary box
  wrongly said "Q1 2026 at a glance"; lede treated DeepSeek R1 as
  upcoming (it released Jan 2025, not Jan 2026); DeepSeek R1 shadow
  section had internal contradiction describing R1 as both upcoming and
  already-happened.
- `agentic-ai-explained.html` — reasoning models list updated from
  o3/Claude 4 Opus/Gemini 2.5 Pro to current Thinking mode framing.

*Confirmed clean, no changes (3):*
- `state-of-llms-q1-2026.html` — consistently past-tense retrospective.
- `why-every-lab-is-racing-to-build-coding-agents.html` — zero specific
  model/date references; genuinely evergreen.
- `deepseek-r1-what-it-proved.html` — one GPT-4o mention is legitimate
  historical comparison, not a current-state claim.

**Audit lesson:** lede framing alone is not a reliable staleness signal.
`agentic-ai-explained.html` had an evergreen-looking lede but a stale
body (o3/Claude 4 Opus/Gemini 2.5 Pro in the reasoning models list).
Body content needs an actual read, not just a lede scan.

**Completed 2026-06-28 — AI Agents + MCP nodes added to Mind Map
(`index.html`, branch `agents-mcp-nodes-2026-06-28`):** Two new leaf nodes
added under the Prompting branch: `agents` ("AI Agents: How They Actually
Work") and `mcp` ("Model Context Protocol (MCP): Why It Matters"). Both
nodes explain mechanics that were previously only mentioned in passing in
other nodes' `examples` arrays — `ReAct prompting` in `cot`,
`Agent hijacking` in `injection` — but were never actually explained
anywhere. Total Mind Map node count went from 38 to 40.

**TREE discovery — standing checklist item for any future node addition:**
`NODE_DATA` entries have no `children` field. Parent-child relationships for
the visual Mind Map are defined in a completely separate object,
`const TREE = {...}`, a few hundred lines further down in `index.html`.
**Adding a node to `NODE_DATA` alone does not make it reachable from the
Mind Map — it also has to be added to the relevant array in `TREE`, or it's
orphaned and invisible.** For these two nodes: both added to `NODE_DATA`
(after `injection`, completing the `prompt` theme cluster) AND to
`TREE.prompting`'s children array.

Note: `themes` is a legitimate exception to the TREE pattern — it's
rendered via a fixed-position `themeY` mechanism, not the click-to-expand
branch pattern. Not a bug, just a different rendering path for that
category.

This is distinct from the existing CRITICAL GOTCHA in the "Mind Map nodes —
DYNAMIC, JSON-driven" section above, which concerns adding a new
`content/nodes/{id}.json` file to the dynamic system. These two edits were
to `index.html`'s inline `NODE_DATA` and `TREE` objects (the static/inline
path), not the dynamic JSON file path. Both require the same two-part edit
(data + TREE), but via different mechanisms.

**EXAMPLE_DATA discovery — critical: do not delete "orphaned-looking" entries
without checking this object first.** `index.html` contains a *third*
relevant inline object, `let EXAMPLE_DATA = {...}` (around line 1047),
separate from both `NODE_DATA` and `TREE`. Every node's `examples` array
renders as clickable pills in the sidebar; clicking a pill calls
`openExampleDetail(exampleText, parentId)`, which looks up
`EXAMPLE_DATA[exampleText]` — keyed by the **exact example text string**,
not a slug. This powers per-example "deep dive" popups. The entries look
identical to `NODE_DATA` entries at a glance, use quoted-string keys with
spaces rather than slug-style IDs, and do NOT appear in `TREE` (they don't
need to — they're popup detail, not top-level nodes). **Before deleting
anything that looks like an orphaned node, confirm which object it lives
in.** Deleting an `EXAMPLE_DATA` entry silently breaks the corresponding
example pill's popup and falls back to a generic "is a specialized
technical concept..." message with no error. `EXAMPLE_DATA` has exactly
157 entries as of 2026-06-29 — use this as a sanity-check after any edit
to confirm nothing was accidentally removed.

**Correction to the earlier "independent review overstated node count"
note:** the review cited 157 Mind Map nodes. The actual `NODE_DATA` count
at that time was around 37-38. It is now confirmed the review almost
certainly found `EXAMPLE_DATA` (157 entries, exact match) and mislabeled
it as the Mind Map node count — not a general overestimate.

**Completed 2026-06-29 — Evaluation & Benchmarks node + hardware body fix
(`index.html`, branch `evaluation-hardware-fix-2026-06-29`):**

- New `evaluation` node added to `TREE.themes` alongside `open-closed`,
  `safety`, and `hardware`. Content covers what a benchmark is, saturation
  (MMLU/HumanEval/GSM8K all at ~90%+ across frontier models), contamination,
  human-preference arenas (tied explicitly to this site's own Model Tracker
  Elo scores), and LLM-as-a-judge. Deliberately avoided citing precise
  current benchmark percentages — described saturation as a structural fact
  rather than a "current score" to avoid the node needing monthly revisiting.
  NODE_DATA count: 40→41.

- `hardware` node body was a broken placeholder visible to any visitor
  (`<p>LLMs run on GPUs... (keeping your existing text) ...reducing memory
  requirements ~8x with modest quality loss.</p>`) since the file's earliest
  commits. Written from scratch: covers GPUs/Tensor Cores/CUDA lock-in,
  Google TPUs as a real alternative, quantization/GGUF/llama.cpp for
  consumer hardware, and Apple Silicon's unified-memory advantage. The 7
  `EXAMPLE_DATA` entries for the hardware node (`NVIDIA H100`, `A100`,
  `CUDA platform`, etc.) were confirmed intact and untouched — 157 entries
  total unchanged.

**Completed 2026-06-29 — Mind Map search feature (`index.html`, branch
`mindmap-search-2026-06-29`):** Full-text search across 189 concepts (41
`NODE_DATA` nodes + 148 reachable `EXAMPLE_DATA` entries). Scoped to the
Mind Map only — Tracker/Directory (small enough for filter buttons) and
Trends (different full-text-search problem) deliberately excluded.

Implementation: search box (`#map-search`) positioned top-left of
`#page-mindmap-inner` (separate from the existing bottom-right
`.map-controls`); `buildSearchIndex()` called after `loadCMSData()` in
the init sequence so the index reflects any CMS-merged node updates;
`jumpToNode()` reuses the existing `expandedNodes`/`visibleNodes`/
`collapseNode`/`updateExpandHint` state rather than a parallel mechanism;
`centerOnNode()` computes pan offset from `POS[id]`/`W`/`H`/`mapScale`
following the same transform math `updateTransform()` uses; arrow-key
navigation, Escape-to-close, and click-outside-to-close all wired.
Matches against node ID as well as display text (`searchConcepts` filters
on `item.id` too, so "mcp" finds "Model Context Protocol" correctly).
Placeholder text set dynamically from real index length, not hardcoded.

**9 orphaned `EXAMPLE_DATA` entries — known gap, deferred:** these keys
exist in `EXAMPLE_DATA` but no node's `examples` array references them,
so they're unreachable from any example pill AND excluded from the search
index. Most are likely stale from earlier staleness fixes that updated
`examples` arrays to current model names without removing the old detail
entries. The 9 keys: `Qwen 3.5`, `DeepSeek V3`, `OpenAI o1`, `OpenAI
o3`, `DeepSeek R1`, `Gemini Thinking`, `Llama 3.3 70B`, `Mistral Large`,
`Phi-4`. Whether to re-link them or delete them is a content decision —
not fixed here, listed explicitly so they don't need rediscovering.

**Live browser check still needed before trusting fully:** data/logic
verified; on-screen rendering (search box visual placement, dropdown
positioning on mobile, centering math landing correctly, theme-row nodes
highlighting on canvas after jump) has not been confirmed in an actual
browser. Theme-row nodes (`hardware`, `evaluation`, `open-closed`,
`safety`) handled defensively (`jumpToNode` adds target to `visibleNodes`
unconditionally, sidebar opens regardless), but canvas highlight for
those nodes specifically warrants a look.

**Completed 2026-06-29 — theme-row visibility fix + reset-view button
(`index.html`, branch `theme-visibility-reset-2026-06-29`):**

**Bug 1 — theme-row nodes invisible and unclickable from first load
(pre-existing, structural, not introduced by search or `evaluation`
addition):** `.node-box` CSS defaults to `opacity:0; pointer-events:none`
and only becomes visible when the `.visible` class is applied (driven by
`visibleNodes`). `visibleNodes` was only ever populated by three things:
the initial `['root']`, the branch-expand flow (`toggleChildren`), and
`jumpToNode`. Nothing ever added theme-row nodes (`open-closed`, `safety`,
`hardware`, `evaluation`) to it — all four were invisible and unclickable
from page load, permanently, until search happened to add whichever one
you searched for defensively. **Fix:** `visibleNodes.add(id)` added inside
`initLayout`'s existing `themeIds.forEach` loop — the same place their
positions are computed — so all 4 are in `visibleNodes` from first render.

**Bug 2 — no path back to the full overview after expanding a branch or
jumping via search:** Added a `⌂` button to `.map-controls` (alongside
zoom +/−) calling `resetMapView()`: collapses any expanded root branch,
closes the sidebar, restores the exact initial pan/zoom (`mapScale` 0.85
desktop / 0.6 mobile, horizontally centered, `panY` 0) — same math
`initInteractivity()` uses on first load, so reset means genuinely back
to the start.

**Follow-up 2026-06-29 — pan bounds + scroll discoverability
(`pan-bounds-scroll-hint-2026-06-29`, PR #15, superseded and closed):**
Live browser debugging confirmed theme nodes had the correct `.visible`
class and pixel position — but `#page-mindmap-inner` has `overflow:hidden`
and `height:80vh` (~500px), while the canvas was 900px tall. The theme row
was always reachable by dragging; visitors had no indication to try.
PR #15 addressed this with pan-bounds clamping and a "more below" scroll
cue — real, correct work — but was superseded before merging by the
structural fix below, which made the scroll-to-find mechanism unnecessary.

**Important lesson for future "node X isn't showing" reports:** check
viewport/overflow, not just the `.visible`-class mechanism. A node can
be correctly marked visible and still be invisible if it's clipped by a
fixed-height `overflow:hidden` container with no scroll cue.

**Structural resolution 2026-06-29 — `themes` becomes a real root branch
(`themes-as-real-branch-2026-06-29`, PR #16):** After seeing PR #15's
preview, Craig identified the deeper issue: `themes` wasn't just hard to
find — it was structurally disconnected, with no connector line to root,
not following the expand/collapse pattern every other branch uses. The fix
made `themes` a genuine 6th root branch labeled **"What Else Matters"**
(alongside Mathematics / Training process / Architectures / Prompting /
AI Roles), with a new branch-header `NODE_DATA` entry and `themes` added
to `TREE.root`. The connector-drawing logic (`drawConnectors()`) was
already fully generic — driven by `Object.keys(TREE).forEach(...)` — so
no new mechanism was needed. The entire fixed-position theme-row layout
block in `initLayout()` was removed (net code reduction: 14 insertions,
20 deletions). NODE_DATA count: 41→42. Search index: 189→190.

New branch node: `themes` — label "What Else Matters", sub "openness,
safety, hardware & evaluation", `hasChildren:true`. The body frames these
4 topics as surrounding context distinct from the other branches'
internal mechanics — "the surrounding questions worth understanding
regardless of which model you use."

**Follow-up commit on PR #16 — row-wrap fix + duplicate connector
cleanup:** A screenshot of the expanded "What Else Matters" branch showed
3 children in a row with the 4th (Evaluation & Benchmarks) wrapping to
its own row below, connected by a long dangling line. Root cause: `perRow`
was hardcoded to `3` for all branches; the old fixed-position theme row
had always forced 4-in-a-line, so wrapping only became visible when
`themes` started going through the generic layout. `math` had the same
silent 3-then-1 wrap the whole time. Fix: `const perRow = children.length
<= 4 ? children.length : 3` — branches with ≤4 children get a single row,
larger branches wrap at 3 as before. Only `math` and `themes` change
behavior; `training`/`arch`/`prompting`/`roles` are byte-for-byte
unaffected (verified against every real branch's actual child count).

**What worked:** live console debugging (`expandedNodes`, `visibleNodes`,
connector pair counts all independently confirmed correct) plus an actual
screenshot — the screenshot pinpointed a visual-only symptom that code
reading alone had missed across two earlier rounds.

**Pre-existing bug fixed along the way:** `drawConnectors()`'s second
loop iterates `Object.keys(TREE)`, which includes `'root'` — so every
root→branch line was added once by the explicit first loop and again by
the generic second loop. Harmless visually (duplicates rendered on top of
each other), but doubled the SVG element count on every render. Fixed:
`if (parentId === 'root') return` skips that key in the second loop.

**Third commit on PR #16 — curve-strength fix, tried then REVERTED (4th
commit):** `curveStrength` was `distY * 0.5` for all connectors. Theory:
on a single-row 4-child layout the vertical gap is fixed but horizontal
spread is wide — `open-closed`/`evaluation` are ~270-285px apart from the
parent, producing a flat diagonal. Tried `Math.max(distY * 0.5, distX *
0.2)` for branch-to-children connectors only. **This made `evaluation`
visibly worse, not better** — confirmed mathematically: the new strength
(53.4px) exceeded the actual vertical gap (42px), so the Bezier control
points overshot past the target before curving back, producing a visible
loop/hook shape (matches Craig's follow-up screenshot exactly). Reverted
via the 4th commit.

**Unresolved: `hardware`'s reported issue was never actually explained.**
Craig named `hardware` specifically as broken-looking, both before and
after the curve-strength attempt. But `hardware`'s curve strength was
mathematically *unchanged* by that fix (21px either way — its horizontal
distance, 95px, wasn't large enough to trigger the `Math.max` branch), so
whatever's wrong with `hardware` is a different cause than the flatness
theory that motivated the (reverted) fix. Next session picking this up:
don't assume flatness is the explanation for `hardware` — get fresh
coordinate data for it specifically, ideally alongside `safety` (which
looks fine and has near-identical distX/distY/curveStrength to
`hardware`) to find what's actually different between the two.

**Not yet touched:** `content/pages/*.json` (about, beginners, contact,
resources) and the broader Mind Map node content beyond the four sections
above — `content/nodes/` only has 2 files (`fine-tuning.json`, `root.json`)
despite `index.html` clearly containing far more node content than that;
where the rest of it actually lives was never fully resolved this session
and is worth pinning down before assuming the audit's scope is complete.

---

## Two completely separate "scripts" locations — do not confuse them

- **`/scripts/`** (repo root) — pre-existing site infrastructure.
  Currently contains `generate-indices.js` only. Runs via `indexing.yml`.
- **`/llms101-automation/scripts/`** — today's automation pipeline.
  Contains `generate.js`. Runs via `weekly-content.yml`.

These are unrelated to each other. A file with a similar name in one
folder has nothing to do with the other.

---

## Security note (resolved 2026-06-21)

A `_headers` file at the repo root once contained a Netlify Basic-Auth
rule for `/admin/*` with a literal placeholder password
(`yourchosenpassword`). It has been DELETED. Do not recreate it — the
review dashboard's protection is an in-page JavaScript password screen
inside `review.html` itself (`CORRECT_PASSWORD` constant), and Decap CMS
is protected separately via Netlify Identity login. Neither needs
`_headers`.

---

## Before making ANY change to a content system

1. **Check this file first** for the relevant system.
2. **If something here seems wrong or you're unsure**, don't guess —
   open Claude Code, point it at the actual repo, and ask it to read the
   relevant files directly. Today proved that pasting fragments back and
   forth is slow and error-prone compared to direct repo access.
3. **If you discover something new or fix something**, update this file
   in the same commit. This file is only useful if it stays accurate.

---

## What got fixed today (2026-06-21), in order

1. Restored `scripts/generate-indices.js` (accidentally deleted, then
   recreated, then fixed for ES module syntax)
2. Deleted exposed `_headers` file with placeholder password
3. Discovered `content/articles/` was NOT orphaned — it's the real Decap
   article system, just missing its `file` field in the index and missing
   a link from `trends.html`
4. Fixed `view-article.html` — removed fragile 24-URL date-guessing
   cascade, removed hardcoded "Continue reading" link to a specific
   report, now relies on index lookup
5. Fixed `generate-indices.js` — now writes `file` and `url` fields
6. Fixed `trends.html` `buildArticleCard()` — links through
   `view-article.html` instead of expecting a standalone file
7. Fixed `trends.html` `loadCMSContent()` — merges dynamic articles with
   hardcoded ones instead of replacing (this bug was only exposed by
   fix #3-6 actually working)
8. Rebuilt Track 2 automation — Trends articles now generate as a single
   JSON file matching the real schema, not a standalone HTML file
9. Deleted 5 inert placeholder JSON files in `content/articles/` (all
   contained literal text "This article was migrated automatically...")
10. Deleted 2 broken test JSON files (Karpathy, RAG) from earlier testing

**Verified live end-to-end:** Mind Map node (Fine-tuning) and Trends
article (Why Every Lab Is Racing to Build Coding Agents) both published
successfully through the fixed pipeline.

---

## What got fixed today (2026-06-25), in order

1. Added schema validation to `scripts/generate-indices.js` for Trends
   articles — files missing `date`/`category`/`read_time`/`summary`/
   `title`/`body` are now excluded from `articles_index.json` with a loud
   `::error::` annotation instead of silently rendering `undefined` on
   `/trends`
2. Added `if: always()` to `indexing.yml`'s commit step so one invalid
   article no longer blocks valid ones from being indexed in the same push
3. Diagnosed a content mix-up: a Track 1 `page` draft (Resources page
   update) had been uploaded to `content/articles/resources.json` instead
   of `content/pages/resources.json`, making a static-page update look
   like a malformed Trends article
4. Added Simon Willison's blog to the real `content/pages/resources.json`,
   matching the existing `resource-card` HTML styling — completed the
   `week_of: 2026-07-06` calendar task that had been sitting unreviewed
   since 2026-06-21
5. Added an accurate Grok model card to `models.html` (current as of
   2026-06-25: Grok 4.3, 1M-token context) — the originally generated
   draft referenced a stale Grok-2/Grok-3 lineup, caught by web search
   before pasting it in
6. Deleted the misplaced `content/articles/resources.json` Trends article
   once the real Resources-page fix (step 4) was confirmed live
7. Documented the `week_of` queue-label behavior, the `generate.js`
   web-search staleness gap, and the dashboard's too-forgiving preview as
   known issues (see relevant sections above)

**Verified live end-to-end:** `content/pages/resources.json` and
`models.html` both confirmed correct after a mid-session file mix-up;
`generate-indices.js`'s new validation logic tested against both a
deliberately broken file (correctly excluded) and the real repo content
(0 errors, clean index rebuild).
