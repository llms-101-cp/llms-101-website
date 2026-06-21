/**
 * llms101.com — TRACK 1: JSON Content Generation
 *
 * Covers content types that the site already loads dynamically:
 *   - Mind Map nodes  → content/nodes/{id}.json
 *   - Static pages     → content/pages/{id}.json  (Beginners, Resources, About, Contact)
 *
 * These map directly onto the existing NODE_DATA / loadCMSData() structure
 * already live in index.html. No HTML generation, no layout decisions —
 * Claude only ever produces the JSON object, the site does the rendering.
 */

export const SITE_CONTEXT = `
You are a content writer for llms101.com — a beginner-friendly guide to large language models.

The audience is smart but non-technical: people who've heard about ChatGPT and want to actually
understand what's going on under the hood. No assumed background in maths, statistics or coding.

Voice: Clear, direct, conversational. Honest about complexity without hiding behind jargon.
Avoid hype. Avoid doom. Stay grounded and accurate. All claims must be factually accurate.
`.trim();

/**
 * TRACK 1A: Mind Map Node
 *
 * Matches the NODE_DATA structure in index.html exactly:
 * { label, sub, tag, theme, hasChildren, title, body, examples, sources }
 *
 * theme must be one of the existing CSS classes already styled on the site:
 * root | math | train | arch | prompt | theme | roles
 */
export function buildNodePrompt(nodeId, parentContext, theme) {
  return {
    system: SITE_CONTEXT,
    user: `
Write a new Mind Map node for llms101.com's interactive mind map.

Node ID (for the JSON filename): "${nodeId}"
Parent branch / context: "${parentContext}"
Theme (CSS class — must match exactly, do not invent a new one): "${theme}"

This node will be added to the existing interactive map. It must match the exact JSON
shape the site expects — every field below is required.

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "label": "Short node label shown on the map box itself (2-4 words, e.g. 'Self-attention')",
  "sub": "One short subtitle shown under the label on the map box (3-6 words, e.g. 'Query / Key / Value')",
  "tag": "Category tag shown in the sidebar (e.g. 'Mathematics', 'Training', 'Architecture', 'Prompting', 'Theme', 'Role')",
  "theme": "${theme}",
  "hasChildren": false,
  "title": "Full title shown at the top of the detail sidebar when clicked",
  "body": "HTML string using only <p> and <strong> tags. 2-3 paragraphs, 120-220 words total. Plain English explanation matching the site's existing tone — see example pattern: opens with what it IS, then how it works with a concrete mechanism, then why it matters.",
  "examples": ["3-6 short example terms or tools related to this node, matching the style of existing nodes (e.g. 'Reward model', 'PPO optimiser')"],
  "sources": [
    {"label": "Descriptive label for the source", "url": "https://..."}
  ]
}

Include 1-2 real, verifiable sources (academic papers, official model documentation, or
reputable technical publications). Do not invent URLs — only include sources you are
confident actually exist and are correctly attributed.
    `.trim()
  };
}

/**
 * TRACK 1B: Static Page Update
 *
 * Matches the loadCMSData() fetch pattern: content/pages/{pageId}.json
 * Site expects: { title, body } where body is parsed through marked.js (Markdown)
 *
 * Valid pageId values: beginners | resources | about | contact
 */
export function buildPagePrompt(pageId, updateBrief) {
  const pageContext = {
    beginners: 'The "AI for Beginners" page — a plain-English FAQ covering foundational AI concepts. Currently covers: what is AI, what is an LLM, ChatGPT/Claude/Gemini differences, running AI locally, tokens, hallucination, jobs, safety.',
    resources: 'The "Interesting Resources" page — a curated reading list organised into sections: Foundational Reading, Courses & Interactive Learning, News & Commentary, Model Playgrounds.',
    about: 'The "About this site" page — explains what the mind map is, how to use it, what it\'s built with, and sources methodology.',
    contact: 'The "Contact" page — a short page with a contact email.'
  };

  return {
    system: SITE_CONTEXT,
    user: `
Update the "${pageId}" static page on llms101.com.

Page context: ${pageContext[pageId] || 'Unknown page — use general site voice.'}

Update brief: ${updateBrief}

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "title": "Page title (e.g. 'AI for Beginners — Plain English Guide to Large Language Models')",
  "body": "Full page content as a MARKDOWN string (this gets parsed by marked.js on the live site). Use ## for section headings, plain paragraphs for body text. Match the tone and structure of the existing page — see the page context above for what's already there. If this is an incremental update (e.g. adding one new FAQ item or one new resource card), include the FULL existing page content PLUS the new addition in the right place — do not just return the new snippet alone, as this will overwrite the whole page."
}

Important: body must be valid Markdown that marked.js can parse — use standard syntax only
(##, **, [text](url), plain paragraphs). Do not use HTML tags inside the markdown body.
    `.trim()
  };
}

/**
 * TRACK 1C: Resource Card Addition
 *
 * A specialised version of the page update for the most common weekly action:
 * adding one new resource card to the Resources page without rewriting everything.
 * This still produces a full-page body (per the note above) but the prompt is
 * narrower and easier for Claude to get right consistently.
 */
export function buildResourceAdditionPrompt(existingPageMarkdown, newResource) {
  return {
    system: SITE_CONTEXT,
    user: `
Add ONE new resource card to the existing Resources page on llms101.com.

New resource to add:
- Title: ${newResource.title}
- URL: ${newResource.url}
- Category: ${newResource.category}
- Why it's worth including: ${newResource.notes}

Here is the CURRENT full page content in Markdown:
---EXISTING PAGE START---
${existingPageMarkdown}
---EXISTING PAGE END---

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "title": "AI for Beginners — Plain English Guide to Large Language Models",
  "body": "The FULL existing page markdown, unchanged, PLUS the new resource card added under the most appropriate existing section heading (Foundational Reading / Courses & Interactive Learning / News & Commentary / Model Playgrounds). Match the exact formatting style of existing resource entries — short description (1-2 sentences), tags in a consistent style, and a markdown link out."
}

Do not remove or alter any existing content. Only add the new resource in the right place.
    `.trim()
  };
}
