# Import System Complete Guide

## Overview

The Okazje+ import system fetches products/deals from marketplace APIs (AliExpress, Convertiser, etc.) and saves them to Firestore. It operates in **two main stages**:

1. **Stage 1: Import & Save** - Fetch products from APIs, process them, save to database
2. **Stage 2: AI Enhancement** - Improve descriptions, translations, and metadata (optional)

## Architecture

### Stage 1: 5-Stage Import Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   FETCH     │────▶│   DEDUPE    │────▶│   ENRICH    │────▶│  TRANSLATE  │────▶│    SAVE     │
│ (stageFetch)│     │(stageDedupe)│     │(stageEnrich)│     │(stageTransl)│     │(stageSave)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼                    ▼
 Get products      Remove dupes      Add metadata        Translate         Write to
 from API          Filter quality    Normalize data      to Polish         Firestore
```

### Stage Details

#### Stage 1: FETCH (`stageFetch.ts`)
**Purpose**: Get products from marketplace APIs

**Input**: 
- Keywords (English, e.g., "smartphone", "laptop")
- Importer type: `keyword-search`, `hot-products`, `convertiser`, `category-direct`
- Config: batch size, delays, retries

**Process**:
1. Try direct API client call
2. Fallback to HTTP endpoint `/api/admin/[marketplace]/search`
3. Validate each product (ID, title, price, image, link)
4. Return array of products

**Output**: `AliExpressProduct[]` (raw products from API)

**Common Issues**:
- ❌ API not configured → Returns 0 products
- ❌ Keywords in Polish → No results from English-only APIs
- ❌ Network timeout → Returns 0 products

#### Stage 2: DEDUPE (`stageDedupe.ts`)
**Purpose**: Remove duplicates and low-quality products

**Input**: `AliExpressProduct[]` from Stage 1

**Process**:
1. Remove duplicates by ID and URL
2. Filter by price range (if configured)
3. Filter by rating (if configured and product has rating)
4. Filter by orders/popularity (if configured and product has orders)

**Output**: Filtered `AliExpressProduct[]`

**Configuration** (relaxed defaults as of 2025-12-13):
```typescript
{
  minPrice: 1,        // Accept products ≥ 1 PLN
  maxPrice: 10000,    // Accept products ≤ 10000 PLN
  minRating: 0,       // Accept products with ANY rating (or no rating)
  minOrders: 0,       // Accept products with ANY order count (or no orders)
}
```

**Common Issues**:
- ❌ Too strict filters → All products filtered out
- ❌ All products have same ID → Dedupe removes all but one

#### Stage 3: ENRICH (`stageEnrich.ts`)
**Purpose**: Normalize data and add metadata

**Input**: Filtered `AliExpressProduct[]`

**Process**:
1. Normalize titles (remove spam, excessive caps)
2. Convert prices to PLN (if needed)
3. Calculate discounts
4. Add quality scores
5. Map to internal category structure

**Output**: `EnrichedProduct[]`

**Common Issues**:
- ❌ Category mapping fails → Products have wrong categories
- ❌ Currency conversion fails → Wrong prices

#### Stage 4: TRANSLATE (`stageTranslate.ts`)
**Purpose**: Translate titles and descriptions to Polish

**Input**: `EnrichedProduct[]`

**Process**:
1. Detect if title/description is in English
2. Translate to Polish using AI (optional, can be skipped)
3. Keep both EN and PL versions

**Output**: `EnrichedProduct[]` with Polish translations

**Common Issues**:
- ❌ AI translation fails → Uses original English text
- ❌ Translation quota exceeded → Skips translation

#### Stage 5: SAVE (`stageSave.ts`)
**Purpose**: Write products to Firestore

**Input**: Translated `EnrichedProduct[]`

**Process**:
1. Check if product already exists (by originalId or affiliateUrl)
2. If exists: Update existing product (unless skipExisting=true)
3. If new: Create new product with status=approved
4. Validate required fields before saving
5. Track created/updated IDs in import job

**Output**: `{ created: string[], updated: string[], skipped: string[] }`

**Product Structure**:
```typescript
{
  // Required fields
  name: string,                    // Polish name (legacy)
  title: { pl: string, en: string }, // Localized titles
  description: string,             // Short description (legacy)
  shortDescription: { pl: string, en: string },
  fullDescription: { pl: string, en: string },
  price: {                         // Smart price object
    amount: number,
    currency: 'PLN',
    shippingCost: number,
    totalPrice: number,
    originalPrice?: number,
    discountPercent?: number,
    lastUpdated: string,
  },
  image: string,                   // URL to main image
  imageHint: string,               // Alt text
  affiliateUrl: string,            // Link to product
  mainCategorySlug: string,        // e.g., 'elektronika'
  subCategorySlug: string,         // e.g., 'smartfony-telefony'
  subSubCategorySlug?: string,     // e.g., 'smartfony'
  status: 'approved' | 'draft' | 'rejected',
  
  // Auto-generated fields
  temperature: 0,
  upvotes: 0,
  downvotes: 0,
  views: 0,
  clicks: 0,
  shares: 0,
  commentsCount: 0,
  ratingCard: { score: 0, count: 0 },
  createdAt: Timestamp,
  
  // Import metadata
  metadata: {
    source: 'aliexpress' | 'convertiser' | etc,
    originalId: string,           // ID from source API
    importedAt: string,
    currencyRate: number,
    qualityScore: number,
  },
}
```

**Common Issues**:
- ❌ Invalid price → Product skipped
- ❌ Invalid image URL → Product skipped
- ❌ Missing category slugs → Product skipped
- ❌ Firestore permission denied → Save fails

## Configuration

### Environment Variables

**Required for AliExpress**:
```bash
ALIEXPRESS_APP_KEY=your_app_key
ALIEXPRESS_APP_SECRET=your_app_secret
ALIEXPRESS_API_BASE=https://api-sg.aliexpress.com/sync
```

**Required for Convertiser**:
```bash
CONVERTISER_API_TOKEN=your_token
```

**Optional**:
```bash
GEMINI_API_KEY=your_key  # For AI translations
```

### Import Job Configuration

When creating an import job via `/api/admin/import/start`:

```json
{
  "type": "products",               // or "deals"
  "maxItemsPerSubcategory": 10,     // How many products per subcategory
  "importerType": "keyword-search"  // or "hot-products", "convertiser", "category-direct"
}
```

### Pipeline Configuration

Each stage can be configured independently:

```typescript
{
  fetch: {
    batchSize: 50,           // Products per keyword
    delayBetweenItems: 100,  // ms delay between products
    delayBetweenBatches: 500, // ms delay between batches
    maxRetries: 2,
  },
  dedupe: {
    batchSize: 50,
    minPrice: 1,             // Minimum price (PLN)
    maxPrice: 10000,         // Maximum price (PLN)
    minRating: 0,            // Minimum rating (0-5), 0 = accept any
    minOrders: 0,            // Minimum orders, 0 = accept any
  },
  enrich: {
    batchSize: 5,
    delayBetweenItems: 200,
    delayBetweenBatches: 1000,
    currencyRate: 4.0,       // USD to PLN
  },
  translate: {
    batchSize: 10,
    delayBetweenItems: 30,
    delayBetweenBatches: 200,
  },
  save: {
    batchSize: 5,
    skipExisting: false,     // Update existing products
  },
}
```

## Common Issues and Solutions

### Issue 1: Import returns 0 products

**Symptoms**:
- Import job completes successfully
- But itemsCreated: 0, itemsUpdated: 0
- Logs show "Fetched: 0 products"

**Causes**:
1. API not configured (missing env vars)
2. Keywords in wrong language (Polish instead of English)
3. Network issues / API timeout
4. API rate limiting

**Solutions**:

**A) Check API Configuration**:
```bash
# Run diagnostic script
node test-import-simple.mjs

