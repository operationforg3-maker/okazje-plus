import * as fs from 'fs';
import * as path from 'path';

const locales = ['en', 'de', 'fr', 'es', 'uk'];
const namespaces = [
  'home',
  'adminSetup',
  'cart',
  'search',
  'deals',
  'products',
  'login',
  'forum',
  'profile',
  'addDeal',
  'leaderboard',
  'admin',
  'adminImports',
  'common',
  'nav',
  'filters',
  'footer',
  'savedSearch',
];

const messagesDir = path.join(__dirname, '../messages');

function getKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], `${prefix}${key}.`));
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
  return keys;
}

console.log('--- STARTING TRANSLATION AUDIT ---');

const missingSummary: Record<string, Record<string, string[]>> = {};

for (const ns of namespaces) {
  const baseFile = path.join(messagesDir, `${ns}.json`);
  if (!fs.existsSync(baseFile)) {
    console.error(`Base file missing: ${baseFile}`);
    continue;
  }
  const baseData = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  const baseKeys = getKeys(baseData);

  for (const locale of locales) {
    const localeFile = path.join(messagesDir, `${ns}.${locale}.json`);
    if (!fs.existsSync(localeFile)) {
      if (!missingSummary[locale]) missingSummary[locale] = {};
      missingSummary[locale][ns] = ['ALL KEYS MISSING (File does not exist)'];
      continue;
    }

    try {
      const localeData = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
      const localeKeys = new Set(getKeys(localeData));
      const missing: string[] = [];

      for (const key of baseKeys) {
        if (!localeKeys.has(key)) {
          missing.push(key);
        }
      }

      if (missing.length > 0) {
        if (!missingSummary[locale]) missingSummary[locale] = {};
        missingSummary[locale][ns] = missing;
      }
    } catch (e) {
      console.error(`Error parsing ${localeFile}:`, e);
    }
  }
}

console.log('\n--- MISSING KEYS REPORT ---');
let hasMissing = false;
for (const locale of locales) {
  const nsList = missingSummary[locale];
  if (!nsList) continue;
  console.log(`\nLocale: [${locale.toUpperCase()}]`);
  hasMissing = true;
  for (const [ns, keys] of Object.entries(nsList)) {
    console.log(`  Namespace: ${ns}`);
    for (const key of keys) {
      console.log(`    - ${key}`);
    }
  }
}

if (!hasMissing) {
  console.log('All namespaces have matching keys for all locales!');
}
