/**
 * llms101.com — TRACK 2: HTML Content Generation
 *
 * Covers content types that are hand-built static HTML, NOT JSON-driven:
 *   - Trends articles  → a complete standalone .html file per article
 *   - Model cards       → a single <div class="mcard"> block spliced into models.html
 *
 * Higher risk than Track 1: layout choices matter, malformed HTML fails silently,
 * and model cards require editing a shared file rather than adding a new one.
 * Prompts here are deliberately strict and template-bound — Claude is asked to
 * closely imitate an existing real example, not generate freely from a blank page.
 */

export const SITE_VOICE = `
You are a content writer for llms101.com — a beginner-friendly guide to large language models.
The audience is smart but non-technical. Voice: clear, direct, conversational, honest about
complexity, no hype, no doom. All claims must be factually accurate.
`.trim();

/**
 * TRACK 2A: Trends Article (full HTML page)
 *
 * This is a STRICT TEMPLATE FILL, not free generation. The skeleton below is
 * copied directly from a real, working article (agentic-ai-explained.html) with
 * placeholders marked. Claude fills placeholders and chooses which optional
 * content blocks (ba-block, callout, summary-box, trend-card, pull-quote) to
 * include based on what suits the subject — but the overall HTML skeleton,
 * all CSS, and all structural classes must remain untouched.
 */
