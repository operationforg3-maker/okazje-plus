# Smart Import Integration Guide

## Overview

The Smart Import Pipeline integrates 3 specialized AI agents into the product import workflow:

1. **The Ruthless Auditor** (`aiDealQualityScore.ts`)
   - Scores product quality (0-100)
   - Applies penalties for high shipping cost, low merchant rating, low sales volume
   - Applies bonuses for high ratings, free shipping, high sales
   - Returns: `publish`, `reject`, or `manual_review`

2. **The Sales Copywriter** (`aiDealDescriptionPL.ts`)
   - Generates Polish marketing copy
   - Creates 2-sentence benefit-focused short descriptions
   - Generates HTML content with bullet points (benefits, not specs)
   - Produces enhanced marketing title
   - Avoids fluff, clickbait, and unsubstantiated claims

3. **The Librarian** (`aiSuggestCategory.ts`)
   - Maps products to 3-level category taxonomy
   - Returns: `mainCategorySlug`, `subCategorySlug`, `subSubCategorySlug`
   - Provides confidence score and reasoning
   - Fallback: Keyword-based matching for 30+ category patterns

## Usage

### Single Product Import

```typescript
import { smartImportProduct } from '@/integrations/smart-importer';

const result = await smartImportProduct({
  title: "Samsung Galaxy S24 Ultra",
  description: "Latest flagship smartphone...",
  price: 3999,
  originalPrice: 5499,
  shippingCost: 50,
  rating: 4.8,
  soldCount: 1200,
  merchantRating: 98,
  merchant: "AliExpress",
  source: "aliexpress",
  importedBy: "user123",
});

if (result.success) {
  console.log('Quality Score:', result.qualityScore);
  console.log('Category:', result.category);
  console.log('Generated Content:', result.generatedContent);
} else {
  console.log('Import rejected:', result.reason);
}
```

### Batch Import

```typescript
import { smartImportBatch } from '@/integrations/smart-importer';

const products = [
  { title: "Product 1", price: 100, source: "aliexpress", ... },
  { title: "Product 2", price: 200, source: "allegro", ... },
  { title: "Product 3", price: 300, source: "amazon", ... },
];

const results = await smartImportBatch(products.map(p => ({
  ...p,
  importedBy: "batch-user",
})));

results.forEach((result, i) => {
  console.log(`Product ${i+1}:`, result.success ? '✅' : '❌');
});
```

### Integration with Existing Import Flow

```typescript
import { smartImportProduct, buildProductFromSmartImport } from '@/integrations/smart-importer';

// In your AliExpress/Allegro ingest pipeline:

const input: SmartImportInput = {
  title: aliProduct.title,
  description: aliProduct.description,
  price: aliProduct.price,
  originalPrice: aliProduct.originalPrice,
  shippingCost: calculateShipping(aliProduct),
  rating: aliProduct.rating,
  soldCount: aliProduct.soldCount,
  merchantRating: aliProduct.merchantRating,
  source: 'aliexpress',
  externalId: aliProduct.id,
  externalUrl: aliProduct.url,
  importedBy: userId,
};

const smartResult = await smartImportProduct(input);

if (smartResult.success) {
  // Build Firestore documents
  const productPayload = buildProductFromSmartImport(input, smartResult);
  const dealPayload = buildDealFromSmartImport(input, smartResult, productId);
  
  // Save to Firestore
  await setDoc(doc(db, 'products', productId), productPayload);
  await setDoc(doc(db, 'deals', dealId), dealPayload);
}
```

## API Endpoint

**POST** `/api/admin/smart-import`

### Request (Single)

```json
{
  "title": "Samsung Galaxy S24",
  "description": "Latest flagship...",
  "price": 3999,
  "originalPrice": 5499,
  "shippingCost": 50,
  "rating": 4.8,
  "soldCount": 1200,
  "merchantRating": 98,
  "source": "aliexpress"
}
```

### Request (Batch)

```json
[
  { "title": "Product 1", "price": 100, ... },
  { "title": "Product 2", "price": 200, ... }
]
```

### Response

```json
{
  "success": true,
  "result": {
    "success": true,
    "qualityScore": 85,
    "qualityRecommendation": "publish",
    "category": {
      "main": "elektronika",
      "sub": "smartfony",
      "subsub": "akcesoria-do-smartfonow",
      "confidence": 0.95
    },
    "generatedContent": {
      "normalizedTitle": "Samsung Galaxy S24 Ultra",
      "shortDescription": "Najnowszy flagowiec Samsunga z aparatem 200MP...",
      "htmlContent": "<ul><li>Aparat 200MP...</li></ul>",
      "marketingTitle": "Samsung Galaxy S24 Ultra - Najlepszy Smartphone 2024"
    },
    "processingTimeMs": 2340
  }
}
```

