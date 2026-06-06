const fs = require('fs');
const path = require('path');

// Helper function to build index for a target collection folder
function buildIndex(collectionDir, outputJsonPath, sortKey, reverse = true) {
  const dirPath = path.join(__dirname, '..', collectionDir);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${collectionDir} does not exist yet. Skipping.`);
    fs.writeFileSync(path.join(__dirname, '..', outputJsonPath), JSON.stringify([]));
    return;
  }

  const files = fs.readdirSync(dirPath);
  const indexData = [];

  files.forEach(file => {
    if (path.extname(file) === '.json') {
      const filePath = path.join(dirPath, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');
      
      try {
        const parsed = JSON.parse(rawContent);
        // Clean out heavy body or raw chart data strings to keep the index file light
        const { body, chartData, ...metaData } = parsed;
        
        // Inject the slug (filename without extension) so the frontend knows what to fetch
        metaData.slug = path.basename(file, '.json');
        indexData.push(metaData);
      } catch (err) {
        console.error(`Error parsing JSON file ${file}:`, err);
      }
    }
  });

  // Sort data (Latest first by default)
  indexData.sort((a, b) => {
    const valA = a[sortKey] || '';
    const valB = b[sortKey] || '';
    return reverse ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
  });

  // Save the index file directly into a layout content directory
  const destination = path.join(__dirname, '..', outputJsonPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(indexData, null, 2));
  console.log(`Successfully generated index feed at ${outputJsonPath} (${indexData.length} entries)`);
}

// Run for both collections
buildIndex('content/articles', 'content/articles_index.json', 'date', true);
buildIndex('content/reports', 'content/reports_index.json', 'year', true); // Sorts by year
