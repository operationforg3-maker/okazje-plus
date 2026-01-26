# Deal Refiner — M6+ Wzbogacanie ofert z AI

## Problem (Które rozwiązuje)

Dotychczas **tylko ProductCore** były wzbogacane (refinowane) przez AI. **Deale** importowane z AliExpress/Allegro/Amazon miały:
- Surowe tytuły bez tłumaczeń (tylko PL)
- Brak informacji o przewagach tej konkretnej oferty
- Brak podsumowań specyficznych dla sprzedawcy

To oznaczało, że:
- Użytkownicy angielskojęzyczni widzieli polskie tytuły
- UI nie mógł podświetlać specyficznych zalet oferty (np. "Darmowa dostawa", "Szybka dostawa od Top Sellera")
- Brak kontekstu dla wyboru między dealami z różnych źródeł

## Rozwiązanie

**Deal Refiner** — nowy moduł wzbogacający dokumenty `deals` z AI-generowaną treścią:

### Funkcjonalność

1. **Tłumaczenia tytułu na EN/DE**
   - Każdy deal dostaje tłumaczenie tytułu oferty na angielski i niemiecki
   - Przechowywane w `title: { pl, en, de }`

2. **Selling Points (Punkty Sprzedażowe)**
   - AI identyfikuje kluczowe zalety oferty:
     - "Hochrated seller (4.8/5)" jeśli rating >= 4.5
     - "Free shipping" jeśli brak kosztów dostawy
     - "Fast delivery (3 days)" jeśli szybka dostawa
     - "Flash sale" jeśli dealType === 'flash_deal'
   - Generowane dla każdego języka (PL/EN/DE)
   - Przechowywane w `metadata.sellingPoints`

3. **Offer Summary (Podsumowanie Oferty)**
   - 1-2 zdania podsumowujące deal w każdym języku
   - Łączy: tytuł + sprzedawca + cenę + dostawę
   - Przechowywane w `metadata.offerSummary`

### Architektura

```
harvester.ts (import)
    ↓
creates ProductCore + Deal
    ↓
refiner.ts (ProductCore enrichment)
    ↓
Now: deal-refiner.ts (NEW)
    ├── refineNewDeals() - główna metoda
    ├── refineSingleDeal() - proces jednego dealu
    └── generateDealEnrichment() - AI wzbogacenie
    ↓
ai/flows/deal-enrichment.ts
    ├── enrichDeal() - orkestracja
    ├── generateSellingPoints() - logika punktów
    └── generateSummary() - logika podsumowania
    ↓
Updated deals collection w Firestore
```

### Struktura Deal (po refinemencie)

```typescript
{
  id: "deal_123",
  productCoreId: "product_456",
  price: { amount: 150, currency: "PLN" },
  source: "aliexpress",
  merchantName: "AliExpress Store",
  merchantRating: 4.8,
  
  // M6+ AI-generated content
  title: {
    pl: "Smartwatch Z7 Pro 48h bateria",
    en: "Smartwatch Z7 Pro 48h battery",
    de: "Smartwatch Z7 Pro 48h Akkulaufzeit"
  },
  
  metadata: {
    sellingPoints: {
      pl: [
        "Sprzedawca AliExpress z oceną 4.8/5",
        "Darmowa dostawa",
        "Szybka dostawa (7 dni)"
      ],
      en: [
        "Highly-rated seller on AliExpress (4.8/5)",
        "Free shipping",
        "Fast delivery (7 days)"
      ],
      de: [
        "Hochwertiger Verkäufer auf AliExpress (4.8/5)",
        "Versand frei",
        "Schnelle Lieferung (7 Tage)"
      ]
    },
    offerSummary: {
      pl: "Smartwatch Z7 Pro 48h bateria od AliExpress Store. Darmowa dostawa. Cena: 150 PLN.",
      en: "Smartwatch Z7 Pro 48h battery from AliExpress Store. Free shipping. Price: 150 PLN.",
      de: "Smartwatch Z7 Pro 48h Akkulaufzeit von AliExpress Store. Versand frei. Preis: 150 PLN."
    }
  }
}
```

