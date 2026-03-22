#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  {
    label: 'harvester-deep-fetch',
    file: 'src/lib/automation/harvester.ts',
    required: [
      'parseAliExpressPromotionData',
      'client.getDetails(productId)',
      'promotionCampaign',
      'appSalePrice',
    ],
  },
  {
    label: 'legacy-importer',
    file: 'src/lib/aliexpress-importer.ts',
    required: [
      'parseAliExpressPromotionData',
      'promotionCampaign',
      'appSalePrice',
      'dealType: promotionData.dealType',
    ],
  },
  {
    label: 'price-refresh',
    file: 'src/lib/aliexpress-price-refresh.ts',
    required: [
      'parseAliExpressPromotionData',
      "'metadata.promotionCampaign'",
      "'metadata.appSalePrice'",
      'dealType: promotionData.dealType',
    ],
  },
  {
    label: 'deep-detail-fields',
    file: 'src/integrations/aliexpress/client.ts',
    required: [
      "'promo_code_info'",
      "'target_app_sale_price'",
      "'promotion_id'",
      "'flash_deal'",
    ],
  },
];

let hasErrors = false;

for (const check of checks) {
  const source = readFileSync(resolve(process.cwd(), check.file), 'utf8');

  for (const token of check.required) {
    if (!source.includes(token)) {
      hasErrors = true;
      console.error(`[verify-aliexpress-promotion-pipeline] ERROR ${check.label}: brak tokena \"${token}\" w ${check.file}`);
    }
  }
}

if (hasErrors) {
  console.error('[verify-aliexpress-promotion-pipeline] FAIL: pipeline promocji AliExpress nie jest kompletny.');
  process.exit(1);
}

console.log('[verify-aliexpress-promotion-pipeline] OK: przyszłe importy AliExpress przechodzą przez pełny pipeline promocji.');