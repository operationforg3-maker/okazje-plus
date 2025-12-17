# Tools Inventory (Import / Enhancement / Translation)

Generated: 2025-12-17T11:09:49.929Z

| Category | Tool | Last Modified | Owner | Has UI | Has API | Has Backend | Has Tests |
|---|---|---|---|:---:|:---:|:---:|:---:|
| Import | Import & Export Console | 2025-12-16 | welldonetg974 | yes | yes | no | no |
| Import | AliExpress Import (AI) | 2025-12-17 | welldonetg974 | yes | yes | yes | no |
| Import | Import Monitor | 2025-12-16 | welldonetg974 | yes | yes | no | no |
| Import | Smart Import | 2025-12-14 | welldonetg974 | yes | yes | no | no |
| Import | Auto Import (AI orchestration) | 2025-12-13 | welldonetg974 | yes | yes | no | no |
| Legacy Import | Deals Import (legacy) | 2025-12-15 | welldonetg974 | yes | yes | no | no |
| Legacy Import | Allegro Import (legacy UI) | 2025-12-09 | welldonetg974 | yes | yes | no | no |
| Legacy Import | Amazon Import (legacy UI) | 2025-12-07 | welldonetg974 | yes | yes | no | no |
| Legacy Import | eBay Import (legacy UI) | 2025-12-09 | welldonetg974 | yes | yes | no | no |
| Legacy Import | Convertiser Import (legacy UI) | 2025-12-07 | welldonetg974 | yes | yes | no | no |
| Enhancement | AI Tools (Enhance/Enrich/Translate) | 2025-12-16 | welldonetg974 | yes | yes | yes | no |
| Translation | Translations Admin | 2025-12-14 | welldonetg974 | no | yes | yes | no |
| Translation | Product Translations | 2025-12-16 | welldonetg974 | yes | yes | yes | no |

## Details
### Import & Export Console
- Category: Import
- Last Modified: 2025-12-16
- Owner: welldonetg974
- UI: src/app/[locale]/admin/import-export/page.tsx
- APIs (15):
  - src/app/api/admin/import/bestsellers/route.ts
  - src/app/api/admin/import/dashboard/summary/route.ts
  - src/app/api/admin/import/debug/route.ts
  - src/app/api/admin/import/fetch-save-drafts/route.ts
  - src/app/api/admin/import/history/route.ts
  - src/app/api/admin/import/kill-all/route.ts
  - src/app/api/admin/import/list/route.ts
  - src/app/api/admin/import/queue/[jobId]/route.ts
  - src/app/api/admin/import/queue/route.ts
  - src/app/api/admin/import/quick-test/route.ts
  - src/app/api/admin/import/rollback/route.ts
  - src/app/api/admin/import/start/route.ts
  - src/app/api/admin/import/status/route.ts
  - src/app/api/admin/import/test/route.ts
  - src/app/api/admin/import/test-diagnostics/route.ts
- Backend modules:
  - -
- Tests: no

### AliExpress Import (AI)
- Category: Import
- Last Modified: 2025-12-17
- Owner: welldonetg974
- UI: src/app/[locale]/admin/aliexpress-import/page.tsx
- APIs (9):
  - src/app/api/admin/aliexpress/advanced/batch-search/route.ts
  - src/app/api/admin/aliexpress/advanced/coupons/route.ts
  - src/app/api/admin/aliexpress/categories/route.ts
  - src/app/api/admin/aliexpress/health/route.ts
  - src/app/api/admin/aliexpress/import/route.ts
  - src/app/api/admin/aliexpress/item/route.ts
  - src/app/api/admin/aliexpress/search/route.ts
  - src/app/api/admin/aliexpress/sku-detail/route.ts
  - src/app/api/admin/aliexpress/suggest-category/route.ts
- Backend modules:
  - src/ai/flows/aliexpress/aiCurateProduct.ts
  - src/ai/flows/aliexpress/aiDealDescriptionPL.ts
  - src/ai/flows/aliexpress/aiDealQualityScore.ts
  - src/ai/flows/aliexpress/aiGenerateSEODescription.ts
  - src/ai/flows/aliexpress/aiGenerateSearchKeywords.ts
  - src/ai/flows/aliexpress/aiNormalizeTitleMultilang.ts
  - src/ai/flows/aliexpress/aiNormalizeTitlePL.ts
  - src/ai/flows/aliexpress/aiProductEnrichmentBatchPL.ts
  - src/ai/flows/aliexpress/aiProductEnrichmentPL.ts
  - src/ai/flows/aliexpress/aiSuggestCategory.ts
  - src/ai/flows/importerFlow/index.ts
  - src/ai/flows/importerFlow/stageAutoPromote.ts
  - src/ai/flows/importerFlow/stageDeals.ts
  - src/ai/flows/importerFlow/stageDedupe.ts
  - src/ai/flows/importerFlow/stageEnhance.ts
  - src/ai/flows/importerFlow/stageEnrich.ts
  - src/ai/flows/importerFlow/stageFetch.ts
  - src/ai/flows/importerFlow/stageSave.ts
  - src/ai/flows/importerFlow/stageSmartContent.ts
  - src/ai/flows/importerFlow/stageTranslate.ts
  - src/ai/flows/importerFlow/types.ts
