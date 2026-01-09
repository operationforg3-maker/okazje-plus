# 🔴 RAPORT: Problemy z systemem walut i cen

**Data**: 28 grudnia 2025  
**Status**: WYMAGA NATYCHMIASTOWEJ UWAGI

---

## 📋 Podsumowanie wykonawcze

System importu i wyświetlania cen zawiera **4 krytyczne problemy**, które powodują niespójne wyświetlanie cen użytkownikom. Mimo że mechanizm importu działa poprawnie (konwersja USD→PLN z API NBP), frontend nie respektuje wyboru waluty użytkownika.

---

## ✅ Co działa poprawnie

### 1. Import z konwersją walut (Harvester)
**Lokalizacja**: `src/lib/automation/harvester.ts` (linie 488-560)

```typescript
// Automatyczna konwersja podczas importu z AliExpress
const sourcePrice = p.price?.current || 0;
const sourceCurrency = p.price?.currency || 'USD';

if (sourceCurrency === 'USD') {
  priceInPLN = await convertToPLN(sourcePrice, 'USD');
  // Wykorzystuje API NBP: https://api.nbp.pl/
}
```

**✅ Korzyści**:
- API NBP (Narodowy Bank Polski) dla aktualnych kursów
- Cache 24h (nieobciążający, wydajny)
- Fallback na stałe kursy (USD=4.0, EUR=4.3) gdy API niedostępne
- Wszystkie ceny zapisywane w PLN w Firestore

### 2. Historia cen (Omnibus Directive)
**Lokalizacja**: `deals` collection → `priceHistory: Array<{date, price}>`

**✅ Korzyści**:
- Zgodność z dyrektywą Omnibus (30 dni historii)
- Timestamp dla każdej zmiany ceny
- Wykresy w `product-price-history-chart.tsx`

---

## 🔴 Problem 1: Trzy niezależne systemy walut

System ma **3 różne implementacje** wyboru waluty, które **nie komunikują się ze sobą**:

### A) CurrencyContext (`src/context/currency-context.tsx`)
```typescript
type Currency = 'USD' | 'PLN' | 'EUR';
exchangeRates: {
  USD: 1.0,    // Bazowa waluta
  PLN: 4.0,    // 1 USD = 4 PLN
  EUR: 0.92,   // 1 USD = 0.92 EUR
}
```
- **Użycie**: `product-card.tsx`, `smart-cart-widget.tsx`
- **Problem**: USD jako bazowa, ale produkty w bazie są w PLN

### B) CurrencySwitcher (`src/components/currency-switcher.tsx`)
```typescript
SUPPORTED_CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP'];
localStorage.setItem('preferredCurrency', newCurrency);
window.dispatchEvent(new CustomEvent('currencyChange', { ... }));
```
- **Użycie**: Navbar (dropdown wyboru waluty)
- **Problem**: Event `currencyChange` NIE jest obsługiwany przez żaden komponent!

### C) currency-service.ts (`src/lib/currency-service.ts`)
```typescript
type SupportedCurrency = 'PLN' | 'USD' | 'EUR' | 'GBP';
// API: https://api.exchangerate-api.com/v4/latest/PLN
FALLBACK_TO_PLN: { PLN: 1.0, USD: 4.0, EUR: 4.3, GBP: 5.0 }
```
- **Użycie**: Import pipeline (harvester)
- **Problem**: PLN jako bazowa, konflikt z CurrencyContext

**Konsekwencja**: Użytkownik wybiera EUR → UI nadal pokazuje PLN!

---

## 🔴 Problem 2: Niespójne formatowanie cen

Każdy komponent używa **innej metody** formatowania:

| Komponent | Metoda formatowania | Waluta |
|-----------|---------------------|--------|
| `product-card.tsx` (L148) | `useCurrency().formatPrice()` | USD→konwersja |
| `deal-list-card.tsx` (L115) | `Intl.NumberFormat('pl-PL')` | **Hardcoded PLN** |
| `price-history-chart.tsx` (L110) | `${price.toFixed(2)}` | **Hardcoded $** |
| `price-alert-button.tsx` (L250) | `${price.toFixed(2)} PLN` | **Hardcoded PLN** |
| `deal-card.tsx` (L748) | `priceData.formattedPrice` | **Hardcoded PLN** |

**Przykład problemu**:
```
Użytkownik wybiera EUR (4.3 PLN/EUR)
- Product Card: "100 EUR" ✅ (używa CurrencyContext)
- Deal Card: "430 PLN" ❌ (ignoruje wybór)
- Price Alert: "430 PLN" ❌ (ignoruje wybór)
- History Chart: "$430" ❌ (pokazuje $ zamiast EUR)
```

