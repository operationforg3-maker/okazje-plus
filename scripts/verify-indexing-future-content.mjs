#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  {
    label: 'deal-page-metadata',
    file: 'src/app/[locale]/deals/[id]/page.tsx',
    required: [
      'localeToOgLocale(locale)',
      "['x-default', `https://okazjeplus.pl/pl/deals/${deal.id}`]",
      'buildCategoryPath(locale, deal.mainCategorySlug, deal.subCategorySlug, deal.subSubCategorySlug)',
      'application/ld+json',
    ],
  },
  {
    label: 'product-page-metadata',
    file: 'src/app/[locale]/products/[id]/page.tsx',
    required: [
      'localeToOgLocale(effectiveLocale)',
      "['x-default', `https://okazjeplus.pl/pl/products/${productData.id}`]",
      'buildCategoryPath(',
      'application/ld+json',
    ],
  },
  {
    label: 'core-indexing-files',
    file: 'src/app/robots.ts',
    required: [
      "disallow: ['/api/', '/admin/', '/_next/']",
      'sitemap:',
    ],
  },
];

let hasErrors = false;

for (const check of checks) {
  const source = readFileSync(resolve(process.cwd(), check.file), 'utf8');

  for (const token of check.required) {
    if (!source.includes(token)) {
      hasErrors = true;
      console.error(`[verify-indexing-future-content] ERROR ${check.label}: brak tokena "${token}" w ${check.file}`);
    }
  }
}

if (hasErrors) {
  console.error('[verify-indexing-future-content] FAIL: indeksowalność przyszłych stron produktów/deali nie jest zabezpieczona.');
  process.exit(1);
}

console.log('[verify-indexing-future-content] OK: SEO/indexing guardrails dla przyszłych produktów/deali są aktywne.');