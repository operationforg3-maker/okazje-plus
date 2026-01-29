# 🔄 M6 Import System - Architektura Kompleta

**Data:** 28 stycznia 2026  
**Status:** ✅ Dokumentacja rzeczywistego systemu  
**Version:** M6 (Product-Centric Architecture)

---

## 🎯 Szybki Przegląd

M6 Import System to zautomatyzowany pipeline do pobierania produktów z API, deduplikacji, wzbogacania danymi AI i zapisywania w Firestore.

```
┌─────────────────┐
│  External API   │  (AliExpress, Amazon, Allegro)
│  (raw data)     │
└────────┬────────┘
         │ fetch + dedupe
         ↓
┌─────────────────────────────────────┐
│  Harvester (PULL PHASE)             │  ← Main bottleneck!
│  ├─ Pobiera produkty z API          │     (8-12 min / 100 items)
│  ├─ Deduplikacja (EAN/identity)     │
│  ├─ Tworzy ProductCore + Deal       │
│  └─ Zapisuje do Firestore           │
└────────┬────────────────────────────┘
         │ draft status
         ↓
┌─────────────────────────────────────┐
│  Refiner (ENRICH PHASE)             │  ← AI enrichment
│  ├─ Normalizuje specs               │     (3-5s / product)
│  ├─ Generuje descriptions (Gemini)  │
│  ├─ Oblicza quality score           │
│  ├─ Wzbogaca AI metadata            │
│  └─ Zmienia status na pending_app   │
└────────┬────────────────────────────┘
         │ pending_approval status
         ↓
┌─────────────────────────────────────┐
│  Admin Panel (REVIEW & READ)        │
│  ├─ Moderator przegląda              │
│  ├─ Zatwierdza / Odrzuca             │
│  └─ Zmienia status na approved       │
└────────┬────────────────────────────┘
         │ approved status (visible)
         ↓
┌─────────────────────────────────────┐
│  Frontend (READ PHASE)              │
│  ├─ Wyświetla ProductCore + Deals   │
│  ├─ Cache (Redis/LRU)               │
│  └─ Temperature sort                │
└─────────────────────────────────────┘
```

---

## 📊 Data Flow - Detale

### Phase 1: HARVESTER (Pobieranie & Deduplikacja)

**Plik:** `src/lib/automation/harvester.ts` (1368 linii)

**Wejście:**
```typescript
// Query dla AliExpress
source: 'aliexpress'
queries: ['electronics/phones/flagship', 'electronics/laptops/gaming']
maxResults: 100
```

**Krok 1: Pobranie danych z API**
```typescript
sourceProducts = await this.fetchFromSource(source, searchTerm, maxResults)

// Każdy produkt ma:
RawProduct {
  title: string
  imageUrl: string
  price: number
  currency: string
  shippingCost: number
  shippingDays: number
  sourceProductId: string
  sourceUrl: string
  merchantName?: string
  merchantRating?: number
  rating?: number
  ratingCount?: number
  specs?: Record<string, string>
  ean?: string      // Dla deduplikacji
  gtin?: string     // Dla deduplikacji
  upc?: string      // Dla deduplikacji
  mpn?: string      // Dla deduplikacji
}
```

**Krok 2: Deduplikacja (3 strategie)**

```typescript
// PRIORITY 1: Identyfikatory standardowe (uniwersalne)
if (ean || gtin || upc || mpn) {
  existingProduct = await findProductByIdentifiers({
    ean, gtin, upc, mpn
  })
  // Query do collections 'product_cores'
  // where('metadata.ean', '==', normalized)
}

// PRIORITY 2: Identity Hash (tytuł + obraz)
if (!existingProduct) {
  identityHash = calculateIdentityHash(title, imageUrl)
  // SHA-256(normalized_title + image_hash)
  // Query do 'identity_matches' collection
  existingProduct = await findProductByIdentity(identityHash)
}

// PRIORITY 3: Fuzzy matching (Levenshtein)
// - Nie używane domyślnie (zbyt wolne)
// - Fallback dla ostrych przypadków
```

**Krok 3: Utwórz ProductCore LUB Deal**

Jeśli produkt istnieje:
```typescript
// Istniejący produkt → Utwórz nowy Deal
const dealId = await createDeal(existingProduct.id, sourceProduct, source)
await updateProductBestPrice(existingProduct.id)
```

