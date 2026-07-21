# LLMs101.com — Architecture Reference

**Read this file FIRST before making any changes to content systems.**
**Last verified: 2026-07-21, via direct Claude Code repo inspection +
live testing. Section notes through 2026-07-21 supersede where present.**

This document exists because a lot of today's work was wasted rediscovering
things that should have been known upfront. Don't repeat that — read this,
trust it, and update it whenever something here turns out to be wrong or
something changes.

---

## Outstanding work — consolidated list (updated 2026-07-21)

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
  **Code landed 2026-07-21** (this session): new
  `llms101-automation/scripts/fortnightly-review.js` +
  `.github/workflows/fortnightly-review.yml` (Wednesday 15:00 UTC cron,
  self-gated to biweekly — see the new Fortnightly Full-Site Review section
  below), plus a sitewide date-format fix (every "Last Updated"-style
  element now reads "27th June 2026" style, ordinal suffix, not the
  previous mix of "June 2026" / "28 June 2026" / no-ordinal formats).
  **Not yet exercised**: like every other automation script added to this
  repo, the code has been syntax-checked and its pure helpers mock-tested,
  but no live `web_search`/fact-check run has happened yet (no
  `ANTHROPIC_API_KEY` in the environment that built it) — the actual first
  run, which is also what resolves V2 below, happens either on the first
  scheduled Wednesday after this merges to main, or via an explicit
  `gh workflow run fortnightly-review.yml` dispatch. Don't treat V2 as
  closed until a report email from a real run has actually arrived.
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

### Watch items (time-triggered)

