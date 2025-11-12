# 📦 Specyfikacja Importu AliExpress do Okazje+

## 🎯 **1. PARAMETRY WEJŚCIOWE (Query Parameters)**

### Wyszukiwanie produktów:
```typescript
{
  // WYMAGANE
  q: string;                    // Fraza wyszukiwania (min 2 znaki)
  
  // OPCJONALNE - FILTROWANIE
  category?: string;            // Kategoria AliExpress
  minPrice?: number;            // Minimalna cena (PLN)
  maxPrice?: number;            // Maksymalna cena (PLN)
  minRating?: number;           // Min ocena (0-5)
  minOrders?: number;           // Min liczba zamówień
  minDiscount?: number;         // Min zniżka (%)
  shippingType?: 'free' | 'paid' | 'any';
  
  // OPCJONALNE - PAGINACJA
  page?: number;                // Numer strony (default: 1)
  limit?: number;               // Produktów na stronę (default: 50, max: 200)
  
  // OPCJONALNE - SORTOWANIE
  sort?: 'price_asc' | 'price_desc' | 'orders' | 'rating' | 'newest';
}
```

### Pobieranie szczegółów produktu:
```typescript
{
  productId: string;            // WYMAGANE: ID produktu z AliExpress
  includeReviews?: boolean;     // Pobierz opinie użytkowników
  includeVariants?: boolean;    // Pobierz warianty (rozmiary, kolory)
}
```

## 🔄 **2. TRANSFORMACJA DANYCH: AliExpress → Okazje+**

### Mapowanie pól Product:
```typescript
// ŹRÓDŁO (AliExpress API Response)
{
  item_id: string;
  title: string;
  image_urls: string[];
  price: { current: number, original: number, currency: string };
  rating: { score: number, count: number };
  sales: number;
  shipping: { cost: number, free: boolean };
  description: string;
  category_path: string[];
  product_url: string;
}

// CEL (Product w Firestore)
{
  id: string;                   // AUTO-GENEROWANE (Firestore)
  name: string;                 // = title (max 200 znaków)
  description: string;          // = description (pierwsze 300 znaków)
  longDescription: string;      // = description (pełny opis)
  image: string;                // = image_urls[0] (główne zdjęcie)
  imageHint: string;            // AUTO: ekstrakcja alt text / AI caption
  affiliateUrl: string;         // = product_url + affiliate_params
  
  price: number;                // = price.current (konwersja na PLN jeśli potrzeba)
  originalPrice?: number;       // = price.original (jeśli różne)
  
  // KATEGORIE - WYMAGANE MAPOWANIE RĘCZNE!
  mainCategorySlug: string;     // ADMIN wybiera z listy kategorii
  subCategorySlug: string;      // ADMIN wybiera podkategorię
  subSubCategorySlug?: string;  // OPCJONALNIE: poziom 3
  
  // OCENY - inicjalizacja
  ratingCard: {
    average: number;            // = rating.score
    count: number;              // = rating.count
    durability: number;         // DEFAULT: rating.score
    easeOfUse: number;          // DEFAULT: rating.score
    valueForMoney: number;      // DEFAULT: rating.score
    versatility: number;        // DEFAULT: rating.score
  };
  
  // STATUS MODERACJI
  status: 'draft';              // ZAWSZE 'draft' przy imporcie
  
  // METADANE (opcjonalne)
  metadata?: {
    source: 'aliexpress';
    originalId: string;         // = item_id
    importedAt: string;         // ISO timestamp
    importedBy: string;         // UID admina
    originalPrice: number;      // cena w oryginalnej walucie
    currency: string;
    discount: number;           // % zniżki
    orders: number;             // liczba zamówień
    shippingInfo: string;
  };
}
```