Jeśli nowy produkt:
```typescript
// Nowy produkt → Utwórz ProductCore + Deal
const productId = await createProductCore(
  sourceProduct,      // Raw data
  identityHash,       // SHA-256 identity
  source,             // 'aliexpress'
  {                   // Category info
    mainCategorySlug: 'electronics',
    subCategorySlug: 'phones',
    subSubCategorySlug: 'flagship'
  }
)

const dealId = await createDeal(productId, sourceProduct, source)
await updateProductBestPrice(productId)
await recordIdentityMatch(identityHash, productId, source, sourceProductId)
```

**Krok 4: Zapisz do Firestore**

ProductCore (kolekcja `product_cores`):
```typescript
ProductCore {
  id: 'prod_abc123',                    // Firestore doc ID
  identityHash: 'sha256_...',           // SHA-256
  title: { pl: '...', en: '...', de: '...' },
  shortDescription: { pl: '...', en: '...', de: '...' },
  specs: {
    'RAM': '16GB',
    'Storage': '512GB',
    'Screen': '15.6"'
  },
  images: ['url1', 'url2', ...],
  mainCategorySlug: 'electronics',
  subCategorySlug: 'phones',
  subSubCategorySlug: 'flagship',
  
  // Ratings
  rating: {
    score: 4.5,
    count: 1250,
    provider: 'aliexpress'
  },
  
  // Best price (calculated)
  bestPrice: {
    amount: 2499,
    currency: 'PLN'
  },
  bestDealId: 'deal_xyz789',
  bestTotalPrice: 2699,  // incl. shipping
  
  linkedDealIds: ['deal_xyz789', ...],
  searchTags: ['phone', 'flagship', 'samsung', ...],
  
  status: 'draft',                      // ← KEY!
  createdAt: '2026-01-28T10:00:00Z',
  updatedAt: '2026-01-28T10:00:00Z',
  
  // Metadata
  metadata: {
    source: 'aliexpress',
    originalId: 'aliexpress_prod_12345',
    importedAt: '2026-01-28T10:00:00Z'
  }
}
```

Deal (kolekcja `deals`):
```typescript
DealM6 {
  id: 'deal_xyz789',                    // Firestore doc ID
  productId: 'prod_abc123',             // ← FK to ProductCore!
  
  // Pricing
  price: {
    amount: 1999,
    currency: 'USD'
  },
  originalPrice: 2499,
  discount: {
    percentage: 20
  },
  discountPercent: 20,
  
  // Shipping
  shipping: {
    cost: 50,
    timeDays: 21,
    method: 'Standard',
    fromCountry: 'CN'
  },
  
  // Source
  source: 'aliexpress',
  sourceProductId: 'aliexpress_prod_12345',
  sourceUrl: 'https://aliexpress.com/...',
  affiliateLink: 'https://...?ref=okazje',
  merchantName: 'Store XYZ',
  merchantRating: 4.7,
  
  // Deal info
  title: { pl: 'Oferta na ...', en: 'Offer for ...', de: '...' },
  dealType: 'sale',
  couponCode: null,
  
  // Stock
  stockStatus: 'in_stock',
  isActive: true,
  
  // Price history (Omnibus compliance)
  priceHistory: [
    { date: '2026-01-28', price: 1999, currency: 'USD' },
    { date: '2026-01-27', price: 2099, currency: 'USD' },
    ...
  ],
  
  // Engagement
  voteCount: 0,
  temperature: 0,
  commentsCount: 0,
  
  status: 'draft',                      // ← KEY!
  createdAt: '2026-01-28T10:00:00Z',
  updatedAt: '2026-01-28T10:00:00Z',
  createdBy: 'system'                   // System harvest, not user
}
```

IdentityMatch (kolekcja `identity_matches`):
```typescript
IdentityMatch {
  id: 'sha256_...',                     // Doc ID = identity hash
  productId: 'prod_abc123',             // ← FK
  source: 'aliexpress',
  sourceProductId: 'aliexpress_prod_12345',
  createdAt: '2026-01-28T10:00:00Z',
  
  // Later lookups - only 1 query instead of scanning 100k products!
}
```

---

### Phase 2: REFINER (Wzbogacanie AI)

**Plik:** `src/lib/automation/refiner.ts` (862 linie)

**Co robi:**
1. Pobiera produkty ze statusem `draft`
2. Normalizuje specs (extract RAM/Storage z tytułu)
3. Generuje multilingual descriptions (Gemini AI)
4. Oblicza quality score
5. Zmienia status na `pending_approval`

**Wejście:**
```typescript
status: 'draft'        // Tylko nowe produkty
limit: 100             // Ile na raz
refinationType: 'full_enrichment' | 'specs_cleanup'
dryRun: false
```

**Krok 1: Pobierz ProductCore ze statusem draft**
```typescript
const snapshot = await adminDb
  .collection('product_cores')
  .where('status', '==', 'draft')
  .limit(limit)
  .get()

// Każdy doc to ProductCore z draft statusem
```