# Or check manually
echo $ALIEXPRESS_APP_KEY
echo $CONVERTISER_API_TOKEN
```

**B) Check Keywords**:
```typescript
// Keywords should be in ENGLISH for AliExpress
✅ GOOD: ["smartphone", "mobile phone", "android phone"]
❌ BAD:  ["smartfony", "telefony komórkowe"]
```

**C) Check Logs**:
```bash
# Check import job logs
node check-imports.mjs

# Check specific job
node check-specific-job.js YOUR_JOB_ID
```

### Issue 2: Products filtered out by dedupe

**Symptoms**:
- Stage 1 (Fetch) returns products
- Stage 2 (Dedupe) filters them all out
- Result: 0 products saved

**Cause**: Filters too strict for products in database

**Solution**: Relax dedupe filters (already done as of 2025-12-13):

```typescript
// In processImportJob or pipeline config
dedupe: {
  minRating: 0,   // Accept products without ratings
  minOrders: 0,   // Accept products without orders
  minPrice: 1,    // Accept cheap products
}
```

### Issue 3: Products fail validation in Stage 5

**Symptoms**:
- Products reach Stage 5 (Save)
- But show "❌ SKIP-PRICE" or "❌ SKIP-IMAGE"
- Result: 0 products saved

**Cause**: Invalid price or image URL

**Solution**: Check product data quality

```javascript
// Products must have:
- price > 0 and not NaN
- image starting with "http"
- valid category slugs
```

### Issue 4: Firestore permission denied

**Symptoms**:
- Error: "PERMISSION_DENIED"
- Products not saved despite passing all validation

**Cause**: Firestore security rules prevent write

**Solution**: Check firestore.rules:

```javascript
// products/{productId}
allow create: if isAdmin() 
  && request.resource.data.status in ['draft', 'approved']
  && hasValidPrice(request.resource.data);

