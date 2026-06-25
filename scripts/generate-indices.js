import fs from 'fs';
import path from 'path';

// Fields every Trends article JSON must have for trends.html / view-article.html
// to render correctly. If any of these are missing, the live card shows literal
// "undefined" text instead of failing loudly — so we catch it here instead.
const REQUIRED_ARTICLE_FIELDS = ['title', 'date', 'category', 'read_time', 'summary', 'body'];

function buildIndex(collectionFolder, outputFileName, sortKey, reverse = true) {
  // process.cwd() forces Node to look exactly at the root repository directory in GitHub Actions
  const repoRoot = process.cwd();
  const collectionPath = path.join(repoRoot, 'content', collectionFolder);
  const destination = path.join(repoRoot, 'content', outputFileName);

  console.log(`Targeting collection path: ${collectionPath}`);
  console.log(`Targeting destination path: ${destination}`);

  // Ensure destination directory structural path exists
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  if (!fs.existsSync(collectionPath)) {
    console.log(`Directory not found: ${collectionPath}. Creating empty fallback index.`);
    fs.writeFileSync(destination, JSON.stringify([], null, 2));
    return false;
  }

  const files = fs.readdirSync(collectionPath);
  const indexData = [];
  let hadValidationError = false;

  files.forEach(file => {
    if (path.extname(file) === '.json' && file !== outputFileName) {
      const filePath = path.join(collectionPath, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');

      try {
        const parsed = JSON.parse(rawContent);
        const { body, chartData, ...metaData } = parsed;
        metaData.slug = path.basename(file, '.json');

        // FIX: write the full relative file path so view-article.html's
        // Step 1 index lookup actually succeeds. Without this field, the
        // viewer always falls through to the fragile date-guessing cascade
        // (the old Step 3), which silently failed for any article not
        // published on the 7th/14th/21st/28th of a recent month.
        metaData.file = `content/${collectionFolder}/${file}`;

        // Also write a stable url field using the clean slug (no date
        // prefix) so trends.html and any other consumer can link directly
        // to view-article.html?article={slug} without needing to know the
        // Decap-generated filename pattern.
        if (!metaData.url) {
          metaData.url = `/trends/view-article.html?article=${metaData.slug.replace(/^\d{4}-\d{2}-\d{2}-/, '')}`;
        }

        // VALIDATION: articles only. Reports use a different schema and
        // aren't covered by REQUIRED_ARTICLE_FIELDS.
        if (collectionFolder === 'articles') {
          const fullRecord = { ...metaData, body };
          const missing = REQUIRED_ARTICLE_FIELDS.filter(
            f => fullRecord[f] === undefined || fullRecord[f] === null || String(fullRecord[f]).trim() === ''
          );

          if (missing.length > 0) {
            // ::error:: annotation makes this show up as a red, top-level
            // failure in the GitHub Actions run (and in any email/Slack
            // notification tied to workflow failures) — not just buried
            // in a log line.
            console.error(
              `::error::content/${collectionFolder}/${file} is missing required field(s): ${missing.join(', ')}. ` +
              `Excluded from ${outputFileName} until fixed — it will not appear on the live site.`
            );
            hadValidationError = true;
            return; // skip — do not push into the index
          }
        }

        indexData.push(metaData);
      } catch (err) {
        console.error(`::error::Error parsing JSON file ${file}: ${err.message}`);
        hadValidationError = true;
      }
    }
  });

  // Chronological sort matrix
  indexData.sort((a, b) => {
    const valA = a[sortKey] || '';
    const valB = b[sortKey] || '';
    return reverse ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
  });

  fs.writeFileSync(destination, JSON.stringify(indexData, null, 2));
  console.log(`Successfully generated index feed. Saved ${indexData.length} entries.`);
  return hadValidationError;
}

// Fire index builds matching your verified lowercase content folder keys
const articlesHadErrors = buildIndex('articles', 'articles_index.json', 'date', true);
const reportsHadErrors = buildIndex('reports', 'reports_index.json', 'year', true);

if (articlesHadErrors || reportsHadErrors) {
  console.error('\nOne or more content files failed validation — see ::error annotations above.');
  console.error('The index was still written, but invalid files were excluded from it.');
  process.exit(1); // makes the GitHub Action run show as failed
}