**Krok 2: Normalizacja specs**
```typescript
// Jeśli tytuł = "Samsung Galaxy S24 5G 256GB 12GB RAM"
// Ekstrahuj specs:
specs = {
  'Model': 'Samsung Galaxy S24 5G',
  'Storage': '256GB',
  'RAM': '12GB',
  'Network': '5G'
}

// Plus ze starego specs:
specs = {
  ...existingSpecs,
  'Screen': '6.1"',
  'Battery': '4000mAh',
  'Processor': 'Snapdragon 8 Gen 3'
}
```

**Krok 3: AI-generated descriptions (Genkit flow)**
```typescript
// Call AI flow: generateProductDescription
const enrichedContent = await generateProductDescription({
  title: productCore.title,
  specs: productCore.specs,
  rating: productCore.rating,
  // Output: { pl: '...', en: '...', de: '...' }
})

// Wynik:
productCore.fullDescription = {
  pl: 'Nowoczesny smartphone Samsung Galaxy S24 5G to idealne urządzenie dla wymagających użytkowników...',
  en: 'The Samsung Galaxy S24 5G is a cutting-edge smartphone featuring...',
  de: 'Das Samsung Galaxy S24 5G ist ein modernes Smartphone...'
}
```

**Krok 4: Quality score**
```typescript
qualityScore = calculateQualityScore({
  hasAllSpecs: true,              // +20 points
  descriptionLength: 500,         // +15 points
  rating: 4.5,                    // +25 points
  ratingCount: 1250,              // +15 points
  hasImages: true,                // +15 points
  merchantRating: 4.7,            // +10 points
})

// Result: 0-100 (80 = very good)
productCore.aiQualityScore = 80
```

**Krok 5: Zaktualizuj ProductCore**
```typescript
await adminDb.collection('product_cores').doc(productId).update({
  specs: normalizedSpecs,
  fullDescription: enrichedContent,
  reviewsSummary: summarizeReviews(...),
  features: extractFeatures(...),
  pros: extractPros(...),
  cons: extractCons(...),
  searchTags: ['phone', 'flagship', 'samsung', ...],
  aiQualityScore: 80,
  status: 'pending_approval',      // ← KEY! Ready for review
  updatedAt: new Date().toISOString()
})
```

---

### Phase 3: MODERATION (Admin Review & Approval)

**Gdzie:** Admin panel → Products tab → Search "pending_approval"

**Moderator przegląda:**
```typescript
ProductCore {
  // AI-generated fields to review
  specs: { ... },
  fullDescription: { ... },
  features: { ... },
  pros: { ... },
  cons: { ... },
  aiQualityScore: 80
}

// Możliwe akcje:
// 1. Zaaprobuj → status = 'approved' (visible!)
// 2. Odrzuć → status = 'rejected' + rejectionReason
// 3. Edit & save → update fields, status stays pending
```

**SQL-like:**
```typescript
// Approve
UPDATE product_cores 
SET status = 'approved', approvedAt = NOW(), approvedBy = 'moderator_uid'
WHERE id = 'prod_abc123'

// Reject
UPDATE product_cores 
SET status = 'rejected', rejectionReason = 'Low quality specs'
WHERE id = 'prod_abc123'
```

---

### Phase 4: READ (Frontend - Dane widoczne dla użytkowników)

**Plik:** `src/lib/data.ts` (2930 linii)

**Tylko approved produkty są widoczne:**

```typescript
// Query #1: Get hot deals (trending)
export async function getHotDeals(count: number) {
  const snapshot = await getDocs(
    query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),        // ← Filter!
      where('productId', '!=', null),           // ← Only linked to ProductCore
      orderBy('temperature', 'desc'),           // ← Heat algorithm
      limit(count)
    )
  )
  
  return snapshot.docs.map(docToDeal)
}

// Result:
[
  {
    id: 'deal_xyz789',
    productId: 'prod_abc123',                   // ← Link!
    price: { amount: 1999, currency: 'USD' },
    temperature: 8.5,                           // ← Hot!
    status: 'approved'                          // ← Only this
  },
  ...
]
```

**Query #2: Get product with all deals**
```typescript
export async function getProductCoreById(productId: string) {
  const productDoc = await getDoc(
    doc(db, 'product_cores', productId)
  )
  
  // Only if approved!
  if (productDoc.data()?.status !== 'approved') {
    return null
  }
  
  return productDoc.data() as ProductCore
}

// Then get all deals for this product:
export async function getLinkedDeals(productId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, 'deals'),
      where('productId', '==', productId),
      where('status', '==', 'approved')         // ← Filter!
    )
  )
  
  return snapshot.docs.map(docToDeal)
}

// Usage in component:
const product = await getProductCoreById('prod_abc123')
const deals = await getLinkedDeals('prod_abc123')

// Display:
// Product title, specs, image, description (all from ProductCore)
// Deals: Price, shipping, seller, affiliate link (each from DealM6)
```

