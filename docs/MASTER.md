# OkazjePlus — Master Documentation (Single Source of Truth)

> **Wersja:** M6.1 | **Aktualizacja:** 2026-03 | **Status:** Produkcja  
> **Stack:** Next.js 15 · Firebase/GCloud · Vertex AI Genkit · Typesense  
> **Model przychodów:** Afiliacja (AliExpress, Convertiser) — prowizja od kliknięcia i zakupu

---

## 📋 Spis treści

1. [Wizja i model przychodów](#1-wizja-i-model-przychodów)
2. [Architektura systemu (M6)](#2-architektura-systemu-m6)
3. [Model danych — Firestore](#3-model-danych--firestore)
4. [Pipeline importu — Harvester](#4-pipeline-importu--harvester)
5. [AI Enrichment — Refiner](#5-ai-enrichment--refiner)
6. [Social Commerce — Poczekalnia](#6-social-commerce--poczekalnia)
7. [Wyszukiwarka — Typesense](#7-wyszukiwarka--typesense)
8. [SEO — Rich Results & JSON-LD](#8-seo--rich-results--json-ld)
9. [Integracje API źródeł](#9-integracje-api-źródeł)
10. [UX — Mobile-First Standards](#10-ux--mobile-first-standards)
11. [Firebase / GCloud — Infrastruktura](#11-firebase--gcloud--infrastruktura)
12. [Środowisko i zmienne](#12-środowisko-i-zmienne)
13. [Komendy deweloperskie](#13-komendy-deweloperskie)
14. [Roadmap 2026 — Priorytety](#14-roadmap-2026--priorytety)
15. [Przestarzałe funkcje — do usunięcia](#15-przestarzałe-funkcje--do-usunięcia)

---

## 1. Wizja i model przychodów

### Czym jest OkazjePlus?

OkazjePlus to **Social Commerce Marketplace** w stylu Ceneo/HotDeals. Łączymy masowe pobieranie ofert z API afiliantów (AliExpress, Convertiser) z moderacją społecznościową, AI enrichment i silnym SEO.

### Jak zarabiamy (Revenue Model)

| Kanał | Mechanizm | Status |
|-------|-----------|--------|
| **AliExpress Affiliate** | CPS (prowizja od zakupu) via `affiliateLink` w Deal | ⚠️ Klucze API do aktywacji |
| **Convertiser** | CPC/CPS z sieci sklepów PL | ✅ Aktywny |
| **Amazon Associates** | CPS od poleceń do Amazon | 🔜 Pending |
| **Allegro Partner** | CPS od zakupów Allegro | 🔜 Pending |
| **Premium Konta** | Wyróżnianie ofert, "Seller Account" | 💡 Roadmap |

### Funkcje kluczowe dla monetyzacji (MUST HAVE)

1. **Affiliate links** — każdy Deal musi mieć prawidłowy `affiliateLink` z tagiem śledzącym
2. **Poczekalnia (Social Discovery)** — użytkownicy wracają codziennie, by głosować → więcej kliknięć w linki
3. **SEO / Rich Results** — organiczny ruch z Google → więcej użytkowników → więcej kliknięć afiliantów
4. **Typesense Search** — szybkie wyszukiwanie → użytkownik szybciej znajduje produkt → wyższy CTR
5. **Price History (Omnibus)** — legalne wymaganie + buduje zaufanie → wyższy CTR

### Funkcje opcjonalne (NICE TO HAVE dla skalowania)

- Forum / komentarze do produktów (engagement)
- Powiadomienia o obniżkach cen (retention)
- Grywalizacja (reputacja, odznaki)
- Haptic Feedback / Swipe na mobile

---

## 2. Architektura systemu (M6)

### Diagram ogólny

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ŹRÓDŁA DANYCH                               │
│  AliExpress API    Convertiser XML/JSON    Amazon    Allegro (todo)  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Bulk Fetch (Firehose)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    HARVESTER (src/lib/automation/harvester.ts)       │
│  1. Fetch → 2. Sieve (JSON) → 3. Dedupe → 4. writeBatch() → Firestore│
└───────────────────────────────┬─────────────────────────────────────┘
                                │ async
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              AI REFINER (src/lib/automation/refiner.ts)             │
│  Product Refiner: coreSpecs + 6-lang descriptions                   │
│  Deal Refiner:    sellingPoints + offerSummary (6 języków)          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FIRESTORE (baza główna)                           │
│  product_cores · deals · identity_matches · harvester_jobs · votes  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ sync (Cloud Function trigger)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TYPESENSE (wyszukiwarka)                          │
│  Indeksuje: title, description, price, status, temperature          │
│  Filter: status:='approved' | status:='pending'                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NEXT.JS 15 FRONTEND (Firebase App Hosting)             │
│  Główna (approved, hot) · Poczekalnia (pending) · Produkt · Szukaj  │
│  SEO: JSON-LD Product schema · BreadcrumbList · AggregateOffer      │
└─────────────────────────────────────────────────────────────────────┘
```

### Kluczowe zasady architektury

- **Product-Centric:** `ProductCore` (katalog) jest niezmienialny. `Deal` (oferta) jest mutowalny.
- **Bulk Fetch, Local Filter:** Pobieramy masowo z API, odrzucamy lokalnie przez `category-tree-seo-extended.json`.
- **Crowdsourced Moderation:** Oferty wchodzą do "Poczekalni" (`pending`), użytkownicy głosują, próg +15 = `approved` → Strona Główna.
- **AI Async:** Enrichment (specs, opisy, tłumaczenia) działa asynchronicznie po imporcie, nie blokuje pipeline'u.
- **Status budżetu zapytań:** Typesense = 95% ruchu browse, Firestore = zapytania mutacyjne.

---

## 3. Model danych — Firestore

### 3.1 Kolekcja `product_cores` — ProductCore

> **Charakter:** Niemutowalny opis produktu (Master Catalog). Tworzony tylko przez Harvester.

```typescript
// src/lib/types.ts
interface ProductCore {
  id: string;
  identityHash: string;              // SHA-256(titleHash + imageHash) — klucz deduplicacji

  // === TREŚĆ (6 JĘZYKÓW: pl, en, de, fr, es, uk) ===
  title: LocalizedText;              // { pl: "", en: "", de: "", fr: "", es: "", uk: "" }
  shortDescription: LocalizedText;
  fullDescription: LocalizedText;

  // === SPECYFIKACJE (wypełniane przez AI Refiner) ===
  coreSpecs: Record<string, string>; // Ustrukturyzowane: { ram: "16GB", gpu: "RTX 4080" }
  rawSpecs: Record<string, string>;  // Surowe z API

  // === TAKSONOMIA (z category-tree-seo-extended.json) ===
  mainCategorySlug: string;          // L1: np. "electronics-it"
  subCategorySlug: string;           // L2: np. "smartphones-accessories"
  subSubCategorySlug: string;        // L3: np. "smartphones"

  // === MEDIA ===
  imageUrl?: string;
  images: string[];

  // === OCENY ===
  rating: { score: number; count: number; provider: string };

  // === SEO ===
  searchTags: string[];              // Tagi do Typesense + seoKeywords z JSON

  // === RELACJE DEAL ===
  bestPrice: { amount: number; currency: string };
  bestTotalPrice: number;
  linkedDealIds: string[];
  bestDealId?: string;

  // === METADANE ===
  status: 'pending_approval' | 'approved' | 'rejected' | 'uncategorized';
  qualityScore: number;              // 0-100 (oblicza Refiner)
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Kolekcja `deals` — Deal (DealM6)

> **Charakter:** Mutable oferta cenowa z konkretnego sklepu. Zbiera głosy i komentarze.

```typescript
// src/lib/types.ts
interface DealM6 {
  id: string;
  productId: string;               // FK → product_cores

  // === CENA ===
  price: { amount: number; currency: string };
  shippingCost: number;
  totalPrice: number;              // price + shippingCost
  lowestPriceIn30Days?: number;    // Omnibus Directive compliance

  // === ŹRÓDŁO ===
  source: 'aliexpress' | 'convertiser' | 'amazon' | 'allegro';
  affiliateLink: string;           // ← GENERUJE PRZYCHÓD
  dealUrl?: string;
  sourceProductId: string;

  // === AI ENRICHMENT (6 JĘZYKÓW) ===
  metadata?: {
    sellingPoints?: {
      pl: string[]; en: string[]; de: string[]; fr: string[]; es: string[]; uk: string[];
    };
    offerSummary?: {
      pl: string; en: string; de: string; fr: string; es: string; uk: string;
    };
  };

  // === GŁOSOWANIE (Social Commerce) ===
  upvotes: number;
  downvotes: number;
  score: number;                   // upvotes - downvotes
  temperature: number;             // Time-decay gravity score (do sortowania "Gorące")
  promotedAt?: string;             // Data wejścia na Stronę Główną
  promoters: string[];             // userId[] którzy głosowali podczas Poczekalni

  // === STATUS ===
  // draft → pending → approved → expired/rejected
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';

  createdAt: string;
  updatedAt: string;
}
```

### 3.3 Pozostałe kolekcje

| Kolekcja | Opis | Klucz |
|----------|------|-------|
| `identity_matches` | Mapa `identityHash → productCoreId` dla deduplicacji | `hash` |
| `harvester_jobs` | Stan i logi zadań importu | `jobId` |
| `votes` | `userId_dealId → { value: 1|-1 }` (zapobiega podwójnemu głosowaniu) | `userId_dealId` |
| `categories` | Seedowane z `category-tree-seo-extended.json` | `slug` |
| `notifications` | Powiadomienia in-app dla użytkowników | `userId` |

### 3.4 Algorytm temperatury (Time-Decay Gravity)

```
temperature = (upvotes - downvotes) / (ageInHours + 2)^1.8
```

- `ageInHours` — godziny od `createdAt`
- Gravity `1.8` — im wyższe, tym szybciej stare deale spadają
- Przeliczany przez Cloud Function co 15 minut → synchronizacja do Typesense
- Przechowywany w `deals.temperature` — do sortowania `filter_by: status:='approved', sort_by: temperature:desc`

---

## 4. Pipeline importu — Harvester

> **Plik:** `src/lib/automation/harvester.ts`  
> **Zasada:** Odpytuj ogólnie, filtruj lokalnie. Nie rób 400 zapytań po kategoriach — rób 1 zapytanie o 20 000 produktów.

### Pipeline krok po kroku

```
ETAP 1: FETCH (Firehose)
├── AliExpress: getPromotedProducts / getSuperDeals (bez categoryId)
├── Convertiser: pełny plik XML/CSV (stream)
└── Wynik: tablica ~20 000 surowych obiektów (tylko RAM)

ETAP 2: SIEVE (category-tree-seo-extended.json)
├── CategoryRouter.route(rawTitle) → matchedL3Slug | null
│   ├── Dopasowanie po ID (googleCategoryId, aliexpressCategoryIds)
│   ├── Fallback: importKeywords z każdego węzła L3 (regex/includes)
│   └── Drop: produkt odrzucony jeśli żaden matcher nie pasuje
├── Normaliza do interfejsu RawProduct (title, price, affiliateLink, categorySlug, ...)
└── Wynik: ~2 000–5 000 produktów z przypisanym L3 slug

ETAP 3: DEDUPLIKACJA (identity-matcher.ts)
├── Strong Match: EAN / UPC / GTIN / MPN / SKU z API
├── Soft Match: identityHash = SHA-256(normalizedTitle + imageHash)
│   ├── Hit → istniejący ProductCore → tworzymy tylko nowy Deal
│   └── Miss → tworzymy nowy ProductCore + Deal
└── Równoległe zapytania (Promise.all) do Firestore/Redis

ETAP 4: BATCH WRITE (writeBatch)
├── Zbieramy wszystkie operacje w tablicach (dealsToCreate, productsToCreate, ...)
├── Chunking po 500 operacji (limit Firestore writeBatch)
├── Jeden flush na końcu pętli (nie per-produkt!)
└── batchUpdateProductBestPrices() po zapisie

ETAP 5: AI ENRICHMENT (async, po zapisie)
├── Deal Refiner: sellingPoints + offerSummary (6 języków)
└── Product Refiner: coreSpecs + fullDescription (6 języków)
```

### Interfejs RawProduct (wspólny dla wszystkich źródeł)

```typescript
interface RawProduct {
  // WYMAGANE
  title: string;
  imageUrl: string;
  price: number;
  currency: string;
  shippingCost: number;
  shippingDays: number;
  sourceProductId: string;
  sourceUrl: string;
  affiliateLink: string;           // ← zawsze wymagany (przychód!)

  // TAKSONOMIA (wypełniana przez CategoryRouter)
  matchedL3Slug?: string;          // np. "smartphones"
  matchedL2Slug?: string;          // np. "smartphones-accessories"
  matchedL1Slug?: string;          // np. "electronics-it"
  originalCategoryName?: string;
  googleCategoryId?: number;

  // OPCJONALNE
  description?: string;
  originalPrice?: number;
  merchantName?: string;
  specs?: Record<string, string>;
  discountPercent?: number;
  couponCode?: string;
  rating?: number;

  // IDENTYFIKATORY
  sku?: string; ean?: string; gtin?: string; upc?: string; mpn?: string;
}
```

### Typy zadań (Harvester Jobs)

| Typ | Kiedy | Co robi |
|-----|-------|---------|
| **Global Sync** | Codziennie 02:00 (cron) | Bulk fetch wszystkich feedów, aktualizacja cen, odrzucenie śmieci |
| **Targeted Fill** | Manualnie z panelu admin | Wyszukiwanie po keyword gdy kategoria jest pusta (`search("camping tents")`) |

### Pseudo-kod CategoryRouter

```typescript
import categoryTree from '@/data/category-tree-seo-extended.json';

export function routeProductToCategory(rawTitle: string): string | null {
  const normalized = rawTitle.toLowerCase();
  for (const mainCat of categoryTree.tree) {
    for (const subCat of mainCat.subcategories) {
      for (const leaf of subCat.subcategories) {
        if (leaf.importKeywords?.some(kw => normalized.includes(kw.toLowerCase()))) {
          return leaf.slug; // matchedL3Slug
        }
      }
    }
  }
  return null; // produkt odrzucony — nie trafia do bazy
}
```

---

## 5. AI Enrichment — Refiner

> **Plik:** `src/lib/automation/refiner.ts`  
> **Model:** Vertex AI Gemini 2.0 Flash Exp (`vertexai/gemini-2.0-flash-exp`)  
> **Trigger:** Asynchroniczny po zakończeniu Harvestera

### Product Refiner (Inteligencja Katalogowa)

1. Pobiera `ProductCore` ze statusem `pending_approval`
2. Odczytuje `subSubCategorySlug` → odpytuje JSON o `filterableAttributes` (np. dla `laptops`: `["brand", "ram", "storage", "gpu"]`)
3. Prompt do Gemini: wyodrębnij i znormalizuj dokładnie te atrybuty z surowych danych
4. Generuje `fullDescription` + `shortDescription` w 6 językach (pl, en, de, fr, es, uk)
5. Oblicza `qualityScore` (0-100)
6. Status → `approved`

### Deal Refiner (Inteligencja Sprzedażowa)

1. Pobiera `DealM6` ze statusem `draft`
2. Analizuje warunki oferty (cena, shipping, rabat, sklep)
3. Generuje `sellingPoints` (dlaczego kupić TĘ ofertę a nie inną) w 6 językach
4. Generuje `offerSummary` w 6 językach
5. Status → `pending` (gotowy do głosowania w Poczekalni)

### ⚠️ Znana luka (P0 — do naprawy)

> Runtime audit 2026-03-06: `coreSpecs` wypełnione w `0/10` próbek po świeżym imporcie.  
> Refiner używa `placeholder specs` zamiast AI extraction.  
> Naprawa: `src/lib/automation/refiner.ts:305` — usunąć fallback placeholder, wymusić AI extraction.

---

## 6. Social Commerce — Poczekalnia

### Cykl życia oferty

```
Harvester → status: 'draft'
    ↓ (Deal Refiner)
status: 'pending' (Poczekalnia)
    ↓ (głosowanie społeczności)
score >= +15 → status: 'approved' → Strona Główna
    lub
admin ⚡ "Zatwierdź natychmiast" → +50 punktów → approved
    lub
admin 🗑️ "Usuń" → status: 'rejected'
```

### Głosowanie (Anti-fraud)

```typescript
// src/app/api/deals/[id]/vote/route.ts
export async function voteOnDeal(dealId: string, userId: string, voteType: 1 | -1) {
  await db.runTransaction(async (transaction) => {
    const voteDoc = await transaction.get(voteRef);
    if (voteDoc.exists && voteDoc.data().value === voteType) {
      throw new Error("Już oddałeś taki głos.");
    }
    // Przelicz score
    if (newTotalScore >= AUTO_APPROVE_THRESHOLD && deal.status === 'pending') {
      transaction.update(dealRef, {
        status: 'approved',
        promotedAt: FieldValue.serverTimestamp()
      });
      // Dodaj reputację promoters (+5 pkt każdemu)
    }
  });
}
```

### Wagi głosów (RBAC)

| Rola | Waga głosu |
|------|-----------|
| Zwykły użytkownik | ±1 |
| Zweryfikowany Łowca | ±2 |
| Administrator | ⚡ +50 (natychmiastowy awans) |
| Nowe konto (<24h) | 0.2 (age gating) |

### Anti-fraud

- **Rate Limiting:** Max 50 głosów / IP / minutę
- **Age Gating:** Konta <24h mają wagę 0.2
- **Ghost Banning:** Bot widzi zmianę na ekranie, ale głos nie jest liczony server-side

---

## 7. Wyszukiwarka — Typesense

> **Plik:** `src/lib/search.ts`  
> **Zasada:** Typesense = 95% browse ruchu. Firestore = mutacje i CRUD.

### Schemat kolekcji Typesense

```
Kolekcja: deals_products (joined view)
Pola:
  - id, title (LocalizedText), description (LocalizedText)
  - price, totalPrice, source
  - status: 'pending' | 'approved'
  - temperature (float, przeliczany co 15 min)
  - mainCategorySlug, subCategorySlug, subSubCategorySlug
  - searchTags (string[])
  - createdAt (int64 Unix timestamp)
```

### Kluczowe zapytania

```typescript
// Strona Główna — Hot Deals
{ filter_by: "status:=approved", sort_by: "temperature:desc", per_page: 20 }

// Poczekalnia
{ filter_by: "status:=pending", sort_by: "createdAt:desc", per_page: 50 }

// Kategoria
{ filter_by: "status:=approved AND subSubCategorySlug:=smartphones", sort_by: "temperature:desc" }

// Wyszukiwanie
{ q: "iphone 15", filter_by: "status:=approved", sort_by: "_text_match:desc,temperature:desc" }
```

### ⚠️ Znana luka

> `src/lib/ingestion/pipeline.ts:295` — TODO dla indexing hook po imporcie.  
> `src/lib/typesense-indexing.ts` — niezakończona implementacja.  
> Naprawa: domknąć synchronizację w pipeline, usunąć TODO.

---

## 8. SEO — Rich Results & JSON-LD

> **Pliki:** `src/lib/json-ld-generators.ts`, `src/app/[locale]/products/[id]/page.tsx`

### Wdrożone schematy

| Schema | Strona | Status |
|--------|--------|--------|
| `Product` + `AggregateOffer` | Strona produktu `/products/[id]` | ✅ |
| `BreadcrumbList` | Strona produktu + kategoria | ✅ |
| `AggregateRating` | Strona produktu (gdy `rating.count > 0`) | ✅ |
| `FAQPage` | Opcjonalnie (TODO dla kategorii) | 🔜 |
| `Organization` | Globalne (`layout.tsx`) | ✅ |

### Generowanie JSON-LD

```typescript
// src/lib/json-ld-generators.ts
export function generateProductSchema(product: ProductCore, deals: DealM6[], locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `https://okazjeplus.pl/${locale}/products/${product.id}`,
    "name": product.title[locale] ?? product.title.pl,
    "image": product.images,
    "description": product.shortDescription[locale] ?? product.shortDescription.pl,
    "brand": { "@type": "Brand", "name": product.coreSpecs.brand ?? "Unknown" },
    "aggregateRating": product.rating.count > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": product.rating.score,
      "reviewCount": product.rating.count
    } : undefined,
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": product.bestPrice.amount,
      "highPrice": Math.max(...deals.map(d => d.totalPrice)),
      "priceCurrency": "PLN",
      "availability": "https://schema.org/InStock",
      "offerCount": deals.length,
      "offers": deals.map(d => ({
        "@type": "Offer",
        "price": d.price.amount,
        "priceCurrency": d.price.currency,
        "url": d.affiliateLink, // ← URL afiliancki = przychód
        "seller": { "@type": "Organization", "name": d.source }
      }))
    }
  };
}
```

### SEO checklist

- [x] JSON-LD Product schema na stronach produktów
- [x] BreadcrumbList (L1 → L2 → L3 → Produkt)
- [x] `<title>` i `<meta description>` generowane dynamicznie z `translations.[locale].metaTemplate`
- [x] `canonical` URL per locale
- [x] `hreflang` dla 6 języków
- [ ] Sitemap XML generowany dynamicznie (TODO — ważne dla SEO!)
- [ ] FAQ schema dla stron kategorii (TODO)
- [ ] Robots.txt wyklucza `/api/*`, `/admin/*`

### Weryfikacja

```bash
# Google Rich Results Test
https://search.google.com/test/rich-results?url=https://okazjeplus.pl/pl/products/[ID]

# Schema.org Validator
https://validator.schema.org/

# Lokalnie
curl -s http://localhost:9002/pl/products/[ID] | grep -o '<script type="application/ld+json">.*</script>'
```

---

## 9. Integracje API źródeł

### 9.1 AliExpress Affiliate API

> **Dokumentacja:** https://portals.aliexpress.com/doc  
> **Endpoint:** `https://openapi.aliexpress.com/gateway.do`  
> **Auth:** HMAC-MD5 signature (APP_KEY + APP_SECRET + timestamp + params)

#### Konfiguracja (Google Cloud Secrets)

| Secret | Opis |
|--------|------|
| `ALIEXPRESS_APP_KEY` | Klucz aplikacji (np. `526032`) |
| `ALIEXPRESS_APP_SECRET` | Sekret aplikacji |
| `ALIEXPRESS_AFFILIATE_ID` | ID konta afiliantów |
| `ALIEXPRESS_TRACKING_ID` | Tracking tag dla linków |
| `ALIEXPRESS_REGION` | `eu` dla EU traffic |
| `ALIEXPRESS_API_ENDPOINT` | `https://openapi.aliexpress.com/gateway.do` |

#### Status (2026-01-30)

> ⚠️ **KLUCZE NIEAKTYWNE** — API zwraca 404 HTML zamiast JSON.  
> Kod jest poprawny (signature, endpoint, tracking_id obsługiwane).  
> Działanie: Aktywować aplikację "Okazje Plus" w AliExpress Developer Console → `https://open.aliexpress.com/`

#### Kluczowe endpointy

```
aliexpress.affiliate.product.query       → wyszukiwanie produktów (bulk)
aliexpress.affiliate.hotproduct.query    → gorące oferty (do Global Sync)
aliexpress.affiliate.link.generate       → generowanie linków afiliantów
aliexpress.affiliate.order.list.query    → raport prowizji
```

#### Przykład wywołania (TypeScript)

```typescript
// src/integrations/aliexpress/client.ts
const response = await aliexpressClient.call('aliexpress.affiliate.hotproduct.query', {
  fields: 'product_id,product_title,target_sale_price,affiliate_link,image_url,evaluate_rate',
  page_no: 1,
  page_size: 50,
  tracking_id: process.env.ALIEXPRESS_TRACKING_ID,
});
```

### 9.2 Convertiser

> **Charakter:** Sieć sklepów PL (XML/JSON feed)  
> **Status:** ✅ Aktywny i zweryfikowany runtime

- Feed XML pobierany strumieniowo (nie ładujemy całości do RAM)
- `googleCategoryId` dostępny w feedzie → bezpośrednie mapowanie na drzewo kategorii
- Affiliate link generowany przez Convertiser API

### 9.3 Amazon Associates (Pending)

> Wymaga rejestracji w Amazon Associates PL/DE.  
> Mapowanie produktów przez ASIN.

### 9.4 Allegro Partner (Pending)

> REST API Allegro + OAuth 2.0.  
> Produkty z kategoriami w formacie Allegro → mapowanie na nasze L3 slugs.

---

## 10. UX — Mobile-First Standards

### Breakpointy (Tailwind CSS)

| Rozmiar | Zakres | Zachowanie |
|---------|--------|-----------|
| DEFAULT | 0–639px | 1 kolumna, Bottom Tab Bar, ukryte sidebary |
| `sm` | 640–767px | Rozszerzone karty |
| `md` | 768–1023px | 2 kolumny, Offcanvas filtrów |
| `lg` | 1024–1279px | 3 kolumny, stały sidebar |
| `xl`/`2xl` | 1280px+ | 4 kolumny, max-w-7xl |

### Nawigacja mobilna (Bottom Tab Bar)

```
[🏠 Główna] [⏳ Poczekalnia] [➕ Dodaj Deal] [❤️ Ulubione] [👤 Profil]
```

Dostępna tylko na mobile (poniżej 768px). Na desktop: tradycyjna Navbar górna.

### Karta Deal — Shape-Shifting UI

**Mobile (kompaktowa lista):**
```
[📷 96px] [Tytuł + Cena bold]  [▲ +12 ▼]
                                ← kontroler głosowania po prawej
```
Cel: 4–5 dealów widocznych na ekranie bez scrollowania.

**Desktop (grid/kafelki):**
```
┌──────────────┐
│  Duże zdjęcie│
│  Kategoria   │
│  Tytuł       │
│  Cena        │
│ [▲ +12 ▼] [Kup]│
└──────────────┘
```

### Touch & Performance standards

- **Touch target:** min 44×44px (Apple) / 48×48px (Google)
- **Optimistic UI:** kliknięcie `+1` zmienia licznik natychmiast (Firebase w tle), rollback na błąd
- **Haptic Feedback:** `navigator.vibrate([50])` na oddanie głosu (Android)
- **Swipe gestures:** Swipe prawo = +1, Swipe lewo = -1 (Poczekalnia mobile)
- **Virtualizacja:** `@tanstack/react-virtual` w listach Poczekalni (nie renderuj 500 kart w DOM)
- **CLS prevention:** Karty z `aspect-square` + Skeleton shimmer przed załadowaniem zdjęcia

### Core Web Vitals (cele produkcyjne)

| Metryka | Cel | Obecny stan |
|---------|-----|-------------|
| LCP | < 2.0s | 3.2s (do naprawy) |
| FCP | < 1.8s | 2.5s (do naprawy) |
| CLS | < 0.1 | 0.18 (do naprawy) |
| Lighthouse | 90+ | 62 (do naprawy) |

**Rozwiązania:**
1. `React.memo` na `DealCard` (−40% re-renders)
2. Konsolidacja `useState` (20+ → 1 obiekt)
3. `react-window` / `@tanstack/react-virtual` dla list
4. Smart polling (pauza gdy tab nieaktywny)

---

## 11. Firebase / GCloud — Infrastruktura

### Komponenty

| Komponent | Użycie |
|-----------|--------|
| **Firebase App Hosting** | Hosting Next.js (europe-west1) |
| **Cloud Firestore** | Główna baza danych (NoSQL) |
| **Firebase Auth** | Uwierzytelnianie użytkowników |
| **Firebase Storage** | Obrazy produktów (+ Image Proxy WebP) |
| **Cloud Functions** | Triggery (vote → promote, notifications) + scheduled jobs |
| **Google Cloud Secret Manager** | Sekrety API (AliExpress, SendGrid, etc.) |
| **Vertex AI** | Gemini 2.0 Flash Exp (enrichment) |
| **Typesense** | Self-hosted / Cloud (wyszukiwarka) |

### Cloud Functions (okazje-plus/)

| Funkcja | Trigger | Opis |
|---------|---------|------|
| `onDealVote` | Firestore write `deals/{id}` | Przelicza score, auto-promotes jeśli ≥15 |
| `recalculateTemperature` | Cron co 15 min | Przelicza `temperature` dla aktywnych dealów |
| `notifyOnDealCommentReply` | Firestore write `comments` | Powiadomienie in-app + email |
| `globalSync` | Cron 02:00 | Uruchamia Harvester (Global Sync) |
| `syncToTypesense` | Firestore write `deals`, `product_cores` | Synchronizuje zmiany do Typesense |

### Firestore Indexes (`firestore.indexes.json`)

Wymagane composite indexes (najważniejsze):

```json
{ "collectionGroup": "deals", "fields": [
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "temperature", "order": "DESCENDING" }
]},
{ "collectionGroup": "deals", "fields": [
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "subSubCategorySlug", "order": "ASCENDING" },
  { "fieldPath": "temperature", "order": "DESCENDING" }
]}
```

### Auth (dual Firebase config)

- **Server:** `FIREBASE_WEBAPP_CONFIG` (App Hosting runtime) → `src/lib/auth-server.ts`
- **Client:** `NEXT_PUBLIC_FIREBASE_*` (embedded at build time) → `src/lib/auth.tsx`
- **Admin check:** `requireAdmin()` w server actions, `session.role === 'admin'` w API routes
- **Role:** `admin`, `moderator`, `user` (defined in `firestore.rules`)

### Deployment

```bash
npm run deploy:hosting   # Next.js → Firebase App Hosting
npm run deploy:functions # Cloud Functions tylko
npm run deploy:prod      # Pełny deploy (hosting + functions)
```

---

## 12. Środowisko i zmienne

### Wymagane (`.env.local`)

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# AI (local dev)
GEMINI_API_KEY=AIza...
```

### Opcjonalne (graceful degradation)

```bash
# AliExpress Affiliate
ALIEXPRESS_APP_KEY=526032
ALIEXPRESS_APP_SECRET=xxx
ALIEXPRESS_AFFILIATE_ID=xxx
ALIEXPRESS_TRACKING_ID=xxx
ALIEXPRESS_REGION=eu

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@okazjeplus.pl

# Typesense
NEXT_PUBLIC_TYPESENSE_HOST=xxx
TYPESENSE_API_KEY=xxx

# Cache (fallback: in-memory LRU max:500 TTL:1h)
REDIS_URL=redis://...

# Convertiser
CONVERTISER_API_KEY=xxx
```

### Google Cloud Secrets (production)

Wszystkie powyższe sekrety są przechowywane w Google Cloud Secret Manager i montowane przez `apphosting.yaml` w Cloud Run runtime.

---

## 13. Komendy deweloperskie

```bash
# Development
npm run dev              # Next.js na porcie 9002 (Turbopack)
npm run genkit:dev       # Genkit UI na porcie 4000 (testowanie AI flows)
npm run genkit:watch     # Genkit z hot reload

# Jakość kodu
npm run typecheck        # TypeScript strict mode
npm run lint             # ESLint (--fix dla autocorrect)
npm run build            # Production build (TS + next build)

# Dane
npm run seed:categories  # Seeduje drzewo kategorii do Firestore

# Deploy
npm run deploy:hosting   # Firebase App Hosting
npm run deploy:functions # Cloud Functions
npm run deploy:prod      # Pełny deploy

# Testy systemowe (Admin UI)
# Panel Admin → zakładka "Testy" → "Uruchom Testy"
# lub: POST /api/admin/tests/run (z tokenem admina)
```

---

## 14. Roadmap 2026 — Priorytety

### 🔴 P0 — Krytyczne (blokują monetyzację)

#### P0.1 — Aktywacja AliExpress API
- **Problem:** Klucze API nieaktywne (404 HTML zamiast JSON)
- **Działanie:** Aktywować "Okazje Plus" w https://open.aliexpress.com/
- **Impact:** Odblokowuje główne źródło produktów

#### P0.2 — Naprawa coreSpecs w Refiner
- **Problem:** `coreSpecs` = 0/10 po świeżym imporcie (placeholder zamiast AI)
- **Plik:** `src/lib/automation/refiner.ts:305`
- **Działanie:** Usunąć fallback placeholder, wymusić AI extraction
- **Impact:** Produkty bez specs nie kwalifikują się do Rich Results w Google

#### P0.3 — Harvester writeBatch() (10-15× speedup)
- **Problem:** Sekwencyjne zapisy → 100 produktów = 8–12 minut
- **Plik:** `src/lib/automation/harvester.ts`
- **Działanie:** Zbierać operacje w tablicach, jednorazowy `writeBatch()` po pętli
- **Impact:** 100 produktów w <1 minutę

### 🟡 P1 — Ważne (skalowanie i SEO)

#### P1.1 — Domknięcie Typesense indexing
- **Problem:** `pipeline.ts:295` ma TODO dla indexing hook
- **Działanie:** Zakończyć `src/lib/typesense-indexing.ts`, usunąć TODO
- **Impact:** Wyszukiwarka działa tylko przy ręcznej synchronizacji

#### P1.2 — Sitemap XML
- **Problem:** Brak dynamicznego sitemap
- **Działanie:** `src/app/sitemap.ts` generujący URLs dla wszystkich produktów/kategorii
- **Impact:** Szybsze indeksowanie przez Google (+20–30% impressions)

#### P1.3 — Performance (Core Web Vitals)
- **Problem:** Lighthouse 62, LCP 3.2s
- **Działanie:** React.memo na DealCard, konsolidacja useState, @tanstack/react-virtual
- **Impact:** Lighthouse 90+, +8–12% konwersja (1% wolniej = 1% mniej konwersji)

### 🟢 P2 — Nice to have (engagement i retencja)

#### P2.1 — Price Alerts (powiadomienia o obniżkach)
- SendGrid email + in-app notification gdy cena spada o X%
- Buduje retention, użytkownicy wracają

#### P2.2 — Amazon Associates Integration
- Dodatkowe źródło produktów + dywersyfikacja przychodów

#### P2.3 — Grywalizacja (Reputacja)
- +5 pkt za każde „Odkrycie" (deal z Poczekalni wchodzi na Główną przez głos użytkownika)
- Buduje zaangażowanie power-userów

#### P2.4 — Mobile UX (haptic, swipe, virtualizacja)
- Haptic `navigator.vibrate([50])` na głosowanie
- Swipe gestures w Poczekalni
- `@tanstack/react-virtual` dla list 500+ dealów

---

## 15. Przestarzałe funkcje — do usunięcia

### Dokumenty zduplikowane (zastąpione przez ten plik)

Następujące pliki są teraz zastąpione przez `docs/MASTER.md` i mogą być archiwizowane:

| Plik | Zastąpiony przez |
|------|-----------------|
| `docs/IMPORT_SOURCE_OF_TRUTH.md` | Sekcja 3, 4, 9 tego dokumentu |
| `docs/final/Zaktualizowany Source of Truth.txt` | Sekcja 3 |
| `docs/final/Architektura M6 Master.txt` | Sekcja 2 |
| `docs/final/Architektura Harvestera M6.txt` | Sekcja 4 |
| `docs/final/Architektura Poczekalni*.txt` | Sekcja 6 |
| `docs/final/Standardy i Architektura Poczekalni.txt` | Sekcja 10 |
| `ALIEXPRESS_STATUS.md`, `ALIEXPRESS_STATUS_FINAL.md` | Sekcja 9.1 |
| `ALIEXPRESS_TOKEN_TEST_REPORT.md` | Sekcja 9.1 |
| `ALIEXPRESS_API_TEST_REPORT.md`, `ALIEXPRESS_API_TEST_RESULTS.md` | Sekcja 9.1 |
| `RICH_RESULTS_VALIDATION.md` | Sekcja 8 |
| `UI_OPTIMIZATION_EXECUTIVE_SUMMARY.md` | Sekcja 10, 14 |
| `M6_IMPROVEMENTS_PLAN.md` | Sekcja 14 |
| `docs/final/M6_FINAL_COMPLIANCE_AUDIT_2026-03-06.md` | Sekcja 2 + status w Sekcji 14 |
| `DEPLOYMENT_CHECKLIST.md`, `DEPLOY_ACTION_GUIDE.md` | Sekcja 11, 13 |

### Funkcje do wyłączenia / usunięcia

| Funkcja | Powód | Działanie |
|---------|-------|-----------|
| Stare testy Jest/Playwright | Usunięte w Jan 2026 cleanup | Folder `legacy/` — nie commitować |
| `legacy/debug-scripts/` | Debug-only, nie produkcja | Zachować lokalnie, nie deployować |
| Forum standalone | Niski priorytet vs afilianty | Wstrzymać development |
| Forum embed (`@deal:id`) | Przydatny, ale niski ROI | Zachować, nie rozwijać |
| `docs/final/*.docx` | Binarne, duże pliki w repo | Rozważyć usunięcie z git history |

---

## 📎 Szybkie linki

| Zasób | URL / Ścieżka |
|-------|--------------|
| Kod modelu danych | `src/lib/types.ts` |
| Harvester | `src/lib/automation/harvester.ts` |
| Refiner | `src/lib/automation/refiner.ts` |
| Data layer | `src/lib/data/` (deals.ts, products.ts, etc.) |
| Wyszukiwarka | `src/lib/search.ts` |
| JSON-LD | `src/lib/json-ld-generators.ts` |
| Kategorie JSON | `src/data/category-tree-seo-extended.json` |
| Firestore rules | `firestore.rules` |
| Firestore indexes | `firestore.indexes.json` |
| Cloud Functions | `okazje-plus/src/index.ts` |
| i18n messages | `messages/pl/`, `messages/en/`, `messages/de/` |
| AliExpress Console | https://open.aliexpress.com/ |
| Google Search Console | https://search.google.com/search-console |
| Firebase Console | https://console.firebase.google.com/ |
| Vertex AI | https://console.cloud.google.com/vertex-ai |

---

*Ostatnia aktualizacja: 2026-03-10 — wygenerowano automatycznie przez konsolidację dokumentacji projektu.*