function isAdmin() {
  return request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Issue 5: Keywords don't match products

**Symptoms**:
- API configured correctly
- Keywords look OK
- But returns 0 products

**Cause**: Keywords too specific or don't match API inventory

**Solutions**:

**A) Use broader keywords**:
```typescript
// Instead of:
❌ ["Samsung Galaxy S23 Ultra 5G"]

// Try:
✅ ["samsung phone", "galaxy", "5g smartphone"]
```

**B) Use AI keyword generation** (if enabled):
```typescript
// System will automatically enhance weak keywords
// See docs/fixes/2025-12-09-import-keywords-fix.md
```

**C) Check marketplace inventory**:
- AliExpress has more general consumer products
- Convertiser may have different inventory
- Try different keyword combinations

## Testing

### Quick Test

```bash
# 1. Check system health
node test-import-simple.mjs

# 2. Create test import job (single subcategory)
curl -X POST http://localhost:9002/api/admin/import/start \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "products",
    "maxItemsPerSubcategory": 5,
    "importerType": "convertiser"
  }'

# 3. Check job status
node check-imports.mjs

# 4. Check products in DB
node check-products.mjs
```

### Full Import Test

```bash
# 1. Start dev server
npm run dev

# 2. Login as admin in browser
#    Visit: http://localhost:9002/admin/harvester

# 3. Go to "Zadania" (Jobs) tab

# 4. Check API status:
#    ✓ = Configured and working
#    ⚠ = Not configured

# 5. Create import job:
#    - Select sources (e.g., Convertiser)
#    - Set max items (e.g., 10)
#    - Click "Start Import"

# 6. Monitor progress:
#    - Job status should change: queued → running → completed
#    - Check "Items Created" count
#    - Check logs for errors

# 7. Verify in database:
#    Visit: /admin/products
#    Should see newly imported products
```

## Troubleshooting Checklist

When import fails, check in this order:

