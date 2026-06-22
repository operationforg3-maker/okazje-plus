const fs = require('fs');
const path = require('path');

const dir = '/Users/tomaszgorecki/.gemini/antigravity-ide/brain/e78dfe75-64e9-4075-a157-22d90a3341e2/browser';
const files = fs.readdirSync(dir).map(f => {
  const fp = path.join(dir, f);
  const stat = fs.statSync(fp);
  return { name: f, path: fp, mtime: stat.mtime };
}).sort((a, b) => b.mtime - a.mtime);

console.log("Latest browser scratchpads:");
files.slice(0, 5).forEach(f => {
  console.log(`- ${f.name} (mtime: ${f.mtime.toISOString()})`);
  console.log(fs.readFileSync(f.path, 'utf8').slice(0, 800));
  console.log('===============================');
});
