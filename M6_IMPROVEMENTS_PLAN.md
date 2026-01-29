# 🛠️ M6 Import System - Plan Napraw & Roadmap

**Data:** 28 stycznia 2026  
**Uaktualnione:** Po pełnej analizie  
**Status:** Ready for Implementation

---

## 🎯 Mapa Robozmów (Priority Order)

Uporządkowana lista konkretnych zmian do kodu.

---

## 🔴 QUICK WIN #1: Harvester - writeBatch() dla zapisów

**Priority:** CRITICAL  
**Impact:** 20x szybsze zapisy (5-10s → 0.5-1s)  
**Czas:** 2-3 godziny  
**Plik:** `src/lib/automation/harvester.ts`

### Current Code (SLOW)
```typescript
// Lines ~350-380 (w pętli for)
for (const sourceProduct of filteredProducts) {
  try {
    // ... dedupe logic ...
    
    if (existingProduct) {
      const dealId = await this.createDeal(...)  // WRITE #1
      dealsCreated++
      
      await this.updateProductBestPrice(...)    // WRITE #2
      duplicatesSkipped++
    } else {
      const productId = await this.createProductCore(...)  // WRITE #3
      productsCreated++
      
      const dealId = await this.createDeal(...)  // WRITE #4
      dealsCreated++
      
      await this.updateProductBestPrice(...)    // WRITE #5
      
      await this.recordIdentityMatch(...)       // WRITE #6
    }
  }
}
```

**Problem:** ~6 writes × 100 products × 50ms per write = 30 seconds just for writes!

### Fix: Batch Writes
```typescript
// Change main loop to collect updates
const updates = {
  dealsToCreate: [] as {id: string, data: DealM6}[],
  dealsToUpdate: [] as {id: string, data: Partial<DealM6>}[],
  productsToUpdate: [] as {id: string, data: Partial<ProductCore>}[],
  identityMatchesToCreate: [] as {id: string, data: IdentityMatch}[],
}

for (const sourceProduct of filteredProducts) {
  try {
    // ... dedupe logic ...
    
    if (existingProduct) {
      // Collect instead of await
      const dealData = this.transformSourceProductToDeal(sourceProduct, existingProduct.id, source)
      updates.dealsToCreate.push({
        id: adminDb.collection('deals').doc().id,
        data: dealData
      })
      
      updates.productsToUpdate.push({
        id: existingProduct.id,
        data: { bestPrice: ..., updatedAt: new Date().toISOString() }
      })
    } else {
      // Collect ProductCore creation
      const productId = adminDb.collection('product_cores').doc().id
      const productData = this.transformSourceProductToProductCore(sourceProduct, identityHash, categoryInfo)
      updates.productsToUpdate.push({
        id: productId,
        data: productData
      })
      
      // Collect Deal creation
      const dealData = this.transformSourceProductToDeal(sourceProduct, productId, source)
      updates.dealsToCreate.push({
        id: adminDb.collection('deals').doc().id,
        data: dealData
      })
      
      // Collect identity match
      updates.identityMatchesToCreate.push({
        id: identityHash,
        data: {
          productId,
          source,
          sourceProductId: sourceProduct.sourceProductId,
          createdAt: new Date().toISOString()
        }
      })
    }
  }
}

// AFTER loop: Batch write all collected updates
await this.batchWriteUpdates(updates)

// New method:
private async batchWriteUpdates(updates) {
  const BATCH_SIZE = 500  // Firestore limit
  
  // Batch 1: Create deals
  for (let i = 0; i < updates.dealsToCreate.length; i += BATCH_SIZE) {
    const batch = writeBatch(adminDb)
    const chunk = updates.dealsToCreate.slice(i, i + BATCH_SIZE)
    
    for (const {id, data} of chunk) {
      batch.set(adminDb.collection('deals').doc(id), data)
    }
    
    await batch.commit()
  }
  
  // Batch 2: Update products
  for (let i = 0; i < updates.productsToUpdate.length; i += BATCH_SIZE) {
    const batch = writeBatch(adminDb)
    const chunk = updates.productsToUpdate.slice(i, i + BATCH_SIZE)
    
    for (const {id, data} of chunk) {
      batch.update(adminDb.collection('product_cores').doc(id), data)
    }
    
    await batch.commit()
  }
  
  // Batch 3: Create identity matches
  for (let i = 0; i < updates.identityMatchesToCreate.length; i += BATCH_SIZE) {
    const batch = writeBatch(adminDb)
    const chunk = updates.identityMatchesToCreate.slice(i, i + BATCH_SIZE)
    
    for (const {id, data} of chunk) {
      batch.set(adminDb.collection('identity_matches').doc(id), data)
    }
    
    await batch.commit()
  }
}
```

