# 🔧 PLAN NAPRAWY - IMPLEMENTACJA AUDYTU 2026

**Status:** 📋 Gotowy do implementacji  
**Ostatnia aktualizacja:** 26 stycznia 2026  
**Powiązany dokument:** [AUDYT_APLIKACJI_2026.md](./AUDYT_APLIKACJI_2026.md)

---

## 🎯 QUICK WINS - Zaimplementuj Najpierw (1-2 dni)

### ✅ Quick Win #1: Zwiększenie Cache LRU
**Czas:** 2 minuty  
**Efekt:** 2-3× mniej cache misses

```typescript
// Plik: src/lib/cache.ts:64
// PRZED:
const lru = new LRUCache<string, any>({ max: 50, ttl: 1000 * 30 });

// PO:
const lru = new LRUCache<string, any>({ 
  max: 500,              // 10× więcej elementów
  ttl: 1000 * 3600,      // 1 godzina zamiast 30 sekund
  updateAgeOnGet: true,  // Odśwież TTL przy odczycie
});
```

---

### ✅ Quick Win #2: Batch Writes w Harvesterze
**Czas:** 30 minut  
**Efekt:** 20× przyspieszenie zapisów

```typescript
// Plik: src/lib/automation/harvester.ts

// DODAJ na początku pliku:
import { writeBatch } from 'firebase-admin/firestore';

// REFAKTOR funkcji processCategory() - linie ~288-428
async processProducts(products: SourceProduct[]) {
  const productUpdates: Array<{productId: string, data: any}> = [];
  
  // Zbierz wszystkie aktualizacje
  for (const product of products) {
    const productId = await this.createOrUpdateProduct(product);
    productUpdates.push({
      productId,
      data: {
        bestPrice: product.price,
        lastUpdated: new Date().toISOString(),
      }
    });
  }
  
  // Batch write co 500 operacji (limit Firestore)
  for (let i = 0; i < productUpdates.length; i += 500) {
    const batch = writeBatch(adminDb);
    const chunk = productUpdates.slice(i, i + 500);
    
    for (const update of chunk) {
      const docRef = adminDb.collection('product_cores').doc(update.productId);
      batch.update(docRef, update.data);
    }
    
    await batch.commit();
  }
}
```

---

### ✅ Quick Win #3: Równoległe Zapytania Deduplikacji
**Czas:** 20 minut  
**Efekt:** 3-4× przyspieszenie

```typescript
// Plik: src/lib/automation/identity-matcher.ts

// REFAKTOR findProductByIdentifiers() - linie 75-111
async findProductByIdentifiers(identifiers: ProductIdentifiers): Promise<ProductCore | null> {
  const queries: Promise<QuerySnapshot>[] = [];
  
  // Równoległe zapytania zamiast sekwencyjnych
  if (identifiers.ean) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.ean', '==', normalizeProductIdentifier(identifiers.ean))
        .limit(1)
        .get()
    );
  }
  
  if (identifiers.gtin) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.gtin', '==', normalizeProductIdentifier(identifiers.gtin))
        .limit(1)
        .get()
    );
  }
  
  if (identifiers.upc) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.upc', '==', normalizeProductIdentifier(identifiers.upc))
        .limit(1)
        .get()
    );
  }
  
  if (identifiers.mpn) {
    queries.push(
      adminDb.collection('product_cores')
        .where('metadata.mpn', '==', normalizeProductIdentifier(identifiers.mpn))
        .limit(1)
        .get()
    );
  }
  
  // Wykonaj wszystkie równolegle
  const results = await Promise.all(queries);
  
  for (const snapshot of results) {
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { ...doc.data() as ProductCore, id: doc.id };
    }
  }
  
  return null;
}
```

---

### ✅ Quick Win #4: Product Schema JSON-LD
**Czas:** 15 minut  
**Efekt:** Lepszy ranking w Google Shopping

```typescript
// Plik: src/app/[locale]/products/[id]/page.tsx

// DODAJ w generateMetadata() lub jako osobny komponent
function generateProductSchema(product: ProductCore, deals: Deal[]) {
  const lowestPrice = Math.min(...deals.map(d => d.totalPrice || d.price));
  const highestPrice = Math.max(...deals.map(d => d.totalPrice || d.price));
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.imageUrl,
    description: product.description?.pl || product.title,
    brand: {
      '@type': 'Brand',
      name: product.specs?.brand || 'Unknown',
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: lowestPrice.toFixed(2),
      highPrice: highestPrice.toFixed(2),
      priceCurrency: 'PLN',
      offerCount: deals.length,
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: product.ratings ? {
      '@type': 'AggregateRating',
      ratingValue: product.ratings.average.toFixed(1),
      reviewCount: product.ratings.count,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
  };
}

// W komponencie strony:
export default async function ProductPage({ params }) {
  const product = await getProductCoreById(params.id);
  const deals = await getLinkedDeals(params.id);
  
  const productSchema = generateProductSchema(product, deals);
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {/* Reszta komponentu */}
    </>
  );
}
```

