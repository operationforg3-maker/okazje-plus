# System Importu Okazji - Dokumentacja

## Przegląd

System importu okazji umożliwia masowe dodawanie okazji z różnych źródeł, z pełną integracją AI do automatycznej kategoryzacji i linkowania produktów.

## Funkcje

### 1. **Rozszerzone Parametry Okazji**

Typ `Deal` został rozszerzony o następujące pola (zgodne z Pepper.pl, MyDealz):

#### Podstawowe
- `dealType`: Typ okazji - `sale`, `coupon`, `freebie`, `pricing-error`, `cashback`, `bundle`
- `couponCode`: Kod rabatowy (dla typu `coupon`)
- `freeShipping`: Czy dostawa darmowa (boolean)
- `expiryDate`: Data wygaśnięcia okazji (ISO string)

#### Warunki i Limity
- `minOrderValue`: Minimalna wartość zamówienia
- `stockAlert`: Alert o dostępności - `limited`, `low`, `ending-soon`
- `availableQuantity`: Liczba dostępnych sztuk
- `limitPerUser`: Limit na użytkownika
- `requiresMembership`: Wymagane członkostwo (np. "Amazon Prime")
- `conditions`: Dodatkowe warunki (string[])

#### Cashback
- `cashback`: Obiekt z polami:
  - `amount`: Kwota w PLN
  - `percentage`: Procent zwrotu
  - `provider`: Dostawca cashbacku

#### Galeria i Tagi
- `gallery`: Dodatkowe zdjęcia (URL[])
- `tags`: Tagi dla wyszukiwania (string[])

#### Weryfikacja
- `verified`: Czy zweryfikowana przez moderatora
- `verifiedAt`: Data weryfikacji
- `verifiedBy`: UID moderatora

#### AI Quality Score
- `aiQuality`: Obiekt z oceną jakości:
  - `score`: 0-100
  - `recommendation`: `approve`, `review`, `reject`
  - `reasoning`: Uzasadnienie
  - `factors`: Szczegółowe czynniki oceny

#### Import Metadata
- `importMetadata`: Metadane importu:
  - `source`: Źródło
  - `importedAt`: Data importu
  - `originalUrl`: Oryginalny URL
  - `scrapedData`: Zescrapowane dane

---

## 2. **AI Flow: Linkowanie Okazja → Produkt**

**Plik**: `src/ai/flows/deals/aiLinkDealToProduct.ts`

### Funkcja
Automatycznie dopasowuje okazję do produktów w bazie na podstawie:
- Tytułu okazji
- Opisu
- URL (może zawierać nazwę produktu)
- Ceny (podobieństwo ±30%)
- Kategorii

### Input
```typescript
{
  dealTitle: string;
  dealDescription?: string;
  dealUrl?: string;
  dealPrice?: number;
  dealMerchant?: string;
  availableProducts: Array<{
    id: string;
    name: string;
    price: number;
    mainCategorySlug: string;
    subCategorySlug: string;
    subSubCategorySlug?: string;
  }>;
}
```

### Output
```typescript
{
  matches: Array<{
    productId: string;
    productName: string;
    matchScore: number; // 0-100
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    matchFactors: {
      titleSimilarity: number;
      priceSimilarity: number;
      categorySimilarity: number;
      urlSimilarity?: number;
    };
  }>;
  recommendation: 'auto-link' | 'review' | 'no-match';
  summary: string;
}
```

### Kryteria Rekomendacji
- **auto-link**: matchScore ≥ 85 + confidence = 'high'
- **review**: matchScore 60-84 LUB confidence = 'medium'
- **no-match**: matchScore < 60

---

## 3. **Backend API: POST /api/admin/deals/import**

**Plik**: `src/app/api/admin/deals/import/route.ts`

### Autoryzacja
Wymaga tokena Bearer z uprawnieniami admin/moderator.

