/**
 * llms101.com — Newsletter Prompt Templates
 * "LLMs 101" — Monday edition
 *
 * Five sections, each with its own prompt.
 * The llms101 voice is baked into every template:
 * plain English, no hype, no doom, learning-first.
 */

export const NEWSLETTER_CONTEXT = `
You are the writer of "LLMs 101" — a weekly newsletter that helps non-technical people
genuinely understand what's happening in AI, not just hear about it.

The reader is smart but not a specialist. They use ChatGPT, they've heard of Claude,
they know AI is changing things — but they don't have a CS degree and don't want one.
They're reading this because they want to actually understand, not just stay informed.

VOICE:
- Plain English. If you use a technical term, explain it in the same sentence.
- Honest. If something is overhyped, say so. If something genuinely matters, say why.
- Curious, not breathless. You find this stuff interesting — you're not trying to alarm anyone.
- No "game-changer", no "revolutionary", no "mind-blowing". If it's significant, show it — don't label it.
- A light touch of wit is welcome. Not jokes. Just a sentence that earns a small smile.

NEVER:
- Use AI industry jargon without explaining it
- Claim something is "the most powerful ever" or "unprecedented"
- Be vague ("this could have big implications") — always say what the actual implication is
- Write bullet points that are just headlines with no insight
- Sound like a press release

The goal of every edition: the reader closes it knowing one thing they didn't know before,
and feeling like AI is something they can understand — not something happening to them.
`.trim();

// ─── Section 1: The Week, Plainly ────────────────────────────────────────────

export function buildWeeklyNewsPrompt(weekOf) {
  return {
    system: NEWSLETTER_CONTEXT,
    user: `
Write "The week, plainly" — the opening news section of the LLMs 101 newsletter for the week of ${weekOf}.

This section covers 3-4 AI developments from the past week. Each item follows a strict format:
- A plain-English headline (not a news headline — write it like you're telling a friend)
- 2 sentences: what happened
- 1 sentence starting with "What this actually means:" — the plain-English consequence for a non-expert

The "What this actually means" line is the most important part of every item. It's what
separates LLMs 101 from every other newsletter. Don't write what the company claims it means.
Write what it actually means for someone who uses AI tools but doesn't build them.

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "section": "the-week-plainly",
  "week_of": "${weekOf}",
  "intro": "1 sentence framing the week — optional, only if there's a genuine theme. Otherwise omit.",
  "items": [
    {
      "headline": "Plain-English headline — written like you're telling a friend, not writing a press release",
      "what_happened": "2 sentences. Factual, clear, no jargon without explanation.",
      "what_it_means": "1 sentence. Start with 'What this actually means:'. Be specific. No vague implications.",
      "category": "One of: model-release | research | policy | product | industry | safety"
    }
  ]
}

Include 3-4 items. Prioritise things that affect how people use AI day-to-day over
pure research news. If there's a safety or policy development worth noting, include it —
but frame it honestly, not alarmingly.
    `.trim()
  };
}

// ─── Section 2: One Thing to Understand ─────────────────────────────────────

export function buildConceptPrompt(concept, weekOf) {
  return {
    system: NEWSLETTER_CONTEXT,
    user: `
Write "One thing to understand" — the centrepiece concept explainer for the LLMs 101 newsletter,
week of ${weekOf}.

Concept this week: "${concept}"

This is the section that makes LLMs 101 different from every other AI newsletter.
It's not a definition. It's not a summary. It's the explanation that makes someone
go "oh — THAT'S what it actually is." The kind of explanation a brilliant friend
gives you when they really want you to get it.

Structure (write as flowing prose, not headers or bullets):
1. Open with the thing itself — what IS it, in one concrete sentence
2. The mechanism — how does it actually work, with an analogy that earns its place
3. Why it matters — one specific, concrete consequence for how AI behaves
4. The part most people get wrong — a common misconception or oversimplification, corrected

Length: 380-480 words. Short paragraphs (2-3 sentences each).
No bullet points. No subheadings. Just clear, flowing prose.

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "section": "one-thing-to-understand",
  "concept": "${concept}",
  "week_of": "${weekOf}",
  "slug": "url-friendly-slug",
  "teaser": "1 sentence that makes the reader want to read this. Not a definition — a hook.",
  "body": "The full explainer, 380-480 words. Prose only. No bullets, no subheadings.",
  "takeaway": "1 sentence. The single thing to remember after reading this.",
  "related_terms": ["2-3 concepts a curious reader might want to explore next"]
}
    `.trim()
  };
}

// ─── Section 3: Tools Worth Your Time ────────────────────────────────────────

