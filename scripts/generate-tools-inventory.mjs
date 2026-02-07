import { Storage } from '@google-cloud/storage';

const DEFAULT_TOOLS_CSV = `category,tool,description,purpose,howItWorks,hasUI,hasAPI,hasBackend,hasTests,lastModified,owner,ui,apiCount,apis,backendModules,testFiles,notes
Import,AliExpress Integration,"Scrapes products from AliExpress via API and imports into platform","Automates product discovery and import workflow from AliExpress marketplace","Uses AliExpress API to fetch product data, validates schema, enriches with translations, imports to Firestore",✅,✅,✅,❌,2025-01-15,system,src/app/admin/aliexpress-import/page.tsx,2,"src/app/api/admin/aliexpress/route.ts
src/app/api/admin/import/route.ts","src/ai/flows/aliexpress.ts
src/ai/flows/importer.ts",,
Import,Allegro Integration,"Fetches deals and products from Allegro Polish marketplace","Enables automated deal discovery from Allegro via official API","Calls Allegro REST API, parses deal/product listings, applies filters, stores in Firestore",❌,✅,❌,❌,2025-01-10,system,,1,src/app/api/admin/allegro/route.ts,,,
Import,CSV Bulk Import,"Accepts CSV uploads with product/deal data for bulk processing","Allows partners to batch-upload products via structured CSV format","Validates CSV schema, parses rows, performs duplicate checks, queues import jobs, processes asynchronously",✅,✅,✅,❌,2025-01-14,system,src/app/admin/smart-import/page.tsx,3,"src/app/api/admin/smart-import/route.ts
src/app/api/admin/import/route.ts
src/app/api/admin/products/bulk/route.ts","src/ai/flows/import-validator.ts",,
Enhancement,Price Monitoring,"Tracks price changes over time for deals and products","Detects price drops and triggers notifications to users","Scheduled Cloud Function samples product prices daily, calculates deltas, flags hot deals",❌,✅,✅,❌,2025-01-12,system,,2,"src/app/api/admin/products/price/route.ts
src/app/api/admin/deals/price/route.ts",src/ai/flows/price-monitor.ts,,
Enhancement,Product Enrichment (AI),"Uses Vertex AI Gemini to enhance product descriptions and categories","Improves product data quality and searchability via AI-generated enhancements","Genkit flow calls Gemini with product schema, generates better title/description/tags",✅,✅,✅,❌,2025-01-15,system,src/app/admin/ai-tools/page.tsx,2,"src/app/api/admin/products/ai/route.ts
src/app/api/admin/deals/ai/route.ts",src/ai/flows/enrichment.ts,,
Enhancement,Image Processing,"Validates, optimizes, and stores product images in Firebase Storage","Ensures image quality, handles multiple formats, generates thumbnails","Downloads from source URLs, validates dimensions/format, resizes for web, uploads to Firebase with CDN",❌,✅,✅,❌,2025-01-11,system,,1,src/app/api/admin/products/images/route.ts,src/ai/flows/image-processor.ts,,
Enhancement,Category Mapping,"Maps external marketplace categories to platform 3-level hierarchy","Normalizes diverse marketplace categories into consistent platform taxonomy","Genkit flow analyzes category names, matches against predefined mappings, suggests categories",❌,✅,✅,❌,2025-01-13,system,,1,src/app/api/admin/categories/map/route.ts,src/ai/flows/category-mapper.ts,,
Translation,Multi-Language UI (next-intl),"i18n framework for Polish/English/German UI translation","Provides route-based locale switching and translated UI components","next-intl middleware intercepts by locale segment, loads JSON catalogs, provides hooks",✅,❌,❌,❌,2024-12-01,system,src/app/[locale]/admin/layout.tsx,0,,,
Translation,Product Description Translation,"Translates product titles and descriptions to multiple languages via Genkit","Makes products discoverable in German/English markets","Genkit flow detects Polish text, calls Gemini to translate, validates quality, stores translations",✅,✅,✅,❌,2025-01-14,system,src/app/admin/products/page.tsx,1,src/app/api/admin/products/translate/route.ts,src/ai/flows/translation.ts,,
Translation,Comment Localization,"Optionally translates user comments for cross-language visibility","Enables cross-language community engagement","On comment creation, detects language, triggers translation flow, stores original + translations",❌,✅,✅,❌,2025-01-12,system,,1,src/app/api/admin/comments/translate/route.ts,src/ai/flows/comment-translate.ts,,
Data Quality,Duplicate Detection,"Identifies and merges duplicate products from multiple import sources","Prevents duplicate listings and improves catalog cleanliness","Compares product title/URL/SKU against catalog, calculates similarity score, flags/merges duplicates",❌,✅,✅,❌,2025-01-11,system,,1,src/app/api/admin/products/deduplicate/route.ts,src/ai/flows/dedup.ts,,
Monitoring,Import Job Status Tracking,"Real-time monitoring of background import jobs and processing status","Provides admins with visibility into import queue, completion rates, error logs","Cloud Function stores job state in Firestore, UI polls endpoint, displays progress and errors",✅,✅,✅,❌,2025-01-15,system,src/app/admin/imports/page.tsx,1,src/app/api/admin/import-jobs/route.ts,src/functions/import-processor.ts,,
Monitoring,Voting & Temperature Algorithm,"Heat-based ranking system that surfaces trending deals/products","Dynamically ranks content based on user engagement without raw vote counts","Calculates temperature from votes + time decay, periodically recalculates hot deals, caches in Redis",✅,✅,✅,✅,2025-01-15,system,src/app/[locale]/deals/page.tsx,2,"src/app/api/admin/deals/heat/route.ts
src/app/api/deals/vote/route.ts",src/lib/data.ts,src/components/deals-list.test.ts,
`;

const bucketName = process.env.GCS_BUCKET || 'okazje-plus-reports';
const targetPath = 'tools-inventory/current.csv';

async function main() {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const csv = `${DEFAULT_TOOLS_CSV.trim()}\n`;

  await bucket.file(targetPath).save(csv, {
    contentType: 'text/csv',
    resumable: false,
    metadata: {
      cacheControl: 'no-store, max-age=0',
    },
  });

  console.log(`✅ Tools inventory uploaded to gs://${bucketName}/${targetPath}`);
}

main().catch((error) => {
  console.error('❌ Tools inventory generation failed:', error);
  process.exit(1);
});
