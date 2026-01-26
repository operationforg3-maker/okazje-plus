# Naprawianie Brakujących Polskich Tłumaczeń w Dealach

## Problem
Deale importowane z AliExpress/Allegro mogą mieć:
- **Tytuł w formacie plain string** zamiast `{ pl, en, de }`
- **Brakować polskiego tłumaczenia** (`title.pl` jest pusty)
- Mieć tylko angielskie lub niemieckie wersje

## Rozwiązanie

### 1. Sprawdzić stan deali
```bash
node legacy/debug-scripts/check-deal-translations.mjs
```

Wynik pokaże:
- Ile deali ma pełne tłumaczenia
- Ile brakuje polskiego
- Ile ma plain string titles

### 2. Naprawić brakujące tłumaczenia

#### Z Admin Panelu
Przycisk w Admin → Deals → "Napraw Tłumaczenia" (gdy dodamy UI)

#### Programmatycznie
```typescript
import { DealRefiner } from '@/lib/automation/deal-refiner';

const refiner = new DealRefiner(`job-${Date.now()}`);
const job = await refiner.refineNewDeals(100); // Process 100 deals

console.log(job.logs); // View detailed logs
```

#### Z Cloud Function
```typescript
// okazje-plus/src/index.ts
export const refineMissingDealTranslations = onRequest(
  async (req, res) => {
    const refiner = new DealRefiner('auto-refine');
    const job = await refiner.refineNewDeals(50);
    res.json({ success: true, processedDeals: job.logs.length });
  }
);
```

## Co robi Deal Refiner

1. **Detektuje brakujące tłumaczenia**
   ```typescript
   dealNeedsRefinement(deal) -> boolean
   
   // Zwraca true jeśli:
   // - title to plain string (nie { pl, en, de })
   // - title.pl jest pusty (KRYTYCZNE!)
   // - title.en lub title.de brakuje
   ```

2. **Gwarantuje polskie tłumaczenie**
   ```typescript
   // Zawsze zachowuje istniejący title.pl
   // Lub używa title.en/de jako fallback
   // Lub fallback do "Produkt"
   ```

3. **Uzupełnia brakujące języki**
   ```typescript
   refined.title = {
     pl: "Mój produkt",          // Zawsze istnieje
     en: "My product",           // AI-generated lub fallback
     de: "Mein Produkt",         // AI-generated lub fallback
   }
   ```

4. **Dodaje selling points i podsumowanie**
   ```typescript
   metadata.sellingPoints: {
     pl: ["Darmowa dostawa", "Szybka dostawa"],
     en: ["Free shipping", "Fast delivery"],
     de: ["Versand frei", "Schnelle Lieferung"]
   },
   metadata.offerSummary: {
     pl: "Mój produkt od sklepu. Darmowa dostawa...",
     en: "My product from store. Free shipping...",
     de: "Mein Produkt vom Shop. Versand frei..."
   }
   ```

## Czemu to ważne

❌ **Bez naprawy:**
- Angielskojęzyczni użytkownicy widzą polskie tytuły lub brak treści
- Niemcy widzą nieprzetłumaczone teksty
- Deal card nie pokazuje konkretnych zalet oferty

✅ **Po naprawie:**
- Każdy deal ma treść we wszystkich 3 językach
- UI może wyświetlić "Darmowa dostawa", "Szybka dostawa" itp
- Użytkownicy rozumieją dlaczego ta oferta jest dobra

## Harmonogram

**Teraz:**
- Deal Refiner gotów do testów
- Można uruchomić ręcznie na małych partii (10-50 deali)

**Przyszłość:**
- Cloud Function trigger: Auto-refine nowych deali
- Scheduled job: Codzienne sprawdzenie brakujących tłumaczeń
- UI component: Wyświetlanie selling points w deal cardach