- Tests: no

### Import Monitor
- Category: Import
- Last Modified: 2025-12-16
- Owner: welldonetg974
- UI: src/app/[locale]/admin/imports/page.tsx
- APIs (15):
  - src/app/api/admin/import/bestsellers/route.ts
  - src/app/api/admin/import/dashboard/summary/route.ts
  - src/app/api/admin/import/debug/route.ts
  - src/app/api/admin/import/fetch-save-drafts/route.ts
  - src/app/api/admin/import/history/route.ts
  - src/app/api/admin/import/kill-all/route.ts
  - src/app/api/admin/import/list/route.ts
  - src/app/api/admin/import/queue/[jobId]/route.ts
  - src/app/api/admin/import/queue/route.ts
  - src/app/api/admin/import/quick-test/route.ts
  - src/app/api/admin/import/rollback/route.ts
  - src/app/api/admin/import/start/route.ts
  - src/app/api/admin/import/status/route.ts
  - src/app/api/admin/import/test/route.ts
  - src/app/api/admin/import/test-diagnostics/route.ts
- Backend modules:
  - -
- Tests: no

### Smart Import
- Category: Import
- Last Modified: 2025-12-14
- Owner: welldonetg974
- UI: src/app/[locale]/admin/smart-import/page.tsx
- APIs (2):
  - src/app/api/admin/smart-import/route.ts
  - src/app/api/admin/smart-import/test/route.ts
- Backend modules:
  - -
- Tests: no

### Auto Import (AI orchestration)
- Category: Import
- Last Modified: 2025-12-13
- Owner: welldonetg974
- UI: src/app/[locale]/admin/auto-import/page.tsx
- APIs (1):
  - src/app/api/admin/ai/auto-import/route.ts
- Backend modules:
  - -
- Tests: no

### Deals Import (legacy)
- Category: Legacy Import
- Last Modified: 2025-12-15
- Owner: welldonetg974
- UI: src/app/[locale]/admin/deals-import/page.tsx
- APIs (2):
  - src/app/api/admin/deals/import/route.ts
  - src/app/api/admin/deals/import-aliexpress/route.ts
- Backend modules:
  - -
- Tests: no

### Allegro Import (legacy UI)
- Category: Legacy Import
- Last Modified: 2025-12-09
- Owner: welldonetg974
- UI: src/app/[locale]/admin/allegro-import/page.tsx
- APIs (2):
  - src/app/api/admin/allegro/import/route.ts
  - src/app/api/admin/allegro/search/route.ts
- Backend modules:
  - -
- Tests: no

### Amazon Import (legacy UI)
- Category: Legacy Import
- Last Modified: 2025-12-07
- Owner: welldonetg974
- UI: src/app/[locale]/admin/amazon-import/page.tsx
- APIs (2):
  - src/app/api/admin/amazon/import/route.ts
  - src/app/api/admin/amazon/search/route.ts
- Backend modules:
  - -
- Tests: no

### eBay Import (legacy UI)
- Category: Legacy Import
- Last Modified: 2025-12-09
- Owner: welldonetg974
- UI: src/app/[locale]/admin/ebay-import/page.tsx
- APIs (2):
  - src/app/api/admin/ebay/import/route.ts
  - src/app/api/admin/ebay/search/route.ts
- Backend modules:
  - -
- Tests: no

### Convertiser Import (legacy UI)
- Category: Legacy Import
- Last Modified: 2025-12-07
- Owner: welldonetg974
- UI: src/app/[locale]/admin/convertiser-import/page.tsx
- APIs (2):
  - src/app/api/admin/convertiser/import/route.ts
  - src/app/api/admin/convertiser/search/route.ts
- Backend modules:
  - -
- Tests: no

### AI Tools (Enhance/Enrich/Translate)
- Category: Enhancement
- Last Modified: 2025-12-16
- Owner: welldonetg974
- UI: src/app/[locale]/admin/ai-tools/page.tsx
- APIs (3):
  - src/app/api/admin/deals/ai-translate/route.ts
  - src/app/api/admin/products/ai-enrich/route.ts
  - src/app/api/admin/products/ai-translate/route.ts