### Mapowanie pól Deal (opcjonalnie):
```typescript
// Jeśli produkt ma dużą zniżkę (>50%) → można utworzyć Deal
{
  id: string;                   // AUTO-GENEROWANE
  title: string;                // = "🔥 " + title
  description: string;          // = description + info o zniżce
  price: number;                // = price.current
  originalPrice: number;        // = price.original
  link: string;                 // = affiliateUrl
  image: string;                // = image_urls[0]
  imageHint: string;
  
  mainCategorySlug: string;     // TEN SAM co Product
  subCategorySlug: string;
  subSubCategorySlug?: string;
  
  postedBy: string;             // UID admina
  postedAt: string;             // ISO timestamp
  merchant: 'AliExpress';
  
  voteCount: 0;                 // INICJALIZACJA
  temperature: 50;              // DEFAULT
  commentsCount: 0;
  
  status: 'draft';              // ZAWSZE draft przy imporcie
  createdBy: string;            // UID admina
}
```

## ⚠️ **3. WALIDACJA I ZASADY BIZNESOWE**

### WYMAGANE przed zapisem do Firestore:

#### ✅ Walidacja Product:
```typescript
{
  // POLA WYMAGANE (nie mogą być puste)
  name: string && name.length >= 10 && name.length <= 500,
  description: string && description.length >= 20,
  longDescription: string && longDescription.length >= 50,
  image: string && isValidUrl(image),
  affiliateUrl: string && isValidUrl(affiliateUrl),
  price: number && price > 0,
  mainCategorySlug: string && categoryExists(mainCategorySlug),
  subCategorySlug: string && subCategoryExists(subCategorySlug),
  status: 'draft' | 'approved' | 'rejected',
  
  // POLA OPCJONALNE ale z walidacją
  originalPrice?: number && originalPrice >= price,
  subSubCategorySlug?: string && subSubCategoryExists(subSubCategorySlug),
  
  // RATING CARD
  ratingCard: {
    average: number && average >= 0 && average <= 5,
    count: number && count >= 0,
    durability: number && durability >= 0 && durability <= 5,
    easeOfUse: number && easeOfUse >= 0 && easeOfUse <= 5,
    valueForMoney: number && valueForMoney >= 0 && valueForMoney <= 5,
    versatility: number && versatility >= 0 && versatility <= 5,
  }
}
```

#### ✅ Walidacja Deal:
```typescript
{
  // WYMAGANE
  title: string && title.length >= 10 && title.length <= 200,
  description: string && description.length >= 20 && description.length <= 2000,
  price: number && price > 0,
  link: string && isValidUrl(link),
  image: string && isValidUrl(image),
  mainCategorySlug: string && categoryExists(mainCategorySlug),
  subCategorySlug: string && subCategoryExists(subCategorySlug),
  postedBy: string && userExists(postedBy),
  postedAt: string && isISOString(postedAt),
  
  // POLA Z WARTOŚCIAMI DOMYŚLNYMI
  voteCount: 0,
  temperature: 50,
  commentsCount: 0,
  status: 'draft'
}
```

### 🚫 Zasady wykluczania produktów:

```typescript
// NIE IMPORTUJ jeśli:
const shouldSkipProduct = (product: AliExpressProduct) => {
  return (
    !product.title ||                        // Brak tytułu
    product.title.length < 10 ||             // Tytuł za krótki
    !product.imageUrl ||                     // Brak zdjęcia
    product.price <= 0 ||                    // Cena nieprawidłowa
    product.rating < 3.5 ||                  // Ocena poniżej 3.5
    product.orders < 10 ||                   // Mniej niż 10 zamówień
    product.title.match(/fake|replica|scam/i) // Podejrzane słowa
  );
};
```

## 🔐 **4. BEZPIECZEŃSTWO I UPRAWNIENIA**