**Query #3: Category listing**
```typescript
export async function getDealsForCategory(
  mainCategorySlug: string,
  limit: number = 20
) {
  const snapshot = await getDocs(
    query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      // Hmm - current data model doesn't have mainCategorySlug on deals!
      // Must join with product_cores
      limit(limit)
    )
  )
  
  // Workaround: Load products in parallel
  const deals = snapshot.docs.map(docToDeal)
  const products = await Promise.all(
    deals.map(d => getDoc(doc(db, 'product_cores', d.productId)))
  )
  
  // Filter in-memory (current bottleneck!)
  return deals.filter((deal, i) => {
    const product = products[i].data() as ProductCore
    return product.mainCategorySlug === mainCategorySlug
  })
}
```

---

## 🔴 M6 Current Issues & Bottlenecks

### Issue #1: Harvester - Sekwencyjne zapisy ❌
**Status:** CRITICAL  
**Current:** 100 produktów = 8-12 minut  
**Root cause:** Każdy Deal zapisywany osobno, brak `writeBatch()`

```typescript
// CURRENT (SLOW):
for (const product of products) {
  const dealId = await createDeal(...)  // 1 write
  await updateProductBestPrice(...)     // 1 write
  // ~50-100ms per product × 100 = 5-10 seconds JUST for writes
}

// EXPECTED FIX: Use writeBatch()
const batch = writeBatch(adminDb)
for (const product of products) {
  batch.set(dealsRef.doc(), dealData)
  batch.update(productsRef.doc(productId), {bestPrice: ...})
}
await batch.commit()  // All 200 ops in ONE network call
// Expected: 30-60 seconds for 100 products
```

### Issue #2: AI Enrichment - Serial (nie parallel) ❌
**Status:** CRITICAL  
**Current:** 100 produktów = 5 minut (Gemini ~ 3s/product × 100 / 10 parallel)  
**Root cause:** Batch size tylko 10, mogą być więcej

```typescript
// CURRENT (SLOW):
for (const product of products) {
  const enriched = await performRefinement(product)  // Czeka na AI
  // ~3-5 seconds per product
}

// EXPECTED FIX: Larger batch
const batch = []
for (const product of products.slice(0, 100)) {
  batch.push(performRefinement(product))  // Don't await!
}
await Promise.all(batch)  // All in parallel
// Expected: ~10 seconds for 100 products
```

### Issue #3: Category queries in readphase ❌
**Status:** MEDIUM  
**Current:** getDealsForCategory loads ALL deals, filters in memory  
**Root cause:** Deals don't have `mainCategorySlug` field

```typescript
// CURRENT (SLOW):
const deals = await getDocs(
  query(collection(db, 'deals'), where('status', '==', 'approved'))
)  // Loads 1000s of deals!

// Then filter in JS:
const filtered = deals.filter(d => {
  const product = ...  // Separate lookup per deal!
  return product.mainCategorySlug === category
})

// EXPECTED FIX: Denormalize!
// Option A: Add mainCategorySlug to deals
UPDATE deals SET mainCategorySlug = (SELECT mainCategorySlug FROM product_cores WHERE id = productId)

// Then query:
const deals = await getDocs(
  query(
    collection(db, 'deals'),
    where('status', '==', 'approved'),
    where('mainCategorySlug', '==', category)
  )
)  // Single fast query!

// Option B: Use Firestore collection group queries
// (More complex but works)
```

### Issue #4: Identity Matching - 5 sekwencyjnych zapytań ❌
**Status:** MEDIUM-HIGH  
**Current:** 5 zapytania per produkt (EAN, GTIN, UPC, MPN, identity hash)  
**Root cause:** Brak `Promise.all()` w identity-matcher.ts

```typescript
// CURRENT (SLOW):
const eanMatch = await query('ean', '==', value)     // Wait 10ms
const gtinMatch = await query('gtin', '==', value)   // Wait 10ms
const upcMatch = await query('upc', '==', value)     // Wait 10ms
const mpnMatch = await query('mpn', '==', value)     // Wait 10ms
const identityMatch = await query('identity', '==', value)  // Wait 10ms
// Total: 50ms per product × 100 = 5 seconds

// EXPECTED FIX: Parallel queries
const results = await Promise.all([
  query('ean', '==', value),
  query('gtin', '==', value),
  query('upc', '==', value),
  query('mpn', '==', value),
  query('identity', '==', value),
])
// Total: 10ms (max latency of slowest query)
```