export function buildToolsPrompt(weekOf) {
  return {
    system: NEWSLETTER_CONTEXT,
    user: `
Write "Tools worth your time" for the LLMs 101 newsletter, week of ${weekOf}.

Cover 4-5 AI tools that are new, updated, or newly worth knowing about.
These can be apps, APIs, open-source projects, browser extensions — anything
a non-developer could realistically try.

The LLMs 101 take on tools is deliberately honest:
- Say who it's actually for (be specific — "people who write a lot" is better than "anyone")
- Say who it's NOT for (this earns enormous trust from readers)
- Say whether the free tier is genuinely useful or just a teaser
- Don't just describe what it does — say whether it's worth trying and why

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "section": "tools-worth-your-time",
  "week_of": "${weekOf}",
  "items": [
    {
      "name": "Tool name",
      "url": "https://...",
      "what_it_does": "1 sentence. What it actually does, not what the homepage claims.",
      "best_for": "Specific description of ideal user — not 'everyone', not 'professionals'",
      "not_for": "Who should skip it. Be honest.",
      "free_tier": "One of: genuinely-useful | limited-but-fair | basically-a-trial | none",
      "our_take": "1-2 sentences. Genuine editorial opinion. Is it worth trying? What's the catch?",
      "category": "One of: writing | coding | research | image | audio | productivity | search | other"
    }
  ]
}

Include 4-5 tools. Mix established tools that are newly relevant with genuinely new releases.
Avoid tools that are just wrappers around ChatGPT with no clear advantage.
    `.trim()
  };
}

// ─── Section 4: Worth Reading This Week ──────────────────────────────────────

export function buildReadsPrompt(weekOf) {
  return {
    system: NEWSLETTER_CONTEXT,
    user: `
Write "Worth reading this week" for the LLMs 101 newsletter, week of ${weekOf}.

Recommend 2-3 pieces of external content — articles, papers, essays, videos, or podcasts.
Mix technical depth: at least one accessible to any reader, at least one that goes deeper.

The LLMs 101 approach to recommendations:
- Say WHY this specific piece, this specific week — not just what it's about
- Be honest if something is dense or long — let the reader decide
- A short honest take is worth more than an enthusiastic summary

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "section": "worth-reading",
  "week_of": "${weekOf}",
  "items": [
    {
      "title": "Title of the piece",
      "url": "https://...",
      "source": "Publication or author",
      "type": "One of: article | paper | video | podcast | essay | thread",
      "time_to_consume": "e.g. '8 min read', '45 min listen', '20 min watch'",
      "why_this_week": "1-2 sentences. Why THIS piece, why NOW. Not a summary — a genuine reason to click.",
      "difficulty": "One of: accessible | moderate | technical",
      "free": true
    }
  ]
}

2-3 items only. Quality over quantity.
    `.trim()
  };
}

// ─── Section 5: From the Site ─────────────────────────────────────────────────

export function buildFromSitePrompt(weekOf, newContent) {
  return {
    system: NEWSLETTER_CONTEXT,
    user: `
Write "From the site" — the short closing section of the LLMs 101 newsletter, week of ${weekOf}.

This section surfaces what's new or updated on llms101.com this week.
New content this week: ${JSON.stringify(newContent)}

Keep this extremely short and warm. It's a signpost, not a summary.
The tone shifts slightly here — it's the writer talking directly to the reader,
not the editorial voice of the newsletter.

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "section": "from-the-site",
  "week_of": "${weekOf}",
  "items": [
    {
      "label": "Very short label e.g. 'New term', 'Model profile', 'Updated guide'",
      "title": "Title of the content piece",
      "url": "https://llms101.com/...",
      "one_liner": "1 sentence. What it is and why a reader might click. Warm, not salesy."
    }
  ],
  "sign_off": "1-2 sentence sign-off for the newsletter. Personal, brief. Could mention something to look forward to next week, or just a grounded closing thought about the week in AI. No 'stay curious' clichés."
}
    `.trim()
  };
}

// ─── Assembly prompt: stitch sections into a cohesive edition ────────────────

export function buildAssemblyPrompt(sections, weekOf, issueNumber) {
  return {
    system: NEWSLETTER_CONTEXT,
    user: `
You are assembling the final LLMs 101 newsletter for the week of ${weekOf} (issue #${issueNumber}).

Here are the five sections, already written:
${JSON.stringify(sections, null, 2)}

Write a short opening note (3-5 sentences max) that:
- Acknowledges the reader directly — they chose to read this, treat that as meaningful
- Threads together the week's theme if one exists naturally across the sections
- Sets up what's inside without listing it robotically
- Sounds like a person wrote it, not a content system

Do NOT summarise every section. Do NOT say "this week we have". 
Just open the conversation the way a good writer opens an essay — 
with something that makes the reader want to keep going.

Return ONLY valid JSON — no preamble, no markdown fences:

{
  "issue_number": ${issueNumber},
  "week_of": "${weekOf}",
  "subject_line": "Email subject line. Under 50 chars. Not clickbait. Not boring. The best subject lines feel like something a smart friend sent you.",
  "preview_text": "Email preview text (shown after subject in inbox). Under 90 chars. Complements the subject — doesn't repeat it.",
  "opening_note": "3-5 sentences. The human voice of the newsletter. Warm, grounded, curious."
}
    `.trim()
  };
}