- Backend modules:
  - src/ai/deal-enricher.ts
  - src/ai/flows/importerFlow/index.ts
  - src/ai/flows/importerFlow/stageAutoPromote.ts
  - src/ai/flows/importerFlow/stageDeals.ts
  - src/ai/flows/importerFlow/stageDedupe.ts
  - src/ai/flows/importerFlow/stageEnhance.ts
  - src/ai/flows/importerFlow/stageEnrich.ts
  - src/ai/flows/importerFlow/stageFetch.ts
  - src/ai/flows/importerFlow/stageSave.ts
  - src/ai/flows/importerFlow/stageSmartContent.ts
  - src/ai/flows/importerFlow/stageTranslate.ts
  - src/ai/flows/importerFlow/types.ts
- Tests: no

### Translations Admin
- Category: Translation
- Last Modified: 2025-12-14
- Owner: welldonetg974
- UI: -
- APIs (1):
  - src/app/api/admin-import/translations/route.ts
- Backend modules:
  - src/ai/flows/translation/aiTranslateDescriptionToPL.ts
  - src/ai/flows/translation/aiTranslateTitleToPL.ts
- Tests: no

### Product Translations
- Category: Translation
- Last Modified: 2025-12-16
- Owner: welldonetg974
- UI: src/app/[locale]/admin/products/page.tsx
- APIs (2):
  - src/app/api/admin/products/ai-translate/route.ts
  - src/app/api/admin/products/translate-drafts/route.ts
- Backend modules:
  - src/ai/flows/translation/aiTranslateDescriptionToPL.ts
  - src/ai/flows/translation/aiTranslateTitleToPL.ts
- Tests: no


## Discovered Admin APIs (raw)
- src/app/api/admin/ai/auto-import/route.ts
- src/app/api/admin/ai/command/route.ts
- src/app/api/admin/ai/enhance-deal/route.ts
- src/app/api/admin/ai/enhance-product/route.ts
- src/app/api/admin/ai/fill-categories/route.ts
- src/app/api/admin/ai/history/route.ts
- src/app/api/admin/ai/wipe/route.ts
- src/app/api/admin/aliexpress/advanced/batch-search/route.ts
- src/app/api/admin/aliexpress/advanced/coupons/route.ts
- src/app/api/admin/aliexpress/categories/route.ts
- src/app/api/admin/aliexpress/health/route.ts
- src/app/api/admin/aliexpress/import/route.ts
- src/app/api/admin/aliexpress/item/route.ts
- src/app/api/admin/aliexpress/search/route.ts
- src/app/api/admin/aliexpress/sku-detail/route.ts
- src/app/api/admin/aliexpress/suggest-category/route.ts
- src/app/api/admin/allegro/import/route.ts
- src/app/api/admin/allegro/search/route.ts
- src/app/api/admin/amazon/import/route.ts
- src/app/api/admin/amazon/search/route.ts
- src/app/api/admin/convertiser/import/route.ts
- src/app/api/admin/convertiser/search/route.ts
- src/app/api/admin/deals/[id]/route.ts
- src/app/api/admin/deals/ai-translate/route.ts
- src/app/api/admin/deals/bulk-delete/route.ts
- src/app/api/admin/deals/export/route.ts
- src/app/api/admin/deals/from-product/route.ts
- src/app/api/admin/deals/import/route.ts
- src/app/api/admin/deals/import-aliexpress/route.ts
- src/app/api/admin/deals/route.ts
- src/app/api/admin/ebay/import/route.ts
- src/app/api/admin/ebay/search/route.ts
- src/app/api/admin/import/bestsellers/route.ts
- src/app/api/admin/import/dashboard/summary/route.ts
- src/app/api/admin/import/debug/route.ts
- src/app/api/admin/import/fetch-save-drafts/route.ts
- src/app/api/admin/import/history/route.ts
- src/app/api/admin/import/kill-all/route.ts
- src/app/api/admin/import/list/route.ts
- src/app/api/admin/import/queue/[jobId]/route.ts
- src/app/api/admin/import/queue/route.ts
- src/app/api/admin/import/quick-test/route.ts
- src/app/api/admin/import/rollback/route.ts
- src/app/api/admin/import/start/route.ts
- src/app/api/admin/import/status/route.ts
- src/app/api/admin/import/test/route.ts
- src/app/api/admin/import/test-diagnostics/route.ts
- src/app/api/admin/products/[id]/route.ts
- src/app/api/admin/products/ai-enrich/route.ts
- src/app/api/admin/products/ai-translate/route.ts
- src/app/api/admin/products/approve-drafts/route.ts
- src/app/api/admin/products/bulk-delete/route.ts
- src/app/api/admin/products/enhance-ai/route.ts
- src/app/api/admin/products/enrich-drafts/route.ts
- src/app/api/admin/products/export/route.ts
- src/app/api/admin/products/import-batch/route.ts
- src/app/api/admin/products/ingest/route.ts
- src/app/api/admin/products/route.ts
- src/app/api/admin/products/translate-drafts/route.ts
- src/app/api/admin/smart-import/route.ts
- src/app/api/admin/smart-import/test/route.ts