### Firestore Rules (już zaimplementowane):
```javascript
// products/{productId}
allow create: if isAdmin() 
  && request.resource.data.status == 'draft'
  && numberMin('price', 0);

// IMPORT może wykonać TYLKO admin
function isAdmin() {
  return request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Dodatkowe zabezpieczenia:
```typescript
// W Cloud Function / API Route
export async function importAliExpressProduct(
  productData: AliExpressProduct,
  adminUid: string
) {
  // 1. Weryfikacja uprawnień admin
  const userDoc = await admin.firestore().doc(`users/${adminUid}`).get();
  if (userDoc.data()?.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  
  // 2. Rate limiting: max 50 produktów na minutę na admina
  const rateLimitKey = `aliexpress_import:${adminUid}`;
  const currentCount = await redis.get(rateLimitKey) || 0;
  if (currentCount >= 50) {
    throw new Error('Rate limit exceeded: Max 50 products per minute');
  }
  
  // 3. Deduplication: sprawdź czy produkt już istnieje
  const existingProduct = await admin.firestore()
    .collection('products')
    .where('metadata.source', '==', 'aliexpress')
    .where('metadata.originalId', '==', productData.id)
    .limit(1)
    .get();
    
  if (!existingProduct.empty) {
    throw new Error('Product already imported');
  }
  
  // 4. Sanityzacja danych (XSS protection)
  const sanitizedData = {
    ...productData,
    name: sanitizeHtml(productData.title),
    description: sanitizeHtml(productData.description),
    longDescription: sanitizeHtml(productData.longDescription),
  };
  
  return sanitizedData;
}
```

## 🗂️ **5. KATEGORIE - KLUCZOWA ZASADA**

### ⚠️ **KATEGORIE NIE SĄ TWORZONE AUTOMATYCZNIE!**

```typescript
// ❌ BŁĘDNE podejście:
async function importProduct(aliProduct) {
  const product = {
    mainCategorySlug: 'nowa-kategoria', // ❌ Ta kategoria nie istnieje!
    subCategorySlug: 'nowa-podkategoria'
  };
  await addDoc(collection(db, 'products'), product);
}

// ✅ POPRAWNE podejście:
async function importProduct(aliProduct) {
  // 1. Sprawdź czy kategoria istnieje
  const categories = await getCategories();
  const mainCategory = categories.find(c => c.slug === selectedMainSlug);
  if (!mainCategory) {
    throw new Error('Kategoria główna nie istnieje');
  }
  
  const subCategory = mainCategory.subcategories.find(
    sc => sc.slug === selectedSubSlug
  );
  if (!subCategory) {
    throw new Error('Podkategoria nie istnieje');
  }
  
  // 2. Dopiero teraz zapisz produkt
  const product = {
    mainCategorySlug: mainCategory.slug,
    subCategorySlug: subCategory.slug,
    // ... reszta danych
  };
  await addDoc(collection(db, 'products'), product);
}
```

### Algorytm sugerowania kategorii:
```typescript
// Pomocnicza funkcja do AI/heurystyki
async function suggestCategory(productTitle: string, categories: Category[]) {
  const keywords = {
    'elektronika': ['phone', 'laptop', 'computer', 'gadget', 'electronic'],
    'dom-i-ogrod': ['garden', 'furniture', 'decoration', 'kitchen'],
    'moda': ['shirt', 'dress', 'shoes', 'fashion', 'clothes'],
    // ... więcej mapowań
  };
  
  const titleLower = productTitle.toLowerCase();
  
  for (const [categorySlug, keywordList] of Object.entries(keywords)) {
    if (keywordList.some(kw => titleLower.includes(kw))) {
      const category = categories.find(c => c.slug === categorySlug);
      if (category) {
        return {
          mainCategorySlug: category.slug,
          confidence: 0.7
        };
      }
    }
  }
  
  return { mainCategorySlug: null, confidence: 0 };
}
```

## 📊 **6. WORKFLOW IMPORTU (Krok po kroku)**

```typescript
// FAZA 1: WYSZUKIWANIE
const results = await searchAliExpress({
  q: 'wireless earbuds',
  minRating: 4.0,
  minOrders: 100,
  limit: 50
});

// FAZA 2: PREVIEW & SELEKCJA (UI)
// Admin widzi listę produktów i wybiera które importować
// Dla każdego zaznaczonego produktu admin musi:
// - Wybrać kategorię główną
// - Wybrać podkategorię
// - (opcjonalnie) Wybrać sub-podkategorię

// FAZA 3: POBIERANIE SZCZEGÓŁÓW
const detailedProducts = await Promise.all(
  selectedIds.map(id => fetchAliExpressProductDetails(id))
);

// FAZA 4: TRANSFORMACJA
const transformedProducts = detailedProducts.map(aliProduct => ({
  name: aliProduct.title.slice(0, 200),
  description: aliProduct.description.slice(0, 300),
  longDescription: aliProduct.description,
  image: aliProduct.image_urls[0],
  imageHint: generateImageHint(aliProduct.title),
  affiliateUrl: addAffiliateParams(aliProduct.product_url),
  price: convertToPLN(aliProduct.price.current, aliProduct.price.currency),
  originalPrice: aliProduct.price.original ? convertToPLN(aliProduct.price.original, aliProduct.price.currency) : undefined,
  mainCategorySlug: categoryMapping[aliProduct.item_id].main,
  subCategorySlug: categoryMapping[aliProduct.item_id].sub,
  subSubCategorySlug: categoryMapping[aliProduct.item_id].subSub,
  ratingCard: {
    average: aliProduct.rating.score,
    count: aliProduct.rating.count,
    durability: aliProduct.rating.score,
    easeOfUse: aliProduct.rating.score,
    valueForMoney: aliProduct.rating.score,
    versatility: aliProduct.rating.score,
  },
  status: 'draft',
  metadata: {
    source: 'aliexpress',
    originalId: aliProduct.item_id,
    importedAt: new Date().toISOString(),
    importedBy: currentUser.uid,
    originalPrice: aliProduct.price.current,
    currency: aliProduct.price.currency,
    discount: calculateDiscount(aliProduct.price),
    orders: aliProduct.sales,
    shippingInfo: aliProduct.shipping.free ? 'Darmowa dostawa' : `Dostawa: ${aliProduct.shipping.cost} PLN`,
  }
}));

// FAZA 5: WALIDACJA
const validatedProducts = transformedProducts.filter(product => {
  try {
    validateProduct(product);
    return true;
  } catch (error) {
    console.error(`Validation failed for ${product.name}:`, error);
    return false;
  }
});

// FAZA 6: BATCH IMPORT (max 500 na raz)
const batches = chunk(validatedProducts, 500);
for (const batch of batches) {
  const batchWrite = writeBatch(db);
  batch.forEach(product => {
    const docRef = doc(collection(db, 'products'));
    batchWrite.set(docRef, product);
  });
  await batchWrite.commit();
}

// FAZA 7: OPCJONALNIE - Synchronizacja z Typesense
await syncProductsToTypesense(validatedProducts.map(p => p.id));
```

## 🔄 **7. KONWERSJA WALUT**

```typescript
const EXCHANGE_RATES = {
  'USD': 4.0,   // Statyczne kursy (lub API)
  'EUR': 4.3,
  'GBP': 5.0,
  'CNY': 0.55,
  'PLN': 1.0
};

function convertToPLN(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] || 1.0;
  return Math.round(amount * rate * 100) / 100; // 2 miejsca po przecinku
}
```

## 📈 **8. MONITORING I LOGI**

```typescript
// Struktura logu importu
interface ImportLog {
  id: string;
  adminUid: string;
  timestamp: string;
  query: string;
  totalFound: number;
  selected: number;
  imported: number;
  failed: number;
  errors: Array<{ productId: string; error: string }>;
  duration: number; // ms
  source: 'aliexpress';
}

