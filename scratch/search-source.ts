import * as fs from 'fs';

function run() {
  const html = fs.readFileSync('scratch/page_source.html', 'utf8');
  console.log('HTML length:', html.length);
  
  const query = 'Succebuy';
  let idx = 0;
  while (true) {
    idx = html.indexOf(query, idx);
    if (idx === -1) break;
    console.log(`Found "${query}" at index ${idx}:`);
    console.log(html.substring(idx - 100, idx + 400).replace(/\s+/g, ' '));
    idx += query.length;
  }
}

run();
