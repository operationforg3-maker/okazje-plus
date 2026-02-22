# Import Source of Truth — Deals & ProductCore

**Ostatnia aktualizacja:** Luty 2026 | **Architektura:** M6 Product-Centric  
**Status integracji:** AliExpress ✅ aktywny | Convertiser ✅ aktywny | Amazon ⚠️ pending | Allegro ⚠️ pending | eBay ⚠️ pending

Niniejszy dokument jest **jedynym źródłem prawdy** dla wszystkich operacji importu ofert i produktów (ProductCore). Zawiera wszystkie API, mapowania pól i wzorce zapisu do bazy danych.

---

## Spis treści

1. [Architektura danych M6](#1-architektura-danych-m6)
2. [Pipeline importu — przegląd](#2-pipeline-importu--przegląd)
3. [Pośredni schemat RawProduct](#3-pośredni-schemat-rawproduct)
4. [Integracje API](#4-integracje-api)
   - 4.1 [AliExpress](#41-aliexpress)
   - 4.2 [Convertiser](#42-convertiser-sieć-afiliacyjna)
   - 4.3 [Amazon](#43-amazon-pending)
   - 4.4 [Allegro](#44-allegro-pending)
   - 4.5 [eBay](#45-ebay-pending)
5. [Mapowania pól — API → RawProduct](#5-mapowania-pól--api--rawproduct)
6. [Zapis do Firestore — schematy kolekcji](#6-zapis-do-firestore--schematy-kolekcji)
   - 6.1 [product_cores](#61-kolekcja-product_cores)
   - 6.2 [deals](#62-kolekcja-deals)
   - 6.3 [identity_matches](#63-kolekcja-identity_matches)
   - 6.4 [harvester_jobs](#64-kolekcja-harvester_jobs)
7. [Logika deduplikacji](#7-logika-deduplikacji)
8. [Wzbogacanie AI (Deal Refiner & Product Refiner)](#8-wzbogacanie-ai-deal-refiner--product-refiner)
9. [Endpointy API importu (Admin)](#9-endpointy-api-importu-admin)
10. [Zmienne środowiskowe](#10-zmienne-środowiskowe)
11. [Walidacja schematów (Zod)](#11-walidacja-schematów-zod)

---

## 1. Architektura danych M6

M6 używa modelu **dwóch encji** z separacją odpowiedzialności:

```
ProductCore (niemutowalne dane produktu)
    ↑ productId (FK)
DealM6 (mutowalna oferta / aukcja)
```

| Aspekt | ProductCore | DealM6 |
|--------|------------|--------|
| **Kolekcja Firestore** | `product_cores` | `deals` |
| **Charakter** | Niemutowalny opis produktu | Mutowalna oferta cenowa |
| **Jeden / wiele** | Jeden na unikalny produkt | Wiele na jeden ProductCore |
| **Tworzony przez** | Harvester (import) | Harvester (import) |
| **Modyfikowany przez** | Refiner (AI) | Głosowania, komentarze, aktualizacje cen |
| **Status publiczny** | `approved` | `approved` |
| **Klucz tożsamości** | `identityHash` = SHA-256(titleHash + imageHash) | `productId` = ID ProductCore |

**Pliki źródłowe:**
- Typy: `src/lib/types.ts` — interfejsy `ProductCore` (linia 2174), `DealM6` (linia 2405)
- Zapis: `src/lib/automation/harvester.ts` — metody `prepareProductCore()`, `prepareDeal()`

---

## 2. Pipeline importu — przegląd

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PIPELINE IMPORTU                              │
│                                                                     │
│  1. FETCH       2. TRANSFORM    3. DEDUPLIKACJA   4. ZAPIS          │
│                                                                     │
│  API źródła  →  RawProduct   →  ProductCore?  →  Firestore         │
│  (AliExpress,   (wspólny        istniejący:        batch.set()      │
│   Convertiser,  schemat)        tylko Deal         WriteBatch       │
│   Amazon...)                    nowy:              max 500 ops      │
│                                 ProductCore                         │
│                                 + Deal                              │
│                                 + IdentityMatch                     │
│                                                                     │
│  5. RECALKULACJA               6. AI ENRICHMENT (async)            │
│                                                                     │
│  batchUpdateProductBestPrices() → Deal Refiner → Product Refiner   │
│  (bestPrice, bestDealId,          (tłumaczenia,    (specs cleanup,  │
│   linkedDealIds)                   selling points) opisy AI)       │
└─────────────────────────────────────────────────────────────────────┘
```

**Orchestrator:** `src/lib/automation/harvester.ts` — klasa `SmartHarvester`

**Uruchamianie:**
- Admin UI → panel "Import" → przycisk "Uruchom Harvest"
- API: `POST /api/admin-import/deals` (mode: `"run"`)

---

## 3. Pośredni schemat RawProduct

Wszystkie źródła API są normalizowane do wspólnego interfejsu `RawProduct` **przed** zapisem do Firestore. To kluczowy punkt integracji.

```typescript
// src/lib/automation/harvester.ts
interface RawProduct {
  // === WYMAGANE ===
  title: string;                    // Tytuł produktu (angielski lub oryginalny)
  imageUrl: string;                 // URL głównego zdjęcia
  price: number;                    // Cena aktualna (PLN)
  currency: string;                 // Waluta (zwykle 'PLN')
  shippingCost: number;             // Koszt wysyłki (PLN)
  shippingDays: number;             // Szacowany czas dostawy (dni)
  sourceProductId: string;          // ID w systemie źródłowym
  sourceUrl: string;                // URL produktu / link afiliacyjny

  // === OPCJONALNE ===
  description?: string;             // Opis tekstowy
  originalPrice?: number;           // Cena przed rabatem
  videoUrl?: string;                // URL wideo produktu (np. AliExpress)
  merchantName?: string;            // Nazwa sprzedawcy
  merchantRating?: number;          // Ocena sprzedawcy
  specs?: Record<string, string>;   // Specyfikacje (klucz-wartość)
  discountPercent?: number;         // Procent rabatu
  couponCode?: string;              // Kod kuponu
  expiryDate?: string;              // Data wygaśnięcia oferty (ISO)
  conditions?: string[];            // Warunki oferty
  freeShipping?: boolean;           // Darmowa wysyłka
  minOrderValue?: number;           // Minimalna wartość zamówienia
  limitPerUser?: number;            // Limit na użytkownika
  requiresMembership?: string;      // Wymagane członkostwo
  isOfferOnly?: boolean;            // Oferta bez konkretnego produktu
  rating?: number;                  // Ocena produktu (0-5)
  ratingCount?: number;             // Liczba ocen
  evaluateCount?: number;           // Liczba opinii (AliExpress)
  soldCount?: number;               // Liczba sprzedanych
  images?: string[];                // Galeria zdjęć (wszystkie URL)
  variants?: Array<{                // Warianty produktu
    id: string;
    name: string;                   // np. "Kolor", "Rozmiar"
    values: string[];               // np. ["Czarny", "Biały"]
    sku?: string;
  }>;
  // Identyfikatory produktu (do deduplikacji)
  sku?: string;
  ean?: string;                     // European Article Number
  gtin?: string;                    // Global Trade Item Number
  upc?: string;                     // Universal Product Code
  mpn?: string;                     // Manufacturer Part Number
  offerMeta?: {
    promotionType?: 'offer';
    terms?: string;
    previewUrl?: string;
    hasCoupons?: boolean;
  };
}
```

---

## 4. Integracje API

### 4.1 AliExpress

**Status:** ✅ W pełni aktywny

**Pliki:**
- Klient: `src/integrations/aliexpress/client.ts`
- Mapper (schemat głęboki): `src/integrations/aliexpress/mappers.ts`
- Typy: `src/integrations/aliexpress/types.ts`
- Ingestion: `src/integrations/aliexpress/ingest.ts`

**Endpoint API:**
```
AliExpress Affiliate API (via ALIEXPRESS_APP_KEY + ALIEXPRESS_APP_SECRET)
Wyszukiwanie: aliexpress.affiliate.product.query
Szczegóły: aliexpress.affiliate.productdetail.get
```

**Parametry wyszukiwania:**
```typescript
client.searchProducts({
  q: searchQuery,         // Fraza wyszukiwania
  limit: 50,              // Maks. 50 wyników
  sort: 'orders',         // 'orders' (bestsellers) | 'price_asc'
  targetLanguage: 'EN',   // Język wyników
  targetCurrency: 'PLN',  // Waluta cen
  shipToCountry: 'PL'     // Kraj docelowy wysyłki
})
```

**Zmienne środowiskowe:**
```
ALIEXPRESS_APP_KEY=xxx
ALIEXPRESS_APP_SECRET=xxx
```

**Deep fetch:** Dla top 10 produktów pobierane są szczegółowe dane (HTML opisy, pełna galeria, specyfikacje SKU).

---

### 4.2 Convertiser (sieć afiliacyjna)

**Status:** ✅ W pełni aktywny

**Pliki:**
- Klient: `src/lib/integrations/convertiser-client.ts`
- Mapper: w `src/lib/automation/harvester.ts` — `mapConvertiserOfferToRawProduct()`
- Auto-kategorie AI: `src/ai/flows/convertiser-auto-category.ts`

**Tryby pobierania:**
| Tryb | Metoda | Opis |
|------|--------|------|
| `products` | `client.searchProductsV2()` → fallback `client.searchProducts()` | Produkty marketplace |
| `offers` | `client.getOffers()` | Oferty afiliacyjne (kupony, rabaty) |
| `autoBrowse` | `client.browseCatalog()` | Cały katalog bez słów kluczowych |

**Parametry:**
```typescript
client.searchProductsV2({
  query: searchQuery,
  country: 'PL'     // Rynek polski
}, {
  page: 1,
  page_size: 50
})
```

**Zmienne środowiskowe:**
```
CONVERTISER_API_TOKEN=xxx
```

**Specjalność Convertiser:** Oferty afiliacyjne z kuponami. Pola oferty są bardzo heterogeniczne — mapper obsługuje wiele wariantów nazw pól. Kategorie przypisywane przez AI batch (`batchAssignCategories()`).

---

### 4.3 Amazon (pending)

**Status:** ⚠️ Integracja pending — brak konfiguracji PA API

**Pliki:**
- Klient: `src/integrations/amazon/client.ts`
- Mapper: `src/integrations/amazon/mappers.ts`
- Typy: `src/integrations/amazon/types.ts`

**W harvesterze:** `fetchFromAmazon()` zwraca `[]` z ostrzeżeniem o braku konfiguracji.

**Wymagane do aktywacji:**
```
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AMAZON_PARTNER_TAG=xxx
AMAZON_MARKETPLACE=www.amazon.pl
```

---

### 4.4 Allegro (pending)

**Status:** ⚠️ Integracja pending — wymaga OAuth setup

**Pliki:**
- Klient: `src/integrations/allegro/client.ts`
- Mapper: `src/integrations/allegro/mappers.ts`
- Typy: `src/integrations/allegro/types.ts`

**W harvesterze:** `fetchFromAllegro()` zwraca `[]` z ostrzeżeniem o braku konfiguracji.

**Wymagane do aktywacji:**
```
ALLEGRO_CLIENT_ID=xxx
ALLEGRO_CLIENT_SECRET=xxx
ALLEGRO_REDIRECT_URI=https://app.url/api/auth/allegro/callback
```

---

### 4.5 eBay (pending)

**Status:** ⚠️ Mapper istnieje, brak implementacji w harvesterze

**Pliki:**
- Klient: `src/integrations/ebay/client.ts`
- Mapper: `src/integrations/ebay/mappers.ts`
- Typy: `src/integrations/ebay/types.ts`

**Wymagane do aktywacji:**
```
EBAY_APP_ID=xxx
EBAY_CERT_ID=xxx
EBAY_DEV_ID=xxx
EBAY_AFFILIATE_TRACKING_ID=xxx
```

---

## 5. Mapowania pól — API → RawProduct

### AliExpress → RawProduct

| Pole API AliExpress | Pole RawProduct | Transformacja |
|---------------------|-----------------|---------------|
| `product_id` / `productId` / `item_id` | `sourceProductId` | `String()` |
| `product_title` / `title` | `title` | `.trim()` |
| `product_main_image_url` / `image_url` | `imageUrl` | bezpośrednio |
| `all_images` / `product_small_image_urls` | `images[]` | split lub array |
| `product_video_url` / `productVideoUrl` | `videoUrl` | opcjonalne |
| `target_sale_price` / `sale_price` | `price` | `parseFloat` × 100 → grosze; SKU list jeśli taniej |
| `original_price` / `target_original_price` | `originalPrice` | `parseFloat` × 100 → grosze |
| `discount` | `discountPercent` | `parseInt` |
| `promotion_link` / `product_detail_url` | `sourceUrl` | bezpośrednio |
| `ship_to_days` / `deliveryDays` | `shippingDays` | `parseInt` |
| `store_info.store_name` | `merchantName` | bezpośrednio |
| `store_info.store_score` / `store_info.rating` | `merchantRating` | bezpośrednio |
| `product_props` / `attribute_list` | `specs` | `extractPropsFromProductProps()` → normalizacja do standardowych kluczy |
| `evaluate_rate` / `lastest_volume` | `soldCount` | `parseInt` |
| `product_avg_rating` / `averageRating` | `rating` | `parseFloat` |
| `evaluate_count` / `ratingCount` | `ratingCount` | `parseInt` |
| `ships_from_countries` | *(informacja o magazynie PL)* | wykrywanie `hasPLWarehouse` |

**Normalizacja specs (standardowe klucze):**
```
memory / ram               → 'memory'
storage / hard disk        → 'storage'
color / colours            → 'color'
brand / brand name         → 'brand'
screen / display size      → 'screen'
battery                    → 'battery'
cpu / processor            → 'processor'
operating system / os      → 'os'
weight                     → 'weight'
material                   → 'material'
connector / port           → 'connector'
waterproof / ipx           → 'waterproof'
warranty                   → 'warranty'
```

### Convertiser → RawProduct

| Pole API Convertiser | Pole RawProduct | Transformacja |
|----------------------|-----------------|---------------|
| `title` / `product_title` / `name` | `title` | bezpośrednio |
| `logo_thumbnail` / `logo` / `image` / `image_url` | `imageUrl` | kolejność fallback |
| `tracking_link` / `tracking_url` / `affiliate_url` / `aff_link` / `preview_url` | `sourceUrl` | kolejność fallback |
| `sale_price` / `price` / `current_price` / `offer_price` | `price` | `parsePrice()` |
| `original_price` / `regular_price` / `list_price` / `old_price` | `originalPrice` | `parsePrice()` z walidacją |
| `discount_value` / `saving` / `savings` | *(do obliczenia originalPrice)* | `parsePrice()` |
| `discount_percent` / `percent_off` / `rebate_percent` | `discountPercent` | normalizacja % (0-1 → 0-100) |
| `coupon_code` / `couponCode` / `code` / `promo_code` / `voucher_code` | `couponCode` | `.trim()` |
| `expiry_date` / `expiration_date` / `valid_until` / `valid_to` / `ends_at` | `expiryDate` | `toIsoDate()` |
| `terms` / `conditions` / `rules` | `conditions[]` | split po `\n`, `•`, `;` |
| `free_shipping` / `freeShipping` | `freeShipping` | `Boolean()` |
| `min_order_value` / `minimum_order_value` | `minOrderValue` | `parsePrice()` |
| `limit_per_user` / `max_per_user` | `limitPerUser` | `parsePrice()` |
| `description` / `product_description` / `excerpt` | `description` | `stripHtml()` |
| `uuid` / `offer_uuid` / `offer_id` / `id` | `sourceProductId` | `String()` |
| `title` / `advertiser_name` | `merchantName` | bezpośrednio |

### Amazon → RawProduct (przez mapper)

| Pole API Amazon | Pole docelowe (Product legacy) | Uwagi |
|-----------------|-------------------------------|-------|
| `asin` | `metadata.originalId` | klucz unikalności Amazon |
| `title` | `name` | bezpośrednio |
| `description` + `features[]` | `description` / `longDescription` | łączone z markdown |
| `imageUrls[]` | `gallery[]` | `ProductImageEntry[]` |
| `price.current` | `price` | float PLN |
| `price.original` | `originalPrice` | float PLN |
| `rating.score` / `rating.count` | `ratingCard.average` / `.count` | 0-5 |
| `brand` / `manufacturer` | `metadata.merchant` | bezpośrednio |
| `specifications` | `longDescription` (sekcja) | key-value markdown |

**Uwaga:** Mapper Amazona (`mappers.ts`) mapuje do starszego formatu `Product`, nie `RawProduct`. Wymaga adaptacji przy pełnej aktywacji.

### Allegro → RawProduct (przez mapper)

| Pole API Allegro | Pole docelowe (Product legacy) | Uwagi |
|-----------------|-------------------------------|-------|
| `id` | `metadata.originalId` | klucz unikalności Allegro |
| `name` | `name` | bezpośrednio |
| `description` | `description` | bezpośrednio |
| `parameters[].name` + `.values[]` | `longDescription` (sekcja specs) | markdown |
| `images[].url` | `gallery[]` | `ProductImageEntry[]` |
| `sellingMode.price.amount` | `price` | float |
| `seller.login` | `metadata.merchant` | bezpośrednio |
| `delivery.shippingRates[]` | `longDescription` (sekcja dostawa) | markdown |
| `category.name` | *(sugestia kategorii)* | `extractCategorySuggestions()` |

### eBay → RawProduct (przez mapper)

| Pole API eBay | Pole docelowe (Product legacy) | Uwagi |
|--------------|-------------------------------|-------|
| `itemId` | `metadata.originalId` | klucz unikalności eBay |
| `title` | `name` | bezpośrednio |
| `description` / `shortDescription` | `description` / `longDescription` | bezpośrednio |
| `image.imageUrl` | `gallery[0].src` | główne zdjęcie |
| `additionalImages[].imageUrl` | `gallery[1+].src` | galeria |
| `price.value` | `price` | `parseFloat` |
| `originalPrice.value` | `originalPrice` | `parseFloat` |
| `seller.feedbackPercentage` | `ratingCard.average` | przeliczyć na 0-5 |
| `seller.feedbackScore` | `ratingCard.count` | bezpośrednio |
| `seller.username` | `metadata.merchant` | bezpośrednio |
| `shippingOptions[]` | `longDescription` (sekcja dostawa) | markdown |
| `itemAffiliateWebUrl` / `itemWebUrl` | `affiliateUrl` | kolejność fallback |
| `condition` | `longDescription` (stan) | bezpośrednio |

---

## 6. Zapis do Firestore — schematy kolekcji

Wszystkie zapisy używają **Firebase Admin SDK** (`adminDb`) i operacji wsadowych (`WriteBatch`). Limit: **500 operacji na batch**. Harvester używa chunków po 500 produktów.

### 6.1 Kolekcja `product_cores`

**Tworzony przez:** `SmartHarvester.prepareProductCore()` → `batch.set(productRef, productData)`

```typescript
// Kompletny schemat zapisu — src/lib/types.ts: interface ProductCore
{
  // === IDENTYFIKACJA ===
  id: string,                    // Firestore auto-ID (productRef.id)
  identityHash: string,          // SHA-256(normalizedTitle + imageHash)

  // === TREŚĆ PRODUKTU ===
  title: LocalizedText,          // { pl: "...", en: "...", de: "..." }
  shortDescription: LocalizedText, // Krótki opis 1-2 zdania
  fullDescription: LocalizedText,  // Pełny opis (opcjonalny, generowany przez AI)
  description?: LocalizedText,     // Zunifikowany opis HTML (opcjonalny)

  // === SPECYFIKACJE ===
  specs: Record<string, string>, // { "memory": "16GB", "screen": "6.1\"" }
  specsLocalized?: {             // Wielojęzyczne etykiety specs (opcjonalnie)
    [locale: string]: Record<string, string>
  },

  // === TAKSONOMIA ===
  mainCategorySlug: string,      // np. "elektronika"
  subCategorySlug: string,       // np. "smartfony"
  subSubCategorySlug?: string,   // np. "flagship"

  // === MEDIA ===
  imageUrl?: string,             // URL głównego zdjęcia
  images: string[],              // Galeria URL (wysokiej rozdzielczości)
  primaryImageHash?: string,     // MD5 głównego zdjęcia (dla identity matching)
  videoUrl?: string,             // URL wideo (np. AliExpress product_video_url)

  // === OCENY ===
  reviewsSummary: LocalizedText, // AI: "Użytkownicy chwalą wytrzymałość..."
  rating: {
    score: number,               // 0-5
    count: number,               // Liczba ocen
    provider: 'mixed' | 'aliexpress' | 'amazon' | 'allegro' | 'users' | 'editorial'
  },

  // === NAJLEPSZA CENA (obliczana) ===
  bestPrice: {
    amount: number,              // PLN
    currency: 'PLN' | 'USD' | 'EUR'
  },
  bestTotalPrice: number,        // bestPrice.amount + shippingCost
  bestDealId?: string,           // ID najtańszej oferty (DealM6)
  bestDealType?: string,         // Typ najlepszej oferty
  hasCoupons?: boolean,          // Czy dostępne kupony
  couponDealsCount?: number,     // Liczba ofert kuponowych

  // === POWIĄZANE OFERTY ===
  linkedDealIds: string[],       // IDs DealM6 dla tego produktu

  // === WYSZUKIWANIE ===
  searchTags: string[],          // Słowa kluczowe (max 12, z tytułu + kategorii)

  // === STATUS ===
  status: 'pending_approval' | 'approved' | 'rejected' | 'draft',
  // Wartość przy tworzeniu przez harvester: 'pending_approval'

  // === METADANE ===
  createdAt: string,             // ISO timestamp
  updatedAt: string,             // ISO timestamp
  metadata: {
    source: string,              // 'aliexpress' | 'amazon' | 'allegro' | 'convertiser'
    originalId: string,          // ID w systemie źródłowym
    importedAt: string,          // ISO timestamp
    identifiers: {               // Standardowe identyfikatory do deduplikacji
      ean?: string,              // European Article Number
      gtin?: string,             // Global Trade Item Number
      upc?: string,              // Universal Product Code
      mpn?: string,              // Manufacturer Part Number
      sku?: string               // Stock Keeping Unit
    }
  }
}
```

### 6.2 Kolekcja `deals`

**Tworzony przez:** `SmartHarvester.prepareDeal()` → `batch.set(dealRef, dealData)`

```typescript
// Kompletny schemat zapisu — src/lib/types.ts: interface DealM6
{
  // === IDENTYFIKACJA ===
  id: string,                    // Firestore auto-ID (dealRef.id)
  productId: string,             // FK → product_cores/{id}
  productCoreId?: string,        // Alias productId (kompatybilność)

  // === MEDIA ===
  image?: string,                // URL głównego zdjęcia
  images?: string[],             // Galeria URL

  // === CENA (Dyrektywa Omnibus) ===
  price: {
    amount: number,              // Cena aktualna (PLN)
    currency: string             // 'PLN'
  },
  originalPrice?: number,        // Cena przed rabatem (do przekreślenia)
  lowestPriceIn30Days?: number,  // Najniższa cena 30 dni (Omnibus)
  discount?: {
    amount?: number,             // Kwota rabatu
    percentage?: number          // Procent rabatu
  },
  discountPercent?: number,      // Skrót dla discount.percentage

  // === WYSYŁKA ===
  shipping: {
    cost: number,                // Koszt wysyłki (PLN)
    timeDays: number,            // Czas dostawy (dni); default: 7
    method?: string,             // 'Standard' | 'Express'
    fromCountry?: string         // Kod kraju magazynu
  },

  // === ŹRÓDŁO I AFILIACJA ===
  source: 'aliexpress' | 'amazon' | 'allegro' | 'ebay' | 'convertiser' | 'manual',
  affiliateLink: string,         // Link z kodem śledzenia
  affiliateUrl?: string,         // Alias affiliateLink
  dealUrl?: string,              // Bezpośredni URL oferty
  merchantName?: string,         // Nazwa sprzedawcy
  merchantRating?: number,       // Ocena sprzedawcy 0-5

  // === WŁAŚCIWOŚCI OFERTY ===
  title: LocalizedText,          // { pl: "...", en: "..." }
  description?: LocalizedText,   // Opis oferty (AI-generated HTML)
  dealType?: 'sale' | 'coupon' | 'flash_deal' | 'cashback' | 'regular',
  couponCode?: string,           // Kod kuponu

  // === DOSTĘPNOŚĆ ===
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order',
  // Wartość przy tworzeniu: 'in_stock'
  stockLevel?: number,           // Liczba sztuk
  expiryDate?: string,           // Data wygaśnięcia ISO
  isActive: boolean,             // Czy oferta aktywna; default: true

  // === HISTORIA CEN (Omnibus) ===
  priceHistory: Array<{
    date: string,                // YYYY-MM-DD
    price: number,               // Cena PLN
    currency: string,            // 'PLN'
    lowestPrice?: number         // Najniższa cena tego dnia
  }>,
  // Przy tworzeniu: jeden wpis z datą importu

  // === ZAANGAŻOWANIE ===
  voteCount: number,             // Liczba głosów; default: 0
  temperature: number,           // Algorytm heat (exponential decay); default: 0
  commentsCount: number,         // Liczba komentarzy; default: 0

  // === MODERACJA ===
  status: 'draft' | 'approved' | 'rejected',
  // Wartość przy tworzeniu przez harvester: 'draft'

  // === METADANE ===
  createdAt: string,             // ISO timestamp
  updatedAt: string,             // ISO timestamp
  sourceProductId?: string,      // ID w systemie źródłowym
  sourceUrl: string,             // URL oryginału

  // === WZBOGACENIE AI (Deal Refiner — opcjonalne po imporcie) ===
  metadata?: {
    sellingPoints?: {            // Punkty sprzedażowe
      pl: string[], en: string[], de: string[],
      fr?: string[], es?: string[], uk?: string[]
    },
    highlights?: {               // Kluczowe zalety oferty
      pl: string[], en: string[], de: string[],
      fr?: string[], es?: string[], uk?: string[]
    },
    offerSummary?: {             // Krótkie podsumowanie oferty
      pl: string, en: string, de: string,
      fr?: string, es?: string, uk?: string
    }
  }
}
```

### 6.3 Kolekcja `identity_matches`

**Tworzony przez:** `SmartHarvester.prepareIdentityMatch()` → `batch.set(identityMatchRef, identityMatchData)`

```typescript
// src/lib/types.ts: interface IdentityMatch
{
  id: string,                    // Firestore auto-ID
  titleHash: string,             // Hash znormalizowanego tytułu
  primaryImageHash: string,      // Hash głównego zdjęcia
  combinedHash: string,          // SHA-256(titleHash + imageHash) = identityHash
  productId: string,             // FK → product_cores/{id}
  source: string,                // Źródło ('aliexpress' | 'convertiser' | ...)
  sourceProductId?: string,      // ID w systemie źródłowym
  confidence: number,            // Pewność dopasowania 0-1
  createdAt: string              // ISO timestamp
}
```

**Cel:** Szybkie sprawdzanie duplikatów bez pełnego skanowania `product_cores`. Indeksowane po `combinedHash`.

### 6.4 Kolekcja `harvester_jobs`

**Tworzony przez:** `SmartHarvester.startJob()` → `adminDb.collection('harvester_jobs').doc(jobId).set()`

```typescript
// src/lib/types.ts: interface HarvesterJob
{
  id: string,
  status: 'running' | 'completed' | 'failed' | 'paused',
  source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser' | 'manual',
  query: string,                 // Fraza lub kategoria
  maxResults: number,

  // Postęp (aktualizowany co 20 produktów lub co 5 sekund)
  currentCategory?: string,
  totalCategories?: number,
  processedCategories?: Array<{
    category: string,
    count: number,
    status: 'ok' | 'error' | 'skipped'
  }>,

  // Wyniki
  productsFound: number,
  productsCreated: number,
  dealsCreated: number,
  dealsLinked: number,           // Oferty powiązane z istniejącymi produktami
  duplicatesSkipped: number,

  errors: Array<{
    productId?: string,
    message: string,
    timestamp: string
  }>,

  startedAt: string,
  completedAt?: string,
  lastUpdatedAt: string,

  logs: Array<{
    level: 'info' | 'warn' | 'error',
    message: string,
    timestamp: string,
    details?: any
  }>
}
```

### Inne kolekcje używane przy imporcie

| Kolekcja | Operacja | Opis |
|----------|----------|------|
| `import_discarded` | `adminDb.collection('import_discarded').add()` | Odrzucone produkty (niskiej jakości, filtry) |
| `moderation_queue` | `addToModerationQueue(dealId, 'deal', ...)` | Oferty do ręcznej weryfikacji |
| `categories` | Read-only (lookup) | Sprawdzanie hierarchii kategorii |

---

## 7. Logika deduplikacji

Harvester używa **trójpoziomowej deduplikacji** przed zapisem:

### Poziom 1 (najwyższy priorytet): Standardowe identyfikatory produktu

```typescript
// Jeśli produkt ma EAN / GTIN / UPC / MPN:
// → findProductByIdentifiers({ ean, gtin, upc, mpn })
// → Query: product_cores WHERE metadata.identifiers.ean == ean

if (productEan || productGtin || productUpc || productMpn) {
  existingProduct = await this.findProductByIdentifiers(identifiers);
}
```

### Poziom 2: Identity Hash (tytuł + zdjęcie)

```typescript
// Jeśli brak identyfikatorów standardowych:
// → calculateIdentityHash(title, imageUrl)
// → Sprawdź identity_matches WHERE combinedHash == hash
// → Pobierz ProductCore z product_cores

identityHash = calculateIdentityHash(sourceProduct.title, sourceProduct.imageUrl);
existingProduct = await this.findProductByIdentity(identityHash);
```

**Obliczanie Identity Hash** (`src/lib/automation/identity-matcher.ts`):
```
titleHash = SHA-256(normalizeTitle(title))
  gdzie normalizeTitle: lowercase, usuń znaki specjalne, normalizuj spacje

imageHash = MD5(imageUrl) lub SHA-256 bajtów obrazu

identityHash = SHA-256(titleHash + imageHash)
```

### Poziom 3: Brak duplikatu → Nowy ProductCore

```typescript
// Jeśli produkt nie istnieje:
// → prepareProductCore() → batch.set(productRef, productData)
// → prepareIdentityMatch() → batch.set(identityMatchRef, identityMatchData)
// → prepareDeal() → batch.set(dealRef, dealData)
```

### Schemat decyzyjny

```
                    Identyfikatory standardowe
                    (EAN/GTIN/UPC/MPN)?
                         /       \
                        TAK      NIE
                        ↓         ↓
               Znajdź product  Oblicz identityHash
               po identifiers  Znajdź w identity_matches
                    \               /
                     Produkt istnieje?
                     /             \
                    TAK            NIE
                    ↓               ↓
               Tylko nowy Deal  Nowy ProductCore
               (batch.set deal) + Nowy Deal
               dealsLinked++    + Nowy IdentityMatch
                                productsCreated++
                                dealsCreated++
```

---

## 8. Wzbogacanie AI (Deal Refiner & Product Refiner)

Wzbogacanie działa **asynchronicznie** po zakończeniu importu głównego.

### Deal Refiner (`src/lib/automation/deal-refiner.ts`)

**Wyzwalacz:** Po imporcie, gdy `dealsToRefine.length >= batchSize` lub upłynął interval

```typescript
startDealRefinerJob(dealIds: string[])
```

**Co robi:**
1. Pobiera DealM6 ze statusem `draft` bez polskiego tytułu
2. Dla każdego dealu:
   - Tłumaczy tytuł na PL/EN/DE
   - Generuje `sellingPoints` (punkty sprzedażowe) per język
   - Generuje `highlights` (kluczowe zalety) per język
   - Generuje `offerSummary` per język
3. Aktualizuje `deals/{dealId}` z wzbogaconymi danymi

**Zapis do Firestore:**
```typescript
adminDb.collection('deals').doc(dealId).update({
  title: { pl: "...", en: "...", de: "..." },
  "metadata.sellingPoints": { pl: [...], en: [...], de: [...] },
  "metadata.highlights": { pl: [...], en: [...], de: [...] },
  "metadata.offerSummary": { pl: "...", en: "...", de: "..." },
  updatedAt: now
})
```

### Product Refiner (`src/lib/automation/refiner.ts`)

**Wyzwalacz:** Ręcznie z Admin UI lub po harvesterze (async)

**Co robi:**
1. Pobiera ProductCore ze statusem `pending_approval`
2. Dla każdego produktu:
   - Czyści i normalizuje specs (Gemini AI)
   - Generuje wielojęzyczne opisy (`fullDescription`)
   - Oblicza `qualityScore` (0-100)
   - Ekstrahuje `searchTags`
   - Opcjonalnie: tworzy `reviewsSummary`
3. Aktualizuje `product_cores/{productId}`

### Smart Import (3 agentów AI) (`src/integrations/smart-importer.ts`)

Alternatywny pipeline dla ręcznego importu pojedynczego produktu:

| Agent | Funkcja | Wynik |
|-------|---------|-------|
| **Audytor** (`aiDealQualityScore`) | Ocena jakości oferty 0-100 | `reject` < 40, `manual_review` 40-60, `publish` > 60 |
| **Copywriter** (`aiGenerateDealDescriptionPL`) | Generuje opis marketingowy PL | `shortDescription`, `htmlContent`, `marketingTitle` |
| **Bibliotekarz** (`aiSuggestCategory`) | Sugeruje kategorię produktu | `mainCategorySlug`, `subCategorySlug`, `confidence` |

---

## 9. Endpointy API importu (Admin)

Wszystkie endpointy wymagają roli `admin` lub `moderator`.

| Endpoint | Metoda | Plik | Opis |
|----------|--------|------|------|
| `/api/admin-import/deals` | `POST` | `src/app/api/admin-import/deals/route.ts` | Dry-run lub pełny import ofert |
| `/api/admin-import/products` | `POST` | `src/app/api/admin-import/products/route.ts` | Import produktów |
| `/api/admin-import/categories` | `POST` | `src/app/api/admin-import/categories/route.ts` | Import kategorii |
| `/api/admin-import/health` | `GET` | `src/app/api/admin-import/health/route.ts` | Status serwisu importu |
| `/api/admin-import/translations` | `POST` | `src/app/api/admin-import/translations/route.ts` | Tłumaczenia ofert |
| `/api/admin-import/prompts` | `POST` | `src/app/api/admin-import/prompts/route.ts` | Zarządzanie promptami AI |

### Przykład żądania — import ofert

```http
POST /api/admin-import/deals
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "mode": "dry-run",    // "dry-run" | "run"
  "payload": {
    "source": "aliexpress",
    "query": "elektronika/smartfony",
    "maxResults": 50,
    "autoBrowse": false,
    "autoApprove": false
  }
}
```

**Server Actions (Admin UI):**
- `dryRunImportDeals(payload)` — podgląd 50 ofert, licznik create/update
- `runImportDeals(payload)` — faktyczny zapis z opcjonalnym auto-approve
- Lokalizacja: `src/app/admin/deals-import/actions.ts`

---

## 10. Zmienne środowiskowe

### AliExpress (wymagane dla aktywnego źródła)
```bash
ALIEXPRESS_APP_KEY=xxx          # Klucz aplikacji AliExpress Affiliate
ALIEXPRESS_APP_SECRET=xxx       # Sekret aplikacji AliExpress Affiliate
```

### Convertiser (wymagane dla aktywnego źródła)
```bash
CONVERTISER_API_TOKEN=xxx       # Token dostępu do Convertiser API
```

### Amazon (do aktywacji pending integracji)
```bash
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AMAZON_PARTNER_TAG=xxx
AMAZON_MARKETPLACE=www.amazon.pl
```

### Allegro (do aktywacji pending integracji)
```bash
ALLEGRO_CLIENT_ID=xxx
ALLEGRO_CLIENT_SECRET=xxx
ALLEGRO_REDIRECT_URI=https://app.url/api/auth/allegro/callback
```

### eBay (do aktywacji pending integracji)
```bash
EBAY_APP_ID=xxx
EBAY_CERT_ID=xxx
EBAY_DEV_ID=xxx
EBAY_AFFILIATE_TRACKING_ID=xxx
```

### Firebase (wymagane dla wszystkich operacji)
```bash
FIREBASE_WEBAPP_CONFIG={"projectId":"..."}   # Server-side Firebase config
```

### AI (wymagane dla enrichmentu)
```bash
GEMINI_API_KEY=AIza...          # Local dev (Vertex AI w produkcji przez ADC)
```

---

## 11. Walidacja schematów (Zod)

Wszystkie dane są walidowane przed zapisem do Firestore.

### Schematy Zod (`src/lib/schema.ts`)

| Schemat | Zastosowanie |
|---------|-------------|
| `ProductSchema` | Pełna walidacja produktu (legacy + AliExpress mapper) |
| `ProductCoreDeepDataSchema` | Walidacja rozszerzonych pól ProductCore (gallery, logistics, seller) |
| `SpecificationSchema` | Walidacja pojedynczej specyfikacji `{ label, value }` |
| `GalleryItemSchema` | Walidacja pozycji galerii `{ url, type: 'IMAGE'|'VIDEO' }` |
| `LogisticsSchema` | Walidacja logistyki `{ deliveryDays, isFreeShipping, shippingCost }` |
| `SellerSchema` | Walidacja sprzedawcy `{ name, rating, positiveRate }` |
| `PriceHistoryEntrySchema` | Walidacja wpisu historii cen `{ date, price, currency }` |

### Przykład walidacji w mapperze AliExpress

```typescript
// src/integrations/aliexpress/mappers.ts
const parsed = ProductSchema.safeParse(candidate);
if (!parsed.success) {
  const messages = parsed.error.issues.map(i =>
    `${i.path.join('.')} - ${i.message}`
  ).join('; ');
  throw new Error(`ProductSchema validation failed: ${messages}`);
}
return parsed.data;
```

---

## Powiązane pliki

| Plik | Rola |
|------|------|
| `src/lib/types.ts` | Wszystkie interfejsy TypeScript (ProductCore, DealM6, HarvesterJob, IdentityMatch) |
| `src/lib/schema.ts` | Schematy walidacji Zod (ProductSchema, SpecificationSchema, ...) |
| `src/lib/automation/harvester.ts` | Główny orchestrator importu (SmartHarvester) |
| `src/lib/automation/identity-matcher.ts` | Logika hashowania i deduplikacji |
| `src/lib/automation/refiner.ts` | AI enrichment dla ProductCore |
| `src/lib/automation/deal-refiner.ts` | AI enrichment dla DealM6 |
| `src/integrations/aliexpress/` | Klient, mapper, typy AliExpress |
| `src/integrations/amazon/` | Klient, mapper, typy Amazon |
| `src/integrations/allegro/` | Klient, mapper, typy Allegro |
| `src/integrations/ebay/` | Klient, mapper, typy eBay |
| `src/integrations/smart-importer.ts` | Pipeline 3-agentowy (ręczny import) |
| `src/app/api/admin-import/` | Endpointy REST API importu |
| `src/app/admin/deals-import/actions.ts` | Server Actions (Admin UI) |
| `src/lib/data.ts` | Wszystkie zapytania Firestore (getHotDeals, getDealsForCategory, ...) |
| `firestore.rules` | Reguły dostępu Firestore |
| `firestore.indexes.json` | Indeksy złożone Firestore |
