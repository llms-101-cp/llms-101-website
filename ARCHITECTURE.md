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