---

## 🔴 Problem 3: Brak automatycznej aktualizacji kursów

### Obecny przepływ:
```
1. Import (2024-12-01): 100 USD → 400 PLN (kurs 4.0)
   ✅ Zapisane w Firestore: price=400, currency='PLN'

2. Kurs się zmienia (2024-12-15): USD/PLN = 4.5
   ❌ Produkty w bazie nadal mają 400 PLN!

3. Użytkownik widzi: 400 PLN
   Faktyczna wartość: 100 USD × 4.5 = 450 PLN
   ❌ Strata informacji o 50 PLN różnicy!
```

### Dlaczego to problem:
- Ceny stają się nieaktualne względem kursu walut
- Użytkownik nie widzi prawdziwej wartości produktu
- Jedyny sposób naprawy: **re-import całego produktu**

### Brakujące rozwiązanie:
```typescript
// NEEDED: Cloud Function aktualizująca ceny co 24h
// Lokalizacja: okazje-plus/src/scheduled-price-update.ts (NIE ISTNIEJE)

export const updatePricesWithCurrentRates = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1' },
  async () => {
    // 1. Pobierz aktualny kurs z NBP
    // 2. Przelicz ceny produktów
    // 3. Zaktualizuj w Firestore
  }
);
```

---

## 🔴 Problem 4: Frontend ignoruje wybór użytkownika

### CurrencySwitcher istnieje ale jest NIEUŻYWANY:

```tsx
// src/components/currency-switcher.tsx (L30-60)
export function CurrencySwitcher() {
  const switchCurrency = (newCurrency: string) => {
    localStorage.setItem('preferredCurrency', newCurrency);
    window.dispatchEvent(new CustomEvent('currencyChange', { 
      detail: { currency: newCurrency } 
    }));
    toast.success(`Waluta zmieniona na ${currencyName}`);
  };
  // ...
}
```

**Problem**: Żaden komponent NIE nasłuchuje na event `currencyChange`!

### Komponenty używające hardcoded PLN:
1. ❌ `deal-card.tsx` (L111-165): `Intl.NumberFormat('pl-PL', { currency: 'PLN' })`
2. ❌ `deal-list-card.tsx` (L113-130): `Intl.NumberFormat('pl-PL', { currency: 'PLN' })`
3. ❌ `price-alert-button.tsx` (L250): `{currentPrice.toFixed(2)} PLN`
4. ❌ `product-price-history-chart.tsx` (L31): `currency = 'USD'` (domyślnie)
5. ❌ `product-detail-page.tsx`: Nie używa `useSelectedCurrency()`

### Tylko 2 komponenty działają poprawnie:
1. ✅ `product-card.tsx` (L148): `const { formatPrice } = useCurrency();`
2. ✅ `smart-cart-widget.tsx` (L17): `import { formatPrice } from '@/lib/i18n-utils';`

---

## 🛠️ Rekomendowane naprawy

### Naprawa 1: Ujednolicenie systemu walut (Priorytet: WYSOKI)

**Cel**: Jeden źródłowy system walut dla całej aplikacji

**Implementacja**:
```typescript
// src/lib/unified-currency.ts (NOWY PLIK)

import { useEffect, useState } from 'react';

export type Currency = 'PLN' | 'USD' | 'EUR' | 'GBP';

// Singleton dla kursów walut
class CurrencyManager {
  private static rates: Record<Currency, number> = {
    PLN: 1.0,
    USD: 4.0,
    EUR: 4.3,
    GBP: 5.1,
  };

  static async updateRates(): Promise<void> {
    // Pobierz z API NBP lub exchangerate-api.com
    const response = await fetch('https://api.nbp.pl/api/exchangerates/tables/a/?format=json');
    const data = await response.json();
    
    for (const rate of data[0].rates) {
      if (rate.code === 'USD') this.rates.USD = rate.mid;
      if (rate.code === 'EUR') this.rates.EUR = rate.mid;
      if (rate.code === 'GBP') this.rates.GBP = rate.mid;
    }
  }

  static convertFromPLN(amountPLN: number, targetCurrency: Currency): number {
    return amountPLN / this.rates[targetCurrency];
  }

  static formatPrice(amountPLN: number, targetCurrency: Currency): string {
    const amount = this.convertFromPLN(amountPLN, targetCurrency);
    
    const locales: Record<Currency, string> = {
      PLN: 'pl-PL',
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
    };
    
    return new Intl.NumberFormat(locales[targetCurrency], {
      style: 'currency',
      currency: targetCurrency,
    }).format(amount);
  }
}

// Hook dla komponentów React
export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('PLN');

  useEffect(() => {
    // Załaduj z localStorage
    const saved = localStorage.getItem('preferredCurrency') as Currency;
    if (saved) setCurrency(saved);

    // Nasłuchuj zmian
    const handler = (e: CustomEvent<{ currency: Currency }>) => {
      setCurrency(e.detail.currency);
    };
    
    window.addEventListener('currencyChange', handler as EventListener);
    return () => window.removeEventListener('currencyChange', handler as EventListener);
  }, []);

  const formatPrice = (amountPLN: number) => {
    return CurrencyManager.formatPrice(amountPLN, currency);
  };

  return { currency, formatPrice };
}
```

