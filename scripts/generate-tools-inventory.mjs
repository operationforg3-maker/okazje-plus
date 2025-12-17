#!/usr/bin/env node
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const execAsync = promisify(exec);
const repoRoot = path.resolve(process.cwd());
const SRC = path.join(repoRoot, 'src');

// Initialize Cloud Storage client
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET || 'okazje-plus-reports';
const bucket = storage.bucket(bucketName);

// ======= TOOLS METADATA =======
const TOOLS_METADATA = [
  {
    category: 'Import',
    tool: 'AliExpress Integration',
    description: 'Scrapes products from AliExpress via API and imports into platform',
    purpose: 'Automates product discovery and import workflow from AliExpress marketplace',
    howItWorks: 'Uses AliExpress API to fetch product data, validates schema, enriches with translations, imports to Firestore'
  },
  {
    category: 'Import',
    tool: 'Allegro Integration',
    description: 'Fetches deals and products from Allegro Polish marketplace',
    purpose: 'Enables automated deal discovery from Allegro via official API',
    howItWorks: 'Calls Allegro REST API, parses deal/product listings, applies filters, stores in Firestore'
  },
  {
    category: 'Import',
    tool: 'CSV Bulk Import',
    description: 'Accepts CSV uploads with product/deal data for bulk processing',
    purpose: 'Allows partners to batch-upload products via structured CSV format',
    howItWorks: 'Validates CSV schema, parses rows, performs duplicate checks, queues import jobs, processes asynchronously'
  },
  {
    category: 'Enhancement',
    tool: 'Price Monitoring',
    description: 'Tracks price changes over time for deals and products',
    purpose: 'Detects price drops and triggers notifications to users',
    howItWorks: 'Scheduled Cloud Function samples product prices daily, calculates deltas, flags hot deals'
  },
  {
    category: 'Enhancement',
    tool: 'Product Enrichment (AI)',
    description: 'Uses Vertex AI Gemini to enhance product descriptions and categories',
    purpose: 'Improves product data quality and searchability via AI-generated enhancements',
    howItWorks: 'Genkit flow calls Gemini with product schema, generates better title/description/tags'
  },
  {
    category: 'Enhancement',
    tool: 'Image Processing',
    description: 'Validates, optimizes, and stores product images in Firebase Storage',
    purpose: 'Ensures image quality, handles multiple formats, generates thumbnails',
    howItWorks: 'Downloads from source URLs, validates dimensions/format, resizes for web, uploads to Firebase with CDN'
  },
  {
    category: 'Enhancement',
    tool: 'Category Mapping',
    description: 'Maps external marketplace categories to platform 3-level hierarchy',
    purpose: 'Normalizes diverse marketplace categories into consistent platform taxonomy',
    howItWorks: 'Genkit flow analyzes category names, matches against predefined mappings, suggests categories'
  },
  {
    category: 'Translation',
    tool: 'Multi-Language UI (next-intl)',
    description: 'i18n framework for Polish/English/German UI translation',
    purpose: 'Provides route-based locale switching and translated UI components',
    howItWorks: 'next-intl middleware intercepts by locale segment, loads JSON catalogs, provides hooks'
  },
  {
    category: 'Translation',
    tool: 'Product Description Translation',
    description: 'Translates product titles and descriptions to multiple languages via Genkit',
    purpose: 'Makes products discoverable in German/English markets',
    howItWorks: 'Genkit flow detects Polish text, calls Gemini to translate, validates quality, stores translations'
  },
  {
    category: 'Translation',
    tool: 'Comment Localization',
    description: 'Optionally translates user comments for cross-language visibility',
    purpose: 'Enables cross-language community engagement',
    howItWorks: 'On comment creation, detects language, triggers translation flow, stores original + translations'
  },
  {
    category: 'Data Quality',
    tool: 'Duplicate Detection',
    description: 'Identifies and merges duplicate products from multiple import sources',
    purpose: 'Prevents duplicate listings and improves catalog cleanliness',
    howItWorks: 'Compares product title/URL/SKU against catalog, calculates similarity score, flags/merges duplicates'
  },
  {
    category: 'Monitoring',
    tool: 'Import Job Status Tracking',
    description: 'Real-time monitoring of background import jobs and processing status',
    purpose: 'Provides admins with visibility into import queue, completion rates, error logs',
    howItWorks: 'Cloud Function stores job state in Firestore, UI polls endpoint, displays progress and errors'
  },
  {
    category: 'Monitoring',
    tool: 'Voting & Temperature Algorithm',
    description: 'Heat-based ranking system that surfaces trending deals/products',
    purpose: 'Dynamically ranks content based on user engagement without raw vote counts',
    howItWorks: 'Calculates temperature from votes + time decay, periodically recalculates hot deals, caches in Redis'
  }
];

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
  console.log('🔍 Scanning codebase for tools...\n');
  
  const files = await readDirRecursive(SRC);

  const uiPages = files.filter(f => /src\/app\/.+\/admin\/.+\/page\.tsx$/.test(f));
  const apiRoutes = files.filter(f => /src\/app\/api\/.+\/route\.(ts|js)$/.test(f));
  const aiFlows = files.filter(f => /src\/ai\/.+\.(ts|tsx)$/.test(f));
  const tests = files.filter(f => /\.(test|spec)\.ts$/.test(f) || /tests\/e2e\/.+\.spec\.ts$/.test(f));

  // Map tools metadata to codebase
  const rows = [];
  for (const meta of TOOLS_METADATA) {
    const toolLower = meta.tool.toLowerCase();
    const catLower = meta.category.toLowerCase();
    const keywords = [toolLower.replace(/\s+/g, ''), toolLower.split(' ')[0], catLower];
    
    const uiPath = uiPages.find(p => keywords.some(k => p.toLowerCase().includes(k))) || '';
    const apiList = apiRoutes.filter(a => keywords.some(k => a.toLowerCase().includes(k)));
    const flowList = aiFlows.filter(f => keywords.some(k => f.toLowerCase().includes(k)));
    const testList = tests.filter(t => keywords.some(k => t.toLowerCase().includes(k)));
    
    const allFiles = [uiPath, ...apiList, ...flowList].filter(Boolean);
    let lastMod = { date: '-', author: '-' };
    if (allFiles.length > 0) {
      const modInfos = await Promise.all(allFiles.map(f => getFileLastModified(f)));
      const sorted = modInfos.filter(m => m.date !== '-').sort((a, b) => b.date.localeCompare(a.date));
      if (sorted.length > 0) lastMod = sorted[0];
    }

    rows.push({
      category: meta.category,
      tool: meta.tool,
      description: meta.description,
      purpose: meta.purpose,
      howItWorks: meta.howItWorks,
      hasUI: uiPath ? '✅' : '❌',
      hasAPI: apiList.length ? '✅' : '❌',
      hasBackend: flowList.length ? '✅' : '❌',
      hasTests: testList.length ? '✅' : '❌',
      lastModified: lastMod.date,
      owner: lastMod.author,
      ui: uiPath ? norm(uiPath) : '',
      apiCount: apiList.length,
      apis: apiList.map(norm).join('\n'),
      backendModules: flowList.map(norm).join('\n'),
      testFiles: testList.map(norm).join('\n'),
      notes: ''
    });
  }

  // Write CSV with GCS upload
  const outDir = path.join(repoRoot, 'docs', 'reports');
  await fs.mkdir(outDir, { recursive: true });

  const csvHeader = ['category','tool','description','purpose','howItWorks','hasUI','hasAPI','hasBackend','hasTests','lastModified','owner','ui','apiCount','apis','backendModules','testFiles','notes'].join(',');
  
  const csvRows = rows.map(r => [
    r.category,
    r.tool,
    `"${r.description.replace(/"/g, '""')}"`,
    `"${r.purpose.replace(/"/g, '""')}"`,
    `"${r.howItWorks.replace(/"/g, '""')}"`,
    r.hasUI,
    r.hasAPI,
    r.hasBackend,
    r.hasTests,
    r.lastModified,
    `"${r.owner}"`,
    `"${r.ui}"`,
    r.apiCount,
    `"${r.apis.replace(/"/g, '""')}"`,
    `"${r.backendModules.replace(/"/g, '""')}"`,
    `"${r.testFiles.replace(/"/g, '""')}"`,
    `"${r.notes}"`
  ].join(','));
  
  const csv = [csvHeader, ...csvRows].join('\n');
  
  await fs.writeFile(path.join(outDir, 'tools-inventory.csv'), csv, 'utf8');
  console.log('✅ Local CSV: docs/reports/tools-inventory.csv');

  // Upload to Cloud Storage
  try {
    const gcsFile = bucket.file('tools-inventory/current.csv');
    await gcsFile.save(csv, { metadata: { contentType: 'text/csv' } });
    console.log('✅ GCS: gs://' + bucketName + '/tools-inventory/current.csv');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const archiveFile = bucket.file(`tools-inventory/archive/${timestamp}.csv`);
    await archiveFile.save(csv, { metadata: { contentType: 'text/csv' } });
    console.log('✅ Backup: gs://' + bucketName + '/tools-inventory/archive/' + timestamp + '.csv');
  } catch (error) {
    console.warn('⚠️  GCS upload skipped:', error.message);
  }

  // Markdown report
  const mdLines = [];
  mdLines.push('# Tools Inventory');
  mdLines.push(`Generated: ${new Date().toISOString()}`);
  mdLines.push('');
  mdLines.push('| Category | Tool | Description | Has UI | Has API | Backend | Tests | Last Modified |');
  mdLines.push('|---|---|---|:---:|:---:|:---:|:---:|---|');
  for (const r of rows) {
    const desc = r.description.substring(0, 40);
    mdLines.push(`| ${r.category} | ${r.tool} | ${desc}${desc.length < r.description.length ? '...' : ''} | ${r.hasUI} | ${r.hasAPI} | ${r.hasBackend} | ${r.hasTests} | ${r.lastModified} |`);
  }
  mdLines.push('');
  mdLines.push('## Tool Details');
  for (const r of rows) {
    mdLines.push(`### ${r.tool}`);
    mdLines.push(`**Category:** ${r.category}`);
    mdLines.push(`**Opis:** ${r.description}`);
    mdLines.push(`**Przeznaczenie:** ${r.purpose}`);
    mdLines.push(`**Sposób działania:** ${r.howItWorks}`);
    mdLines.push('');
    mdLines.push('| Property | Value |');
    mdLines.push('|---|---|');
    mdLines.push(`| UI | ${r.hasUI} |`);
    mdLines.push(`| API Routes | ${r.hasAPI} (${r.apiCount}) |`);
    mdLines.push(`| Backend | ${r.hasBackend} |`);
    mdLines.push(`| Tests | ${r.hasTests} |`);
    mdLines.push(`| Last Modified | ${r.lastModified} |`);
    mdLines.push(`| Owner | ${r.owner} |`);
    mdLines.push('');
  }

  await fs.writeFile(path.join(outDir, 'tools-inventory.md'), mdLines.join('\n'), 'utf8');
  console.log('✅ Local MD: docs/reports/tools-inventory.md');

  // Statistics
  const stats = {
    total: rows.length,
    hasUI: rows.filter(r => r.hasUI === '✅').length,
    hasAPI: rows.filter(r => r.hasAPI === '✅').length,
    hasBackend: rows.filter(r => r.hasBackend === '✅').length,
    hasTests: rows.filter(r => r.hasTests === '✅').length,
  };

  console.log('\n📊 Summary:');
  console.log(`   Total tools: ${stats.total}`);
  console.log(`   UI coverage: ${stats.hasUI}/${stats.total} (${Math.round(100*stats.hasUI/stats.total)}%)`);
  console.log(`   API coverage: ${stats.hasAPI}/${stats.total} (${Math.round(100*stats.hasAPI/stats.total)}%)`);
  console.log(`   Backend coverage: ${stats.hasBackend}/${stats.total} (${Math.round(100*stats.hasBackend/stats.total)}%)`);
  console.log(`   Test coverage: ${stats.hasTests}/${stats.total} (${Math.round(100*stats.hasTests/stats.total)}%)`);
  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