---

### ✅ Quick Win #5: Aria-Live dla Toast
**Czas:** 10 minut  
**Efekt:** Screen reader support

```typescript
// Plik: src/components/ui/toast.tsx

// DODAJ aria-live region
export function Toaster() {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-0 right-0 z-50 p-4"
    >
      {/* Existing toast content */}
    </div>
  );
}
```

---

## 🔴 FAZA 1: KRYTYCZNE (Tydzień 1-2)

### Priorytet 1.1: Batch AI Enrichment
**Czas:** 2 godziny  
**Plik:** `src/lib/automation/refiner.ts`

**Problem:** Wzbogacanie AI sekwencyjne (100 produktów = 5 minut)

**Rozwiązanie:**
```typescript
// REFAKTOR enrichProducts() - linie 144-206

async enrichProducts(productIds: string[], refinementType: RefinementType) {
  const products = await Promise.all(
    productIds.map(id => this.getProduct(id))
  );
  
  // Batch po 10 produktów
  const batchSize = 10;
  const allResults: ProductCore[] = [];
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    // Równoległe wzbogacanie AI
    const enriched = await Promise.all(
      batch.map(product => this.performRefinement(product, refinementType))
    );
    
    allResults.push(...enriched);
    
    // Batch write
    const writeBatch = writeBatch(adminDb);
    enriched.forEach((result, idx) => {
      const docRef = adminDb.collection('product_cores').doc(batch[idx].id);
      writeBatch.update(docRef, result);
    });
    
    await writeBatch.commit();
    
    // Progress update
    await this.updateRefinementProgress(i + batch.length, products.length);
  }
  
  return allResults;
}
```

---

### Priorytet 1.2: Job Update Throttling
**Czas:** 30 minut  
**Plik:** `src/lib/automation/harvester.ts`

**Problem:** Job aktualizowany co 5 produktów (100+ zapisów)

**Rozwiązanie:**
```typescript
// DODAJ na początku klasy Harvester:
private lastJobUpdate: number = Date.now();
private readonly JOB_UPDATE_INTERVAL = 5000; // 5 sekund

// REFAKTOR updateJobRecord():
private async updateJobRecordThrottled(updates: Partial<HarvesterJob>) {
  const now = Date.now();
  
  // Aktualizuj tylko co 5 sekund
  if (now - this.lastJobUpdate < this.JOB_UPDATE_INTERVAL) {
    return;
  }
  
  await this.updateJobRecord(updates);
  this.lastJobUpdate = now;
}

// UŻYJ w pętli processingowej:
for (const product of products) {
  // ... przetwarzanie ...
  
  // Zamiast updateJobRecord() co 5 produktów:
  await this.updateJobRecordThrottled({
    processedCount: this.processedCount,
    status: 'processing',
  });
}
```

---

### Priorytet 1.3: Retry Logic z Exponential Backoff
**Czas:** 1 godzina  
**Plik:** `src/lib/automation/utils.ts` (nowy)

