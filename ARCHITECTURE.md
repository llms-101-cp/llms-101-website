# LLMs101.com — Architecture Reference

**Read this file FIRST before making any changes to content systems.**
**Last verified: 2026-08-31 — split into current-state reference (this file)
+ dated incident history (PR #47). Section notes through 2026-07-22 supersede
where present; the blow-by-blow debugging narratives were moved out (see below).**

**Full dated incident history: `docs/ARCHITECTURE-history.md`** — this file
is now the lean current-state reference (schemas, gotchas, mechanics,
outstanding work). Every "how we found this bug" / "what got fixed on date X"
narrative lives in the history doc; consult it when you need the story behind
a fix, not just the current rule.

This document exists because a lot of early work was wasted rediscovering
things that should have been known upfront. Don't repeat that — read this,
trust it, and update it whenever something here turns out to be wrong or
something changes.

---

## Outstanding work — consolidated list (updated 2026-08-31)

Single source of truth for what is still open. Detailed context lives in
the dated sections below — this list only points at them. Maintenance
rule: any session that completes, adds, or re-scopes one of these items
must update this list in the same commit as the work itself. (Its
reader-facing twin: any PR changing reader-facing content must append a
`content/changelog.json` entry in the same PR — see content system 5.)

### Immediate follow-ups

* P1 — Pipeline changelog integration. **Landed 2026-07-20.** After a
  successful publish, `validate-and-publish.js` appends one entry to the
  END of `content/changelog.json` (area: Mind Map for nodes, Trends for
  articles) in the same publish commit; on append failure the publish
  proceeds and a warning appears in the report email. `generate-tracker.js`
  appends a Tracker entry alongside `tracker.html` in its monthly PR commit;
  the workflow was widened to stage `content/changelog.json` too. Shared
  helper: `scripts/changelog-append.js` (fail-soft: reads, validates
  round-trip JSON parse, writes — any error returns a warning, never throws).
  Deferred from PR #24 because the script files carried uncommitted in-flight
  self-planning work; first concrete instance of the gap was publish commit
  `9dfa54c` (no changelog entry); backfilled manually in PR #27 same day.

* P2 — Narrow /updates changelog scope. New article publication should NOT
  generate a changelog entry going forward (the Trends index already catalogues
  new articles) — only a correction to a previously published article's factual
  content should. Requires: (1) remove the `area: Trends`-on-every-publish
  behaviour from `validate-and-publish.js`'s changelog-append call, since
  automated publishes are always new articles, never corrections; (2) define
  how a manual correction to an existing article gets its own changelog entry
  (no such flow exists today — likely a manual/PR-based append, not automated);
  (3) update ARCHITECTURE.md System 5 rule text to match. Not started.

* P3 — Methodology & Glossary page + tracker.html sourcing fix. **Landed
  2026-07-21 (PR #29 + follow-up commit 69ae9df).** New
  `content/pages/methodology.json` registered in `index.html` (CMS fetch
  list, nav link, fallback page div); `_redirects` entry added
  (`/methodology → /index.html 200`); PAGE_ROUTES handler in `load` init
  opens the correct section when the URL path is `/methodology`. `tracker.html`
  lines 222 and 482 corrected — both previously misattributed rankings to
  LMSYS Chatbot Arena; `generate-tracker.js` actually uses unconstrained
  `web_search`. Footer now links to `/methodology`. Changelog entry appended
  (area: Site, 2026-07-21). Two-nav GOTCHA resolved by the nav redesign below.

* Nav redesign — Unified navigation. **Landed 2026-07-21 (PR #30, merge
  commit a102630).** Replaced all per-page hardcoded `<nav>` blocks across
  17 HTML files with a single data-driven system: `content/settings/nav.json`
  (source of truth) + `scripts/render-nav.js` (injected via `<script defer>`
  in every page's `<head>`). Desktop: persistent top bar with hover dropdown
  groups (≥641px). Mobile: hamburger + slide-out drawer (≤640px), reusing
  the index.html drawer pattern. Footer links also data-driven from the same
  `nav.json`. `_redirects` extended with `/beginners`, `/resources`, `/about`,
  `/contact` all routing to `index.html 200`. PAGE_ROUTES in `index.html`
  extended to include `beginners` and `resources`. The "two nav systems"
  GOTCHA from P3 is permanently resolved — there is now one nav system for
  all pages. **Verified live on production 2026-07-21:** root `/` (mindmap
  active, 4 nav bar items, 7-link footer), `/tracker` (top bar + footer from
  live nav.json), `/trends/agentic-ai-explained` (nav bar + drawer + footer
  all populated). See System 2 below for the updated gotcha list.

* P6 — Fortnightly Full-Site Review + sitewide "Last Updated" date format.
  **Landed and live-verified 2026-07-21** (PR #31 + four follow-up fixes,
  #32-#35, all found via real dispatches after Craig topped up Anthropic
  credit): `llms101-automation/scripts/fortnightly-review.js` +
  `.github/workflows/fortnightly-review.yml` (originally a biweekly Wednesday
  cron; **restructured to a hybrid monthly-full + mid-month-light cadence
  2026-07-22** — see the Full-Site Review section), plus a sitewide
  date-format fix (every "Last Updated"-style element now reads
  "27th June 2026" style). Five
  manual dispatches, four real bugs (push-order, missing per-item
  isolation, drafts/report never committed, `lastTextBlock`-only silently
  dropping payloads when the model appends a trailing note — the last one
  also patched in the SHARED `repairDraft()` used by the weekly pipeline).
  Run 5 was clean end to end: `resources.json` got 3 real corrections
  published (commit `1a1ed857`), 7 stale model cards drafted cleanly
  (commit `ecfd37b4`). See the Fortnightly Full-Site Review section below
  for the full account. V2 is closed.
* P4 — Link badges/tiers to the methodology page, and model-name lists on
  `models.html` cards to their corresponding tracker rows (no anchor IDs exist
  on tracker rows yet — needs adding). Depends on P3 landing first. Not started.

* P5 (future, deferred) — Wire `track1-json.js` / `track2-trends.js` prompts
  to actually query Artificial Analysis and LMArena as named data sources,
  rather than unconstrained web_search. Requires a verified tracker re-run
  before the Methodology page's sourcing language can be upgraded to name those
  sources (draft wording quarantined separately — do not publish until the
  pipeline actually implements it). Not started — explicitly not bundled with
  P3 to avoid shipping a page that claims a pipeline behaviour the code
  doesn't yet have.

* P7 — Static-page audit scope gap. The 2026-06-27/28 site-wide staleness
  audit covered `index.html`, `guide.html`, `models.html`, Mind Map nodes,
  the Q2 report, and all 8 static Trends articles — but never
  `content/pages/*.json` (about/beginners/contact/resources) at the time,
  and never fully pinned down where the rest of the Mind Map's node content
  actually lives given `content/nodes/` only has 2 files despite `index.html`
  clearly containing far more. Partially resolved 2026-07-21: the fortnightly
  review's static-page check (System full-site-review, item 1) now covers
  about/beginners/contact/resources on a monthly cadence going forward. Still
  open: confirm nothing else in the original audit's scope was missed, and
  formally close the "where does the rest of Mind Map content live" question
  rather than leaving it implicit.

* P8 — Mind Map changelog source links. 2026-08's changelog source-link pass
  added `url` to Trends/Tracker/Models/Site changelog items, but Mind Map
  node entries were explicitly scoped OUT — no stable per-node URL exists to
  link to (same underlying gap as P4: nothing on `index.html` currently
  addresses an individual node). Mind Map items keep rendering as plain text
  (schema's `url` field is optional for exactly this reason). Blocked on
  Mind Map URL/anchor support landing — revisit once P4 (or a Mind Map-
  specific deep-link mechanism) exists. Not started.

### Watch items (time-triggered)

* W1 — **CLOSED 2026-08-01.** August tracker run (PR #50) merged and
  live. Review confirmed clean run: correct flagship generation picked,
  model-specific `homepage_url` values, broad lab coverage.
* W2 — Digital Omnibus. The `regulation` node correctly treats the
  amendment as agreed-but-unpublished. When it is formally published,
  the node's dates need updating. See the regulation-node note.
* W3 — **CLOSED 2026-07-26.** First autonomous changelog append
  confirmed live on that run.
* W4 — **CLOSED 2026-07-26.** First fully unattended run clean end to end.
* W5 — **CLOSED 2026-08-01.** Hybrid cadence (monthly full + mid-month
  light) confirmed working: August 1 run did full review + tracker PR in
  one `monthly-tracker-refresh.yml` run; August 15 light spot-check ran
  in 42s with a report email and no commits. Both rides on the shared
  Anthropic key — the recurring credit-exhaustion failure did hit August
  (see incident note below).
* W6 — **1 September 2026 monthly run** (scheduled 09:00 UTC tomorrow).
  First run with the `updateModelsBadge()` fix in `fortnightly-review.js`
  (added 2026-08-31) — confirm the models.html badge date updates to
  1 September 2026 in the drafts commit. Also first run since the
  2-week credit gap; confirm the tracker PR opens cleanly.

### Incident notes

* **2026-08-31 — API credit exhaustion (2-week pipeline gap).** The
  self-planning stage (tier 3) fires when `calendar.weeks[]` is empty
  and requires Anthropic API credits. Credits were exhausted for 2 weeks
  (runs 2026-08-17 and 2026-08-24 both failed at the self-planning call
  with HTTP 400 "credit balance too low"). Fix: topped up credits, queued
  a week in `calendar.weeks[]` (`ai-regulation` node + regulation trends
  article) to bypass the self-planner and trigger immediate generation,
  then re-dispatched `weekly-content.yml`. Run completed successfully.
  **GOTCHA from this incident:** the queued node id `ai-regulation`
  duplicated the existing `regulation` node on the themes branch.
  Duplicate caught visually (two "AI Regulation" nodes on Mind Map);
  fixed by removing `'ai-regulation'` from `TREE.themes` in `index.html`
  and deleting `content/nodes/ai-regulation.json` (commit `6ad6d83`).
  **Rule:** before queueing a node, verify its id does not already exist
  in `TREE` or `NODE_DATA` in `index.html`. The plan-validation check in
  `plan-week.js` catches this for self-planned topics but does NOT run on
  hand-queued calendar entries.

* **2026-08-31 — models.html "Updated" badge auto-update fix.** The
  badge was a hardcoded string never updated automatically — frozen at
  "22nd July 2026" since the last manual card paste. Two changes:
  (1) badge corrected to today's date immediately (commit `8d32be1`);
  (2) `updateModelsBadge()` added to `fortnightly-review.js` — called
  every monthly full run, rewrites the badge to the run date, staged
  alongside the drafts commit (commit `cfb86ea`). No manual edits to
  this badge are needed going forward.

### Decisions parked for Craig

* D1 — Tracker auto-merge. The monthly tracker's PR-merge checkpoint is
  deliberate; removing it is a one-line change once several consecutive
  runs are clean. Craig's call.
* D2 — PR-for-everything policy. Whether script-only changes may commit
  direct to main or must go through PRs. Data point: the 2026-07-18 run
  routed prompt-file changes through PR #23 without friction.

### Verification gaps

* V1 — Mind Map search rendering. Data and logic verified; on-screen
  rendering (search box placement, dropdown on mobile, centering math,
  theme-row canvas highlight) has never been explicitly confirmed in a
  real browser. Some aspects may have been incidentally exercised
  during the 2026-06-30 connector-line debugging, but no one has
  actually checked. The computer-use node published 2026-07-20 under
  the Prompting branch is a concrete node to verify — visiting the
  live Mind Map and confirming it appears, expands, and renders
  correctly counts as partial coverage of this check.
* V2 — `content/pages/*.json` staleness audit. **RESOLVED 2026-07-21.**
  About, beginners, and contact had never been content-audited; resources
  had only ever gotten a link-rot check (2026-06-27). The new fortnightly
  job (P6, see the section below) now fact-checks all four pages plus
  link-rot on resources every run, auto-correcting through the same
  schema→fact-check→repair-once→publish|hold gate the weekly pipeline
  uses. Live-verified, not just built: run 5 of the dispatch cycle found
  and published 3 real corrections to `resources.json` (a dead/stale
  newsletter link among them), the first genuine content audit any of
  these four pages has ever had.

### Deferred — revisit only on trigger

* F1 — tree.json migration (Option 2). Only if the guarded splice ever
  fails a guard in practice.
* F2 — Reports automation track. Only if hand-authoring quarterly
  reports in Decap stops being viable.

### Improvement candidates (non-blocking)

* I1 — `homepage_url` live-fetch validation. Validation is form-only;
  a plausible URL can still 404. Consider a HEAD-request check if a bad
  link ever ships.
* I2 — Failure-email consistency in generate.js. The zero-drafts exit-1
  path (all generation calls failed) sends no Resend notification — only
  the planner-failure path does. Every exit-1 in generate.js should route
  through the same failure-email helper so Craig always hears about a
  failed run via email, not just GitHub's run-failure notification.
  Non-blocking: GitHub's run-failure emails cover the alarm meanwhile.

---

## The five real content systems (confirmed, not assumed)

There are FIVE genuinely different systems for managing content on this
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
- **CRITICAL GOTCHA #3 (2026-08-31):** Before queueing or adding a new
  node, verify its id does not already exist in `TREE` or `NODE_DATA` in
  `index.html`. Duplicate ids silently create two nodes on the same branch
  with identical labels. The pipeline's `plan-week.js` plan-validation
  catches duplicates for self-planned topics, but does NOT validate
  hand-queued `calendar.json` entries — that check is manual-only.
- **CRITICAL GOTCHA #2:** The root node file MUST be named exactly
  `root.json`. It was previously misnamed `large-language-models.json`,
  which silently broke the ENTIRE dynamic loading system for ALL node
  types (not just the root) until fixed 2026-06-21.
- **Standing verification habit:** `EXAMPLE_DATA` should hold exactly 152
  entries as of the last audit (2026-07-04). After any edit that touches
  `NODE_DATA`, `TREE`, or `EXAMPLE_DATA`, re-count `EXAMPLE_DATA`'s keys as a
  quick sanity check that nothing was accidentally added or removed — a
  silent mismatch here breaks example-pill popups with no error thrown.

### 2. Static pages (Beginners/Resources/About/Contact/Methodology) — DYNAMIC, JSON-driven ✅ confirmed working

- **Storage:** `content/pages/{beginners|resources|about|contact|methodology}.json`
- **Loader:** `index.html` → `loadCMSData()` → fetches each page's JSON,
  parses `body` field as Markdown via `marked.js`, injects into the page
- **Schema:** `{ title, body }` — body is Markdown, NOT HTML
- **Navigation — single unified system (updated 2026-07-21, nav redesign):**
  - `scripts/render-nav.js` is loaded via `<script src="/scripts/render-nav.js" defer>`
    in every page's `<head>`. It fetches `content/settings/nav.json`, builds
    the desktop top bar (into `#site-nav-bar`), mobile drawer (into `#nav-drawer`),
    and footer `<p>`. The hamburger button (`#hamburger`) and overlay (`#nav-overlay`)
    are static HTML present in every page; render-nav.js wires their click handlers.
  - On `index.html`, render-nav.js intercepts clicks on `data-page` links
    (items with a `"page"` field in nav.json) and calls `showPage()` instead
    of navigating. On satellite pages the same links navigate normally (full
    page load to the clean URL, which `_redirects` routes back to `index.html`).
  - `_redirects`: all showPage targets need a `{path} /index.html 200` entry.
    Currently mapped: `/methodology`, `/beginners`, `/resources`, `/about`, `/contact`.
  - `PAGE_ROUTES` in `index.html`'s `load` init: maps every clean URL path back
    to a `showPage()` call. Currently: `methodology`, `about`, `contact`, `beginners`,
    `resources`.
- **CRITICAL GOTCHA:** Adding a new `content/pages/{id}.json` requires:
  1. Add the JSON file itself.
  2. Register `id` in `index.html`'s CMS fetch list (the `pages` array in `loadCMSData`).
  3. Add a `<div class="page" id="page-{id}">` fallback div in `index.html`.
  4. Add an entry to `content/settings/nav.json` (with `"page": "{id}"`).
  5. Add `/{url}: /index.html 200` to `_redirects`.
  6. Add `'/{url}': '{id}'` to `PAGE_ROUTES` in `index.html`.
  The two-nav problem from P3 no longer applies — nav.json is the single source.

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
- **"Updated …" badge is auto-maintained (fixed 2026-08-31).** The
  `<span class="updated-badge">Updated …</span>` badge in `models.html`
  is rewritten by `fortnightly-review.js` on every monthly full run
  (via `updateModelsBadge()`), staged alongside the drafts commit. The
  date reflects "last reviewed on …" — no manual edits needed.
- **STALENESS RISK (confirmed 2026-06-25; root cause fixed 2026-07-04 —
  `generate.js` now runs ALL content-generation calls, model cards
  included, with `web_search` enabled; the manual verify-before-paste
  habit below is still worth keeping for model cards, which never
  auto-publish):** `generate.js` used to call the
  Anthropic API with no `web_search` tool attached, so model-card content
  was generated purely from training knowledge and could already be stale by
  review time. A generated Grok card referenced a "Grok-2 / Grok-2 mini /
  Grok-3" lineup when the actual current flagship was Grok 4.3 — caught
  only by manually web-searching before pasting it in. Always verify
  model-specific facts (current version names, pricing, context windows)
  independently before approving a model-card draft. (The OpenAI, Anthropic,
  and Google cards had the same staleness problem — resolved 2026-06-27
  when PR #6 refreshed all six lab cards; see the models.html refresh
  section below.)

### 5. Site updates page (`updates.html`) — DYNAMIC, JSON-driven

- **Storage:** `content/changelog.json` — a single append-only JSON array
  (NOT a collection folder; deliberately outside generate-indices.js scope)
- **Loader:** `updates.html` fetches it directly, sorts by date desc
  client-side, renders entries. No index, no build step.
- **Schema:** `[{ date: "YYYY-MM-DD", title?, items: [{ area, text, url? }] }]`
  — `area` is one of: Mind Map, Models, Tracker, Trends, Reports, Site.
  `url` is optional (added 2026-08 for P2's sibling task, source-linking) —
  when present, `updates.html` wraps `text` in a link to it; when absent
  (all pre-2026-08 entries, and Mind Map entries until a stable per-node
  URL exists — see Outstanding Work), the item renders as plain text exactly
  as before. Per area: Trends → `/trends/view-article.html?article={slug}`,
  Tracker → `/tracker`, Models → `/models.html`, Site → `/{pageId}`. All
  page-level for now (no anchor IDs on tracker rows or model cards yet — see
  P4); Mind Map is deferred entirely pending a deep-link target.
- **RULE (reader-facing changelog discipline):** any PR that changes
  reader-facing CONTENT must append an entry (or add items to today's
  entry) in the same PR. Reader-facing = Mind Map nodes, model cards,
  tracker data, articles, reports, static-page content. NOT reader-facing
  = scripts, CSS, infra, docs. This is the reader-facing twin of the
  Outstanding-work list maintenance rule.
- **Automation appends to the END of the array** (page sorts, so order
  in file doesn't matter). Failure mode is a broken JSON parse → page
  shows a graceful fallback message; validate JSON parses before commit.
  As of 2026-07-20 (P1), `validate-and-publish.js` appends automatically
  after each publish (area: Mind Map / Trends), and `generate-tracker.js`
  appends a Tracker entry as part of its monthly PR. The shared helper
  `scripts/changelog-append.js` handles read→append→round-trip-validate→write
  and returns a warning rather than throwing on any error.

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
- **Not yet done:** no automation/generation track exists for reports (no
  `EXISTING_REPORTS`-style awareness in `llms101-automation/`, unlike
  articles' `EXISTING_TRENDS_SLUGS`). Given the quarterly (not weekly)
  cadence, this may not be worth automating — reports are rare enough to
  author by hand in Decap. Revisit only if that assumption stops holding.

---

## The automation pipeline (`llms101-automation/`)

```
llms101-automation/
├── .github/workflows/weekly-content.yml   ← Sunday 21:00 UTC cron + manual trigger
│                                            (was long misdescribed here as "Monday 6am UTC" —
│                                            the actual cron is `0 21 * * 0`, fixed 2026-07-04)
├── content-calendar/calendar.json         ← weeks[0] consumed each run, moved to completed[]
├── drafts/{week}/                         ← generated output lands here (audit trail),
│                                            then validate-and-publish runs against it
├── prompts/
│   ├── track1-json.js                     ← Mind Map nodes + static pages
│   └── track2-trends.js                   ← Trends articles (JSON) + Model cards (HTML block)
├── scripts/generate.js                    ← orchestrates both tracks (web_search enabled since 2026-07-04)
├── scripts/validate-and-publish.js        ← validates drafts and publishes them to main (2026-07-04)
└── dashboard/review.html  (deployed to /admin/review.html — now a READ-ONLY status view)
```

- **PRINCIPLE CHANGE (2026-07-04, Craig's explicit decision — not a
  mistake, do not "fix" it back):** the old rule here was "Nothing is ever
  auto-published." That is deliberately reversed for the weekly content
  pipeline. The rule is now: **publish automatically after automated
  validation; human review is post-hoc on the live site; one revertable
  commit per week.** Every weekly run generates drafts, then
  `validate-and-publish.js` validates each item (schema, web-search
  fact-check, and for nodes a layout simulation plus a guarded TREE
  splice), publishes everything that passes in a single
  `publish: weekly content {week} (...)` commit pushed directly to main,
  and emails Craig a published report. That email is the review trigger;
  `git revert <publish commit>` is the correction mechanism. Since
  2026-07-05 a fact-check failure triggers ONE repair attempt
  (regenerate with web_search, then the full gate again) before anything
  is held — see the repair stage below; "held" now signals two
  consecutive verification failures (or a non-repairable schema/config
  error). A failure still affects that item only, and a guard failure is
  never bypassed to make a publish succeed. Model cards are the one exception:
  they still require manual paste into models.html (shared hand-coded
  file, no dynamic system) and are always held back with that reason.
- **The dashboard fetches from GitHub's raw content API** (public repo,
  no auth needed) — `raw.githubusercontent.com/{owner}/{repo}/main/...`
- **Calendar only reads `weeks[0]` — ~~hard exit on empty is gone~~
  (2026-07-20).** The original behaviour: if `weeks[]` is empty or
  missing, the whole run exits 1 with no content generated and no email
  sent. This crashed two production runs in a row — July 12 and July 19,
  2026 — when the queue drained and the self-planning work sat in the
  working tree unmerged. **As of 2026-07-20 the empty-calendar hard exit
  is replaced by the self-planning stage** (see below). A hand-queued
  week always wins; the self-planner only fires when `weeks[]` is empty.
  Always keep at least one well-formed entry in `weeks[]` if you want to
  override the self-planner's topic choice.
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
- **Self-planning stage (landed 2026-07-20 — Craig's decision to extend
  pipeline autonomy to topic selection, with manual queuing as the
  standing override).** When `weeks[]` is empty, `generate.js` imports
  `plan-week.js` instead of exiting. Editorial priority is strictly:

  1. **Queue** (`calendar.weeks[]`) — hand-queued weeks always win. `plan-week.js`
     is never reached while the queue has entries.
  2. **Backlog** (`content-calendar/topic-backlog.json`) — Craig's soft
     steering. The top entry is turned into a full week entry and
     `consumeBacklog()` removes it from the file after a real run (never
     during a `--plan-only` dry run). Reorder or edit the backlog freely;
     order is priority.
  3. **Self-plan** — only when queue AND backlog are both empty. One
     `web_search`-enabled Anthropic call (claude-opus-4-8) with live
     coverage context (existing TREE ids, article index, standalone
     slugs, recent completed weeks) proposes a topic that matters to a
     non-technical audience and doesn't near-duplicate existing coverage.

  Every planned entry gets two audit fields stamped on it: `_planned_by`
  (`"backlog"` or `"auto"`) and `rationale` (2-3 sentences). Both ride
  into `calendar.completed[]` permanently. The report email leads with a
  prominent `*** THIS WEEK WAS SELF-PLANNED ***` / `*** BACKLOG ***`
  header when either source was used — **the topic choice is reviewable,
  not just the content**. A low-queue warning appears in the email when
  ≤1 week remains queued.

  **Plan validation** runs on both backlog and self-plan paths before
  generation proceeds — fail-stop, no retry. Checks: node.id is
  kebab-case, not already in TREE or `content/nodes/`, and maps to a
  valid branch; `trendsArticle.topic` is non-empty, has notes, and
  passes a word-set Dice similarity check against all existing coverage
  (threshold 0.6). A validation failure sends the "nothing generated this
  week" email and exits 1 — generation never runs on an invalid plan.

  **Planner failure** (planning API error, parse error, or validation
  failure) sends the `[llms101] Weekly run: nothing generated — planner
  failed` email with the specific reason and exits 1. This is the
  final-resort path; it should be rare once the backlog has entries.

  **`--plan-only` CLI / `plan_only` dispatch input:** editorial safety
  net — commits nothing, generates nothing, mutates nothing. Pass
  `plan_only=true` to exercise the real priority order (backlog first);
  `plan_only=auto` to force the tier-3 self-planning call regardless of
  backlog state. Prints the proposed week entry + rationale to the log.
  Use this to spot-check what the planner would pick before the Sunday
  cron fires.

  **`git add llms101-automation/content-calendar/`** (not just
  `calendar.json`): the commit step in `weekly-content.yml` was widened
  so that `topic-backlog.json` mutations (consumed entries) are committed
  alongside the calendar update in the same weekly chore commit.


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
### validate-and-publish.js — how the auto-publish actually works (added 2026-07-04)

`llms101-automation/scripts/validate-and-publish.js [weekFolder] [--dry-run] [--offline]`
runs after generation in `weekly-content.yml` (default week folder: the
most recent `drafts/` folder containing a `_manifest.json`). Per manifest
item, in order — any failure holds back THAT item only, and the reason
goes in the report email:

1. **Schema validation.** Articles mirror `REQUIRED_ARTICLE_FIELDS` from
   `scripts/generate-indices.js` (manual-sync comment convention — the two
   scripts locations cannot share imports). Nodes validate the full node
   schema (`label, sub, tag, theme, hasChildren, title, body, examples,
   sources`) plus JSON parse. Pages validate `{title, body}`.
2. **Fact-check pass.** One `web_search`-enabled API call per item
   (claude-opus-4-8, same convention as generate-tracker.js) acting as a
   critic: current model names/versions, dates, quantitative claims, and
   "as of" statements (house rule: explicit dates required — bare "as of
   writing" is a blocking finding). Structured pass/fail + findings;
   a blocking finding triggers the REPAIR stage (below, added 2026-07-05)
   rather than an immediate hold; "note" findings publish but are listed
   in the email so Craig can judge from the live page.
3. **Repair stage (added 2026-07-05 — Craig's decision: "held" as a
   terminal outcome meant the site got no update that week, so hold is
   demoted from expected outcome to alarm bell).** Pipeline shape is now
   `validate → publish | repair → re-validate → publish | hold`. On a
   fact-check FAIL, the item is regenerated ONCE (claude-opus-4-8 with
   `web_search`), passing the blocking findings in as **pointers to what
   to re-research, never as replacement facts**. The operating principle:
   **the critic's verdicts are reliable; its specific "current state"
   assertions are advisory** (observed example: the critic cited Claude
   Opus 4.6/4.7 as frontier while the site's own live-searched tracker
   said 4.8). The repaired draft preserves the original schema contract
   (same fields, same slug, same targetPath, explicit-date house rule)
   and goes through the FULL gate again — schema, fact-check, and for
   nodes the layout simulation + splice guards. No shortcuts for repaired
   content. **Hard retry cap: 1 repair attempt per item per week — never
   loop.** The repaired draft is committed to the week's drafts/ folder
   as `{name}.repaired.json` alongside the original, and
   `_publish_report.json` records the original findings, the repair
   attempt, and the final verdict. Outcomes: `published` (passed clean),
   `published_after_repair` (email attaches the original findings so the
   piece earns a closer post-hoc read), `held_after_repair` (**the alarm
   case — two consecutive verification failures**; both findings rounds
   go in the report and email, publish nothing for that item), and plain
   `held` (reserved for non-repairable failures: schema errors, config
   problems, API errors — a malformed draft is a generation bug to
   surface, not content to rewrite; schema failures never trigger
   repair). Commit messages distinguish the path, e.g.
   `publish: weekly content 2026-07-20 (1 article via repair)`.

   **Resolving a `held_after_repair` item (policy, 2026-07-05):** by
   deliberate agent correction submitted through the FULL gate — never by
   blind regeneration (no rerolling until something passes), never by
   bypassing validation, and not by human pre-review. The correcting
   agent takes both findings rounds from `_publish_report.json`,
   verifies every contested claim itself via live web search, and where
   a specific claim can't be confirmed, DELETES or SOFTENS it rather
   than substituting a new specific — an explainer needs fewer dated
   claims, not different ones. The corrected draft replaces the
   manifest's draft file and is resubmitted via `workflow_dispatch` with
   `no_repair: true` (script flag `--no-repair`), which makes a
   fact-check failure hold immediately instead of triggering another
   regeneration. If a deliberate correction still fails the gate, the
   topic has a genuine factual problem — that is the one case worth a
   conversation with Craig. First exercised 2026-07-05 on the
   `open-source-ai-models-closing-gap` article (held_after_repair
   earlier that day: the automated repair fixed the original staleness
   but introduced a wrong GPT-4.5-retirement claim; the deliberate
   correction deleted the unconfirmable specifics and softened a
   "monthly cadence" generalisation).
4. **Nodes only — layout simulation.** Replicates `initLayout()`'s exact
   `perRow` / row-width / margin-shift math (constants kept in MANUAL SYNC
   with index.html — see the `LAYOUT` object) against the post-insert
   child count of the manifest's `targetBranch`; asserts no overlap and
   rows within canvas margins, and reports the before/after row shape
   (e.g. "training 3/3/1 → 3/3/2") in the email.
5. **Nodes only — defensive TREE splice** into `TREE.{targetBranch}` in
   index.html. Mandatory guards, any failure aborts the node publish and
   leaves index.html untouched: the PR #17 `Math.max(maxY + H + 100, 900)`
   canvas-height clamp must still be present before touching the file;
   TREE must parse (vm sandbox) before AND after the edit; the id must
   appear exactly once across all branches afterwards; no other branch may
   change; every id in the fetched branches must resolve to content
   (see roles note below); and the splice must be idempotent (applying it
   twice is a byte-for-byte no-op — the tracker's non-idempotency lesson).
   The edit is a pure string operation, so index.html's CRLF line endings
   are preserved.
6. **Placement + one commit.** Passing files are copied to their
   `targetPath`s; one commit for the whole week
   (`publish: weekly content {week} (1 node, 1 article)`), pushed directly
   to main — no PR. That commit is the audit trail and the single
   `git revert` point. A `_publish_report.json` is committed into the week
   folder alongside it; the read-only dashboard renders it.

**`targetBranch` manifest field (nodes only, added 2026-07-04):**
generate.js derives it deterministically from the calendar entry's theme
(`math→math, train→training, arch→arch, prompt→prompting, theme→themes`).
If no branch can be derived it emits `targetBranch: null`, and the
publisher holds the node back — it never guesses.

**The roles exclusion, mirrored everywhere:** `loadCMSData()` fetches ids
from every TREE branch EXCEPT `TREE.roles` (roles are hardcoded inline).
So `roles` is not a valid `targetBranch`, and the "every id resolves to
content" guard checks only the fetched branches (root, math, training,
arch, prompting, themes).

**Repo reality vs. the original spec (discovered 2026-07-04):**
`content/nodes/` holds only a handful of JSON files — most nodes live
inline in index.html's `NODE_DATA`, and `loadCMSData()` silently falls
back to them. The "resolves to content" guard therefore accepts EITHER a
`content/nodes/{id}.json` file OR an inline `NODE_DATA` entry; the id
being published must specifically have its JSON file (that IS its
content).

**Email contract (the review trigger — sends even on partial failure):**
the published report replaces the old "drafts ready for review" email
(generate.js no longer emails at all). It contains: direct links to each
live page, fact-check findings (blocking and borderline), the node layout
before/after row shape, everything held back and why, and the publish
commit SHA with a one-line revert instruction. Same RESEND_API_KEY /
REVIEW_EMAIL secrets as before. Since 2026-07-05 items are labelled with
one of three outcomes: `published` (passed clean),
`published_after_repair` (original findings attached — this piece earned
a closer post-hoc read), or `held_after_repair` (the alarm case — both
findings rounds attached plus one-line next-step guidance). Plain `held`
still appears for non-repairable schema/config/API failures.

Resend domain verification fixed 2026-07-18. Root cause of the two-week
email failure: a misspelled domain entry in Resend (`lms101.com`, one L).
Re-added correctly with a new DKIM key placed in Netlify. Weekly report
emails are confirmed sending as of this date.

**GitHub Actions gotcha found while wiring this up:** the publish commit
is pushed with `GITHUB_TOKEN`, and GITHUB_TOKEN pushes never fire
push-triggered workflows — so `indexing.yml` would NOT have fired on the
article path by itself (all previous publishes were manual uploads with
Craig's own token, which is why it always fired before). Fix:
`indexing.yml` now also has a `workflow_dispatch` trigger, and
`weekly-content.yml` dispatches it explicitly after the publish step
(`gh workflow run indexing.yml`, requires `actions: write` permission).
The index work itself is not duplicated.

**tree.json migration (Option 2) — considered and deferred.** Moving TREE
out of index.html into a fetched `tree.json` would make node publishing a
pure data change with no HTML splice. Deliberately deferred in favour of
the guarded splice (Option 1): revisit if the splice ever fails a guard in
practice.

- **Fixed 2026-06-26 (SUPERSEDED 2026-07-04 — the dashboard is now a
  read-only status view; the preview/approve flow described in this bullet
  no longer exists, kept for history):** `admin/review.html`'s rendered
  preview for Trends articles used to use quiet fallbacks (`d.summary ? ... : ''`, `d.date || ''`,
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
  PR review-and-merge click. `generate-tracker.js` was the first generation
  script in this repo to call the Anthropic API with the `web_search`
  tool enabled — this is the actual fix for the staleness problem, not just
  a publishing-automation upgrade. (Since 2026-07-04, `generate.js` and
  `validate-and-publish.js` use `web_search` too — the tracker's pattern
  became the pipeline-wide standard.) If this script's API calls ever start
  failing with a model-not-found error, check whether `claude-opus-4-8` has
  been superseded (Anthropic ships new Opus versions roughly every 6-10
  weeks) and update the model string in `generateTrackerRows()`.
- **GOTCHA — workflow-file push race (2026-07-22).** Don't merge a PR that
  touches `.github/workflows/**` while a tracker run is mid-flight: the tracker
  token has `contents`/`pull-requests` write but NOT `workflows`, so a branch
  cut from pre-merge main that then differs from the advanced main in a workflow
  file gets its push rejected (`refusing to allow a GitHub App to … workflow …
  without workflows permission`). Fix: re-dispatch once main has settled. (Full
  incident in the history doc.)
- **Why the merge checkpoint stays.** (Note 2026-07-04: the site-wide
  "nothing auto-publishes without a human look" principle this paragraph
  cites was reversed for the WEEKLY CONTENT pipeline on 2026-07-04 — see
  the automation-pipeline section. The tracker's PR-merge checkpoint was
  left as-is: it's a separate pipeline, and removing its checkpoint is a
  separate decision nobody has made.) Even with `web_search` enabled,
  search results can be stale, contradictory, or SEO-noise, and a wrong
  public AI-model ranking is both a likely failure mode (the landscape
  changes weekly) and a visible one. Schema validation catches malformed
  output but cannot catch plausible-but-wrong content. The human check
  costs about 30 seconds per month; if trust builds over several clean
  runs, full auto-merge is a one-line addition — but that decision belongs
  to Craig after watching a few PRs prove themselves.
- **Merge-gate reminder gap — CLOSED 2026-07-22 (PR #39).** The merge
  checkpoint above only protects the site if someone actually merges the PR.
  It has no reminder of its own, and on 2026-07-21 that bit hard: the July 1
  run's PR (#18) sat OPEN and unmerged for ~3 weeks, so tracker.html silently
  stayed on June 27 content while GPT-5.6, Grok 4.5, Sonnet 5, and Kimi K3 all
  launched uncovered. The fortnightly review's spot-audit now also runs
  `checkUnmergedTrackerPRs()` (lists open PRs on `tracker-refresh-*` branches
  via `gh pr list`) and surfaces any in its report email — age in days, link,
  tagged `*** STALE ***` past 7 days with a `— STALE TRACKER PR` subject
  marker. So an unmerged tracker PR now gets a nudge at least every fortnight.
  Note the right fix for a stale tracker PR is NOT to merge the old one but to
  close it and re-dispatch fresh (an old PR both misses newer launches and
  conflicts with intervening tracker.html edits — #18 by 2026-07-21 predated
  the nav redesign, LMArena-sourcing fix, and ordinal-badge changes).

---

## Full-Site Review — hybrid cadence (added 2026-07-21; restructured 2026-07-22)

> Cadence note: this ran every 2 weeks at first. Since 2026-07-22 it is a
> **hybrid**: the full pass runs MONTHLY (folded into the tracker run on the
> 1st) and a cheap LIGHT spot-check runs mid-month (the 15th). The
> "every two weeks" phrasing below is historical — see the HYBRID CADENCE
> block further down for the current schedule and the cost rationale.


Before this, review cadence was uneven: Trends/Mind Map weekly, Tracker
monthly, and `models.html` + the static `content/pages/*.json` pages
(about/beginners/contact/resources) never on any cadence at all — reviewed
only when someone happened to notice staleness. That gap let the Claude
card's "Fable 5 suspended since June 12" line sit stale for ~3 weeks after
Anthropic restored access July 1, and let Kimi K3's July 16 launch go
uncovered entirely. `llms101-automation/scripts/fortnightly-review.js` +
`.github/workflows/fortnightly-review.yml` close it with a uniform pass
across everything, every two weeks.

**Four checks, one run, deliberately reusing rather than reinventing the
existing pipeline's internals:**

1. **Static pages — auto-correct.** `about.json`, `beginners.json`,
   `contact.json`, `resources.json` each get `factCheck()` (now exported
   from `validate-and-publish.js`, previously private — no behaviour
   change, just visible to this new caller). `resources.json` additionally
   gets a mechanical link-rot check (`extractUrls` + `checkLinkRot`: every
   `href="https?://..."` in the body, HEAD with an ~8s timeout, GET
   fallback), whose dead links are folded in as synthetic blocking
   findings. Any blocking finding triggers `repairDraft()` once, then the
   full gate again (`validateSchema` + `factCheck`) — the exact same
   repair-once-then-hold shape the weekly pipeline uses for Trends
   articles and nodes (see "validate-and-publish.js — how the auto-publish
   actually works" above). **Craig's 2026-07-21 decision: these
   auto-publish** through this gate, unlike model cards — static pages are
   lower-volume, and the fortnightly job's first real run is what closes
   V2 (see Verification gaps). `methodology.json` is out of scope
   (newer, meta content, not in the original spec's page list).
2. **`models.html` — report + draft only, never auto-spliced.** Same rule
   as the weekly pipeline's model-card handling: models.html is a shared
   hand-coded file with no dynamic system, so nothing here is ever spliced
   in automatically. `extractModelCards()` does a read-only, balanced-div
   extraction of each `.mcard` block (confirmed against the live file:
   finds all 10 cards, matches the "7 cards → 10" count from the PR #6
   refresh) and runs `factCheck()` per card. A stale card gets a suggested
   replacement block generated via the existing `buildModelCardPrompt()`
   (same function `generate.js` already uses for brand-new cards, fed the
   fact-check findings as its `notes` parameter) and written to
   `llms101-automation/drafts/fortnightly-{date}/model-card-{slug}.html`
   for manual review and paste.

   **draft → reviewed → APPLIED (three tracked states, added 2026-07-22).**
   Because model cards are manual-paste-only, "applied to the live file" is a
   distinct third step that nothing tracked — a generated, reviewed, corrected
   draft could (and did, twice in one session) sit unapplied while the live
   page stayed stale. The report now tracks each card through three states,
   not two: `generated` (draft written), `reviewed` (the human step — the
   report email is the trigger), and `applied` (live card reflects the fix).
   "Applied" is derived, not guessed: a card that is still stale this run has
   NOT been applied. The loud signal is `findPriorDrafts()` — if a card is
   stale AND a draft for it exists from an EARLIER run whose `mcard-models`
   line the live card does not match, that earlier draft was reviewed but
   never pasted → the report tags it `*** UNAPPLIED DRAFT ***` with a
   `— UNAPPLIED CARD DRAFT` subject marker. The mcard-models comparison keeps
   it precise: a draft the live card already matches was applied (so a card
   that merely went stale again for a new reason is not mis-flagged). A card
   applied correctly is no longer stale, so it never trips the alarm — the 7
   cards applied 2026-07-22 read `✓ current` next run.

   **Changelog entry on APPLIED (added 2026-08).** The mirror image of the
   UNAPPLIED alarm: a CLEAN card whose live `mcard-models` line now matches a
   prior run's draft is evidence that draft was just pasted in. Comparing
   against a small persisted state file, `llms101-automation/drafts/.applied-log.json`
   (slug → date of the newest prior draft already turned into a changelog
   entry — same sidecar-file pattern as `drafts/.last-generated-week`), keeps
   this a one-time event per draft rather than re-flagging the same
   already-logged application on every subsequent clean run. On a genuine new
   detection, a `Models` changelog item (`url: /models.html`) is appended in
   the SAME commit as any static-page corrections from check 1, and the log
   is updated in that commit too — the two never land separately. Seeded at
   ship time against the already-applied 2026-07-22/2026-08 cards so the
   feature's first live run doesn't retroactively backdate old corrections
   into today's changelog.

   **GOTCHA when applying a generated card draft (learned the hard way
   2026-07-22).** The drafts are raw model output and are NOT paste-ready:
   they carry markup artifacts — empty `<a>` citation wrappers, stray bare
   `<span>`s, multi-line `<p>` — and the prompt template OMITS the model-name
   homepage link the live cards have. Clean only bare-tag PAIRS
   (`<a>…</a>`, `<span>…</span>` with no attributes) — a blanket `/<\/?span>/g`
   also strips every attribute-bearing tag's `</span>` closer and silently
   produces malformed HTML that still renders (browsers auto-close) but breaks
   `extractModelCards()`. Restore the mcard-name link, and validate `<div>`,
   `<span>` AND `<a>` balance (not just divs) plus that all companies parse.
3. **Tracker + Trends — spot-audit, report only.** Deliberately lighter
   than checks 1-2: these already have their own weekly/monthly cadences,
   so this is one `web_search`-enabled call asking "has anything
   time-sensitive emerged since the last dedicated pass" (given
   `gatherCoverage()`'s existing coverage context, reused from
   `plan-week.js`, plus a summary of tracker.html's current rows).
   Findings are report-only — corrections still flow through the existing
   weekly/monthly pipelines, never through this job.
4. **Report email + one commit.** Same Resend pattern as the other two
   pipelines' report emails. Any static-page corrections from check 1, AND
   any newly-detected APPLIED model cards from check 2, land in a SINGLE
   commit for the whole run (the audit trail and the one `git revert`
   point), with changelog entries (area: `Site` with `url: /{pageId}`, area:
   `Models` with `url: /models.html`) appended via the existing
   `appendToChangelog()` helper — see the APPLIED checkpoint note above.

**HYBRID CADENCE (2026-07-22 cost restructure) — supersedes the every-2-weeks
model above.** The full pass described in checks 1–4 is the expensive part:
~23 `web_search`-enabled Opus calls per run (10 card fact-checks + ~7 draft
generations + 4 pages + spot-audit), ~$0.30–0.70 each. Running it every two
weeks was the biggest single line item on the shared Anthropic key. So the
job now has **two modes** and **two schedules**:

- **FULL (monthly, the 1st).** `node scripts/fortnightly-review.js` (no flag)
  runs checks 1–4 exactly as documented above. It is **folded into
  `monthly-tracker-refresh.yml`** — one runner does the full review *then* the
  tracker generation, so there aren't two independent monthly crons both
  hitting the API. Order matters: the review runs FIRST (auto-committing/
  pushing its corrections to main), then the tracker step cuts its PR branch
  from the now-updated main, so the tracker PR diff stays just tracker.html +
  changelog. The review step is `continue-on-error` so a review failure (e.g.
  API credit) never blocks the tracker refresh, and vice versa.
- **LIGHT (mid-month, the 15th).** `node scripts/fortnightly-review.js --light`
  is `fortnightly-review.yml` (renamed "Mid-Month Light Spot-Check"). The
  off-week between full reviews: **one** `web_search` call asking "what's
  changed since the ~1st full review?" (`spotAuditTrackerAndTrends(client,
  sinceDate)`, sinceDate = first-of-month) plus the free `checkUnmergedTrackerPRs()`.
  Report-only — it NEVER fact-checks each card/page and NEVER auto-drafts
  corrections. If it flags something, the email tells Craig to
  `gh workflow run monthly-tracker-refresh.yml` for a full pass or wait for
  the 1st. ~1 call instead of ~23.

The old every-other-Wednesday `isScheduledWeek()` ISO-week-parity hack (and
its `--force` flag) is **retired** — two fixed calendar-day crons (1st + 15th)
are simpler and less bug-prone than parity math. `firstOfMonthISO()` replaced
`isScheduledWeek()`.

**Expected monthly API spend under the hybrid structure** (Opus 4.8 $5/$25
per 1M tok; web search $10/1k): full review monthly ≈ $8–16; light spot-check
≈ $1–2; weekly content pipeline (unchanged) ≈ $8–12; tracker generation
(unchanged, now same run) ≈ $1–2 → **~$18–32/mo total on the shared key**,
down from ~$27–49/mo when the full review ran fortnightly. The review portion
roughly halves with zero coverage loss — the same checks run, just monthly +
a cheap mid-month nudge. Weekly content and the tracker were deliberately left
weekly/monthly (Craig's call 2026-07-22): dropping weekly→fortnightly would
save ~$4–6/mo more but halve content output, an editorial decision to make
separately.


**Known rough edge, not blocking:** the corrected `resources.json` lost
its trailing newline (`fs.writeFile(..., JSON.stringify(...))` doesn't add
one back). Harmless — doesn't affect JSON validity or rendering — but
worth a one-line fix (`+ '\n'`) next time this file is touched.

**Sitewide "Last Updated" date format (bundled with this work, same
2026-07-21 session).** Every "Last Updated"-style element on the site now
reads a full written date with an ordinal suffix ("27th June 2026"),
replacing a previous mix of formats (`models.html`/`tracker.html`'s
`.updated-badge` was month+year only; the 5 static Trends articles with an
"Updated" badge had day+month+year but no ordinal; `trends.html`,
`updates.html`, `trends/view-article.html`, and `trends/view-report.html`
each had an independently-typed `formatDate()` producing "21 July 2026",
no ordinal). Audited via grep across every `.html` file — confirmed
`content/pages/*.json` pages (about/beginners/contact/resources/
methodology) have no last-updated element at all, nothing to change there.
The `formatDate()`/`ordinal()` pair is duplicated identically across the 4
dynamic-rendering files and again (as `formatOrdinalDate`) in
`generate-tracker.js` — same manual-sync-across-files convention already
used for `REQUIRED_ARTICLE_FIELDS`, since these are inline `<script>`
blocks and a standalone Node script with no shared module system between
them. `generate-tracker.js`'s `applyTrackerUpdate()` now also rewrites
tracker.html's `.updated-badge` on every monthly run (previously a static
string this script never touched, despite refreshing the tracker's row
content every month) — `models.html`'s badge stays a manual edit, updated
whenever a card is actually pasted in, consistent with models.html staying
manual-paste-only throughout this repo.

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

Standing rule: do not add a `_headers` Basic-Auth rule for `/admin/*`. The
review dashboard is protected by an in-page JavaScript password screen inside
`review.html` (`CORRECT_PASSWORD` constant), and Decap CMS by Netlify Identity
login — neither needs `_headers`. (A stray `_headers` file with a placeholder
password was found and deleted 2026-06-21; full detail in the history doc.)

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

