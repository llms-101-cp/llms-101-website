# llms101.com — Content Automation

Weekly AI-powered content pipeline. Every Monday it generates:
- **Web content** — a new term explainer + model profile or resource for the site
- **LLMs 101 newsletter** — a full 5-section email edition, pushed as a draft to Beehiiv

Both land in your inbox for a 20–30 minute review. You approve web content and click
Send in Beehiiv. That's your entire Monday commitment.

---

## Newsletter setup (Beehiiv — 10 minutes)

The newsletter is sent via [Beehiiv](https://beehiiv.com) — free up to 2,500 subscribers.

1. Create a free Beehiiv account at beehiiv.com
2. Create a new publication named **LLMs 101**
3. Go to Settings → API → Generate API key
4. Copy your Publication ID from the URL: `app.beehiiv.com/publications/YOUR_ID_HERE`
5. Add both as GitHub Secrets (see table below)

The script creates a **draft** in Beehiiv every Monday — it never sends automatically.
You review in the Beehiiv editor and click Send when you're happy.

---

## One-time setup (15 minutes)

### 1. Add this folder to your repo

Copy the `llms101-automation/` folder into the root of your llms101.com GitHub repo.

### 2. Add GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret.

Add these three:

| Secret name              | Value |
|--------------------------|-------|
| `ANTHROPIC_API_KEY`      | Your Anthropic API key from console.anthropic.com |
| `RESEND_API_KEY`         | Your Resend API key from resend.com (free tier is fine) |
| `REVIEW_EMAIL`           | The email address to receive weekly review notifications |
| `BEEHIIV_API_KEY`        | Your Beehiiv API key from Settings → API |
| `BEEHIIV_PUBLICATION_ID` | Your publication ID from the Beehiiv dashboard URL |

### 3. Install dependencies locally (optional, for testing)

```bash
cd llms101-automation
npm install
```

### 4. Host the review dashboard

Copy `dashboard/review.html` to your site and make it accessible at:
`https://llms101.com/admin/review`

Protect it with HTTP Basic Auth or a simple password in your hosting config
(Netlify, Vercel, Cloudflare Pages all support this).

---

## Weekly workflow

**Monday 6am UTC** — GitHub Actions runs automatically:
1. Reads the content calendar for this week's brief
2. Generates web content (term + model/resource) via Claude
3. Generates all 5 newsletter sections via Claude
4. Assembles sections into a cohesive edition with subject line and opening note
5. Renders the HTML email
6. Pushes a draft to your Beehiiv account
7. Commits everything to your repo
8. Emails you: "Issue #N is ready to review"

**You (20–30 min, anytime Monday):**
1. Check email — click the Beehiiv link
2. Read through the newsletter in Beehiiv's preview — edit anything that needs it
3. Click Send (or schedule for later that day)
4. Separately: review and approve the web content pieces in the review dashboard

---

## Steering the content

Edit `content-calendar/calendar.json` to control what gets generated.

Each week entry looks like this:

```json
{
  "week_of": "2025-09-01",
  "type_a": {
    "type": "term",
    "topic": "Retrieval-Augmented Generation (RAG)",
    "notes": "Explain how RAG lets LLMs answer from live documents."
  },
  "type_b": {
    "type": "resource",
    "topic": "Andrej Karpathy — Let's build GPT",
    "url": "https://www.youtube.com/watch?v=kCc8FmEb1nY"
  }
}
```

Content types available: `term` | `model` | `digest` | `resource`

The calendar is pre-filled with 12 weeks. Update it monthly — takes about 10 minutes.

---

## Manual trigger

To run generation outside the Monday schedule:

1. Go to your repo → Actions → Weekly Content Generation → Run workflow
2. Optionally enter a `week_override` date (YYYY-MM-DD) to regenerate a specific week

---

## Monthly content audit

A separate job runs on the 1st of every month and checks all static pages for staleness.

**What it does:**
1. Fetches each static page on llms101.com
2. Asks Claude to identify anything that may have become outdated or misleading
3. Prioritises flags: 🔴 likely wrong now, 🟡 worth checking, 🟢 minor
4. Emails you a formatted Staleness Report — nothing is auto-edited

**Pages audited:** Homepage explainers, model directory, model tracker, AI trends, resources, full guide.

**Decay rates** — how often each page type needs attention:
- Fast (models, trends): monthly
- Medium (resources, guide): quarterly
- Slow (foundational explainers): every 6 months

**To add a new page to the audit**, edit the `PAGES_TO_AUDIT` array in `scripts/audit.js`.

**To run a manual audit** at any time: GitHub Actions → Monthly Content Audit → Run workflow.

Audit results are also saved as JSON files in `/audits/{YYYY-MM-DD}/` for a full history.

---

## Files

```
llms101-automation/
├── .github/
│   └── workflows/
│       ├── weekly-content.yml      ← Monday: web content + newsletter
│       └── monthly-audit.yml       ← 1st of month: staleness audit
├── content-calendar/
│   ├── calendar.json               ← 12-week rolling content plan
│   └── issue-counter.json          ← Tracks newsletter issue numbers (auto-created)
├── drafts/
│   ├── {YYYY-MM-DD}/               ← Web content drafts
│   └── newsletter/{YYYY-MM-DD}/    ← Newsletter edition (JSON + HTML + TXT)
├── content/                        ← Approved web content (auto-created)
├── audits/                         ← Monthly audit results (auto-created)
├── prompts/
│   ├── templates.js                ← Web content prompts (term, model, resource, digest)
│   ├── newsletter-templates.js     ← Newsletter section prompts (5 sections + assembly)
│   ├── email-template.js           ← HTML + plain-text email renderer
│   └── audit-templates.js          ← Staleness audit prompts
├── scripts/
│   ├── generate.js                 ← Web content generation
│   ├── newsletter.js               ← Newsletter generation + Beehiiv push
│   └── audit.js                    ← Monthly staleness audit
├── dashboard/
│   └── review.html                 ← Web content review dashboard
└── package.json
```

---

## Costs

| Service | Usage | Estimated cost |
|---------|-------|----------------|
| Claude API — web content | ~2 calls/week | ~$0.15/week |
| Claude API — newsletter | ~6 calls/week (5 sections + assembly) | ~$0.50/week |
| Claude API — audit | ~8 calls/month | ~$0.50/month |
| Beehiiv | Up to 2,500 subscribers | Free |
| Resend (email) | ~5 emails/month | Free tier |
| GitHub Actions | ~5 min/week | Free tier |

Total: **under $4/month.**
