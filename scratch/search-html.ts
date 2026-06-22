import * as fs from 'fs';

function run() {
  const html = fs.readFileSync('scratch/page_source.html', 'utf8');
  console.log('HTML size:', html.length);
  
  // Search for _initData or runParams or similar JSON blocks inside the HTML
  // Often there is window._initData = { ... } or window.runParams = { ... }
  // Let's do a search for script tags that contain JSON.
  const regexes = [
    /window\._initData\s*=\s*({[\s\S]*?});/m,
    /window\.runParams\s*=\s*({[\s\S]*?});/m,
    /window\._d_c_\.DCData\s*=\s*({[\s\S]*?});/m,
    /window\.runParams\s*=\s*([\s\S]*?);\s*window\._d_c_/m,
    /window\.runParams\s*=\s*([\s\S]*?);\s*\n/m,
  ];
  
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match) {
      console.log('Matched regex:', regex.toString());
      console.log('Match length:', match[1].length);
      console.log('Match preview:', match[1].substring(0, 500));
      fs.writeFileSync('scratch/matched_json.txt', match[1]);
    }
  }
}

run();