* W1 — 1 August 2026 tracker run. First real test of the 2026-07-18
  prompt tightening: check that the budget slot picks the current
  flagship generation's fast sibling and that `homepage_url` values are
  model-specific pages, not family pages. Same run also tests whether
  the 12-row category guidance genuinely broadens lab coverage
  (unverified since PR #4's single run). See the Model Tracker section.
* W2 — Digital Omnibus. The `regulation` node correctly treats the
  amendment as agreed-but-unpublished. When it is formally published,
  the node's dates need updating. See the regulation-node note.
* W3 — First autonomous changelog append. **Armed 2026-07-20 (P1
  landed).** The first unattended weekly cron run (W4, Sunday 2026-07-26)
  is the live exercise. Check `/updates` after that run: a malformed append
  is the one failure mode that blanks the page down to its fallback message
  (JSON.parse fails → graceful error, no entries). The round-trip JSON.parse
  check in `changelog-append.js` should prevent this, but it will never have
  been exercised by real automation before that run. Pairs naturally with the
  W1 check on the 1 August tracker run (first automated Tracker changelog
  entry).
* W4 — Sunday 2026-07-26 21:00 UTC — first fully unattended run of the
  planner + sentinel + retry stack together. Backlog is at 3 topics so
  the backlog tier fires; the self-plan (tier 3) stays unexercised until
  the backlog drains. Confirm via report email: (a) backlog entry consumed
  and calendar committed in the chore step, (b) drafts generated + sentinel
  written, (c) validate gate published at least one item, (d) changelog
  entry appended to `/updates` (W3/P1 live exercise). If the run fails,
  check whether another 529-wave hit — the retry stack should absorb a
  transient burst, but a sustained overload can still exhaust all 3
  attempts.
* W5 — First fortnightly review run. Code landed 2026-07-21 (P6); the
  first real execution (via the first scheduled Wednesday after merge, or
  a manual `gh workflow run fortnightly-review.yml` dispatch) is what
  actually closes V2. Confirm via report email: (a) all 4 static pages
  checked, (b) resources.json's link-rot check ran and found the expected
  zero-or-few dead links, (c) any static-page correction actually
  auto-published in one commit with a changelog entry, (d) models.html's
  10 cards were all found and checked (not silently zero — see
  `extractModelCards`'s balanced-div walk), (e) the biweekly gate fires
  correctly on the next scheduled Wednesday and is a silent no-op on the
  Wednesday after that.

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
* V2 — `content/pages/*.json` staleness audit. About, beginners, and
  contact have never been content-audited; resources got a link-rot
  check only (2026-06-27). **Mechanism landed 2026-07-21** — the new
  fortnightly job (see P6 above and the new section below) fact-checks all
  four pages plus link-rot on resources every run, auto-correcting through
  the same schema→fact-check→repair-once→publish|hold gate the weekly
  pipeline uses. **Still open until the first real run completes** — the
  code exists but hasn't executed against live web_search yet; this entry
  moves to Outstanding Work's "landed" language only after that report
  email actually arrives.

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
- **CRITICAL GOTCHA #2:** The root node file MUST be named exactly
  `root.json`. It was previously misnamed `large-language-models.json`,
  which silently broke the ENTIRE dynamic loading system for ALL node
  types (not just the root) until fixed 2026-06-21.

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
- **Schema:** `[{ date: "YYYY-MM-DD", title?, items: [{ area, text }] }]`
  — `area` is one of: Mind Map, Models, Tracker, Trends, Reports, Site.
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
  **verified live on 2026-07-18** via a throwaway PR deploy preview
  (PR #22, closed unmerged, branch deleted): the full path — index build,
  sidebar prepend above the 3 legacy reports, featured swap (test report
  dated 2026-07-18 > fallback 2026-06-01), viewer render of
  title/date/summary/Markdown body with zero literal `undefined`, and
  footer merge/exclusion (legacy reports linked to their standalone
  pages, open report excluded) — all passed. The non-swap path was also
  verified: with the test report re-dated 2026-05-01 (older than the
  fallback), the featured slot correctly stayed on the legacy hardcoded
  report while the sidebar prepend was unaffected. Evidence recorded in
  PR #22's closing comment.
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

  **2026-07-20 — three failures and three fixes in one session:**

  **(a) Empty-calendar hard exit (July 12 + 19 crons).** `weeks[]` drained
  while the self-planning fix sat uncommitted locally. Both scheduled runs
  exited 1 immediately with no content generated and no email sent — exactly
  the coverage gap the self-planning stage was built to close.

  **(b) Green-but-wrong false positive (first dispatch of the landed fix).**
  Both generation calls hit HTTP 529 (Overloaded). generate.js logged a
  warning and **exited 0**, advancing the calendar and moving the entry to
  `completed[]`. validate-and-publish.js fell back to the lexicographic-max
  drafts folder (`drafts/2026-07-20`) and re-published July 5 content as new
  (commits `fc8db85` chore + `737fd29` publish). The run appeared green.

  **(c) Fixes shipped same session.** (i) Zero drafts is now a fatal exit 1;
  the week entry stays in `weeks[]`; `drafts/.last-generated-week` sentinel
  written on success only. (ii) `resolveWeekFolder()` requires the sentinel —
  missing or dangling sentinel is a loud exit 1, never a silent fallback.
  (iii) `scripts/api-retry.js` (new, shared by all three scripts): 3 attempts,
  ~30s / ~90s backoff with ±20% jitter, retries on 529/429/500–503 and
  network errors, Retry-After honoured, every retry logged loudly. Calendar
  recovered manually (2026-07-27 entry restored to `weeks[0]`).

  **Verified live 2026-07-20 (third dispatch, successful).** Planner consumed
  the restored 2026-07-27 entry (source: backlog). Drafts committed in chore
  `ec6e402` including the `.last-generated-week` sentinel.
  `screen-control-agents-capabilities-limits` article failed first fact-check
  (1 blocking finding), repaired, passed the full gate —
  `published_after_repair`. `computer-use` node TREE-spliced into Prompting.
  Publish commit `9dfa54c`. Report email sent. Indexing rebuilt
  `articles_index.json`. Content identity confirmed:
  `content/articles/screen-control-agents-capabilities-limits.json` and
  `content/nodes/computer-use.json` both present on main.

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

  **Both review notes addressed in the prompt 2026-07-18**
  (`llms101-automation/prompts/track2-trends.js`): the budget/speed
  category guidance now tells the model to prefer the budget/fast sibling
  of each lab's CURRENT flagship generation (verified via web_search)
  rather than any older-generation model that merely satisfies the label,
  and the `homepage_url` instruction now requires searching for a
  model-specific page first (per-model docs paths called out explicitly)
  with the general product-family page allowed ONLY when no model-specific
  page exists. Verified after editing: `node --check` passes, and the
  8-case mock suite (reconstructed to the same case list as PR #4's)
  passes 8/8 against the unchanged `validateTrackerRows` /
  `renderTrackerRow`, plus both new instructions confirmed present in
  `buildModelTrackerPrompt`'s output. Standing caveat: whether these
  prompt changes actually change real output is unverified until the next
  monthly tracker run (1 August 2026) — watch that PR's budget-slot pick
  and URL specificity.

---

## Fortnightly Full-Site Review (added 2026-07-21)

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
3. **Tracker + Trends — spot-audit, report only.** Deliberately lighter
   than checks 1-2: these already have their own weekly/monthly cadences,
   so this is one `web_search`-enabled call asking "has anything
   time-sensitive emerged since the last dedicated pass" (given
   `gatherCoverage()`'s existing coverage context, reused from
   `plan-week.js`, plus a summary of tracker.html's current rows).
   Findings are report-only — corrections still flow through the existing
   weekly/monthly pipelines, never through this job.
4. **Report email + one commit.** Same Resend pattern as the other two
   pipelines' report emails. Any static-page corrections from check 1 land
   in a single commit for the whole run (the audit trail and the one
   `git revert` point), with a changelog entry (area: `Site`) appended via
   the existing `appendToChangelog()` helper.

**Scheduling gotcha — read before touching the cron.** GitHub Actions cron
has no native "every 2 weeks" primitive. `fortnightly-review.yml` fires
every Wednesday 15:00 UTC (clear of the Sunday 21:00 UTC weekly run and the
1st-of-month 09:00 UTC tracker run); `isScheduledWeek()` inside the script
itself gates every OTHER Wednesday via ISO-week parity against a fixed
anchor date (`2026-07-22`, the first fortnightly Wednesday) — the off-week
run exits immediately with no API calls and no email. `workflow_dispatch`
(and the local `--force` flag) always runs regardless of parity, for manual
testing. If the cadence ever needs to change, the anchor date and the cron
expression both need updating together.

**Status as of 2026-07-21: code landed, not yet exercised.** Syntax-checked
(`node --check`) and the pure helpers (`ordinal`, `isScheduledWeek`,
`extractUrls`, `checkLinkRot`, `extractModelCards`) were mock-tested against
real fixtures and the live `models.html`/`tracker.html` — see P6 in
Outstanding Work and W5 in Watch items. No live `web_search`/fact-check run
has happened yet; the environment that built this had no
`ANTHROPIC_API_KEY`. The first real run — via the next scheduled Wednesday
after this merges to main, or an explicit `gh workflow run
fortnightly-review.yml` dispatch — is what actually closes V2, not the code
landing.

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
  data point in the cost-collapse story. **RESOLVED 2026-07-18 — the
  "three inconsistent multipliers" deferred item** (title "100x in two
  years", body "300x+ in under three years", lede implying 10,000x):
  retitled to "200x in Three Years", supportable both input-to-input
  (GPT-4 $30/1M → DeepSeek V4 Flash $0.14/1M) and output-to-output
  (GPT-4 $60/1M → V4 Flash $0.28/1M), per DeepSeek's official pricing
  docs and current GPT-5.4 nano rates ($0.20/1M input), all re-verified
  against primary sources 2026-07-18. The lede's unsupportable GPT-3
  10,000x comparison was removed and replaced by an accurate,
  clearly-labelled cache-hit aside in the body (DeepSeek cache-hit input
  $0.0028/1M, >10,000x below GPT-4's 2023 rate). The body comparison is
  now input-to-input with prices labelled as such; the trends.html card
  (JSON-LD headline, h3, acard-desc) was synced in the same commit, its
  ba-preview block left as-is (its "At DeepSeek rates: under $0.15" was
  already consistent with the verified $0.14). Note: the article's
  previous "DeepSeek's cheapest tier, under $0.10" claim was wrong at
  standard (cache-miss) rates — only the cache-hit tier is below $0.10 —
  which is why the originally proposed 300x frame was abandoned for 200x.
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

**RESOLVED 2026-07-04 (PR #20).** Decided each of the 9 individually
rather than a blanket rule. Deleted 6: `Qwen 3.5` and `DeepSeek V3`
(stale, superseded by current Qwen3.6/V4 references elsewhere), `OpenAI
o1`/`OpenAI o3` (the `openai` node's examples are now entirely GPT-5.x
era, o-series history already told in `reasoning`'s prose), `Gemini
Thinking` (verified via search: Google's real current name is "Deep
Think," not "Thinking Mode" — `reasoning` already correctly uses "Gemini
Deep Think" separately), and `Mistral Large` (genuine factual error, not
just staleness — claimed "closed" when Mistral Large 3 is actually
Apache 2.0/open, confirmed during earlier `models.html` work). Re-linked
2 accurate ones: `Llama 3.3 70B` (added to `open-models`'s examples) and
`Phi-4` (added to `synthetic`'s examples — caught a near-miss here:
almost added `'Phi-4 (Microsoft)'` by pattern-matching the sibling
`'Phi-3 (Microsoft)'` key, which would have created a *new* orphan; the
real key is just `'Phi-4'`, no suffix — an existing inconsistency in the
data, not something to "fix" by matching the wrong pattern). Re-linked
`DeepSeek R1` with one small addition: `reasoning`'s example list had it
combined as a single string, `"DeepSeek R1 / V4"`, which had **no**
detail popup at all (neither half matched a real key) — split into two
real, distinct examples and added a new `DeepSeek V4` `EXAMPLE_DATA`
entry (written from facts already verified earlier this week, not a
fresh unverified claim). Final count: 157 → 152. Confirmed zero orphans
remain via the same check used to find the original 9.

**RESOLVED 2026-07-18:** `reasoning`'s body prose previously said
*"Google's Gemini Thinking and Qwen 3.5's thinking mode follow the same
principle"* — same staleness pattern fixed in the examples list on
2026-07-04, sitting in prose instead. Replaced with "Google's Gemini Deep
Think mode and the Qwen3 family's hybrid thinking mode follow the same
principle" (both names verified via live search 2026-07-18: Deep Think is
Google's actual reasoning-mode name on Gemini 3.x; hybrid thinking has
been a Qwen-family-wide feature since Qwen3, April 2025). Pure byte-level
string replacement — all index.html guards confirmed before and after
(PR #17 clamp present, `node --check` on inline scripts, NODE_DATA 44 /
EXAMPLE_DATA 152 keys unchanged, CRLF endings preserved).

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

**Separate fix post-PR #16 — branch row Y gap increased 170→200
(`branch-row-gap-2026-06-30`):** After PR #16 merged, careful live
verification of the root→themes connector (pulling exact SVG path data,
real `getBoundingClientRect()` coords, and `mapScale`, then doing the
math by hand) confirmed the connector itself was never broken — target
and box position matched to within 0.4px. What Craig was accurately
seeing: all 6 root connector lines had very little vertical room to swoop
because the branch row's Y was hardcoded to `170` while root's box
renders ~110px tall (wrapping to 3 lines). That left only ~30px of
canvas-space gap (~25.5px on screen) between root's true bottom and the
branch row. Changed Y from `170` to `200` — one number, affects all 6
branches uniformly. Everything downstream derives from `POS[id].y`
dynamically. No other reference to `170` existed anywhere in the file.
New gap: 60px canvas-space / 51px on screen, confirmed 2x the previous.
Pre-existing since before this session — just first noticed under close
scrutiny today.

**Meta-lesson recorded here:** don't assert something is "confirmed
working" from inference or memory of earlier testing without re-checking
the specific instance being asked about. That claim was wrong here and
caused an unnecessary round-trip.

**Second commit on same PR — row-collision fix (child nodes
overlapping/collapsing):** Adding `themes` as a 6th root branch shifted
every branch's X position and spacing, and the row-wrap fix (commit 2 of
PR #16) made some rows wider. Both compounded against a pre-existing "Strict
Edge Detection" clamp (commit `c1029b7`, 2026-04-26) that pulled any
overflowing child back to a fixed margin independently — when multiple
siblings in the same row overflowed, they all landed on the *identical*
clamped X, collapsing onto each other. Confirmed with exact numbers:
Mathematics' "Linear algebra" and "Calculus" both clamped to x=50
(hidden behind each other); AI Roles' "AI Ethicist" clamped to x=1190
while "ML Engineer" sat at x=1125 (65px apart on 160px-wide boxes).
**Fix:** replaced per-child clamping with per-row shifting — compute each
row's natural width and starting X once, shift the *entire row* as a unit
if it overflows either canvas edge, then position children within the
already-in-bounds row. Preserves sibling spacing in all cases. Exhaustively
verified zero overlaps and zero out-of-bounds across all 6 real branches
and every row.

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

**RESOLVED 2026-06-30 — the `hardware` mystery above was never about
`hardware` specifically.** It was the same root cause described below,
affecting every root-to-branch connector uniformly; `hardware` just
happened to be the one Craig was looking at closely enough to notice.

**Dead end, investigated and ruled out — root's animation timing:**
Craig asked whether root's `intro-mode` shrink transition (500ms CSS,
`syncLines` chases for 550ms) could be capturing a stale mid-transition
`getBoundingClientRect()`. Tested directly with live coordinates
(clicked, waited several seconds past any animation window, then
captured root's rect and the connector's path data) — matched to within
0.2px. Ruled out cleanly. CC independently proposed the same theory from
code-reading alone (no live measurement), implemented a `transitionend`-
based fix, then — to its credit — admitted the theory was inference, not
confirmed diagnosis, once shown the conflicting live data, and reverted
its own fix without being asked twice. Worth recording as a good example
of the right response to being shown better evidence.

**ACTUAL ROOT CAUSE, found via atomic (single-paste) live coordinate
capture:** `#map-canvas` has a static CSS rule `min-height:900px`
(pre-existing, unrelated to any of today's work). Whenever the
JS-computed content height (`canvasH`) is less than 900 — which today's
gap-reduction trials made happen for the first time (a 275px gap
produces `canvasH=779`) — the CSS floor forces the box to actually
render at 900px regardless of what JS set via `style.height`. The
`<svg id="connector-svg">`'s `viewBox` was still being set to the
smaller, un-floored value (`"0 0 1400 779"`). Because the SVG's internal
coordinate system (779 tall) didn't match its actual rendered box (900
tall), the browser's default `preserveAspectRatio` (`xMidYMid meet`)
centered the smaller content vertically within the taller box — silently
shifting every connector line down by exactly `(900-779)/2 × mapScale
(0.85) = 51.425` screen pixels. That's the exact number measured live,
repeatedly, across multiple different gap values and lines, to 3 decimal
places.

This explains why nothing tried earlier in the session (gap values
200→380, plain straight lines, the 100px and 25px spread attempts, the
trunk-shape attempt) ever fully fixed the "floaty origin" perception —
none of them touched this. It was a dormant, pre-existing CSS constraint
that only became visible once a gap small enough to trigger it was
tried.

**Fix (one line):**
```js
const canvasH = Math.max(maxY + H + 100, 900);
```
Wraps the existing calculation in the same 900 floor the CSS already
enforces, so `canvasH`, `style.height`, and the SVG's `viewBox` are now
always mutually consistent, regardless of how short real content is.

**Diagnostic method that actually worked, for future reference:**
single-paste atomic snapshots (root rect + canvas rect + `mapScale` +
path `d` attribute + path's own rect + SVG's own rect/viewBox, all
captured in one console statement) — eliminated the risk of comparing
values from different moments, which caused at least one earlier false
lead (an apparent 80px root-position shift that turned out to be stale
cross-session data, not a real change).

**Follow-up commit, same PR — three explicit requests after the root
cause was fixed:**
1. Reverted the 25px spread back to a single shared origin point (safe
   now that the real bug is fixed — the spread was compensating for a
   symptom, not needed once the actual cause was resolved).
2. Reintroduced curved root-to-branch lines — but not a blind revert to
   the original formula. Proved mathematically that the original
   symmetric curve construction (`CP1=y1+cs`, `CP2=y2-cs`, same `cs` for
   every line) *always* passes through the exact same midpoint Y
   regardless of `cs`'s value — the term cancels out algebraically in
   the cubic Bezier midpoint formula. That's the real mechanism behind
   the original flat-band bug; it was never about `curveStrength`'s
   magnitude. Fix: asymmetric control points (`cs1 ≠ cs2`, varied by
   each branch's real `TREE.root` index, not array position) — breaks
   the cancellation, confirmed via computed midpoints for all 6 branches
   (genuine ~22.5-unit spread, no shared band), bounded to a max ~61% of
   the gap to stay safely clear of the overshoot bug from the earlier
   reverted curve-strength attempt.
3. Restored the "drag to explore" hint (bottom-fade + bobbing pill),
   generalized to check overflow in any direction rather than tied to
   the old fixed-position theme row it was originally built for (that
   row no longer exists since `themes` became a real branch). Hooked
   into all 5 places that change pan/zoom/view state — confirmed by
   direct count, not assumed.

**One real mistake caught and fixed before it shipped:** a copy-paste
edit left dangling duplicate code from the old branching structure
mid-refactor — would have been a silent syntax error if not caught by
`node --check` before committing.

**Remaining open item for next session:** the branch-row gap size.
Every gap value tried today (200 through 380) was tested against
*incorrectly rendered* connectors (the min-height bug was live the whole
time), so none of that trial-and-error is trustworthy for judging the
right gap now that rendering is actually correct. Craig confirmed
post-fix that with properly curved lines, the current 275px gap reads as
"large again" — worth re-doing the gap-size judgment from scratch against
accurate rendering, not resuming from any of today's numbers.

**RESOLVED 2026-07-01 — gap-size judged fresh against correctly-rendered
connectors, per the note above.** Craig measured the actual on-screen gap
directly (highlighted it on a screenshot) and asked for a 50% reduction.
Computed from real values rather than measured off the image: root's true
bottom is consistently ~139 canvas-space units; old gap was `275-139=136`;
halved gap is `68`; new `branchY = 139+68 = 207`. Confirmed visually
correct on the deploy preview.

**Second bug found during this same review — curve mirror asymmetry,
also fixed:** Craig noticed the leftmost and rightmost branches
(Mathematics, AI Roles) don't overlay when one is flipped horizontally,
even though they're equidistant from root and should be true mirrors.
Confirmed mathematically before fixing: the asymmetric curve-strength
formula from the PR #17 fix used *signed* distance from center
(`rootIdx - center`), which gives mirrored branches **swapped**, not
matched, `cs1`/`cs2` values (Mathematics: `cs1=19,cs2=49`; AI Roles:
`cs1=49,cs2=19` — reversed). Fixed by using **absolute** distance from
center instead — mirrored branches now get identical `cs1`/`cs2`,
confirmed via direct computation (`idx0===idx5`, `idx1===idx4`,
`idx2===idx3`, all `true`). Also reduced the curve-variation scale factor
from 6 to 5, since the smaller 207 gap made the same scale factor push
the overshoot-safety margin to 0.79 — tightened back to a comfortable
0.68, matching the safety level from the original PR #17 fix.

**Lesson for any future per-branch variation scheme:** when 6 items are
meant to read as 3 mirrored pairs (or any symmetric arrangement), vary
by *absolute* distance from the symmetric center, not signed position —
signed variation breaks the mirror even when the underlying intent
(giving each pair a distinct value) is otherwise correct. This is a
different, narrower bug than the original flat-band issue; both needed
fixing independently.

**Connector-line saga now fully closed**, from "I cannot see the
Hardware node" through the row-collision fix, the actual min-height/
viewBox root cause, and now correct gap size + genuinely mirror-symmetric
curves. No further open items on this thread.

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

---

## Theme cluster expanded 4 → 6 nodes (2026-07-04, PR #21)

Per the independent site review's specific gap flags (regulation/policy
and economic/environmental cost both named as missing topics), added two
new nodes to the previously-thin `themes` cluster:

- **`regulation`** — "AI Regulation: What Rules Actually Apply Right
  Now." Covers the EU AI Act's risk-tiered structure and extraterritorial
  reach, what's genuinely in force as of writing (GPAI obligations since
  Aug 2025, real fines from Aug 2026, transparency rules landing Aug 2026
  regardless), and is explicit that the "Digital Omnibus" amendment
  deferring high-risk rules to Dec 2027/Aug 2028 was politically agreed
  but not yet formally published at time of writing — original 2026
  dates remain technically binding until it is.
- **`cost`** — "The Economic & Environmental Cost of AI." Leads with the
  counter-intuitive, sourced fact that ~90% of AI energy use is inference,
  not training. Deliberately avoids citing a single "water per query"
  figure — research found estimates ranging from under 1ml to over 500ml
  per query, a thousandfold spread driven by methodology differences, so
  picking one number would have been more misleading than useful. Closes
  with the Jevons paradox and the real 2026 political response (utility
  pledges, state legislation).

**Layout consequence, checked before shipping:** `themes` crossing from
4 to 6 children pushed it past the `perRow <= 4` threshold from the
row-wrap fix built earlier this week — it now wraps into 2 rows of 3
(matching `training`/`arch`/`prompting`'s existing pattern) instead of
sitting in one flat row. Simulated the exact row-shift math against the
real 6-child case before considering it safe: confirmed even spacing,
zero overlap, correct bounds — the earlier collision fix held up here
without needing changes.

**Node count:** 42 → 44. `TREE.themes` now
`['open-closed','safety','hardware','evaluation','regulation','cost']`,
all confirmed resolving to real `NODE_DATA` entries.

**Process note:** Craig gave a standing instruction during this session —
whenever body text says "as of writing" or "as of today," attach the
explicit date (e.g. "4 July 2026") rather than leaving it ambiguous for a
future reader. Applied to `regulation`'s one relevant sentence; worth
carrying forward as a general content-writing convention.

## What's Changed updates page shipped (2026-07-19, PRs #24 + #25)

Content system 5 (see its section above) went from proposal to production
in one session. Record of what happened and what was learned:

- **PR #24 (merged as fbb119a):** `updates.html` + seeded
  `content/changelog.json` (3 backfill entries), nav + footer links on
  trends/models/tracker, the Explore-list link on index.html, sitemap.xml
  and llms.txt entries, and the system-5 docs section — all in one PR,
  per the same-commit documentation rule. guide.html deliberately kept
  its minimal two-link nav. Full pre-merge verification on the Netlify
  deploy preview: entries newest-first, tag colors, mobile single-column
  collapse, active nav state, and the graceful-fallback path (renaming
  changelog.json produced the fallback message, not a blank column).
- **PR #25 (merged as 281c6e1):** the page's own launch entry — the
  first entry added under the changelog discipline rule, appended to the
  END of the array per convention (the page's client-side date sort is
  what puts it on top; automation must never prepend). Routed through a
  quick PR: a changelog-only append is still a content change under the
  content-change policy.
- **GOTCHA (index.html line endings):** index.html is a CRLF file that
  contains ~9 stray bare-LF lines inside the TREE `<script>` block. With
  `core.autocrlf=true`, a naive full-file edit silently normalizes those
  lines and produces spurious diff hunks inside the TREE script — the
  exact region no unrelated PR should ever appear to touch. The fix was
  reverting and redoing the insert byte-surgically so the final diff was
  exactly one added nav line. Any future edit to index.html should
  expect this and verify the staged diff touches only the intended
  lines.
- **Deliberate deferral:** pipeline changelog integration became P1
  (see Outstanding work) rather than shipping in PR #24, because
  `validate-and-publish.js`, `generate.js`, and `weekly-content.yml`
  carried uncommitted in-flight self-planning work — editing them would
  have swept that work into the PR or manufactured a conflict.
- **Backfill dating:** the 2026-06-30 and 2026-06-01 entries are
  deliberate month-level round-ups, not per-PR entries. June merge dates
  (27–30 June) confirmed the 30 June round-up date is accurate. Keep
  future backfill (if any) at this granularity.