**Stwórz helper:**
```typescript
// Nowy plik: src/lib/automation/utils.ts

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Nie retry jeśli nie powinniśmy
      if (!shouldRetry(error)) {
        throw error;
      }
      
      // Ostatnia próba - rzuć błąd
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      console.log(`[withRetry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Użycie w refiner.ts:
import { withRetry } from './utils';

async performRefinement(product: ProductCore) {
  const refinedContent = await withRetry(
    () => generateMarketingContent({...}),
    {
      maxRetries: 3,
      shouldRetry: (error) => {
        // Retry tylko na transient errors
        return error.code === 'RESOURCE_EXHAUSTED' || 
               error.code === 'UNAVAILABLE';
      }
    }
  );
  
  return refinedContent;
}
```

---

### Priorytet 1.4: Rate Limiting dla API
**Czas:** 1 godzina  
**Plik:** `src/lib/automation/utils.ts`

**Dodaj do utils:**
```typescript
// Dodaj do src/lib/automation/utils.ts

export async function batchWithRateLimit<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayMs?: number;
  } = {}
): Promise<R[]> {
  const {
    batchSize = 10,
    delayMs = 500,
  } = options;
  
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    console.log(`[batchWithRateLimit] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
    
    // Równoległe przetwarzanie w ramach batcha
    const batchResults = await Promise.all(
      batch.map(item => processFn(item))
    );
    
    results.push(...batchResults);
    
    // Pauza między batchami (oprócz ostatniego)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

// Użycie w harvester.ts:
import { batchWithRateLimit } from './utils';

async fetchProductDetails(products: Product[]) {
  const details = await batchWithRateLimit(
    products,
    async (product) => {
      return await aliexpressClient.getProductDetails(product.id);
    },
    {
      batchSize: 10,   // 10 requestów na raz
      delayMs: 500,    // 500ms pauzy między batchami
    }
  );
  
  return details;
}
```

---

### Priorytet 1.5: N+1 Categories Fix
**Czas:** 4 godziny  
**Plik:** `src/lib/data.ts`

**Problem:** 1,050+ zapytań w `getCategoriesWithContent()`

**Rozwiązanie - Opcja A: Batch Query**
```typescript
// REFAKTOR getCategoriesWithContent() - linie 1111-1189

async function getCategoriesWithContent() {
  // 1. Pobierz wszystkie kategorie (już zoptymalizowane)
  const categories = await getCategories();
  
  // 2. Zbierz wszystkie ID kategorii (flat)
  const allCategoryIds = flattenCategoryIds(categories);
  
  // 3. Jeden batch query dla wszystkich liczników
  const contentCounts = await batchGetContentCounts(allCategoryIds);
  
  // 4. Mapuj liczniki z powrotem do kategorii
  return mapCountsToCategories(categories, contentCounts);
}

// Helper: spłaszcz drzewo kategorii do listy ID
function flattenCategoryIds(categories: Category[]): string[] {
  const ids: string[] = [];
  
  for (const cat of categories) {
    ids.push(cat.id);
    
    for (const sub of cat.subcategories || []) {
      ids.push(sub.id);
      
      for (const subSub of sub.subSubcategories || []) {
        ids.push(subSub.id);
      }
    }
  }
  
  return ids;
}

// Helper: batch query dla liczników
async function batchGetContentCounts(categoryIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  
  // Firestore limit: 30 elementów w 'in' query
  const chunks = chunkArray(categoryIds, 30);
  
  for (const chunk of chunks) {
    // Jeden query dla deals
    const dealsSnapshot = await getDocs(
      query(
        collection(db, 'deals'),
        where('status', '==', 'approved'),
        where('mainCategorySlug', 'in', chunk)
      )
    );
    
    // Policz dla każdej kategorii
    for (const doc of dealsSnapshot.docs) {
      const data = doc.data();
      const categoryId = data.mainCategorySlug;
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    }
  }
  
  return counts;
}

// Helper: złącz liczniki z kategoriami
function mapCountsToCategories(
  categories: Category[],
  counts: Map<string, number>
): CategoryWithContent[] {
  return categories.map(cat => ({
    ...cat,
    contentCount: counts.get(cat.id) || 0,
    hasContent: (counts.get(cat.id) || 0) > 0,
    subcategories: cat.subcategories?.map(sub => ({
      ...sub,
      contentCount: counts.get(sub.id) || 0,
      hasContent: (counts.get(sub.id) || 0) > 0,
      subSubcategories: sub.subSubcategories?.map(subSub => ({
        ...subSub,
        contentCount: counts.get(subSub.id) || 0,
        hasContent: (counts.get(subSub.id) || 0) > 0,
      })),
    })),
  }));
}
```

**Rozwiązanie - Opcja B: Denormalizacja (bardziej radykalne)**
```typescript
// Opcja B: Pre-compute content counts w Cloud Function

// Cloud Function (okazje-plus/src/index.ts):
export const updateCategoryContentCounts = functions
  .firestore
  .document('deals/{dealId}')
  .onWrite(async (change, context) => {
    const deal = change.after.exists ? change.after.data() : null;
    
    if (!deal) return;
    
    // Aktualizuj licznik w dokumencie kategorii
    const categoryRef = adminDb
      .collection('categories')
      .doc(deal.mainCategorySlug);
    
    await categoryRef.update({
      contentCount: FieldValue.increment(change.after.exists ? 1 : -1),
      lastUpdated: FieldValue.serverTimestamp(),
    });
  });

// W getCategories() użyj już policzonego contentu:
async function getCategoriesWithContent() {
  const categories = await getCategories(); // Ma już contentCount z Firestore
  return categories; // Bez dodatkowych zapytań!
}
```

**Rekomendacja:** Zacznij od Opcji A (prostsze), później rozważ Opcję B (bardziej wydajne długoterminowo)

---

### Priorytet 1.6: Denormalizacja Drzewa Kategorii
**Czas:** 2 godziny  
**Plik:** `src/lib/data.ts`

**Problem:** 211 zapytań w `getCategories()` (3-poziomowa kaskada)

**Rozwiązanie:**
```typescript
// 1. DODAJ nową kolekcję: category_tree (jednorazowa migracja)

// Script: src/scripts/denormalize-categories.ts
import { adminDb } from '@/lib/firebase-admin';

async function denormalizeCategoryTree() {
  console.log('Starting category tree denormalization...');
  
  // Pobierz wszystkie kategorie obecną metodą
  const categories = await getCurrentCategories();
  
  // Zapisz jako jeden dokument
  await adminDb.collection('category_tree').doc('full_tree').set({
    version: 1,
    lastUpdated: new Date().toISOString(),
    categories: categories,
  });
  
  console.log('Category tree denormalized successfully!');
}

// 2. REFAKTOR getCategories() - linie 985-1051
async function getCategories(): Promise<Category[]> {
  const cacheKey = 'categories:full_tree';
  
  // Check cache (1h TTL)
  const cached = await cacheGet(cacheKey);
  if (cached) {
    console.log('[getCategories] Cache hit');
    return cached;
  }
  
  // Jeden query zamiast 211
  const treeDoc = await getDoc(
    doc(db, 'category_tree', 'full_tree')
  );
  
  if (!treeDoc.exists()) {
    console.error('[getCategories] Category tree not found! Run denormalize script.');
    return [];
  }
  
  const tree = treeDoc.data();
  const categories = tree.categories;
  
  // Cache na 1h
  await cacheSet(cacheKey, categories, 3600);
  
  return categories;
}

// 3. DODAJ Cloud Function do auto-update przy zmianach
// okazje-plus/src/index.ts:
export const updateCategoryTree = functions
  .firestore
  .document('categories/{categoryId}')
  .onWrite(async (change, context) => {
    // Przebuduj drzewo przy każdej zmianie kategorii
    const categories = await rebuildCategoryTree();
    
    await adminDb.collection('category_tree').doc('full_tree').update({
      categories: categories,
      lastUpdated: FieldValue.serverTimestamp(),
      version: FieldValue.increment(1),
    });
    
    console.log('[updateCategoryTree] Tree rebuilt successfully');
  });
```

**Instrukcje wdrożenia:**
1. Uruchom `tsx src/scripts/denormalize-categories.ts`
2. Wdroż Cloud Function `updateCategoryTree`
3. Zastąp `getCategories()` nową implementacją
4. Monitoruj przez tydzień, usuń starą implementację

---

## 🟡 FAZA 2: WYSOKIE (Tydzień 3-4)

### Priorytet 2.1: Refaktoryzacja data.ts
**Czas:** 2 dni  
**Plik:** `src/lib/data.ts` (2930 linii)

**Plan podziału:**

```
src/lib/data/
├── index.ts           (re-exports)
├── queries.ts         (podstawowe CRUD - 400 linii)
├── filtering.ts       (filtry i sortowanie - 300 linii)
├── favorites.ts       (system ulubionych - 250 linii)
├── notifications.ts   (powiadomienia - 300 linii)
├── forum.ts           (forum - 400 linii)
├── categories.ts      (kategorie - 500 linii)
├── deals.ts           (deals-specific - 400 linii)
├── products.ts        (products-specific - 380 linii)
└── utils.ts           (helpers - 200 linii)
```

**Krok 1: Stwórz struktur folderów**
```bash
mkdir -p src/lib/data
```

**Krok 2: Przenieś funkcje deals**
```typescript
// src/lib/data/deals.ts

import { db } from '@/lib/firebase';
import { Deal } from '@/lib/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

// Przenieś z data.ts:
export async function getHotDeals(count: number): Promise<Deal[]> {
  // ... kod z data.ts linie 51-83
}

export async function getDealById(id: string): Promise<Deal | null> {
  // ... kod z data.ts linie 85-105
}

// ... pozostałe funkcje deals
```

**Krok 3: Przenieś funkcje categories**
```typescript
// src/lib/data/categories.ts

export async function getCategories(): Promise<Category[]> {
  // ... kod z data.ts linie 985-1051 (nowa wersja z denormalizacją)
}

export async function getCategoryById(id: string): Promise<Category | null> {
  // ... kod z data.ts
}

export async function getCategoriesWithContent(): Promise<CategoryWithContent[]> {
  // ... kod z data.ts linie 1111-1189 (nowa wersja z batch query)
}
```

**Krok 4: Re-export w index.ts**
```typescript
// src/lib/data/index.ts

export * from './deals';
export * from './categories';
export * from './favorites';
export * from './notifications';
export * from './forum';
export * from './queries';
export * from './filtering';
export * from './utils';
```

**Krok 5: Update importów w całej aplikacji**
```typescript
// PRZED:
import { getHotDeals } from '@/lib/data';

// PO (bez zmian - dzięki re-export):
import { getHotDeals } from '@/lib/data';
```

---

### Priorytet 2.2: DRY - Query Builders
**Czas:** 3 godziny  
**Plik:** `src/lib/data/query-builders.ts` (nowy)

**Problem:** Duplikacja budowania zapytań (3× powielone)

**Rozwiązanie:**
```typescript
// Nowy plik: src/lib/data/query-builders.ts

import { QueryConstraint, where, orderBy, limit } from 'firebase/firestore';

export interface CategoryFilters {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
}

export function buildCategoryConstraints(
  filters: CategoryFilters
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [
    where('status', '==', 'approved')
  ];
  
  // 3-poziomowa hierarchia
  if (filters.subSubCategorySlug) {
    constraints.push(
      where('subSubCategorySlug', '==', filters.subSubCategorySlug)
    );
  } else if (filters.subCategorySlug) {
    constraints.push(
      where('subCategorySlug', '==', filters.subCategorySlug)
    );
  } else if (filters.mainCategorySlug) {
    constraints.push(
      where('mainCategorySlug', '==', filters.mainCategorySlug)
    );
  }
  
  return constraints;
}

export interface PriceFilters {
  minPrice?: number;
  maxPrice?: number;
}

export function buildPriceConstraints(
  filters: PriceFilters
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  
  if (filters.minPrice !== undefined) {
    constraints.push(where('price', '>=', filters.minPrice));
  }
  
  if (filters.maxPrice !== undefined) {
    constraints.push(where('price', '<=', filters.maxPrice));
  }
  
  return constraints;
}

export interface SortOptions {
  sortBy?: 'price' | 'temperature' | 'createdAt' | 'rating';
  sortOrder?: 'asc' | 'desc';
  limitCount?: number;
}

export function buildSortConstraints(
  options: SortOptions
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  
  if (options.sortBy) {
    const direction = options.sortOrder === 'asc' ? 'asc' : 'desc';
    constraints.push(orderBy(options.sortBy, direction));
  }
  
  if (options.limitCount) {
    constraints.push(limit(options.limitCount));
  }
  
  return constraints;
}

// Użycie w deals.ts:
import { buildCategoryConstraints, buildPriceConstraints } from './query-builders';

export async function getDealsByCategory(
  categoryFilters: CategoryFilters,
  priceFilters: PriceFilters = {},
  sortOptions: SortOptions = {}
): Promise<Deal[]> {
  const constraints = [
    ...buildCategoryConstraints(categoryFilters),
    ...buildPriceConstraints(priceFilters),
    ...buildSortConstraints(sortOptions),
  ];
  
  const q = query(
    collection(db, 'deals'),
    ...constraints
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToDeal);
}
```

---

### Priorytet 2.3: Paginacja Kursorowa
**Czas:** 2 godziny  
**Plik:** `src/lib/data/deals.ts`

**Problem:** Brak paginacji w `getHotDeals()`

**Rozwiązanie:**
```typescript
// REFAKTOR getHotDeals() - dodaj paginację

import { QueryDocumentSnapshot, startAfter } from 'firebase/firestore';

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function getHotDeals(
  count: number,
  lastDoc?: QueryDocumentSnapshot
): Promise<PaginatedResult<Deal>> {
  const cacheKey = lastDoc 
    ? `deals:hot:${count}:${lastDoc.id}`
    : `deals:hot:${count}`;
  
  // Cache tylko pierwszą stronę
  if (!lastDoc) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }
  
  let q = query(
    collection(db, 'deals'),
    where('status', '==', 'approved'),
    orderBy('temperature', 'desc'),
    limit(count)
  );
  
  // Dodaj cursor jeśli istnieje
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  
  const snapshot = await getDocs(q);
  const deals = snapshot.docs.map(docToDeal);
  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  
  const result = {
    data: deals,
    lastDoc: newLastDoc,
    hasMore: deals.length === count,
  };
  
  // Cache pierwszą stronę
  if (!lastDoc) {
    await cacheSet(cacheKey, result, 300);
  }
  
  return result;
}

// Użycie w komponencie:
export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  async function loadMore() {
    const result = await getHotDeals(20, lastDoc);
    setDeals(prev => [...prev, ...result.data]);
    setLastDoc(result.lastDoc);
    setHasMore(result.hasMore);
  }
  
  return (
    <>
      {deals.map(deal => <DealCard key={deal.id} deal={deal} />)}
      {hasMore && <button onClick={loadMore}>Załaduj więcej</button>}
    </>
  );
}
```

---

### Priorytet 2.4: Typesense/Firestore Indexes dla Wyszukiwania
**Czas:** 4 godziny  
**Plik:** `src/app/api/search/route.ts`

**Problem:** Wyszukiwanie in-memory (200 docs loaded)

**Rozwiązanie - Opcja A: Typesense (preferred)**
```typescript
// src/lib/search/typesense-search.ts

import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{
    host: process.env.NEXT_PUBLIC_TYPESENSE_HOST!,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY!,
});

export async function searchProducts(params: {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  category?: string;
  limit?: number;
}) {
  const filters: string[] = [];
  
  if (params.minPrice) {
    filters.push(`price:>=${params.minPrice}`);
  }
  
  if (params.maxPrice) {
    filters.push(`price:<=${params.maxPrice}`);
  }
  
  if (params.minRating) {
    filters.push(`rating:>=${params.minRating}`);
  }
  
  if (params.category) {
    filters.push(`mainCategorySlug:=${params.category}`);
  }
  
  const searchParams = {
    q: params.query,
    query_by: 'title,description,searchTags',
    filter_by: filters.join(' && '),
    per_page: params.limit || 20,
    sort_by: '_text_match:desc',
  };
  
  const results = await client
    .collections('products')
    .documents()
    .search(searchParams);
  
  return results.hits?.map(hit => hit.document) || [];
}

// Użycie w src/app/api/search/route.ts:
import { searchProducts } from '@/lib/search/typesense-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const minPrice = parseFloat(searchParams.get('minPrice') || '0');
  const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999');
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  
  const results = await searchProducts({
    query,
    minPrice,
    maxPrice,
    minRating,
    limit: 20,
  });
  
  return Response.json({ results });
}
```

**Rozwiązanie - Opcja B: Firestore Composite Indexes (fallback)**
```json
// firestore.indexes.json - DODAJ:
{
  "indexes": [
    {
      "collectionGroup": "product_cores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "price", "order": "ASCENDING" },
        { "fieldPath": "ratings.average", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "product_cores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "mainCategorySlug", "order": "ASCENDING" },
        { "fieldPath": "price", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 🟢 FAZA 3: ŚREDNIE (Tydzień 5-6)

### Priorytet 3.1: BreadcrumbList Schema
**Czas:** 30 minut  
**Plik:** `src/components/BreadcrumbSchema.tsx` (nowy)

```typescript
// Nowy komponent: src/components/BreadcrumbSchema.tsx

export function BreadcrumbSchema({ items }: { items: Array<{ name: string; url: string }> }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Użycie w src/app/[locale]/products/[id]/page.tsx:
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';

export default function ProductPage({ params }) {
  const breadcrumbs = [
    { name: 'Home', url: 'https://okazje.plus/pl' },
    { name: 'Elektronika', url: 'https://okazje.plus/pl/categories/elektronika' },
    { name: product.title, url: `https://okazje.plus/pl/products/${params.id}` },
  ];
  
  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      {/* Reszta strony */}
    </>
  );
}
```

---

### Priorytet 3.2: SEO Descriptions w Harvesterze
**Czas:** 2 godziny  
**Plik:** `src/lib/automation/refiner.ts`

```typescript
// DODAJ do refiner.ts

async function generateSEOMetadata(product: ProductCore): Promise<{
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}> {
  // Wywołanie AI do generowania SEO
  const seoContent = await generateSEOContent({
    title: product.title,
    description: product.description?.pl || '',
    specs: product.specs,
    category: product.mainCategorySlug,
  });
  
  return {
    metaTitle: truncate(seoContent.title, 60),
    metaDescription: truncate(seoContent.description, 160),
    keywords: seoContent.keywords.slice(0, 10),
  };
}

// Dodaj do enrichment flow:
async performRefinement(product: ProductCore): Promise<ProductCore> {
  // ... istniejące wzbogacanie ...
  
  // Dodaj SEO metadata
  const seoMetadata = await generateSEOMetadata(product);
  
  return {
    ...product,
    seo: {
      metaTitle: seoMetadata.metaTitle,
      metaDescription: seoMetadata.metaDescription,
      keywords: seoMetadata.keywords,
      slug: generateSEOSlug(product.title),
    },
  };
}

function generateSEOSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Usuń polskie znaki
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}
```

---

### Priorytet 3.3: Aria Improvements
**Czas:** 3 godziny  
**Pliki:** Różne komponenty

**Task 1: Focus Trap w modalach**
```typescript
// src/components/ui/dialog.tsx

import { FocusScope } from '@radix-ui/react-focus-scope';

export function Dialog({ children, ...props }: DialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay />
        <FocusScope trapped>
          <DialogPrimitive.Content>
            {children}
          </DialogPrimitive.Content>
        </FocusScope>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

**Task 2: Aria-current w breadcrumbs**
```typescript
// src/components/Breadcrumbs.tsx

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={item.url}>
              {isLast ? (
                <span aria-current="page" className="font-bold">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.url}>{item.name}</Link>
                  <span className="mx-2" aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

**Task 3: Aria-pressed dla vote buttons**
```typescript
// src/components/VoteButtons.tsx

export function VoteButtons({ dealId, hasVoted, voteCount }: VoteButtonsProps) {
  return (
    <button
      aria-label="Głosuj za ofertą"
      aria-pressed={hasVoted ? "true" : "false"}
      onClick={() => handleVote(dealId)}
    >
      👍 {voteCount}
    </button>
  );
}
```

**Task 4: Skip Links**
```typescript
// src/components/SkipLinks.tsx (nowy)

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Przejdź do treści
      </a>
      <a
        href="#main-nav"
        className="fixed top-4 left-4 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Przejdź do nawigacji
      </a>
    </div>
  );
}