## Jak Użyć

### 1. Uruchomienie z Admin Panelu

```typescript
// src/app/admin/[locale]/deals/page.tsx
const { startDealRefinerJob } = await import('@/app/actions/deal-refiner');
const result = await startDealRefinerJob(50); // Refine 50 deals
```

### 2. Programmatycznie

```typescript
import { DealRefiner } from '@/lib/automation/deal-refiner';

const refiner = new DealRefiner('job-123');
const job = await refiner.refineNewDeals(100); // Refine up to 100 deals

console.log(`Success: ${job.logs.length} operations`);
```

### 3. W UI — Wyświetlanie Selling Points

```tsx
// src/components/deal-card.tsx
import { useTranslations } from 'next-intl';

export function DealCard({ deal }: { deal: DealM6 }) {
  const t = useTranslations('deals');
  const sellingPoints = deal.metadata?.sellingPoints?.[locale] || [];
  
  return (
    <div>
      <h3>{deal.title[locale]}</h3>
      
      {/* Wyświetlaj selling points */}
      {sellingPoints.length > 0 && (
        <ul className="selling-points">
          {sellingPoints.map((point, i) => (
            <li key={i} className="text-xs text-green-600">✓ {point}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Integracja z Harvesterem

Deal Refiner **nie jest automatycznie uruchamiany** po imporcie. To umożliwia:
- Kontrolę nad wydajnością (można refinować w batch mode)
- Rozdzielenie procesu: import → review → refinement
- Opcjonalne uruchomienie tylko dla wybranych dealów

**Przyszłe opcje:**
- Cloud Function trigger — auto-refinement po każdym nowym dealu
- Scheduled job — codzienne refinowanie nowych dealów

## Jak Rozszerzyć

### 1. Dodanie Pełnej AI Translacji

Aktualnie `titleEN` i `titleDE` to placeholdery. Aby dodać pełną translację:

```typescript
// src/ai/flows/deal-enrichment.ts
export async function enrichDeal(input: DealEnrichmentInput) {
  // Call Gemini for translation
  const translated = await translateFlow({
    text: input.dealTitle,
    fromLang: 'pl',
    toLang: ['en', 'de']
  });
  
  return {
    titleEN: translated.en,
    titleDE: translated.de,
    // ... rest of enrichment
  };
}
```

### 2. Dodanie Seller Review Summary

Można dodać podsumowanie opinii specificznych dla danego sprzedawcy:

```typescript
metadata.sellerReviewSummary: {
  pl: "Klienci chwalą szybką dostawę i dobrą jakość",
  en: "Customers praise fast delivery and good quality",
  de: "Kunden loben schnelle Lieferung und gute Qualität"
}
```

### 3. Dynamiczne Selling Points na podstawie TrendS

```typescript
// Jeśli deal ma wysokie click-through rate
if (dealStats.ctr > 0.1) {
  sellingPoints.pl.push('Popularna oferta - wielu kupujących')
}
```

## Pliki Zmienione

- **`src/lib/automation/deal-refiner.ts`** (NEW) — Główna klasa Deal Refinera
- **`src/ai/flows/deal-enrichment.ts`** (NEW) — Helpy do generacji treści
- **`src/app/actions/deal-refiner.ts`** (NEW) — Server action do uruchamiania z UI
- **`src/lib/types.ts`** — Dodano pola do `DealM6.metadata.sellingPoints` i `.offerSummary`

## Status

✅ **Implementacja gotowa do testów**
- [ ] Integracja Genkit dla pełnej translacji (opcjonalne)
- [ ] Cloud Function trigger (przyszłe)
- [ ] UI component do wyświetlania selling points
