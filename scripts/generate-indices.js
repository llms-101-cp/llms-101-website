import fs from 'fs';
import path from 'path';

// Fields every Trends article JSON must have for trends.html / view-article.html
// to render correctly. If any of these are missing, the live card shows literal
// "undefined" text instead of failing loudly — so we catch it here instead.
const REQUIRED_ARTICLE_FIELDS = ['title', 'date', 'category', 'read_time', 'summary', 'body'];

// Same idea, for Quarterly Reports. trends.html's buildFeatured() and
// view-report.html both assume title/date/summary/body exist (year/quarter
// are used for sorting and the slug pattern, not just cosmetic).
const REQUIRED_REPORT_FIELDS = ['title', 'year', 'quarter', 'date', 'summary', 'body'];

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

        // Also write a stable url field so trends.html and view-report.html/
        // view-article.html can link directly without needing to know the
        // Decap-generated filename pattern. BUG FIX: this used to always
        // build a view-article.html URL regardless of collection, which
        // would have silently sent every report to the wrong viewer the
        // moment a real one was added.
        if (!metaData.url) {
          if (collectionFolder === 'reports') {
            metaData.url = `/trends/view-report.html?report=${metaData.slug}`;
          } else {
            metaData.url = `/trends/view-article.html?article=${metaData.slug.replace(/^\d{4}-\d{2}-\d{2}-/, '')}`;
          }
        }

        // VALIDATION: articles and reports both get checked now. Reports
        // were previously unvalidated, so a report missing e.g. `summary`
        // would have rendered literal "undefined" on the live featured
        // card and sidebar — the exact bug already fixed for articles on
        // 2026-06-25, just not extended to reports at the time.
        if (collectionFolder === 'articles' || collectionFolder === 'reports') {
          const requiredFields = collectionFolder === 'articles' ? REQUIRED_ARTICLE_FIELDS : REQUIRED_REPORT_FIELDS;
          const fullRecord = { ...metaData, body };
          const missing = requiredFields.filter(
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

        // SORT KEY: reports need to sort by year+quarter together, not just
        // year — otherwise Q1/Q2/Q3/Q4 of the same year sort arbitrarily
        // (object key insertion order from readdirSync, which is NOT
        // chronological). This computed field is index-only; it's never
        // part of the saved content/reports/{slug}.json itself.
        if (collectionFolder === 'reports' && metaData.year != null && metaData.quarter != null) {
          metaData._sort_key = `${metaData.year}-${String(metaData.quarter).padStart(2, '0')}`;
        }

        indexData.push(metaData);
      } catch (err) {
        console.error(`::error::Error parsing JSON file ${file}: ${err.message}`);
        hadValidationError = true;
      }
    }
  });

  // Chronological sort matrix
  const effectiveSortKey = collectionFolder === 'reports' ? '_sort_key' : sortKey;
  indexData.sort((a, b) => {
    const valA = a[effectiveSortKey] || '';
    const valB = b[effectiveSortKey] || '';
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