export function buildTrendsArticlePrompt(topic, notes, relatedArticles) {
  return {
    system: SITE_VOICE,
    user: `
Write a complete Trends article for llms101.com about: "${topic}"

Notes / angle for this article: ${notes}

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS — READ CAREFULLY
═══════════════════════════════════════════════════════════════

You must produce a COMPLETE HTML FILE by filling in the template below. This is a
strict template fill, not free-form generation. Follow these rules exactly:

1. COPY the entire HTML structure, ALL <style> CSS, and the <header>/<nav>/<footer>
   exactly as given below. Do not modify, remove, or rewrite any CSS or structural HTML.
2. ONLY replace the placeholders marked with {{DOUBLE_BRACES}}.
3. For the article body, choose 2-4 of these optional content blocks based on what
   best suits this specific topic — do not use all of them, and do not force a block
   that doesn't fit naturally:
   - <div class="ba-block"> — for before/after or old-way/new-way comparisons
   - <div class="callout"> — for one key distinction or important caveat
   - <div class="summary-box"> with <div class="summary-grid"> — for at-a-glance facts
   - <div class="trend-card"> — for a numbered trend/prediction with a large number
   - <div class="pull-quote"> — for one striking, quotable sentence (write this yourself,
     do not attribute it to a real named person)
   - <div class="model-snapshot"> with <div class="ms-card"> — for comparing 2-4 named models
4. Write 4-6 <h2> sections with 2-4 <p> paragraphs each. This should read as a genuine
   ~700-900 word article, not a stub.
5. The "Further reading" section must link to 2-3 of these EXISTING real articles
   (do not invent new ones): ${relatedArticles.join(', ')}
6. Do NOT use em dashes or curly quotes in the title or filename-relevant text —
   use plain hyphens and straight quotes to avoid downstream encoding issues.

═══════════════════════════════════════════════════════════════
TEMPLATE TO FILL
═══════════════════════════════════════════════════════════════

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ARTICLE_TITLE}} · LLMs 101</title>
<meta name="description" content="{{META_DESCRIPTION}}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://llms101.com/trends/{{SLUG}}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://llms101.com/trends/{{SLUG}}">
<meta property="og:title" content="{{ARTICLE_TITLE}} · LLMs 101">
<meta property="og:description" content="{{META_DESCRIPTION}}">
<meta property="og:image" content="https://llms101.com/og-image.png">
<meta property="og:site_name" content="LLMs 101">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ARTICLE_TITLE}} · LLMs 101">
<meta name="twitter:image" content="https://llms101.com/og-image.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="192x192" href="/favicon-192.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{ARTICLE_TITLE}}",
  "description": "{{META_DESCRIPTION}}",
  "url": "https://llms101.com/trends/{{SLUG}}",
  "datePublished": "{{DATE_ISO}}",
  "isPartOf": {"@type":"WebSite","url":"https://llms101.com/","name":"LLMs 101"},
  "isAccessibleForFree": true,
  "inLanguage": "en-US"
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--brown:#3d2a18;--gold:#B8860B;--tan:#D2B48C;--cream:#FAF8F4;--muted:#9a7a5e;--light:#F5EDD8;--border:rgba(184,134,11,.18);--white:#fff;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Jost',sans-serif;font-weight:300;background:var(--cream);color:var(--brown);line-height:1.7;font-size:16px}
header{position:sticky;top:0;z-index:100;background:rgba(250,248,244,.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);padding:.9rem 2rem;display:flex;align-items:center;justify-content:space-between}
.site-title{font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:400;color:var(--brown);text-decoration:none;letter-spacing:.02em}
.site-title span{color:var(--gold)}
nav{display:flex;align-items:center;gap:.25rem;flex-wrap:wrap}
nav a{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-decoration:none;padding:.3rem .7rem;border-radius:20px;transition:color .2s,background .2s}
nav a:hover{color:var(--gold)}
nav a.active{color:var(--brown);background:var(--light)}
.article-hero{padding:4rem 2rem 2.5rem;max-width:760px;margin:0 auto}
.back-link{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-decoration:none;margin-bottom:2rem;transition:color .2s}
.back-link:hover{color:var(--gold)}
.article-meta{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem}
.article-tag{font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;background:rgba(184,134,11,.1);color:var(--gold);border:1px solid rgba(184,134,11,.25);padding:2px 10px;border-radius:20px}
.article-date{font-size:.72rem;color:var(--muted)}
.article-read{font-size:.72rem;color:var(--tan)}
.article-hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,4.5vw,3rem);font-weight:400;color:var(--brown);line-height:1.15;margin-bottom:1rem}
.article-hero h1 span{color:var(--gold)}
.article-lede{font-size:1.05rem;color:var(--muted);line-height:1.8;font-style:italic;border-left:3px solid var(--gold);padding-left:1.25rem;margin-bottom:2rem}
.article-rule{width:50px;height:2px;background:var(--gold)}
.article-body{max-width:760px;margin:0 auto;padding:2rem 2rem 3rem}
.article-body h2{font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:400;color:var(--brown);margin:2.5rem 0 .75rem;line-height:1.2}
.article-body h3{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:400;color:var(--brown);margin:1.75rem 0 .5rem}
.article-body p{font-size:.95rem;color:#5a3e28;line-height:1.85;margin-bottom:1rem}
.article-body strong{font-weight:500;color:var(--brown)}
.article-body a{color:var(--gold);text-decoration:none}
.article-body a:hover{text-decoration:underline}
.ba-block{display:grid;grid-template-columns:1fr 1fr;gap:1px;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin:1.5rem 0}
.ba-side{padding:1.1rem 1.25rem}
.ba-old{background:rgba(61,42,24,.04)}
.ba-new{background:rgba(184,134,11,.05)}
.ba-head{font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.5rem;font-weight:500}
.ba-old .ba-head{color:var(--muted)}
.ba-new .ba-head{color:var(--gold)}
.ba-content{font-size:.85rem;color:var(--brown);line-height:1.65}
.callout{background:var(--white);border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:0 10px 10px 0;padding:1.1rem 1.4rem;margin:1.5rem 0}
.callout-label{font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem}
.callout p{font-size:.88rem;color:var(--brown);line-height:1.7;margin:0}
.pull-quote{border-left:3px solid var(--gold);padding:1rem 1.5rem;margin:2rem 0;background:var(--white);border-radius:0 10px 10px 0}
.pull-quote p{font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-style:italic;color:var(--brown);line-height:1.6;margin:0}
.pull-quote cite{display:block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:.5rem}
.summary-box{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:1.5rem 1.75rem;margin:2rem 0}
.summary-box-title{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:1rem;display:flex;align-items:center;gap:8px}
.summary-box-title::before{content:'';display:block;width:18px;height:2px;background:var(--gold)}
.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.summary-label{font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem}
.summary-val{font-size:.88rem;color:var(--brown);font-weight:500;line-height:1.4}
.trend-card{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:1.5rem 1.75rem;margin:1.5rem 0}
.trend-num{font-family:'Cormorant Garamond',serif;font-size:2.5rem;font-weight:400;color:rgba(184,134,11,.2);line-height:1;margin-bottom:.5rem}
.trend-title{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:400;color:var(--brown);margin-bottom:.6rem}
.trend-body{font-size:.88rem;color:var(--muted);line-height:1.75}
.trend-body p{font-size:.88rem;color:var(--muted);line-height:1.75;margin-bottom:.75rem}
.model-snapshot{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:1.5rem 0}
.ms-card{background:var(--white);border:1px solid var(--border);border-radius:10px;padding:1rem}
.ms-name{font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-weight:400;color:var(--brown);margin-bottom:.15rem}
.ms-company{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.ms-verdict{font-size:.78rem;color:var(--brown);line-height:1.5;margin-bottom:.5rem}
.ms-badge{font-size:.62rem;padding:2px 8px;border-radius:20px;border:1px solid;display:inline-block}
.ms-up{color:#1a6640;background:rgba(45,120,80,.08);border-color:rgba(45,120,80,.2)}
.ms-stable{color:var(--muted);background:var(--cream);border-color:var(--border)}
.ms-watch{color:#8a3a10;background:rgba(180,80,30,.07);border-color:rgba(180,80,30,.2)}
.further-reading{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:1.5rem 1.75rem;margin-bottom:3rem}
.fr-title{font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;color:var(--brown);margin-bottom:1rem;padding-bottom:.6rem;border-bottom:1px solid var(--border)}
.fr-list{list-style:none;display:flex;flex-direction:column;gap:.6rem}
.fr-list li{display:flex;align-items:baseline;gap:.6rem;font-size:.83rem}
.fr-list li::before{content:'›';color:var(--gold);flex-shrink:0}
.fr-list a{color:var(--brown);text-decoration:none;transition:color .2s}
.fr-list a:hover{color:var(--gold)}
.fr-list span{font-size:.72rem;color:var(--muted)}
.article-nav{display:flex;justify-content:space-between;align-items:center;margin:3rem 0 1rem;padding-top:1.5rem;border-top:1px solid var(--border)}
.article-nav a{font-size:.78rem;letter-spacing:.05em;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:6px;transition:color .2s}
.article-nav a:hover{color:var(--gold)}
footer{background:var(--brown);color:var(--muted);text-align:center;padding:1.5rem 2rem;font-size:.78rem;letter-spacing:.04em}
footer a{color:var(--gold);text-decoration:none}
@media(max-width:600px){
  header{padding:.75rem 1rem}
  .article-hero,.article-body{padding-left:1rem;padding-right:1rem}
  .ba-block{grid-template-columns:1fr}
  .summary-grid{grid-template-columns:1fr}
  .model-snapshot{grid-template-columns:1fr 1fr}
}
</style>
</head>
<body>
<header>
  <a href="/" class="site-title"><span>LLMs</span> 101</a>
  <nav>
    <a href="/">Mind Map</a>
    <a href="/guide">Full Guide</a>
    <a href="/models">Models</a>
    <a href="/tracker">Tracker</a>
    <a href="/trends" class="active">Trends</a>
  </nav>
</header>
<div class="article-hero">
  <a href="/trends" class="back-link">← Back to Trends</a>
  <div class="article-meta">
    <span class="article-tag">{{TAG}}</span>
    <span class="article-date">{{DISPLAY_DATE}}</span>
    <span class="article-read">{{READ_TIME}}</span>
  </div>
  <h1>{{ARTICLE_TITLE_WITH_LINE_BREAK_AND_SPAN}}</h1>
  <p class="article-lede">{{LEDE_PARAGRAPH}}</p>
  <div class="article-rule"></div>
</div>
<div class="article-body">

{{ARTICLE_BODY_HTML — 4-6 h2 sections, 2-4 optional content blocks, 700-900 words}}

<div class="further-reading">
  <div class="fr-title">Further reading</div>
  <ul class="fr-list">{{FURTHER_READING_LIST_ITEMS}}</ul>
</div><div class="article-nav"><span></span><a href="{{NEXT_ARTICLE_URL}}">{{NEXT_ARTICLE_LABEL}} →</a></div></div>
<footer>
  <p><a href="/">LLMs 101</a> · <a href="/models">Models</a> · <a href="/tracker">Tracker</a> · <a href="/trends">Trends</a> · <a href="/guide">Full Guide</a></p>
</footer>
</body>
</html>

═══════════════════════════════════════════════════════════════

Now return the COMPLETE filled HTML file. Return ONLY the raw HTML — no markdown
code fences, no preamble, no explanation. Start directly with <!DOCTYPE html>.
    `.trim()
  };
}

/**
 * TRACK 2B: Model Card (single HTML block, NOT a full page)
 *
 * This produces ONE <div class="mcard">...</div> block matching the exact
 * structure used in models.html. The output is meant to be manually pasted
 * into the existing <div class="grid" id="model-grid"> by the human reviewer —
 * it is NOT downloaded as a standalone file, since models.html is one shared
 * file and splicing it automatically is too risky to do unattended.
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
