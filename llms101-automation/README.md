# llms101.com — Content Automation (Two-Track System)

This replaces the earlier single-track version. After inspecting the real site
code, we found two genuinely different content systems already live:

| Content type | How the site actually renders it |
|---|---|
| Mind Map nodes (`index.html`) | ✅ Reads `content/nodes/{id}.json` dynamically |
| Static pages — Beginners/Resources/About/Contact | ✅ Reads `content/pages/{id}.json` dynamically |
| Trends articles (`/trends/*`) | ❌ Hand-built standalone `.html` file per article |
| Model cards (`models.html`) | ❌ Hand-built `<div class="mcard">` blocks in one shared file |

This automation is split into two tracks to match that reality.

---

## Track 1 — JSON content (low risk)

**Covers:** Mind Map nodes, static page updates (Beginners/Resources/About/Contact).

**Why low risk:** The site already has working code to fetch and render these
files dynamically (`loadCMSData()` in index.html). Claude only ever produces a
JSON object — the site handles all rendering. A malformed JSON file fails loudly
(the page just won't update) rather than silently breaking layout.

**Workflow:** Generate → review in dashboard → approve → download → drag into
`content/nodes/` or `content/pages/` on GitHub.

---

## Track 2 — HTML content (higher risk)

**Covers:** Trends articles, Model cards.

**Why higher risk:**
- Claude has to choose which visual components suit the content (callouts,
  before/after blocks, summary boxes) — a judgment call, not just data entry.
- A single broken HTML tag can silently break page layout with no error.
- Model cards require editing a **shared** file (`models.html`) rather than
  adding a new standalone file — much higher chance of accidentally breaking
  other cards if done carelessly.

**Mandatory safeguard:** The dashboard renders every Track 2 item in a live
`<iframe>` preview. You **cannot** approve a Track 2 item until you click
"Mark as visually reviewed" — this is enforced in the dashboard, not just
a suggestion.

**Workflow for Trends articles:** Generate → visually review in iframe →
mark reviewed → approve → download `.html` file → upload to `trends/` on GitHub.

**Workflow for Model cards:** Generate → visually review in iframe →
mark reviewed → approve → copy the HTML block → manually paste inside
`<div id="model-grid">` in `models.html` on GitHub. **Never downloaded or
auto-spliced** — editing a shared file is always a manual, deliberate action.

---

## Setup

Same as before — see GitHub Secrets table below. The folder structure has
changed slightly to reflect the two tracks; replace your existing
`llms101-automation/` folder entirely with this version.

| Secret name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `RESEND_API_KEY` | From resend.com |
| `REVIEW_EMAIL` | Where to send weekly review notifications |

---

## Content calendar

Edit `content-calendar/calendar.json`. Each week can include any combination of:

```json
{
  "week_of": "2026-06-29",
  "node": { "id": "...", "parentContext": "...", "theme": "..." },
  "page": { "id": "resources", "updateBrief": "..." },
  "trendsArticle": { "topic": "...", "notes": "..." },
  "modelCard": { "name": "...", "maker": "...", "notes": "..." }
}
```

Not every week needs all four — pick what's relevant. A reasonable cadence is
one Track 1 item + one Track 2 item per week, alternating which Track 2 type.

---

## Files

```
llms101-automation/
├── .github/workflows/weekly-content.yml
├── content-calendar/calendar.json
├── drafts/{week}/                    ← generated drafts (JSON + HTML mixed)
├── prompts/
│   ├── track1-json.js                ← node + page prompts
│   └── track2-html.js                ← trends article + model card prompts (strict templates)
├── scripts/generate.js               ← orchestrates both tracks
├── dashboard/review.html             ← two-track review UI with mandatory visual preview
└── package.json
```

---

## Important: this does NOT touch `content/articles/*.json`

That folder/Decap collection was found to be orphaned — nothing on the live
site reads from it. It's not part of this automation. You may want to either
remove that Decap collection to avoid future confusion, or repurpose it for
something the site actually uses.
