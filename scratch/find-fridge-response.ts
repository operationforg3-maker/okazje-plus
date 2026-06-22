import * as fs from 'fs';
import * as path from 'path';

function run() {
  const dir = 'scratch';
  const targetId = '1005009279188100';
  const files = fs.readdirSync(dir).filter(f => f.startsWith('mobile_response_') && f.endsWith('.json'));
  
  console.log(`Searching through ${files.length} mobile response files for target product ID ${targetId}...`);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes(targetId)) {
      console.log(`\nMatch found in file: ${file} (Size: ${content.length} bytes)`);
      // Parse JSON
      try {
        let jsonStr = content.trim();
        // Remove jsonp callback wrapper if present
        const jsonpMatch = jsonStr.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
        if (jsonpMatch) {
          jsonStr = jsonpMatch[1].trim();
        }
        const parsed = JSON.parse(jsonStr);
        console.log('Successfully parsed JSON!');
        const apiName = parsed.api || parsed.action || 'unknown';
        console.log('API Endpoint Name:', apiName);
        
        // Find where the product ID is and print keys/hierarchy
        // We can inspect if it has skuModule, priceModule, etc.
        const searchInObj = (obj: any, path: string = ''): string[] => {
          if (!obj || typeof obj !== 'object') return [];
          const found: string[] = [];
          for (const [k, v] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${k}` : k;
            if (k === targetId) {
              found.push(`${currentPath} is the target ID! Keys: ${Object.keys(v || {})}`);
              if (v && typeof v === 'object') {
                const subkeys = Object.keys(v);
                console.log(`Subkeys of target ID in ${currentPath}:`, subkeys);
                // Print interesting sub-blocks
                if ((v as any).skuInfo || (v as any).skuModule || (v as any).priceInfo) {
                  console.log('Found SKU/price modules inside target ID!');
                }
              }
            } else if (typeof v === 'object') {
              found.push(...searchInObj(v, currentPath));
            }
          }
          return found;
        };
        
        const paths = searchInObj(parsed);
        console.log('Paths found:', paths);
        
        // Write a filtered version of this match to a separate file
        fs.writeFileSync('scratch/fridge_match.json', JSON.stringify(parsed, null, 2));
        console.log('Saved parsed JSON to scratch/fridge_match.json');
        
      } catch (err: any) {
        console.error(`Failed to parse/inspect ${file}:`, err.message);
      }
    }
  }
}

run();
