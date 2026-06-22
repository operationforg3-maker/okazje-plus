import * as fs from 'fs';
import { JSDOM } from 'jsdom';

function run() {
  const html = fs.readFileSync('scratch/page_source.html', 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  const scripts = Array.from(doc.querySelectorAll('script'));
  console.log(`Total script tags found: ${scripts.length}`);
  
  // Search text contents of scripts for interesting keywords
  scripts.forEach((s, idx) => {
    const text = s.textContent || '';
    if (text.length === 0) return;
    
    const keywords = ['sku', 'price', 'inventory', 'quantity', 'variant', 'option'];
    const foundKeywords = keywords.filter(kw => text.toLowerCase().includes(kw));
    
    if (foundKeywords.length > 0) {
      console.log(`Script [${idx}] (length: ${text.length}): keywords found: ${foundKeywords.join(', ')}`);
      // Print first 300 chars of script content
      console.log(`  Preview: ${text.substring(0, 300).replace(/\s+/g, ' ')}...`);
      
      // Let's write larger script tags to files for debugging
      if (text.length > 2000) {
        const filepath = `scratch/script_${idx}.js`;
        fs.writeFileSync(filepath, text);
        console.log(`  Saved full script to ${filepath}`);
      }
    }
  });
}

run();
