# LLMs101.com — Architecture Incident History

Dated debugging narratives and "how we found this" stories, split out of
`ARCHITECTURE.md` on 2026-07-25 to keep that file a lean current-state
reference. **Nothing here is load-bearing for making a change today** — it is
the record of how the current rules were arrived at (the bugs, the failed
runs, the verification). For current schemas, gotchas, mechanics, and
outstanding work, see `ARCHITECTURE.md`; consult this doc when you need the
story behind a rule, not just the rule.

Roughly chronological.

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

---

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

---

## Quarterly Reports — bugs fixed in the 2026-06-26 pipeline pass

(Current status + pipeline description live in ARCHITECTURE.md; this is the
bug list + live-verification detail from the pass that fixed the report pipeline.)

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

---

## Automation pipeline — 2026-07-20, three failures and three fixes

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

---

## Model Tracker — generation debugging history (2026-06-27 build + 2026-07-22 re-run)

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

- **Two generation bugs fixed 2026-07-22 (found only by re-running after a
  3-week gap — see the tracker-staleness incident below).** When the tracker
  hadn't actually generated fresh output since June 27, two latent issues in
  `generateTrackerRows()` surfaced on consecutive re-dispatches, each
  unmasking the next: (1) **max_tokens too low** — the 4000 cap was
  borderline for a 12-row, web_search-grounded JSON generation; the June 27
  and July 1 runs fit under it but the July 22 run truncated
  (`stop_reason: max_tokens` → the hard "not safe to parse" throw). Raised to
  8000 (PR #38), matching the repair-stage / generate.js ceilings. (2)
  **last-text-block-only extraction** — with more headroom the model returned
  a complete array but appended a trailing explanation block ("I ranked in
  order of..."); the code took only the LAST text block, so `extractJsonArray`
  found no `[` and `JSON.parse` choked on the prose. This is the SAME class
  of bug PR #35 fixed in `validate-and-publish.js`/`fortnightly-review.js` —
  this script had its own un-patched copy. Fixed (PR #40) to concatenate ALL
  text blocks before `extractJsonArray` (leading prose has no `[` so it's
  skipped; trailing prose is past the matching `]` so it's ignored).
  Lesson reinforced: a generation script that "worked" months ago can carry
  latent output-shape bugs that only appear when the model's real response
  drifts — the tracker's monthly cadence plus the unmerged-PR gap meant it
  went 3 weeks without a real generation, so both bugs hid until re-run.

---

## Full-Site Review — first live dispatches, four bugs, and V2 closure (2026-07-21)

**Status as of 2026-07-21: live-verified via 5 manual dispatches, V2
CLOSED.** The build environment had no `ANTHROPIC_API_KEY`, so the initial
PR (#31) shipped syntax-checked and mock-tested but never exercised against
real `web_search`. Once Craig topped up the Anthropic account's credit
balance, manual `gh workflow run fortnightly-review.yml` dispatches found
and fixed four real bugs in quick succession — each one caught something
the mock tests structurally couldn't, because it required an actual model
response:

1. **Push-order bug (run 1, PR #32).** The script committed a
   `resources.json` correction locally, then a later, unrelated card check
   hit `400: credit balance too low` and aborted the job before a
   *separate* workflow-level push step ever ran. The already-committed
   correction was stranded on the ephemeral runner and lost when it was
   destroyed. Fixed: `git push` now happens immediately after `git commit`,
   inside the script itself — same pattern `validate-and-publish.js`
   already uses, for the same reason.
2. **No per-item isolation (run 2, PR #33).** `resources.json`'s repair
   response failed to parse as JSON, and because `checkStaticPages()`/
   `checkModelCards()` had no per-item try/catch, that ONE page's failure
   aborted the entire run — `models.html`'s 10 cards and the spot-audit
   never even started. Fixed to isolate each page/card individually, same
   "a failure in any step holds back THAT item only" principle
   `validate-and-publish.js` already applies per manifest entry.
3. **Drafts/report never committed (run 3, PR #34).** The run completed
   cleanly end to end — 8 model-card drafts written, but the drafts folder
   and `_fortnightly_report.json` were only ever written to the runner's
   disk, never staged or pushed. All of that real work product (paid API
   calls) vanished the moment the runner was destroyed; the report email
   only describes findings in text, it doesn't carry the actual draft
   HTML. Fixed: commit + push the whole `drafts/fortnightly-{date}/` folder
   immediately after writing it, BEFORE the page-correction commit.
4. **"Last text block only" silently drops the payload (run 4, PR #35) —
   the real root cause, not a one-off.** `resources.json`'s repair had now
   failed 3/3 live attempts with `Unexpected token '(', "(the draft"...`,
   and 4 of 7 model-card drafts from run 3 were just a stray sentence
   fragment, no HTML at all. Root cause in both: the model sometimes
   appends a SEPARATE final text block of caveats/notes AFTER the real
   payload (e.g. "(the draft above reflects corrected links; I couldn't
   verify two of the older entries...)"), and `lastTextBlock()` — used by
   `repairDraft()` in `validate-and-publish.js` and by this job's
   model-card generation — takes only that trailing block, silently
   discarding the real content that lived earlier in the response. Fixed
   as a narrow fallback (not a rewrite of the working common path, so the
   narration-BEFORE-content case `lastTextBlock` was originally chosen to
   handle isn't regressed): `repairDraft()` retries against the full
   concatenated response if the last-block parse fails; the model-card
   path searches the full concatenated response for a balanced
   `<div class="mcard">` directly, reusing `extractBalancedDiv()` (already
   used to parse `models.html` itself). **This is shared code** —
   `repairDraft()` backs the weekly Trends/node pipeline too, so this fix
   plausibly also closes a latent bug there that had simply never been
   triggered by a typical (smaller) article/node repair target.

**Run 5, clean.** All 4 static pages checked; `resources.json` found 3
real issues (Import AI's newsletter had moved off Substack to
jack-clark.net; two other resource-card descriptions/URLs were stale),
repaired, re-fact-checked, and published in one commit
(`1a1ed85786de1e5f5efaab3e9b112a442c79feb8`) with a changelog entry. All 10
model cards checked, 7 drafted as clean full-HTML suggested replacements
(verified: `model-card-grok.html` is a complete 44-line block starting
directly with `<div class="mcard"`, not the 1-line fragment run 4
produced), landed in a separate drafts+report commit
(`ecfd37b4a568c968007f4943c50cd7af039cad6a`). Spot-audit ran without
findings. **V2 is closed** — the mechanism has now genuinely reviewed and
corrected live content, not just run without crashing.

---

## Security note — the deleted `_headers` file (2026-06-21)

A `_headers` file at the repo root once contained a Netlify Basic-Auth rule
for `/admin/*` with a literal placeholder password (`yourchosenpassword`). It
was DELETED 2026-06-21. The standing rule (do not recreate it; the review
dashboard uses an in-page JS password screen and Decap CMS uses Netlify
Identity, so neither needs `_headers`) lives in ARCHITECTURE.md.

---

## Document split — ARCHITECTURE.md → current-state reference + this file (2026-07-25, PR #47)

`ARCHITECTURE.md` had grown to ~2,022 lines / ~124KB — large enough that
GitHub's rendered view truncated it mid-file. On 2026-07-25 it was split into
two files (merge commit `ddaa262`):

- `ARCHITECTURE.md` — a lean ~980-line current-state reference (schemas,
  gotchas, mechanics, outstanding work). Ten sections were kept, condensed to
  drop the "how we found this" narrative from each.
- `docs/ARCHITECTURE-history.md` (this file) — the ten dated debugging
  narratives, moved out verbatim: 2026-06-21 and 2026-06-25 fixes, the
  site-wide staleness audit, the theme cluster 4→6 expansion, the updates
  page, the Quarterly 5-bug list, the automation 2026-07-20 three-failures,
  the Model Tracker six-bug + PR #4 review + 2026-07-22 re-run, the Full-Site
  four-bug/Run-5/V2 closure, and this security note.

Pure documentation restructure — no code, content, or rules changed; the split
only relocates existing text. Two content additions shipped in the same PR: the
P7 outstanding-work item (static-page audit scope gap) and the EXAMPLE_DATA
re-count verification habit in content system 1.
