import fs from 'fs';
import path from 'path';

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
    return;
  }

  const files = fs.readdirSync(collectionPath);
  const indexData = [];

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

        indexData.push(metaData);
      } catch (err) {
        console.error(`Error parsing JSON file ${file}:`, err);
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
}

// Fire index builds matching your verified lowercase content folder keys
buildIndex('articles', 'articles_index.json', 'date', true);
buildIndex('reports', 'reports_index.json', 'year', true);