// Zapisywanie w Firestore
await addDoc(collection(db, 'import_logs'), importLog);
```

## 🎨 **9. UX - WYMAGANIA UI**

Admin powinien mieć możliwość:
1. ✅ Wyszukiwania produktów (query + filtry)
2. ✅ Podglądu wyników w tabeli z checkboxami
3. ✅ Masowego wyboru produktów
4. ✅ Przypisania kategorii dla każdego produktu
5. ✅ Podglądu szczegółów przed importem
6. ✅ Progress bar podczas importu
7. ✅ Podsumowania: ile zaimportowano / ile się nie powiodło
8. ✅ Możliwości edycji zaimportowanych produktów (status draft)

## 🛠️ **10. IMPLEMENTACJA TECHNICZNA**

### API Route: `/api/admin/aliexpress/search`
```typescript
// GET /api/admin/aliexpress/search?q=wireless+earbuds&minRating=4.0
export async function GET(request: Request) {
  // 1. Weryfikacja uprawnień admin
  const session = await getServerSession();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Parsowanie parametrów
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  // ... reszta parametrów
  
  // 3. Wywołanie AliExpress API
  const results = await aliexpressClient.searchProducts({
    keywords: query,
    min_price: searchParams.get('minPrice'),
    // ...
  });
  
  // 4. Normalizacja odpowiedzi
  return NextResponse.json({
    products: results.items.map(normalizeProduct),
    total: results.total,
    page: results.page
  });
}
```

### API Route: `/api/admin/aliexpress/import`
```typescript
// POST /api/admin/aliexpress/import
export async function POST(request: Request) {
  const session = await getServerSession();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { products, categoryMappings } = await request.json();
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const product of products) {
    try {
      // Walidacja
      validateProduct(product);
      
      // Sprawdź kategorię
      const categoryExists = await verifyCategoryExists(
        categoryMappings[product.id].main,
        categoryMappings[product.id].sub
      );
      
      if (!categoryExists) {
        throw new Error('Invalid category');
      }
      
      // Import
      const docRef = await addDoc(collection(db, 'products'), {
        ...product,
        status: 'draft',
        metadata: {
          source: 'aliexpress',
          importedAt: new Date().toISOString(),
          importedBy: session.user.uid
        }
      });
      
      results.success.push({ id: docRef.id, originalId: product.id });
    } catch (error) {
      results.failed.push({ 
        id: product.id, 
        error: error.message 
      });
    }
  }
  
  return NextResponse.json(results);
}
```

### Cloud Function: Batch Import (opcjonalnie)
```typescript
// functions/src/aliexpress-batch-import.ts
export const aliexpressBatchImport = onCall(
  { region: 'europe-west1', maxInstances: 10 },
  async (request) => {
    // Weryfikacja admin
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin access required');
    }
    
    const { products, categoryMappings } = request.data;
    
    // Batch write (max 500)
    const batch = db.batch();
    const results = [];
    
    for (const product of products.slice(0, 500)) {
      const docRef = db.collection('products').doc();
      batch.set(docRef, {
        ...transformProduct(product),
        mainCategorySlug: categoryMappings[product.id].main,
        subCategorySlug: categoryMappings[product.id].sub,
        status: 'draft'
      });
      results.push(docRef.id);
    }
    
    await batch.commit();
    
    return { imported: results.length, ids: results };
  }
);
```

## 📝 **11. CHECKLIST PRZED WDROŻENIEM**

- [ ] Konfiguracja AliExpress API credentials (app_key, app_secret)
- [ ] Endpoint `/api/admin/aliexpress/search` zaimplementowany
- [ ] Endpoint `/api/admin/aliexpress/import` zaimplementowany
- [ ] Walidacja kategorii (sprawdzanie czy istnieją w Firestore)
- [ ] Sanityzacja HTML (XSS protection)
- [ ] Rate limiting (max 50 produktów/min)
- [ ] Deduplication (sprawdzanie czy produkt już istnieje)
- [ ] Konwersja walut (USD/EUR → PLN)
- [ ] Generowanie affiliate URL
- [ ] Progress bar w UI
- [ ] Error handling i user feedback
- [ ] Logging importów do `import_logs` collection
- [ ] Synchronizacja z Typesense (opcjonalnie)
- [ ] Testy E2E dla flow importu
- [ ] Dokumentacja API w Postman/Swagger

## 🔗 **12. POWIĄZANE PLIKI**

- `src/lib/types.ts` - Definicje typów (Product, Deal, Category)
- `src/lib/aliexpress.ts` - Funkcje pomocnicze (signing, query building)
- `src/components/admin/aliexpress-importer.tsx` - UI komponentu importu
- `src/app/api/admin/aliexpress/search/route.ts` - Endpoint wyszukiwania
- `src/app/api/admin/aliexpress/import/route.ts` - Endpoint importu
- `firestore.rules` - Zabezpieczenia (admin-only dla importu)
- `docs/kategorie-automatyczne.md` - Dokumentacja systemu kategorii