**Expected result:** 20x szybciej (30s → 1.5s for 100 products) ✅

---

## 🔴 QUICK WIN #2: Identity Matcher - Promise.all() dla zapytań

**Priority:** CRITICAL  
**Impact:** 5x szybsze dedupe (2.5s → 0.5s dla 100 produktów)  
**Czas:** 1 godzina  
**Plik:** `src/lib/automation/identity-matcher.ts`

### Current Code (SLOW)
```typescript
// Lines 75-111
async findProductByIdentifiers(identifiers: ProductIdentifiers): Promise<ProductCore | null> {
  // Check EAN
  if (identifiers.ean) {
    const snapshot = await adminDb.collection('product_cores')
      .where('metadata.ean', '==', normalizeProductIdentifier(identifiers.ean))
      .limit(1)
      .get()  // WAIT 10ms
    
    if (!snapshot.empty) return snapshot.docs[0].data() as ProductCore
  }
  
  // Check GTIN
  if (identifiers.gtin) {
    const snapshot = await adminDb.collection('product_cores')
      .where('metadata.gtin', '==', normalizeProductIdentifier(identifiers.gtin))
      .limit(1)
      .get()  // WAIT 10ms (total 20ms)
    
    if (!snapshot.empty) return snapshot.docs[0].data() as ProductCore
  }
  
  // Check UPC
  if (identifiers.upc) {
    const snapshot = await adminDb.collection('product_cores')
      .where('metadata.upc', '==', normalizeProductIdentifier(identifiers.upc))
      .limit(1)
      .get()  // WAIT 10ms (total 30ms)
    
    if (!snapshot.empty) return snapshot.docs[0].data() as ProductCore
  }
  
  // ... MPN, then identity hash...
  // Total: ~50ms per product × 100 = 5 seconds!
  
  return null
}
```

### Fix: Parallel Queries
```typescript
async findProductByIdentifiers(identifiers: ProductIdentifiers): Promise<ProductCore | null> {
  const queries: Promise<QuerySnapshot>[] = []
  
  // Collect all queries (don't await!)
  if (identifiers.ean) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.ean', '==', normalizeProductIdentifier(identifiers.ean))
        .limit(1)
        .get()
    )
  }
  
  if (identifiers.gtin) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.gtin', '==', normalizeProductIdentifier(identifiers.gtin))
        .limit(1)
        .get()
    )
  }
  
  if (identifiers.upc) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.upc', '==', normalizeProductIdentifier(identifiers.upc))
        .limit(1)
        .get()
    )
  }
  
  if (identifiers.mpn) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.mpn', '==', normalizeProductIdentifier(identifiers.mpn))
        .limit(1)
        .get()
    )
  }
  
  // Execute ALL in parallel!
  const results = await Promise.all(queries)
  
  // Check results (short-circuit on first match)
  for (const snapshot of results) {
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as ProductCore
    }
  }
  
  return null
}
```

**Expected result:** 5x szybciej (2.5s → 0.5s) ✅

---

## 🔴 QUICK WIN #3: Refiner - Parallelize AI Enrichment