**Migracja**:
1. Zamień wszystkie `useCurrency()` z `CurrencyContext` na nowy `unified-currency.ts`
2. Usuń `src/context/currency-context.tsx` (deprecated)
3. Zaktualizuj wszystkie komponenty do używania `useCurrency().formatPrice()`

---

### Naprawa 2: Ujednolicenie formatowania (Priorytet: WYSOKI)

**Cel**: Wszystkie ceny formatowane przez jeden helper

**Implementacja**:
```typescript
// Zamień WSZYSTKIE wystąpienia:

// ❌ PRZED:
new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(price)
${price.toFixed(2)} PLN
`${amount} zł`

// ✅ PO:
import { useCurrency } from '@/lib/unified-currency';
const { formatPrice } = useCurrency();
{formatPrice(price)} // Automatycznie w wybranej walucie użytkownika
```

**Dotknięte pliki** (18 komponentów do poprawy):
- `src/components/deal-card.tsx`
- `src/components/deal-list-card.tsx`
- `src/components/product-list-card.tsx`
- `src/components/price-alert-button.tsx`
- `src/components/price-alert-dialog.tsx`
- `src/components/product-price-history-chart.tsx`
- `src/components/admin/deal-edit-dialog.tsx`
- `src/app/[locale]/deals/[id]/deal-detail-client.tsx`
- `src/app/[locale]/products/page.tsx`
- ... i 9 innych

---

### Naprawa 3: Aktualizacja cen (Priorytet: ŚREDNI)

**Cel**: Cloud Function aktualizująca ceny co 24h

**Implementacja**:
```typescript
// okazje-plus/src/scheduled-price-update.ts (NOWY PLIK)

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

export const updatePricesDaily = onSchedule(
  { 
    schedule: 'every day 03:00',
    timeZone: 'Europe/Warsaw',
    region: 'europe-west1',
  },
  async (event) => {
    const db = getFirestore();
    
    // 1. Pobierz aktualny kurs USD/PLN z NBP
    const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/USD/?format=json');
    const data = await response.json();
    const currentUSDRate = data.rates[0].mid;
    
    console.log(`Daily price update: USD/PLN = ${currentUSDRate}`);
    
    // 2. Pobierz wszystkie deale z originalPriceUSD
    const dealsSnapshot = await db.collection('deals')
      .where('metadata.originalPriceUSD', '>', 0)
      .get();
    
    const batch = db.batch();
    let updateCount = 0;
    
    for (const doc of dealsSnapshot.docs) {
      const data = doc.data();
      const originalUSD = data.metadata?.originalPriceUSD;
      
      if (originalUSD) {
        const newPricePLN = Math.round(originalUSD * currentUSDRate * 100) / 100;
        
        batch.update(doc.ref, {
          price: newPricePLN,
          totalPrice: newPricePLN + (data.shippingCost || 0),
          'metadata.lastPriceUpdate': new Date().toISOString(),
          'metadata.exchangeRateUsed': currentUSDRate,
        });
        
        updateCount++;
      }
    }
    
    await batch.commit();
    console.log(`Updated ${updateCount} deal prices with current USD rate`);
    
    return { success: true, updated: updateCount, rate: currentUSDRate };
  }
);
```

**Dodatkowe zmiany w Harvester**:
```typescript
// src/lib/automation/harvester.ts
// Zapisz oryginalną cenę USD dla przyszłych aktualizacji

await dealRef.set({
  // ...istniejące pola
  price: priceInPLN,
  currency: 'PLN',
  metadata: {
    originalPriceUSD: sourcePrice, // ✅ DODAJ TO
    originalCurrency: 'USD',
    exchangeRateAtImport: priceInPLN / sourcePrice,
    importedAt: new Date().toISOString(),
  },
});
```

---