// Dodaj do src/app/[locale]/layout.tsx:
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <SkipLinks />
        <nav id="main-nav">{/* ... */}</nav>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
```

---

## 🔵 FAZA 4: CODE QUALITY (Tydzień 7-8)

### Priorytet 4.1: Logger Service
**Czas:** 2 godziny  
**Plik:** `src/lib/logger.ts` (nowy)

```typescript
// Nowy plik: src/lib/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  private log(level: LogLevel, message: string, data?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...data,
    };
    
    // W development: console
    if (process.env.NODE_ENV === 'development') {
      console[level](JSON.stringify(logEntry, null, 2));
    }
    
    // W production: wysyłaj do logging service (Cloud Logging, Sentry, etc.)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with Cloud Logging
      // sendToCloudLogging(logEntry);
    }
  }
  
  debug(message: string, data?: LogContext) {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: LogContext) {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: LogContext) {
    this.log('warn', message, data);
  }
  
  error(message: string, data?: LogContext) {
    this.log('error', message, data);
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Użycie w src/lib/data/categories.ts:
import { createLogger } from '@/lib/logger';

const logger = createLogger('categories');

export async function getCategories() {
  logger.debug('Fetching categories', { cached: false });
  
  try {
    const categories = await fetchCategories();
    logger.info('Categories fetched successfully', { count: categories.length });
    return categories;
  } catch (error) {
    logger.error('Failed to fetch categories', { error: error.message, stack: error.stack });
    throw error;
  }
}
```

**Zamień wszystkie console.log/warn/error:**
```bash
# Find & Replace (VS Code)
# Find:    console\.log\('([^']+)',
# Replace: logger.debug('$1',

# Find:    console\.warn\('([^']+)',
# Replace: logger.warn('$1',

# Find:    console\.error\('([^']+)',
# Replace: logger.error('$1',
```

---

### Priorytet 4.2: Constants
**Czas:** 1 godzina  
**Plik:** `src/lib/constants/index.ts` (nowy)

```typescript
// Nowy plik: src/lib/constants/cache-ttl.ts

export const CACHE_TTL = {
  DEALS_HOT: 5 * 60,              // 5 minutes
  PRODUCTS_RECOMMENDED: 10 * 60,  // 10 minutes
  CATEGORIES: 60 * 60,            // 1 hour
  NAVIGATION_SHOWCASE: 30 * 60,   // 30 minutes
  SECRET_PAGE: 5 * 60,            // 5 minutes
  USER_PROFILE: 15 * 60,          // 15 minutes
} as const;

// Nowy plik: src/lib/constants/limits.ts

export const LIMITS = {
  PRE_REGISTRATIONS_MAX: 5000,
  PIONEER_COUNT: 58,
  DEALS_PER_STATUS: 50,
  BATCH_SIZE_FIRESTORE_IN: 30,
  PAGINATION_DEFAULT: 20,
  PAGINATION_MAX: 100,
  HARVESTER_BATCH_SIZE: 100,
  AI_ENRICHMENT_BATCH_SIZE: 10,
} as const;

// Nowy plik: src/lib/constants/index.ts

export * from './cache-ttl';
export * from './limits';

// Użycie:
import { CACHE_TTL, LIMITS } from '@/lib/constants';

await cacheSet(cacheKey, deals, CACHE_TTL.DEALS_HOT);
const deals = await getHotDeals(LIMITS.PAGINATION_DEFAULT);
```

---

### Priorytet 4.3: Error Handling
**Czas:** 3 godziny  
**Plik:** `src/lib/errors.ts` (nowy)

```typescript
// Nowy plik: src/lib/errors.ts

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, unknown>,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('DATABASE_ERROR', message, context, 500);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`, { resource, id }, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super('VALIDATION_ERROR', message, { fields }, 400);
    this.name = 'ValidationError';
  }
}

// Użycie w src/lib/data/categories.ts:
import { DatabaseError, NotFoundError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const logger = createLogger('categories');

export async function getCategoryById(id: string): Promise<Category> {
  try {
    const doc = await getDoc(doc(db, 'categories', id));
    
    if (!doc.exists()) {
      throw new NotFoundError('Category', id);
    }
    
    return { ...doc.data() as Category, id: doc.id };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error; // Re-throw known errors
    }
    
    logger.error('Failed to get category', { id, error: error.message });
    throw new DatabaseError('Failed to fetch category', { id, cause: error });
  }
}
```

---

### Priorytet 4.4: Type Guards
**Czas:** 2 godziny  
**Plik:** `src/lib/type-guards.ts` (nowy)

```typescript
// Nowy plik: src/lib/type-guards.ts

import { ProductCore, Deal, Category } from './types';

export function isProductCore(value: unknown): value is ProductCore {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'imageUrl' in value &&
    'status' in value
  );
}

export function isDeal(value: unknown): value is Deal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'productCoreId' in value &&
    'price' in value &&
    'source' in value
  );
}

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'slug' in value
  );
}

// Helper do assert
export function assertProductCore(value: unknown): asserts value is ProductCore {
  if (!isProductCore(value)) {
    throw new TypeError('Value is not a ProductCore');
  }
}

// Użycie zamiast `any`:
import { isProductCore, assertProductCore } from '@/lib/type-guards';

// PRZED:
function processProduct(data: any) {
  return data.title; // Brak type safety
}

// PO:
function processProduct(data: unknown) {
  if (!isProductCore(data)) {
    throw new Error('Invalid product data');
  }
  
  return data.title; // ✓ Type safe!
}

// Lub z assert:
function processProduct(data: unknown) {
  assertProductCore(data);
  return data.title; // ✓ Type safe!
}
```

---

## 📊 METRYKI SUKCESU

### Przed Optymalizacją (Baseline)

```
Performance:
- Harvester: 100 produktów = 8-12 minut
- getCategories(): 211 zapytań Firestore, ~5-10s
- getCategoriesWithContent(): 1,050+ zapytań, ~30-60s
- Cache hit rate: ~40-50%
- Search: 200 docs loaded, in-memory filter

Code Quality:
- data.ts: 2,930 linii (1 plik)
- console.log: 23 wystąpienia
- any types: 15+ wystąpień
- Magic numbers: 20+ wystąpień

SEO:
- Meta tags: ✓
- Structured data: WebSite + Organization
- Product schema: ✗
- BreadcrumbList: ✗

Accessibility:
- ARIA coverage: ~70%
- Live regions: ✗
- Focus traps: ✗
- Skip links: ✗
```

### Po Optymalizacji (Target)

```
Performance:
- Harvester: 100 produktów = 30-60 sekund ✅ (10-15× szybciej)
- getCategories(): 1 zapytanie, <1s ✅ (200× szybciej)
- getCategoriesWithContent(): 1 zapytanie, <2s ✅ (50-100× szybciej)
- Cache hit rate: ~90-95% ✅ (5-8× lepsza)
- Search: Typesense indexed, <100ms ✅ (10-20× szybciej)

Code Quality:
- data.ts: Podzielone na 9 modułów ✅
- console.log: 0 wystąpień (logger service) ✅
- any types: <5 wystąpień (progress) ✅
- Magic numbers: 0 (constants) ✅

SEO:
- Meta tags: ✓
- Structured data: WebSite + Organization + Product + BreadcrumbList ✅
- Product schema: ✓ ✅
- BreadcrumbList: ✓ ✅

Accessibility:
- ARIA coverage: ~95% ✅
- Live regions: ✓ ✅
- Focus traps: ✓ ✅
- Skip links: ✓ ✅
```

---

## 🚦 STATUS TRACKING

Użyj tego checklistu do śledzenia postępów:

### Quick Wins (1-2 dni)
- [ ] Cache LRU: 50 → 500 elementów
- [ ] Batch writes w harvesterze
- [ ] Równoległe zapytania deduplikacji
- [ ] Product schema JSON-LD
- [ ] Aria-live dla toast

### Faza 1: Krytyczne (Tydzień 1-2)
- [ ] Batch AI enrichment
- [ ] Job update throttling
- [ ] Retry logic z exponential backoff
- [ ] Rate limiting dla API
- [ ] N+1 categories fix
- [ ] Denormalizacja drzewa kategorii

### Faza 2: Wysokie (Tydzień 3-4)
- [ ] Refaktoryzacja data.ts (9 modułów)
- [ ] DRY - query builders
- [ ] Paginacja kursorowa
- [ ] Typesense/Firestore indexes

### Faza 3: Średnie (Tydzień 5-6)
- [ ] BreadcrumbList schema
- [ ] SEO descriptions w harvesterze
- [ ] Focus traps w modalach
- [ ] Aria-current w breadcrumbs
- [ ] Aria-pressed dla buttons
- [ ] Skip links

### Faza 4: Code Quality (Tydzień 7-8)
- [ ] Logger service (zamień 23× console.log)
- [ ] Constants (cache TTL, limits)
- [ ] Structured error handling
- [ ] Type guards (eliminacja any)

---

## 📞 KONTAKT I WSPARCIE

Jeśli potrzebujesz pomocy przy implementacji:

1. **Issues:** Stwórz GitHub Issue z tagiem `audit-implementation`
2. **Documentation:** Zobacz [AUDYT_APLIKACJI_2026.md](./AUDYT_APLIKACJI_2026.md)
3. **Code examples:** Wszystkie przykłady kodu dostępne w tym dokumencie

---

**Koniec planu naprawy**  
**Ostatnia aktualizacja:** 26 stycznia 2026  
**Autor:** GitHub Copilot - AI Coding Agent