### Request Body
```json
{
  "deals": [
    {
      "title": "string (min 5 znaków)",
      "description": "string (min 10 znaków)",
      "price": number (positive),
      "originalPrice": number (optional),
      "link": "URL",
      "image": "URL",
      "merchant": "string (optional)",
      "shippingCost": number (optional),
      
      // Rozszerzone parametry
      "dealType": "sale|coupon|freebie|pricing-error|cashback|bundle",
      "couponCode": "string (optional)",
      "freeShipping": boolean,
      "cashback": { "amount": 10, "percentage": 5, "provider": "LetyShops" },
      "minOrderValue": number,
      "stockAlert": "limited|low|ending-soon",
      "expiryDate": "ISO date string",
      "availableQuantity": number,
      "limitPerUser": number,
      "requiresMembership": "string",
      "conditions": ["string"],
      "gallery": ["URL"],
      "tags": ["string"],
      
      // Opcjonalne ręczne kategorie (jeśli nie podane, AI ustali)
      "mainCategorySlug": "elektronika",
      "subCategorySlug": "smartfony",
      "subSubCategorySlug": "case-i-etui",
      
      // Źródło importu
      "source": "manual|csv|pepper|mydealz|reddit|other"
    }
  ],
  "autoCategorize": true,
  "autoLinkProducts": true
}
```

### Response
```json
{
  "success": true,
  "message": "Zaimportowano 5/5 okazji",
  "imported": 5,
  "failed": 0,
  "results": [
    {
      "success": true,
      "dealId": "abc123",
      "title": "Apple AirPods Pro 2",
      "categories": {
        "main": "elektronika",
        "sub": "audio",
        "subSub": "sluchawki"
      },
      "linkedProducts": [
        {
          "id": "prod456",
          "name": "Apple AirPods Pro 2",
          "score": 95
        }
      ]
    }
  ]
}
```

### Proces Importu
1. **Walidacja** - Zod schema dla każdej okazji
2. **AI Kategoryzacja** - Jeśli `autoCategorize=true` i brak ręcznych kategorii
3. **AI Linkowanie** - Jeśli `autoLinkProducts=true`:
   - Pobiera produkty z podobnej kategorii (max 50)
   - Wywołuje `aiLinkDealToProduct` flow
   - Auto-linkuje tylko dla `high` confidence + score ≥ 85
4. **Zapis do Firestore** - Tworzy dokument w kolekcji `deals`
5. **Update Produktów** - Dodaje `dealId` do `linkedDealIds` powiązanych produktów

---

## 4. **Frontend Panel: /admin/deals-import**

**Plik**: `src/app/[locale]/admin/deals-import/page.tsx`

### Zakładki

#### **Bulk Creation**
Ręczne dodawanie wielu okazji przez formularz.

**Pola formularza**:
- Tytuł*, Opis*, Cena*, Cena oryginalna
- Link*, URL zdjęcia*
- Sklep/Merchant
- Typ okazji (sale/coupon/freebie/pricing-error/cashback/bundle)
- Kod rabatowy (dla typu `coupon`)
- Koszt wysyłki, Data wygaśnięcia
- Checkbox: Darmowa wysyłka

#### **Import CSV**
Upload pliku CSV z okazjami.

**Wymagane kolumny**: `title`, `description`, `price`, `link`, `image`

**Opcjonalne**: `originalPrice`, `merchant`, `shippingCost`, `dealType`, `couponCode`, `freeShipping`, `expiryDate`

#### **Import z URL**
Scraping pojedynczej okazji z URL (funkcja w przyszłości).

### Opcje AI
- ☑️ **Auto-kategoryzacja** - AI automatycznie przypisuje 3-poziomową kategorię
- ☑️ **Auto-linkowanie produktów** - AI wyszukuje i linkuje pasujące produkty

### Wyniki Importu
Po imporcie wyświetlane są:
- Status każdej okazji (✅ sukces / ❌ błąd)
- ID wygenerowanej okazji
- Przypisane kategorie (3 poziomy)
- Połączone produkty z % dopasowania

---

## 5. **Nawigacja**

Link do panelu importu dodany w sidebar admina:
- **Ikona**: 🔥 Flame (pomarańczowy gradient)
- **Ścieżka**: `/admin/deals-import`
- **Wymóg**: Autoryzacja admin (withAuth HOC)

---

## Przykłady Użycia

### Przykład 1: Import CSV

**Plik `okazje.csv`**:
```csv
title,description,price,originalPrice,link,image,merchant,dealType,freeShipping
"Apple AirPods Pro 2","Świetna cena na słuchawki",899,1299,https://amazon.pl/...,https://img.png,Amazon.pl,sale,true
"Kod 20% Nike","Kod rabatowy na buty",0,0,https://nike.com,https://nike.jpg,Nike,coupon,false
```