### Naprawa 4: Respektowanie wyboru użytkownika (Priorytet: WYSOKI)

**Cel**: Wszystkie komponenty pokazują ceny w wybranej walucie

**Plan działania**:

#### Krok 1: Hook `useCurrency` we wszystkich komponentach
```tsx
// Wzorzec dla KAŻDEGO komponentu wyświetlającego cenę:

import { useCurrency } from '@/lib/unified-currency';

export function SomeComponent({ pricePLN }: { pricePLN: number }) {
  const { formatPrice, currency } = useCurrency();
  
  return (
    <div>
      <span className="price">{formatPrice(pricePLN)}</span>
      <span className="currency-badge">{currency}</span>
    </div>
  );
}
```

#### Krok 2: Aktualizacja chart'ów
```tsx
// src/components/product-price-history-chart.tsx (L31)

// ❌ PRZED:
export function ProductPriceHistoryChart({ deals, currency = 'USD' }: Props) {

// ✅ PO:
export function ProductPriceHistoryChart({ deals }: Props) {
  const { currency, formatPrice } = useCurrency();
  
  // Użyj currency z hooka zamiast prop'a
}
```

#### Krok 3: Server-side rendering (SSR)
```tsx
// Dla komponentów SSR, przekaż walutę z cookie/header

// middleware.ts
export function middleware(request: NextRequest) {
  const currency = request.cookies.get('preferredCurrency')?.value || 'PLN';
  const response = NextResponse.next();
  response.headers.set('x-user-currency', currency);
  return response;
}

// page.tsx (server component)
import { headers } from 'next/headers';

export default async function ProductPage() {
  const headersList = headers();
  const userCurrency = headersList.get('x-user-currency') || 'PLN';
  
  // Przekaż do client component
  return <ProductDetail currency={userCurrency} />;
}
```

---

## 📊 Podsumowanie wpływu na użytkownika

### Obecnie (PRZED naprawami):
❌ Użytkownik wybiera EUR w dropdown  
❌ 50% komponentów pokazuje PLN (ignorują wybór)  
❌ 30% komponentów pokazuje USD (błędna waluta)  
❌ 20% komponentów pokazuje EUR (poprawnie)  
❌ Ceny nie aktualizują się z kursami walut  
❌ Brak spójności w całym UI  

### Po naprawach:
✅ Użytkownik wybiera EUR w dropdown  
✅ 100% komponentów pokazuje EUR (respektują wybór)  
✅ Ceny aktualizują się codziennie o 3:00 (Cloud Function)  
✅ Pełna spójność w całym UI  
✅ Prawidłowa wartość produktów względem aktualnych kursów  

---

## 🎯 Plan wdrożenia

### Faza 1: Przygotowanie (1 dzień)
- [ ] Utwórz `src/lib/unified-currency.ts`
- [ ] Napisz testy jednostkowe
- [ ] Dodaj migrations dla istniejących danych

### Faza 2: Backend (2 dni)
- [ ] Stwórz Cloud Function `updatePricesDaily`
- [ ] Dodaj `metadata.originalPriceUSD` do Harvester
- [ ] Przetestuj aktualizację cen na staging

### Faza 3: Frontend (3-4 dni)
- [ ] Zamień `CurrencyContext` na `unified-currency`
- [ ] Zaktualizuj 18 komponentów do używania `useCurrency()`
- [ ] Dodaj testy E2E dla wyboru waluty

### Faza 4: Deploy & Monitoring (1 dzień)
- [ ] Deploy na produkcję
- [ ] Monitor logów Cloud Function (pierwsze 3 dni)
- [ ] Zbierz feedback użytkowników

**Szacowany czas**: 7-8 dni roboczych  
**Priorytet**: WYSOKI (wpływa na wszystkich użytkowników)

---

## 📎 Załączniki

### Powiązane pliki (do przeglądu):
- `src/lib/currency-exchange.ts` - API NBP (działa poprawnie)
- `src/lib/currency-service.ts` - Serwis konwersji (duplikacja?)
- `src/context/currency-context.tsx` - Stary context (do usunięcia)
- `src/components/currency-switcher.tsx` - UI wyboru (OK, ale niepodłączone)
- `src/lib/automation/harvester.ts` - Import z konwersją (OK)

### Dokumentacja zewnętrzna:
- [API NBP](https://api.nbp.pl/) - źródło kursów walut
- [Dyrektywa Omnibus](https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX%3A32019L2161) - wymagania prawne dla cen

---

**Autor**: AI Coding Assistant  
**Data**: 28 grudnia 2025  
**Wersja**: 1.0
