const fs = require('fs');
const path = require('path');

/**
 * Reads a directory of JSON content files, extracts metadata,
 * and writes a sorted index array file.
 */
function buildIndex(collectionDir, outputJsonPath, sortKey, reverse = true) {
  const dirPath = path.join(__dirname, '..', collectionDir);
  const destination = path.join(__dirname, '..', outputJsonPath);
  
  // Ensure the destination directory exists
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  
  // Safe Check: If the content collection folder doesn't exist yet,
  // write an empty index list instead of throwing a fatal execution error.
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory "${collectionDir}" does not exist yet. Creating an empty fallback index.`);
    fs.writeFileSync(destination, JSON.stringify([], null, 2));
    return;
  }

  const files = fs.readdirSync(dirPath);
  const indexData = [];

  files.forEach(file => {
    // Only parse clean JSON payloads
    if (path.extname(file) === '.json') {
      const filePath = path.join(dirPath, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');
      
      try {
        const parsed = JSON.parse(rawContent);
        
        // Remove heavy text bodies or massive data charts to keep the feed index payload light
        const { body, chartData, ...metaData } = parsed;
        
        // Capture the slug filename so the frontend knows what file endpoint to query later
        metaData.slug = path.basename(file, '.json');
        indexData.push(metaData);
      } catch (err) {
        console.error(`Error parsing JSON data file ${file}:`, err);
      }
    }
  });

  // Chronological sort tracker
  indexData.sort((a, b) => {
    const valA = a[sortKey] || '';
    const valB = b[sortKey] || '';
    return reverse ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
  });

  // Write compiled data cleanly back to the branch tree
  fs.writeFileSync(destination, JSON.stringify(indexData, null, 2));
  console.log(`Successfully generated index feed at ${outputJsonPath} (${indexData.length} entries)`);
}

// Execute indexing safely across both collections
buildIndex('content/articles', 'content/articles_index.json', 'date', true);
buildIndex('content/reports', 'content/reports_index.json', 'year', true);
