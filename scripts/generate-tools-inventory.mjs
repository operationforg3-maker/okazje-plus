#!/usr/bin/env node
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const repoRoot = path.resolve(process.cwd());
const SRC = path.join(repoRoot, 'src');

async function readDirRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...await readDirRecursive(p));
    } else {
      results.push(p);
    }
  }
  return results;
}

function norm(p) {
  return p.replace(repoRoot + path.sep, '').split(path.sep).join('/');
}

function includesAny(str, arr) {
  const s = str.toLowerCase();
  return arr.some(k => s.includes(k));
}

async function getFileLastModified(filePath) {
  try {
    const { stdout } = await execAsync(`git log -1 --format="%ai|%an" -- "${filePath}"`);
    const [date, author] = stdout.trim().split('|');
    return { date: date ? new Date(date).toISOString().split('T')[0] : '-', author: author || '-' };
  } catch {
    return { date: '-', author: '-' };
  }
}

async function main() {
  const files = await readDirRecursive(SRC);

  // Buckets
  const uiPages = files.filter(f => /src\/app\/.+\/admin\/.+\/page\.tsx$/.test(f));
  const apiRoutes = files.filter(f => /src\/app\/api\/.+\/route\.ts$/.test(f));
  const aiFlows = files.filter(f => /src\/ai\/.+\.(ts|tsx)$/.test(f));
  const tests = files.filter(f => /\.(test|spec)\.ts$/.test(f) || /tests\/e2e\/.+\.spec\.ts$/.test(f));

  // Heuristics: classify tools
  const TOOLS = [
    { key: 'import-console', name: 'Import & Export Console', category: 'Import', uiHints: ['admin/import-export'], apiHints: ['admin/import/'], flowHints: [], },
    { key: 'aliexpress-import', name: 'AliExpress Import (AI)', category: 'Import', uiHints: ['admin/aliexpress-import', 'admin/imports/aliexpress'], apiHints: ['admin/aliexpress/'], flowHints: ['ai/flows/aliexpress','ai/flows/importerflow'] },
    { key: 'import-monitor', name: 'Import Monitor', category: 'Import', uiHints: ['admin/imports/page.tsx'], apiHints: ['admin/import/'], flowHints: [] },
    { key: 'smart-import', name: 'Smart Import', category: 'Import', uiHints: ['admin/smart-import'], apiHints: ['admin/smart-import'], flowHints: ['integrations/smart-importer'] },
    { key: 'auto-import', name: 'Auto Import (AI orchestration)', category: 'Import', uiHints: ['admin/auto-import'], apiHints: ['admin/ai/auto-import'], flowHints: [] },
    { key: 'deals-import', name: 'Deals Import (legacy)', category: 'Legacy Import', uiHints: ['admin/deals-import'], apiHints: ['admin/deals/import'], flowHints: [] },
    { key: 'allegro-import', name: 'Allegro Import (legacy UI)', category: 'Legacy Import', uiHints: ['admin/allegro-import'], apiHints: ['admin/allegro/'], flowHints: [] },
    { key: 'amazon-import', name: 'Amazon Import (legacy UI)', category: 'Legacy Import', uiHints: ['admin/amazon-import'], apiHints: ['admin/amazon/'], flowHints: [] },
    { key: 'ebay-import', name: 'eBay Import (legacy UI)', category: 'Legacy Import', uiHints: ['admin/ebay-import'], apiHints: ['admin/ebay/'], flowHints: [] },
    { key: 'convertiser-import', name: 'Convertiser Import (legacy UI)', category: 'Legacy Import', uiHints: ['admin/convertiser-import'], apiHints: ['admin/convertiser/'], flowHints: [] },
    { key: 'ai-tools', name: 'AI Tools (Enhance/Enrich/Translate)', category: 'Enhancement', uiHints: ['admin/ai-tools'], apiHints: ['admin/products/ai','admin/deals/ai'], flowHints: ['ai/flows/importerflow','ai/deal-enricher'] },
    { key: 'translations-admin', name: 'Translations Admin', category: 'Translation', uiHints: ['app/admin/translations', 'admin/translations'], apiHints: ['admin-import/translations'], flowHints: ['ai/flows/translation'] },
    { key: 'products-translate', name: 'Product Translations', category: 'Translation', uiHints: ['admin/products'], apiHints: ['admin/products/ai-translate','admin/products/translate-drafts'], flowHints: ['ai/flows/translation'] },
  ];

  function findUI(uiHint) {
    const hit = uiPages.find(p => includesAny(p, [uiHint]));
    return hit ? norm(hit) : '';
  }
  function findAPIs(hints) {
    const matched = apiRoutes.filter(p => includesAny(p, hints));
    return matched.map(norm);
  }
  function findFlows(hints) {
    const matched = aiFlows.filter(p => includesAny(p, hints));
    return matched.map(norm);
  }
  function hasTestsFor(hints) {
    const t = tests.filter(p => includesAny(p, hints));
    return { has: t.length > 0, files: t.map(norm) };
  }

  const rows = [];
  for (const t of TOOLS) {
    const uiPath = t.uiHints.map(findUI).filter(Boolean)[0] || '';
    const apiList = findAPIs(t.apiHints);
    const flowList = findFlows(t.flowHints);
    const testInfo = hasTestsFor([t.key, ...t.apiHints, ...t.flowHints, ...t.uiHints]);

    // Get last modified info from the most recent file
    const allFiles = [uiPath, ...apiList, ...flowList].filter(Boolean);
    let lastMod = { date: '-', author: '-' };
    if (allFiles.length > 0) {
      const modInfos = await Promise.all(allFiles.map(f => getFileLastModified(path.join(repoRoot, f))));
      const sorted = modInfos.filter(m => m.date !== '-').sort((a, b) => b.date.localeCompare(a.date));
      if (sorted.length > 0) lastMod = sorted[0];
    }

    rows.push({
      category: t.category,
      tool: t.name,
      ui: uiPath,
      apiCount: apiList.length,
      apis: apiList.join('\n'),
      backendModules: flowList.join('\n'),
      hasUI: uiPath ? 'yes' : 'no',
      hasAPI: apiList.length ? 'yes' : 'no',
      hasBackend: flowList.length ? 'yes' : 'no',
      hasTests: testInfo.has ? 'yes' : 'no',
      testFiles: testInfo.files.join('\n'),
      lastModified: lastMod.date,
      owner: lastMod.author,
      notes: ''
    });
  }

  // Add catch-all discovered items (heuristic): any admin API that matches import/enrich/translate not yet covered
  const extraApis = apiRoutes
    .map(norm)
    .filter(p => /admin\/(aliexpress|import|products|deals|smart-import|ai|convertiser|allegro|amazon|ebay)/.test(p));

  // Write CSV & MD
  const outDir = path.join(repoRoot, 'docs', 'reports');
  await fs.mkdir(outDir, { recursive: true });

  const csvHeader = ['category','tool','hasUI','hasAPI','hasBackend','hasTests','lastModified','owner','ui','apiCount','apis','backendModules','testFiles','notes'].join(',');
  const csv = [csvHeader, ...rows.map(r => [r.category,r.tool,r.hasUI,r.hasAPI,r.hasBackend,r.hasTests,r.lastModified,`"${r.owner}"`,`"${r.ui}"`,r.apiCount,`"${r.apis}"`,`"${r.backendModules}"`,`"${r.testFiles}"`,`"${r.notes}"`].join(','))].join('\n');
  await fs.writeFile(path.join(outDir, 'tools-inventory.csv'), csv, 'utf8');

  const mdLines = [];
  mdLines.push('# Tools Inventory (Import / Enhancement / Translation)');
  mdLines.push('');
  mdLines.push(`Generated: ${new Date().toISOString()}`);
  mdLines.push('');
  mdLines.push('| Category | Tool | Last Modified | Owner | Has UI | Has API | Has Backend | Has Tests |');
  mdLines.push('|---|---|---|---|:---:|:---:|:---:|:---:|');
  for (const r of rows) {
    mdLines.push(`| ${r.category} | ${r.tool} | ${r.lastModified} | ${r.owner} | ${r.hasUI} | ${r.hasAPI} | ${r.hasBackend} | ${r.hasTests} |`);
  }
  mdLines.push('');
  mdLines.push('## Details');
  for (const r of rows) {
    mdLines.push(`### ${r.tool}`);
    mdLines.push(`- Category: ${r.category}`);
    mdLines.push(`- Last Modified: ${r.lastModified}`);
    mdLines.push(`- Owner: ${r.owner}`);
    mdLines.push(`- UI: ${r.ui || '-'}`);
    mdLines.push(`- APIs (${r.apiCount}):`);
    mdLines.push(r.apis ? r.apis.split('\n').map(a => `  - ${a}`).join('\n') : '  - -');
    mdLines.push(`- Backend modules:`);
    mdLines.push(r.backendModules ? r.backendModules.split('\n').map(a => `  - ${a}`).join('\n') : '  - -');
    mdLines.push(`- Tests: ${r.hasTests}`);
    if (r.testFiles) mdLines.push(r.testFiles.split('\n').map(a => `  - ${a}`).join('\n'));
    mdLines.push('');
  }
  mdLines.push('');
  mdLines.push('## Discovered Admin APIs (raw)');
  for (const a of extraApis) mdLines.push(`- ${a}`);

  await fs.writeFile(path.join(outDir, 'tools-inventory.md'), mdLines.join('\n'), 'utf8');

  console.log('Inventory generated:');
  console.log(' - docs/reports/tools-inventory.md');
  console.log(' - docs/reports/tools-inventory.csv');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
