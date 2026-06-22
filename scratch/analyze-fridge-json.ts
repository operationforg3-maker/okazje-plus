import * as fs from 'fs';

function run() {
  const content = fs.readFileSync('scratch/fridge_match.json', 'utf8');
  const data = JSON.parse(content);
  
  console.log('Top-level keys in fridge_match:', Object.keys(data));
  
  const result = data.data?.result || data.result || data;
  console.log('Result keys:', Object.keys(result));
  
  // Find where skuModule or similar is
  const findKeys = (obj: any, path: string = ''): void => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${k}` : k;
      if (k.toLowerCase().includes('sku') || k.toLowerCase().includes('price') || k.toLowerCase().includes('variant')) {
        console.log(`Found key "${currentPath}": type=${typeof v}, ${Array.isArray(v) ? 'array len=' + v.length : 'keys=' + Object.keys(v || {}).slice(0, 10)}`);
      }
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        // Limit depth
        if (currentPath.split('.').length < 4) {
          findKeys(v, currentPath);
        }
      }
    }
  };
  
  findKeys(result);
  
  // Let's check specifically for commonly known modules in AliExpress PDP JSON:
  // e.g. skuInfo, skuModule, priceModule, inventory, skuList, etc.
  const skuInfo = result.skuInfo || result.skuModule || result.data?.skuInfo || result.data?.skuModule;
  if (skuInfo) {
    console.log('\n--- SKU Info / SKU Module found! ---');
    console.log('SKU Info keys:', Object.keys(skuInfo));
    fs.writeFileSync('scratch/sku_info.json', JSON.stringify(skuInfo, null, 2));
    console.log('Saved SKU Info to scratch/sku_info.json');
  } else {
    console.log('\n--- SKU Info / SKU Module NOT found directly ---');
  }
}

run();