1. Wejdź na `/admin/deals-import`
2. Zakładka "Import CSV"
3. Wybierz plik `okazje.csv`
4. Zaznacz opcje AI (auto-kategoryzacja + linkowanie)
5. Kliknij "Importuj CSV"

**Rezultat**: 
- Okazja #1: Sklasyfikowana jako `elektronika/audio/sluchawki`, połączona z produktem "AirPods Pro 2"
- Okazja #2: Sklasyfikowana jako `moda/obuwie/buty-sportowe`, kod: `SAVE20`

### Przykład 2: Bulk Creation

1. Wypełnij formularz dla pierwszej okazji
2. Kliknij "Dodaj kolejną okazję"
3. Wypełnij drugą okazję
4. Kliknij "Importuj okazje (2)"

### Przykład 3: Programatyczny Import (API)

```typescript
const token = await auth.currentUser?.getIdToken();

const response = await fetch('/api/admin/deals/import', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deals: [
      {
        title: "iPhone 15 Pro - rekordowo niska cena!",
        description: "Najnowszy iPhone w super promocji",
        price: 4999,
        originalPrice: 5999,
        link: "https://mediaexpert.pl/...",
        image: "https://img.png",
        merchant: "Media Expert",
        dealType: "sale",
        freeShipping: true,
        expiryDate: "2025-11-30T23:59:59Z",
        tags: ["apple", "smartfon", "premium"],
      }
    ],
    autoCategorize: true,
    autoLinkProducts: true,
  }),
});

const result = await response.json();
console.log('Imported:', result.imported);
```

---

## Przyszłe Rozszerzenia

### 1. **Scraping Zewnętrznych Źródeł**
- Pepper.pl API/scraping
- MyDealz scraping
- Reddit /r/deals API
- Respektowanie `robots.txt` i ToS

### 2. **Weryfikacja Jakości AI**
- Flow `aiDealQualityScore` (analogiczny do produktów)
- Automatyczne odrzucanie low-quality okazji
- Scoring: priceQuality, discountLegitimacy, merchantTrust, expiryValidity

### 3. **Powiadomienia Push**
- Alerty dla użytkowników o nowych okazjach w obserwowanych kategoriach
- Powiadomienia o wygasających okazjach

### 4. **Dashboard Okazji**
- Statystyki: top deals, trending, expiring soon
- Metryki: CTR, conversion rate, user engagement

---

## Migracja Danych

Jeśli masz istniejące okazje w bazie bez nowych pól, uruchom migrację:

```typescript
// scripts/migrate-deals.ts
import { adminDb } from '@/lib/firebase-admin';

async function migrateDeals() {
  const snapshot = await adminDb.collection('deals').get();
  
  for (const doc of snapshot.docs) {
    await doc.ref.update({
      dealType: 'sale', // domyślny typ
      freeShipping: false,
      verified: false,
      linkedProductIds: [],
      source: 'manual',
      importMetadata: {
        source: 'legacy',
        importedAt: new Date().toISOString(),
      },
    });
  }
  
  console.log(`Migracja zakończona: ${snapshot.size} okazji`);
}
```

---

## FAQ

**Q: Czy AI zawsze łączy okazję z produktem?**  
A: Nie. Tylko przy matchScore ≥ 85 + high confidence. W innych przypadkach tworzy sugestie do ręcznej weryfikacji.

**Q: Co jeśli nie ma produktu w bazie?**  
A: Okazja zostanie zapisana bez linkowania. Można ręcznie dodać produkt później i połączyć.

**Q: Czy można importować z Pepper.pl?**  
A: Obecnie nie (wymaga scrapingu). W przyszłości planowane jako opcjonalna funkcja.

**Q: Czy import CSV obsługuje wszystkie pola?**  
A: Tak, wszystkie pola z typu `Deal` mogą być w CSV. Cashback jako JSON string w kolumnie `cashback`.

---

## Kontakt

W razie pytań lub problemów, sprawdź:
- `README.md` - główna dokumentacja projektu
- `docs/` - dodatkowe dokumenty
- GitHub Issues - zgłaszanie bugów
