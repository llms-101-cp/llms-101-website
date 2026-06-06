const fs = require('fs');
const path = require('path');

// Helper function to dynamically find a folder matching names case-insensitively
function findFolderCaseInsensitive(basePath, targetName) {
  if (!fs.existsSync(basePath)) return null;
  const currentItems = fs.readdirSync(basePath);
  const match = currentItems.find(item => item.toLowerCase() === targetName.toLowerCase());
  return match ? path.join(basePath, match) : null;
}

function buildIndex(collectionName, outputName, sortKey, reverse = true) {
  const rootDir = path.join(__dirname, '..');
  
  // 1. DYNAMICALLY FIND YOUR CONTENT FOLDER (Handles 'content', 'Content', etc.)
  let contentPath = findFolderCaseInsensitive(rootDir, 'content');
  
  // Backup: Look inside 'Trends' folder just in case
  if (!contentPath) {
    const trendsPath = findFolderCaseInsensitive(rootDir, 'trends');
    if (trendsPath) {
      contentPath = findFolderCaseInsensitive(trendsPath, 'content') || trendsPath;
    }
  }

  if (!contentPath) {
    console.error("Could not find a content folder anywhere in the repository root!");
    return;
  }

  // 2. DYNAMICALLY FIND YOUR COLLECTION FOLDER (Handles 'articles', 'Articles', etc.)
  const collectionPath = findFolderCaseInsensitive(contentPath, collectionName);
  const destination = path.join(contentPath, outputName);

  // If the folder doesn't exist yet, write an empty index list and exit gracefully
  if (!collectionPath || !fs.existsSync(collectionPath)) {
    console.log(`Collection folder for "${collectionName}" not found. Writing empty fallback array.`);
    fs.writeFileSync(destination, JSON.stringify([], null, 2));
    return;
  }

  // 3. READ AND PARSE JON FILES
  const files = fs.readdirSync(collectionPath);
  const indexData = [];

  files.forEach(file => {
    if (path.extname(file) === '.json') {
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

  // Sort chronological data array elements
  indexData.sort((a, b) => {
    const valA = a[sortKey] || '';
    const valB = b[sortKey] || '';
    return reverse ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
  });

  // Write compiled data cleanly back to the branch tree
  fs.writeFileSync(destination, JSON.stringify(indexData, null, 2));
  console.log(`Successfully generated index feed at ${destination} (${indexData.length} entries)`);
}

// Fire index builds safely across both tracks
buildIndex('articles', 'articles_index.json', 'date', true);
buildIndex('reports', 'reports_index.json', 'year', true);