**Priority:** CRITICAL  
**Impact:** 10x szybsze wzbogacanie (5 min → 30-40s dla 100 produktów)  
**Czas:** 2 godziny  
**Plik:** `src/lib/automation/refiner.ts`

### Current Code (SLOW)
```typescript
// Lines 65-100 (w pętli)
for (const doc of snapshot.docs) {
  const productId = doc.id
  const product = doc.data() as ProductCore
  
  const refined = await this.performRefinement(product, refinationType)  // WAIT 3-5s
  
  productsSuccessful++
  
  if (!dryRun) {
    await this.updateProduct(productId, refined)  // WAIT
  }
}
// 100 products × 3-5 seconds = 5+ minutes!
```

### Fix: Batch Enrichment
```typescript
async refineExistingProducts(
  status?: string,
  limit: number = 100,
  refinationType: 'full_enrichment' | 'specs_cleanup' = 'full_enrichment',
  dryRun: boolean = false
): Promise<RefinerJob> {
  // Fetch all products first
  const snapshot = await q.get()  // All at once
  const products = snapshot.docs.slice(0, limit)
  
  // Batch size for AI (can process 20 at once)
  const BATCH_SIZE = 20
  let productsSuccessful = 0
  let productsFailed = 0
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const productIds = batch.map(doc => doc.id)
    const productDocs = batch.map(doc => doc.data() as ProductCore)
    
    // Process ALL in batch in parallel
    const enrichmentPromises = productDocs.map(product =>
      this.performRefinement(product, refinationType)
        .catch(err => {
          productsFailed++
          throw err
        })
    )
    
    const enrichedResults = await Promise.allSettled(enrichmentPromises)
    
    // Batch write results
    const writePromises = enrichedResults.map((result, idx) => {
      if (result.status === 'fulfilled') {
        productsFailed++
        const productId = productIds[idx]
        const refined = result.value
        
        if (!dryRun) {
          return this.updateProduct(productId, refined)
        }
        return Promise.resolve()
      } else {
        this.addLog('error', `Enrichment failed for ${productIds[idx]}`, {error: result.reason})
        return Promise.resolve()
      }
    })
    
    await Promise.all(writePromises)
    
    // Progress update
    const progress = Math.min(i + BATCH_SIZE, products.length)
    this.addLog('info', `Processed ${progress}/${products.length} products`)
    await this.updateJobRecord({...})
  }
}
```

**Expected result:** 10x szybciej (5 min → 30s) ✅

---

## 🟡 FIX #4: Categories - Denormalizuj mainCategorySlug na deals

**Priority:** MEDIUM-HIGH  
**Impact:** 10x szybsze kategoria queries (5s → 0.5s)  
**Czas:** 3-4 godziny  
**Pliki:** `src/lib/data.ts`, `harvester.ts`, Cloud Functions

### Current Problem
```typescript
// getDealsForCategory currently does:
const deals = await getDocs(
  query(collection(db, 'deals'), where('status', '==', 'approved'))
)
// Loads ALL deals, then:

const filtered = deals.filter(d => {
  const product = ...  // Load product for each deal!
  return product.mainCategorySlug === category
})
// N+1 queries!
```

### Solution: Denormalize mainCategorySlug field

**Step 1: Add field to DealM6 interface** (`src/lib/types.ts`)
```typescript
export interface DealM6 {
  id: string
  productId: string
  
  // NEW FIELD:
  mainCategorySlug?: string  // Denormalized from ProductCore
  
  // ... rest of fields ...
}
```

**Step 2: Update harvester to set this field** (`src/lib/automation/harvester.ts`)
```typescript
// When creating deal:
const dealData: DealM6 = {
  id: dealId,
  productId: productId,
  mainCategorySlug: categoryInfo.mainCategorySlug,  // NEW!
  price: {...},
  // ... rest ...
}

// Or when creating from existing product:
const product = await getProductCoreById(existingProduct.id)
const dealData: DealM6 = {
  id: dealId,
  productId: productId,
  mainCategorySlug: product.mainCategorySlug,  // NEW!
  // ... rest ...
}
```

