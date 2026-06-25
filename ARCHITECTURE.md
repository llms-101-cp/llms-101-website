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

## Quarterly Reports — confirmed broken, not yet fixed

- **Storage:** `content/reports/{slug}.json` (collection exists in Decap
  config, indexed by `generate-indices.js` into `reports_index.json`)
- **Reality:** `content/reports/` is currently empty. `reports_index.json`
  is always `[]`. The featured section and reports sidebar on `trends.html`
  always show hardcoded placeholder content because the array is empty.
- **`view-report.html`** likely exists (referenced in Decap config
  `preview_path`) but was NOT verified or read during today's session.
  Check it before building anything for reports.
- This is a known gap, not yet addressed. Either build a real reports
  generation workflow, or remove the quarterly reports UI from
  `trends.html` if it's not going to be used.

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
- **KNOWN GAP, not yet fixed:** `admin/review.html`'s rendered preview for
  Trends articles uses quiet fallbacks (`d.summary ? ... : ''`,
  `d.date || ''`) that hide missing fields instead of surfacing them.
  `trends.html` on the live site has no such fallback for `date` or
  `summary`, so a draft can pass visual review looking complete and still
  break in production (see Trends articles CRITICAL GOTCHA #3 above for
  the index-level fix — the dashboard preview itself still doesn't match
  live rendering and would benefit from the same field-checking logic).

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
