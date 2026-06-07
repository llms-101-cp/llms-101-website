/**
 * llms101.com — Content Generation Prompt Templates
 *
 * One prompt per content type. Each returns a structured JSON object
 * that the site renderer can consume directly.
 *
 * Usage: import { buildPrompt } from './prompts/templates.js'
 */

export const SITE_CONTEXT = `
You are a content writer for llms101.com — a beginner-friendly guide to large language models.

The audience is smart but non-technical: people who've heard about ChatGPT and want to actually
understand what's going on under the hood. No assumed background in maths, statistics or coding.

Voice: Clear, direct, conversational. Like a knowledgeable friend explaining over coffee.
Never condescending. Honest about complexity without hiding behind jargon.
Avoid hype. Avoid doom. Stay grounded and accurate.

All claims must be factually accurate as of 2025. Cite sources where possible.
`.trim();

/**
 * CONTENT TYPE 1: Term of the Week
 * A plain-English explainer of one AI/LLM concept (~300 words).
 */
export function buildTermPrompt(term) {
  return {
    system: SITE_CONTEXT,
    user: `
Write a "Term of the Week" explainer for the concept: "${term}"

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "type": "term",
  "term": "${term}",
  "slug": "url-friendly-slug",
  "tagline": "One sentence, under 15 words, that captures the essence",
  "body": "Plain-English explanation, 250-320 words. Use short paragraphs (2-3 sentences each). No bullet points. Start with what it IS, then why it matters, then a concrete analogy or example. End with one sentence on where readers can go deeper.",
  "analogy": "A single vivid analogy in 1-2 sentences. The simpler the better.",
  "related_terms": ["term1", "term2", "term3"],
  "further_reading": {
    "title": "Title of one recommended resource",
    "url": "https://...",
    "source": "Author or publication name"
  },
  "meta_description": "SEO meta description, 140-160 characters"
}
    `.trim()
  };
}

/**
 * CONTENT TYPE 2: Model Spotlight
 * A profile of one LLM or AI tool for the /models directory (~250 words).
 */
export function buildModelPrompt(modelName) {
  return {
    system: SITE_CONTEXT,
    user: `
Write a "Model Spotlight" profile for: "${modelName}"

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "type": "model",
  "name": "${modelName}",
  "slug": "url-friendly-slug",
  "maker": "Company or organisation name",
  "released": "Month Year (approximate if exact date unknown)",
  "category": "One of: frontier | open-weight | specialised | embedding | multimodal",
  "tagline": "One sentence describing what makes this model notable",
  "overview": "2-3 paragraph overview. Cover: what it is, key capabilities, how it differs from similar models. 200-250 words total. No bullet points.",
  "strengths": ["3-4 specific, concrete strengths — not generic praise"],
  "limitations": ["2-3 honest limitations or caveats"],
  "best_for": "One sentence describing the ideal use case",
  "access": {
    "free_tier": true,
    "api": true,
    "local": false,
    "notes": "Brief access notes e.g. 'Free via Claude.ai, API via Anthropic Console'"
  },
  "parameters": "Parameter count if publicly known, otherwise null",
  "context_window": "Context window size e.g. '200K tokens' or null if unknown",
  "meta_description": "SEO meta description, 140-160 characters"
}
    `.trim()
  };
}

/**
 * CONTENT TYPE 3: Weekly AI News Digest
 * 4-5 bullet summaries of the week's notable AI news, beginner-friendly.
 */
export function buildDigestPrompt(weekOf) {
  return {
    system: SITE_CONTEXT,
    user: `
Write a "Weekly AI Digest" for the week of ${weekOf}.

Search your knowledge for 4-5 notable AI developments from approximately this week.
Focus on things that matter to non-technical users: new model releases, major capability changes,
policy developments, or broadly interesting research findings.

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "type": "digest",
  "week_of": "${weekOf}",
  "slug": "ai-digest-${weekOf.replace(/\s+/g, '-').toLowerCase()}",
  "intro": "1-2 sentence framing of what kind of week it was in AI. Conversational, not breathless.",
  "items": [
    {
      "headline": "Plain-English headline, not clickbait. Under 12 words.",
      "summary": "2-3 sentences explaining what happened and why it matters to a non-expert.",
      "why_it_matters": "One sentence on the broader significance.",
      "category": "One of: model-release | research | policy | product | industry"
    }
  ],
  "closing": "1 sentence sign-off. Light in tone. Optional observation about the week's theme.",
  "meta_description": "SEO meta description, 140-160 characters"
}

Include 4-5 items. Prioritise accuracy over novelty — if you're uncertain about a specific
detail, be conservative or omit it.
    `.trim()
  };
}

/**
 * CONTENT TYPE 4: Resource of the Week
 * A curated entry for the /resources reading list.
 */
export function buildResourcePrompt(resourceTitle, resourceUrl) {
  return {
    system: SITE_CONTEXT,
    user: `
Write a "Resource of the Week" entry for: "${resourceTitle}"
URL: ${resourceUrl || '(find the canonical URL)'}

Return ONLY valid JSON in this exact structure — no preamble, no markdown fences:

{
  "type": "resource",
  "title": "${resourceTitle}",
  "slug": "url-friendly-slug",
  "url": "canonical URL",
  "author": "Author or creator name",
  "source": "Publication, platform, or institution",
  "category": "One of: paper | course | video | tool | newsletter | book | podcast",
  "tags": ["2-4 descriptive tags e.g. beginner-friendly, free, technical"],
  "description": "3-4 sentences. What is it, what will you learn, who is it for, why is it worth your time. No hype — honest and specific.",
  "why_this_week": "1 sentence on why this resource is relevant or timely right now.",
  "difficulty": "One of: beginner | intermediate | technical",
  "free": true,
  "meta_description": "SEO meta description, 140-160 characters"
}
    `.trim()
  };
}