---

## 📈 Expected Improvements

After fixing all 4 issues:

| Phase | Before | After | Speedup |
|-------|--------|-------|---------|
| Harvester writes | 5-10s | 1-2s | **5-10x** |
| AI enrichment | 5 min | 30-40s | **10x** |
| Identity matching | 0.5s | 0.1s | **5x** |
| Category queries | 5s (100 docs) | 0.5s | **10x** |
| **TOTAL 100 items** | **8-12 min** | **1-2 min** | **10-15x** 🚀 |

---

## 🔧 Kolecje Firestore (M6)

```
Root Collections:
├── product_cores/          ← Immutable products
│   ├── prod_abc123
│   │   ├── identityHash: "sha256_..."
│   │   ├── title: { pl: '...', en: '...', de: '...' }
│   │   ├── specs: { RAM: '16GB', Storage: '512GB' }
│   │   ├── status: 'draft|pending_approval|approved|rejected'
│   │   ├── linkedDealIds: ['deal_xyz789', ...]
│   │   └── bestDealId: 'deal_xyz789'
│   └── prod_def456
│
├── deals/                  ← Mutable offers (one product = many deals)
│   ├── deal_xyz789
│   │   ├── productId: 'prod_abc123'  ← FK!
│   │   ├── price: { amount: 1999, currency: 'USD' }
│   │   ├── source: 'aliexpress'
│   │   ├── status: 'draft|approved|rejected'
│   │   ├── temperature: 8.5
│   │   └── voteCount: 123
│   └── deal_hij012
│
├── identity_matches/       ← For fast deduplication
│   ├── sha256_...
│   │   ├── productId: 'prod_abc123'
│   │   ├── source: 'aliexpress'
│   │   └── sourceProductId: 'aliexpress_12345'
│   └── sha256_...
│
├── harvester_jobs/         ← Track import progress
│   ├── job_123
│   │   ├── status: 'running|completed|failed|paused'
│   │   ├── source: 'aliexpress'
│   │   ├── productsFound: 150
│   │   ├── productsCreated: 120
│   │   ├── dealsCreated: 120
│   │   ├── logs: [{ level: 'info', message: '...', timestamp: '...' }, ...]
│   │   └── currentCategory: 'electronics/phones/flagship'
│   └── job_456
│
├── refiner_jobs/           ← Track enrichment progress
│   ├── job_789
│   │   ├── status: 'running|completed|failed'
│   │   ├── productIds: ['prod_abc123', 'prod_def456', ...]
│   │   ├── productsSuccessful: 98
│   │   ├── productsFailed: 2
│   │   ├── logs: [...]
│   │   └── refinationType: 'full_enrichment'
│   └── job_012
│
├── categories/             ← 3-level hierarchy
│   ├── electronics
│   │   ├── slug: 'electronics'
│   │   ├── name: 'Elektronika'
│   │   ├── subcategories/
│   │   │   ├── phones
│   │   │   │   ├── slug: 'phones'
│   │   │   │   ├── subcategories/
│   │   │   │   │   ├── flagship
│   │   │   │   │   │   ├── slug: 'flagship'
│   │   │   │   │   │   └── aliexpressCategoryIds: ['100008684', ...]
│   │   │   │   │   └── budget
│   │   │   └── laptops
│   │   │       └── ...
│   │   └── ...
│   └── other_categories...
│
└── ... (other collections for users, comments, votes, etc.)
```

---

## 🎯 Summary

**M6 je:** Dual-entity system:
- **ProductCore** = Immutable product template (unique per product)
- **DealM6** = Mutable price offer (many deals per product)

**Import flow:**
1. **Harvester** → Fetch API → Dedupe → Create ProductCore + Deal → Save (DRAFT)
2. **Refiner** → Enrich specs + descriptions + AI score → (PENDING_APPROVAL)
3. **Moderator** → Review → Approve/Reject → (APPROVED or REJECTED)
4. **Frontend** → Read only APPROVED → Display with cache

**Bottlenecks:**
1. ❌ Sequential writes (use `writeBatch()`)
2. ❌ Serial AI enrichment (use `Promise.all()`)
3. ❌ Sequential dedupe queries (use `Promise.all()`)
4. ❌ Slow category queries (denormalize fields)

**Expected improvement:** 10-15x faster import (8-12 min → 1-2 min)

---

Teraz możemy zacząć poprawiać! 🚀 Którą część chcesz naprawić najpierw?

