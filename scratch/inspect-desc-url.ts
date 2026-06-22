import fs from 'fs';
import path from 'path';

function search() {
  const filePath = path.join(__dirname, 'last-scraped.html');
  if (!fs.existsSync(filePath)) {
    console.error('last-scraped.html not found');
    return;
  }

  const html = fs.readFileSync(filePath, 'utf-8');
  console.log(`Searching in ${html.length} bytes...`);

  // Search for description url keys
  const keys = ['desc.htm', 'aliexpress-media.com', 'pdp.aliexpress-media.com', 'descriptionUrl', 'descUrl'];
  for (const key of keys) {
    const idx = html.indexOf(key);
    if (idx !== -1) {
      console.log(`Found "${key}" at index ${idx}`);
      console.log(`Context: ... ${html.slice(Math.max(0, idx - 150), idx + 250)} ...\n`);
    } else {
      console.log(`"${key}" NOT found.`);
    }
  }
}

search();