## Admin Panel

Test the pipeline at: `/admin/smart-import`

Features:
- 3 pre-configured test samples (iPhone, Budget Laptop, Premium Headphones)
- Real-time product scoring
- Visual results for all 3 agents
- Processing time display

## Integration Points

### 1. AliExpress Import (`src/integrations/aliexpress/ingest.ts`)

Current code structure to enhance:

```typescript
// Replace this:
const qualityResult = await aiDealQualityScore({
  title: product.name,
  description: product.description,
  price: product.price,
  // ... old schema with 10 fields
});

// With this:
const smartResult = await smartImportProduct({
  title: aliProduct.title,
  description: aliProduct.description,
  price: aliProduct.price,
  shippingCost: aliProduct.shippingCost,
  rating: aliProduct.rating,
  soldCount: aliProduct.salesCount,
  merchantRating: aliProduct.merchantRating,
  source: 'aliexpress',
  externalId: aliProduct.id,
  importedBy: userId,
});
```

### 2. Allegro Integration (`src/integrations/allegro/`)

Same approach - use `smartImportProduct` with Allegro data:

```typescript
const smartResult = await smartImportProduct({
  title: allegroProduct.title,
  price: allegroProduct.price,
  originalPrice: allegroProduct.originalPrice,
  shippingCost: allegroProduct.shipping,
  rating: allegroProduct.rating,
  soldCount: allegroProduct.sold,
  merchantRating: allegroProduct.sellerRating,
  source: 'allegro',
  externalId: allegroProduct.id,
  importedBy: userId,
});
```

### 3. Admin Import Pages

Existing admin pages that should use Smart Import:

- `/admin/aliexpress-import` - Use `smartImportProduct` for each item
- `/admin/batch-import` - Use `smartImportBatch` for CSV/bulk imports
- `/admin/imports/aliexpress` - Integrate into import preview

## Quality Score Penalties & Bonuses

### Penalties (Base: 60)
- High shipping (>20% of price): -25 pts
- Low merchant rating (<90%): -20 pts
- Low sales volume (<10): -15 pts
- Missing merchant data: -10 pts

### Bonuses (Cumulative)
- High rating (>4.8): +20 pts
- Free shipping: +15 pts
- High sales (>100): +10 pts
- High discount (>50%): +10 pts

### Decision Thresholds
- **score ≥ 80**: `publish` (auto-approve)
- **50-79**: `manual_review` (needs moderation)
- **score < 50**: `reject` (auto-reject)

## Category Taxonomy (3 Levels)

Main categories with sub and subsub examples:

```
elektronika/smartfony/case-i-etui
elektronika/audio/sluchawki
moda/obuwie/obuwie-sportowe
dom-i-ogrod/meble/meble-do-salonu
sport-i-turystyka/fitness/akcesoria-fitness
zdrowie-i-uroda/kosmetyki/kosmetyki-do-twarzy
motoryzacja/akcesoria-samochodowe/uchwyty
zabawki/klocki/lego
inne/pozostale/niesklasyfikowane
```

## Performance

- Single product: **~2-3 seconds** (including 3 AI calls)
- Batch of 10: **~20-30 seconds**
- Main bottleneck: Genkit AI model inference

Optimization opportunities:
- Cache category suggestions for similar titles
- Batch Genkit calls within single AI flow
- Pre-score high-volume merchants

## Error Handling

All agents have fallback logic:

1. **Quality Score**: Rule-based scoring if AI unavailable
2. **Descriptions**: Category-based templates
3. **Category**: Keyword pattern matching (30+ patterns)

This ensures imports never fully fail - quality degrades gracefully.

## Testing

### Via API

```bash
curl -X POST http://localhost:9002/api/admin/smart-import \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Samsung Galaxy S24",
    "price": 3999,
    "rating": 4.8,
    "source": "aliexpress"
  }'
```

### Via UI

1. Navigate to `/admin/smart-import`
2. Click one of the 3 test sample buttons
3. Or manually fill the form and submit
4. View results from all 3 agents

## Next Steps

1. **Integrate into AliExpress importer** - Replace old `aiDealQualityScore` calls
2. **Integrate into Allegro importer** - Same pattern
3. **Admin UI enhancements** - Show smart import stats in dashboard
4. **Performance optimization** - Cache and batch processing
5. **Production deployment** - Test with real merchants