- [ ] **API Configuration**: Run `node test-import-simple.mjs`
- [ ] **Categories Exist**: Need categories before importing products
- [ ] **Keywords Valid**: English keywords for AliExpress, appropriate for Convertiser
- [ ] **Network Access**: Server can reach marketplace APIs
- [ ] **Firestore Rules**: Admin users can write to products collection
- [ ] **Recent Job Logs**: Check `check-imports.mjs` for error details
- [ ] **Validation Rules**: Check stageFetch and stageDedupe filters
- [ ] **Database Quota**: Firestore hasn't exceeded quota

## Performance Tips

### Optimize Import Speed

```typescript
// Reduce delays for faster imports (but watch rate limits!)
fetch: {
  delayBetweenItems: 50,    // Default: 100ms
  delayBetweenBatches: 250,  // Default: 500ms
},
translate: {
  delayBetweenItems: 10,     // Default: 30ms
  delayBetweenBatches: 100,  // Default: 200ms
},
```

### Batch Processing

```typescript
// Process multiple subcategories in parallel
// Set maxItemsPerSubcategory lower to process more categories
{
  maxItemsPerSubcategory: 5,  // Instead of 50
}
```

### Skip Translation

```typescript
// If you don't need Polish translations yet
{
  translateToPolish: false,
}
```

## API Documentation

### AliExpress API
- Documentation: `docs/api/ALIEXPRESS_API_OVERVIEW.md`
- Spec: `docs/api/aliexpress-import-specification.md`
- Integration: `docs/integration/aliexpress.md`

### Convertiser API
- Integration: `docs/api/CONVERTISER_API_INTEGRATION.md`

### Other Marketplaces
- Allegro: `docs/api/ALLEGRO_API_SETUP.md`
- Amazon: Coming soon
- eBay: Coming soon

## Related Files

### Core Import Files
- `src/ai/flows/importerFlow/index.ts` - Main pipeline orchestrator
- `src/ai/flows/importerFlow/stageFetch.ts` - Stage 1: Fetch products
- `src/ai/flows/importerFlow/stageDedupe.ts` - Stage 2: Deduplicate
- `src/ai/flows/importerFlow/stageEnrich.ts` - Stage 3: Enrich metadata
- `src/ai/flows/importerFlow/stageTranslate.ts` - Stage 4: Translate
- `src/ai/flows/importerFlow/stageSave.ts` - Stage 5: Save to Firestore

### API Routes
- `src/app/api/admin/import/start/route.ts` - Create and start import job
- `src/app/api/admin/aliexpress/search/route.ts` - AliExpress search endpoint
- `src/app/api/admin/convertiser/search/route.ts` - Convertiser search endpoint

### Data Access
- `src/lib/data-admin.ts` - Admin data access (createProduct, updateProduct)
- `src/lib/firebase-admin.ts` - Firebase Admin SDK setup
- `src/lib/types.ts` - TypeScript type definitions

### Test Scripts
- `test-import-simple.mjs` - Simple diagnostic script
- `check-imports.mjs` - Check recent import jobs
- `check-products.mjs` - Check products in database

## Support

If you're still having issues after following this guide:

1. **Check Recent Fixes**: `docs/fixes/` - May have solution for your issue
2. **Review Troubleshooting**: `docs/troubleshooting/IMPORT_JOBS_NOT_WORKING.md`
3. **Check System Logs**: Server logs may have additional details
4. **Test in Isolation**: Use test scripts to narrow down the issue

## Recent Changes

**2025-12-13**:
- ✅ Relaxed validation in stageFetch.ts (accept more products)
- ✅ Relaxed dedupe filters (accept products with 0 ratings/orders)
- ✅ Updated default configuration for less strict filtering
- ✅ Added comprehensive import system guide (this document)
- ✅ Created test-import-simple.mjs diagnostic script

**2025-12-09**:
- ✅ Fixed keyword generation (AI-powered English keywords)
- ✅ Added fallback chain for import keywords

**2025-12-04**:
- ✅ Fixed missing function export in stageFetch.ts
- ✅ Cleaned up stuck jobs

See `docs/fixes/` for full change history.
