const fs = require('fs');
const path = require('path');

// Path configurations
const htmlFilePath = path.join(__dirname, 'Trends', 'index.html'); // Adjust if your file name/path is different
const outputDir = path.join(__dirname, 'content', 'articles');

// Create the output directory if it doesn't exist
fs.mkdirSync(outputDir, { recursive: true });

try {
  // Read your original trends.html file content
  const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

  // Regex to isolate each individual <a class="acard" ...></a> block
  const cardRegex = /<a class="acard"[\s\S]*?<\/a>/g;
  const cards = htmlContent.match(cardRegex);

  if (!cards) {
    console.error("No article cards found! Double-check your htmlFilePath layout.");
    process.exit(1);
  }

  console.log(`Found ${cards.length} articles to migrate. Starting processing...`);

  cards.forEach(card => {
    // 1. Extract the Slug / Link Destination
    const slugMatch = card.match(/href="\/trends\/([^"]+)"/);
    const slug = slugMatch ? slugMatch[1] : `article-${Math.random().toString(36).substr(2, 5)}`;

    // 2. Extract Title
    const titleMatch = card.match(/<h3>([\s\S]*?)<\/h3>/);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Article";

    // 3. Extract Summary Description
    const descMatch = card.match(/<p class="acard-desc">([\s\S]*?)<\/p>/);
    const summary = descMatch ? descMatch[1].trim() : "";

    // 4. Extract Category Tag Text
    const tagMatch = card.match(/<span class="acard-tag[^>]*">([\s\S]*?)<\/span>/);
    let category = tagMatch ? tagMatch[1].trim() : "Explainer";
    if (category === "Trend spotlight") category = "Model Update"; // Map seamlessly to Decap selections

    // 5. Extract and Standardize the Date Strings
    const dateMatch = card.match(/<span class="acard-date">([\s\S]*?)<\/span>/);
    let rawDate = dateMatch ? dateMatch[1].trim() : "2026-06-06";
    
    // Convert human dates like "15 May 2026" or "1 April 2026" to standard ISO strings
    let dateObj = new Date(rawDate);
    if (isNaN(dateObj)) {
      // Fallback parser for standard UK text variations
      const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
      const parts = rawDate.toLowerCase().split(' ');
      if(parts.length === 3) {
        dateObj = new Date(parseInt(parts[2]), months[parts[1].substring(0,3)], parseInt(parts[0]));
      } else {
        dateObj = new Date(); // Final fallback to today's timestamp
      }
    }
    const finalDateString = dateObj.toISOString();

    // 6. Build the clean Decap CMS JSON payload blueprint
    const jsonPayload = {
      title: title,
      date: finalDateString,
      category: category,
      summary: summary,
      body: `This article was migrated automatically. You can edit this full analysis text body directly from your Decap admin panel at llms101.com/admin!`
    };

    // 7. Write cleanly to the database repository file map
    const outputFilePath = path.join(outputDir, `${slug}.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(jsonPayload, null, 2));
    console.log(`✅ Migrated: ${slug}.json`);
  });

  console.log(`\n🎉 Success! All historical files built inside content/articles/`);
} catch (error) {
  console.error("Migration runtime crash:", error);
}
