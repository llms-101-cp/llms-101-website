/**
 * Shared changelog append helper for the llms101 pipeline.
 *
 * Appends one entry to the END of content/changelog.json. The page sorts
 * client-side so order in the file doesn't matter, but per convention
 * automation always appends — never prepends.
 *
 * Fail-soft by design: a malformed append is the one failure mode that
 * blanks /updates to its graceful-fallback message (JSON.parse fails →
 * no entries rendered). We validate the result parses before writing, and
 * on any error we return a warning and leave the file untouched — publish
 * proceeds, the warning goes in the report email, and the entry must be
 * added manually.
 */

import fs from 'fs/promises';
import path from 'path';

const CHANGELOG_REL = path.join('content', 'changelog.json');

/**
 * @param {{ area: string, text: string, url?: string }[]} items — changelog
 *   line items. `url` is optional and passed through as-is — callers should
 *   omit the key entirely when there's no link (never write `url: null`).
 * @param {string} todayISO                          — "YYYY-MM-DD" publish date
 * @param {string} repoRoot                          — absolute path to repo root
 * @param {{ log?: (msg:string)=>void }} [opts]
 * @returns {Promise<{ staged: boolean, warning: string|null, relPath: string }>}
 */
export async function appendToChangelog(items, todayISO, repoRoot, { log = console.log } = {}) {
  if (!items || items.length === 0) {
    return { staged: false, warning: null, relPath: CHANGELOG_REL };
  }

  const changelogPath = path.join(repoRoot, CHANGELOG_REL);

  let existing;
  try {
    const raw = await fs.readFile(changelogPath, 'utf8');
    existing = JSON.parse(raw);
    if (!Array.isArray(existing)) throw new Error('root is not an array');
  } catch (err) {
    return { staged: false, warning: `could not read/parse changelog.json: ${err.message}`, relPath: CHANGELOG_REL };
  }

  existing.push({ date: todayISO, items });

  let serialized;
  try {
    serialized = JSON.stringify(existing, null, 2);
    JSON.parse(serialized); // round-trip check before touching the file
  } catch (err) {
    return { staged: false, warning: `changelog append produced invalid JSON: ${err.message}`, relPath: CHANGELOG_REL };
  }

  await fs.writeFile(changelogPath, serialized, 'utf8');
  log(`[${new Date().toISOString()}] Appended ${items.length} changelog item(s) for ${todayISO}.`);
  return { staged: true, warning: null, relPath: CHANGELOG_REL };
}
