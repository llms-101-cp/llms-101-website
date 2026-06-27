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
- **Current pipeline status (as of 2026-06-27, end of day): the "PR already
  exists, skip create" path has been verified live. The "cold create" path
  — a genuinely fresh month with no existing PR — has NOT yet been
  empirically tested**, because every real run so far happened on the same
  calendar day as an already-open PR (#3). The very first real cold-create
  test will be either next month's natural cron firing, or a manual
  `workflow_dispatch` trigger run on a day with no open tracker PR.
- **OPEN, UNRESOLVED as of 2026-06-27: a curation pattern in the generated
  rankings, not a technical bug.** Across both real `web_search`-driven
  generations this session, Anthropic occupied 3 of 9 rows (Opus 4.8,
  Sonnet 4.6, Haiku 4.5) and Meta/Llama had zero representation, despite
  the prompt explicitly listing Llama as a valid open-weight option
  alongside DeepSeek. This is consistent across both runs, not a one-off.
  Schema validation cannot catch this category of issue — every row was
  individually valid and defensible, the pattern is about aggregate
  balance, which only a human reviewing the full set can judge. PR #3 is
  open and **deliberately not yet merged** pending a decision on this.
  Three options were on the table, none chosen yet:
  1. Merge PR #3 as-is (each row defensible on its own merits) and leave
     the prompt unchanged.
  2. Hold PR #3 and adjust `buildModelTrackerPrompt` first — e.g. cap rows
     per maker, or make the open-weight category language stickier so it
     doesn't get silently swapped for a same-maker row.
  3. Merge PR #3 now, treat the prompt adjustment as a separate follow-up
     for next month, decoupling "is this month's content fine" from
     "should curation logic change going forward."
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
