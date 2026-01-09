# 🔧 Import Pipeline - DEDUPE FIX Dokumentacja

## Problem
Import pipeline był **całkowicie zepsuty** - produkty były fetchowane (np. 120) ale **0 produktów przechodziło deduplikację**.

```
fetched: 120 → deduplicated: 0 → enriched: 0 → saved: 0 ❌
```

## Root Cause
Plik: `/src/ai/flows/importerFlow/stageDedupe.ts`

**Stary kod (BROKEN):**
```typescript
// Rating filter
if (config.minRating !== undefined && product.rating && product.rating < config.minRating) {
  filtered_rating++;
  continue; // ← REJECT
}

// Orders filter
if (config.minOrders !== undefined && product.orders && product.orders < config.minOrders) {
  filtered_orders++;
  continue; // ← REJECT
}
```

**Problem:** AliExpress API zwraca produkty z `rating: undefined` lub `0` i `orders: undefined` lub `0`.
- Warunek `product.rating &&` zwraca `false` gdy `rating` jest `undefined` lub `0`
- Ale w takiej sytuacji kod **skakał do warunku `rating < minRating`** (bo `&&` jest short-circuit)
- Wynik: **każdy produkt bez danych o rating/orders był odrzucany**

## Rozwiązanie
**Nowy kod (FIXED):**
```typescript
// Rating filter - only apply if product HAS rating data
if (config.minRating !== undefined && product.rating !== undefined && product.rating !== null && product.rating > 0) {
  if (product.rating < config.minRating) {
    filtered_rating++;
    continue; // ← REJECT only if rating EXISTS and is too low
  }
}

// Orders filter - only apply if product HAS orders data
if (config.minOrders !== undefined && product.orders !== undefined && product.orders !== null && product.orders > 0) {
  if (product.orders < config.minOrders) {
    filtered_orders++;
    continue; // ← REJECT only if orders EXISTS and is too low
  }
}
```

**Logika:** Filtry są stosowane **TYLKO gdy dane istnieją**. Produkty bez rating/orders **przechodzą** dalej.

## Status
- ✅ Code fix - commit `9bf3cf1`
- ✅ Build succeeds locally
- ⏳ App Hosting deployment in progress (2-5 minutes)
- 🧪 Waiting for live test confirmation

## Jak Testować

### 1. Lokalny test (zawsze working):
```bash
node scripts/manual-dedupe-test.js
```

### 2. Live test (jak tylko deploy będzie ready):
```bash
bash scripts/test-live-import.sh
```

Powinien pokazać:
```
Fetched: 120
Deduplicated: 120  ← JUż BĘDĄ PRODUKTY!
Enriched: N
Translated: N
Saved: N
```

### 3. Monitor live imports:
```bash
node scripts/diagnose-live-import.js
```

## Timeline

| Czas | Event |
|------|-------|
| 20:32 UTC | Fix committed to main |
| 20:35 UTC | Empty commit to force rebuild |
| 20:35-20:40 UTC | App Hosting building... |
| 20:40 UTC | First test import created |
| 20:45 UTC | Live test results |

## Fallback Plan
Jeśli App Hosting nie deployuje po 10 minut:
1. Sprawdzić Cloud Build logs
2. Manually deploy to Cloud Run: `gcloud run deploy...`
3. Force redeploy Firebase App Hosting

## Dokumentacja Importu

### Import Flow
```
1. POST /api/admin/import/start
   ├─ Creates job in Firestore
   └─ Spawns async processImportJob()

2. processImportJob()
   ├─ Loops through 372 batches (all category combinations)
   └─ For each batch → runProductImportPipeline()

3. runProductImportPipeline()
   ├─ Stage 1: FETCH (AliExpress API)
   ├─ Stage 2: DEDUPE (filter by rating/orders) ← FIX HERE
   ├─ Stage 3: ENRICH (normalize, categories)
   ├─ Stage 4: TRANSLATE (to Polish)
   └─ Stage 5: SAVE (to Firestore)

4. Each batch updates job logs
   └─ Tracks: fetched, deduped, enriched, translated, saved
```

### Keyword-Search Import
- Source: AliExpress search by keywords
- Keywords from: `/src/lib/category-structure.ts` (importKeywords field)
- Default fallback: category slug as keyword
- Max items: configurable (usually 20 per subcategory)

### Importer Types
```typescript
'keyword-search'   // Search by keywords
'hot-products'     // AliExpress trending/bestsellers
'convertiser'      // Convertiser API
'category-direct'  // Direct category import
```

## Monitoring
```javascript
// Get recent jobs
db.collection('import_jobs').orderBy('createdAt', 'desc').limit(5).get()

// Check stage flow
jobDoc.data().logs.forEach(log => {
  console.log(`${log.subcategory}: ${log.stages.fetched} → ${log.stages.saved}`)
})

// Check saved products
db.collection('products').where('importJobId', '==', jobId).get()
```
