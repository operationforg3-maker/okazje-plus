import fs from 'fs';
import path from 'path';
import { load as loadHtml } from 'cheerio';

function inspect() {
  const filePath = path.join(__dirname, 'last-scraped.html');
  if (!fs.existsSync(filePath)) {
    console.error('last-scraped.html does not exist');
    return;
  }
  const html = fs.readFileSync(filePath, 'utf-8');
  console.log(`Read ${html.length} bytes from last-scraped.html`);

  const $ = loadHtml(html);
  
  // Search for ZOONLYI in all script tags
  let foundZOONLYI = false;
  $('script').each((i, el) => {
    const text = $(el).text();
    if (text.includes('ZOONLYI')) {
      foundZOONLYI = true;
      console.log(`Script ${i} contains ZOONLYI! Length: ${text.length} chars.`);
      // Print first 500 chars and occurrences
      console.log(`Preview: ${text.trim().slice(0, 500)}`);
      
      // Let's search for JSON-like strings
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        console.log(`Contains JSON structure starting at char ${jsonStart} to ${jsonEnd}`);
      }
    }
  });

  if (!foundZOONLYI) {
    console.log('ZOONLYI was not found in any script tags of the raw fetched HTML.');
  }

  // Check if ZOONLYI is anywhere in the raw HTML text
  if (html.includes('ZOONLYI')) {
    console.log('ZOONLYI is present in the raw HTML text!');
    // Print around the occurrence
    const idx = html.indexOf('ZOONLYI');
    console.log(`Context: ... ${html.slice(Math.max(0, idx - 100), idx + 100)} ...`);
  } else {
    console.log('ZOONLYI is NOT present anywhere in the raw fetched HTML!');
  }
}

inspect();