**Step 3: Update deals collection** (one-time migration)
```typescript
// Cloud Function or admin script:
const dealsSnapshot = await adminDb.collection('deals').get()

for (const dealDoc of dealsSnapshot.docs) {
  const deal = dealDoc.data() as DealM6
  const product = await adminDb.collection('product_cores').doc(deal.productId).get()
  const productData = product.data() as ProductCore
  
  await dealDoc.ref.update({
    mainCategorySlug: productData.mainCategorySlug
  })
}
```

**Step 4: Update data.ts queries** (`src/lib/data.ts`)
```typescript
export async function getDealsForCategory(
  mainCategorySlug: string,
  limit: number = 20
) {
  // Fast single query now!
  const snapshot = await getDocs(
    query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      where('mainCategorySlug', '==', mainCategorySlug),  // NEW!
      limit(limit)
    )
  )
  
  return snapshot.docs.map(docToDeal)
}
```

**Expected result:** 10x szybciej (5s → 0.5s for 100 items) ✅

---

## 📋 Implementation Checklist

### Phase 1: Quick Wins (This Week)
- [ ] **writeBatch() for Harvester** (2-3 hours)
  - [ ] Create `batchWriteUpdates()` method
  - [ ] Refactor main loop to collect updates
  - [ ] Test with 100 products
  - [ ] Measure: should be 1.5s instead of 30s

- [ ] **Promise.all() for Identity Matcher** (1 hour)
  - [ ] Update `findProductByIdentifiers()`
  - [ ] Test with 100 products
  - [ ] Measure: should be 0.5s instead of 2.5s

- [ ] **AI Batch Enrichment** (2 hours)
  - [ ] Refactor main loop in Refiner
  - [ ] Use `Promise.allSettled()`
  - [ ] Add error handling
  - [ ] Measure: should be 30s instead of 5 min

### Phase 2: Data Denormalization (Next Week)
- [ ] **Add mainCategorySlug to DealM6**
  - [ ] Update types.ts
  - [ ] Update harvester.ts
  - [ ] Add Firestore index if needed
  - [ ] Measure: getDealsForCategory should be 0.5s

### Phase 3: Testing & Validation
- [ ] Performance benchmarks before/after
- [ ] Test with real AliExpress API
- [ ] Monitor Firestore read/write costs
- [ ] Verify all statuses still work (draft → pending → approved)

---

## 🎯 Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Harvester writes | 30s | 1.5s | 20x ✅ |
| Identity matching | 2.5s | 0.5s | 5x ✅ |
| AI enrichment | 5 min | 30-40s | 10x ✅ |
| Category queries | 5s | 0.5s | 10x ✅ |
| **TOTAL (100 items)** | **8-12 min** | **1-2 min** | **10-15x 🚀** |

---

## 📝 Code Review Checklist

Before merging:
- [ ] All `await` loops converted to `Promise.all()` where applicable
- [ ] `writeBatch()` properly used (max 500 ops per batch)
- [ ] Error handling with `Promise.allSettled()`
- [ ] Firestore indexes added (if new WHERE clauses)
- [ ] Unit tests pass (if any)
- [ ] Manual test with 100+ products
- [ ] No regression in existing functionality
- [ ] Status flow still works: draft → pending → approved

---

## 🔗 Related Files

Core files to understand:
- `src/lib/automation/harvester.ts` - Main import orchestrator
- `src/lib/automation/refiner.ts` - AI enrichment
- `src/lib/automation/identity-matcher.ts` - Deduplication
- `src/lib/data.ts` - Read layer queries
- `src/lib/types.ts` - Type definitions (ProductCore, DealM6)
- `okazje-plus/src/index.ts` - Cloud Functions (triggers, monitoring)

---

**Ready to start improving? Pick one from Phase 1 to begin! 🚀**

