const fs = require('fs');
const path = require('path');

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
