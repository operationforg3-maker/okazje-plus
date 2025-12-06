# Multi-Currency API Integration Guide

## Podsumowanie: Jak API zwracają ceny

### AliExpress API ✅
- **Domyślna waluta**: USD
- **Parametr wyboru waluty**: `target_currency` 
- **Obsługiwane waluty**: USD, EUR, GBP, PLN (i inne - sprawdź w dokumentacji API)
- **Format odpowiedzi**:
```json
{
  "price": {
    "current": 29.99,
    "original": 49.99,
    "currency": "USD",
    "app_sale": 27.99
  },
  "shipping": {
    "cost": 5.99,
    "free": false
  }
}
```

**Przykład zapytania z wyborem waluty**:
```typescript
const params = {
  app_key: APP_KEY,
  method: 'aliexpress.solution.product.info.get',
  target_currency: 'EUR', // ← Wybór waluty
  product_id: '1234567890',
  // ... inne parametry
};
```

### Convertiser API ✅
- **Obsługa wielu walut**: TAK
- **Sposób wyboru**: W ścieżce URL lub parametrze
- **Endpoint przykład**: `/publisher/billing_accounts/{currency_code}/`
- **Obsługiwane waluty**: PLN, USD, EUR, GBP (sprawdź w panelu Convertiser)

**Przykład zapytania**:
```typescript
// Pobierz saldo w PLN
GET /publisher/billing_accounts/PLN/

// Pobierz transakcje z filtrem waluty
GET /publisher/transactions/?currency=EUR
```

---

## Strategia obsługi walut w Okazje Plus

### 1. **Podczas importu produktów**

#### Opcja A: Pobierz w USD i konwertuj lokalnie (AKTUALNE)
```typescript
// src/ai/flows/importerFlow/stageFetch.ts
const products = await fetchFromAliExpress({
  // NIE przekazujemy target_currency - dostajemy USD
  keywords: 'smartphone',
});

// src/ai/flows/importerFlow/stageEnrich.ts
const pricePLN = priceUSD * exchangeRate; // Lokalna konwersja
```

**Plusy**:
- Niezależność od dostępności walut w API
- Kontrola nad kursami wymiany
- Jednolite źródło cen (zawsze USD)

**Minusy**:
- Trzeba zarządzać kursami wymiany
- Możliwe rozbieżności z rzeczywistymi cenami

#### Opcja B: Pobierz bezpośrednio w PLN z API (ZALECANE)
```typescript
// src/ai/flows/importerFlow/stageFetch.ts
import { buildCurrencyParam } from '@/lib/multi-currency-api';

const products = await fetchFromAliExpress({
  keywords: 'smartphone',
  ...buildCurrencyParam('aliexpress', 'PLN'), // ← Pobierz w PLN
});

// Produkty już w PLN, nie trzeba konwertować!
```

**Plusy**:
- ✅ Ceny dokładne (bezpośrednio z AliExpress)
- ✅ Brak błędów konwersji
- ✅ Prostszy kod

**Minusy**:
- Uzależnienie od dostępności waluty w API

---

### 2. **Wyświetlanie cen użytkownikom**

Używamy `SmartPrice` do przechowywania i konwersji:

```typescript
import { convertSmartPrice } from '@/lib/multi-currency-api';
import { useSelectedCurrency } from '@/lib/price-utils';

// W komponencie
const userCurrency = useSelectedCurrency(); // np. 'EUR'

// Konwertuj cenę produktu
const displayPrice = await convertSmartPrice(product.price, userCurrency);

// Formatuj dla użytkownika
const formatted = formatPrice(displayPrice, userCurrency);
// Wynik: "123,45 €"
```

---

## Implementacja w projekcie

### Krok 1: Zaktualizuj fetchProductsFromAliexpress

**Plik**: `src/ai/flows/importerFlow/stageFetch.ts`

```typescript
import { buildCurrencyParam } from '@/lib/multi-currency-api';

export async function fetchProductsFromAliexpress(
  keywords: string[],
  config: FetchConfig
): Promise<AliExpressProduct[]> {
  const params = {
    keywords: keywords.join(','),
    ...buildCurrencyParam('aliexpress', 'PLN'), // ← Dodaj wybór waluty
    page_size: config.batchSize,
    // ... inne parametry
  };
  
  // Wywołaj API...
}
```

### Krok 2: Aktualizuj mapowanie do SmartPrice

**Plik**: `src/ai/flows/importerFlow/stageSave.ts`

```typescript
import { externalPriceToSmartPrice } from '@/lib/multi-currency-api';

// Konwertuj cenę z API na SmartPrice
const smartPrice = await externalPriceToSmartPrice({
  amount: product.price,
  currency: product.currency, // Z odpowiedzi API
  originalAmount: product.originalPrice,
  shippingCost: product.shippingCost,
  freeShipping: product.freeShipping,
}, 'PLN'); // Docelowa waluta w systemie

const productData = {
  ...product,
  price: smartPrice, // Użyj SmartPrice zamiast number
};
```

### Krok 3: Wyświetlanie w UI

**Plik**: `src/components/product-card.tsx`

```typescript
import { useSelectedCurrency } from '@/lib/price-utils';
import { formatPrice } from '@/lib/price-utils';

export function ProductCard({ product }: { product: Product }) {
  const userCurrency = useSelectedCurrency();
  
  // Konwersja ceny do wybranej waluty użytkownika
  const displayPrice = formatPrice(product.price, userCurrency);
  
  return (
    <div>
      <h3>{product.name}</h3>
      <p className="price">{displayPrice}</p>
    </div>
  );
}
```

---

## Testowanie

### Test 1: Import w różnych walutach
```bash
# Zmień DEFAULT_API_CURRENCY w .env.local
DEFAULT_API_CURRENCY=PLN

# Uruchom import
npm run auto-import
```

### Test 2: Konwersja walut
```typescript
// src/__tests__/currency-conversion.test.ts
import { externalPriceToSmartPrice } from '@/lib/multi-currency-api';

test('converts USD to PLN correctly', async () => {
  const result = await externalPriceToSmartPrice({
    amount: 100,
    currency: 'USD',
    shippingCost: 10,
  }, 'PLN');
  
  expect(result.currency).toBe('PLN');
  expect(result.amount).toBeGreaterThan(300); // ~400 PLN
});
```

---

## FAQ

**Q: Czy muszę zawsze konwertować ceny z USD?**  
A: Nie! Jeśli API obsługuje wybraną walutę (AliExpress obsługuje PLN), możesz pobrać ceny bezpośrednio w tej walucie.

**Q: Co jeśli API nie obsługuje PLN?**  
A: Użyj lokalnej konwersji z `currency-service.ts`. Kursy są aktualizowane co godzinę z API kursów walut.

**Q: Jak często aktualizować kursy wymiany?**  
A: Automatycznie co 1h (ustawione w `currency-service.ts`). Możesz ręcznie odświeżyć wywołując `invalidateExchangeRatesCache()`.

**Q: Czy ceny w bazie są w PLN?**  
A: `SmartPrice` przechowuje walutę w polu `currency`. Mogą być różne waluty, ale domyślnie importujemy w PLN.

---

## Zalecenia

✅ **DO:**
- Pobieraj ceny w PLN jeśli API to obsługuje
- Użyj `SmartPrice` do przechowywania cen z walutą
- Konwertuj na walutę użytkownika przy wyświetlaniu
- Aktualizuj kursy co najmniej raz dziennie

❌ **NIE:**
- Nie przechowuj cen bez informacji o walucie
- Nie zakładaj że wszystkie ceny są w USD
- Nie używaj statycznych kursów wymiany
- Nie konwertuj zbyt często (używaj cache)

---

## Plany na przyszłość

- [ ] Integracja z Omnibus (najniższa cena 30 dni)
- [ ] Cache cen produktów z różnych walut
- [ ] Automatyczne powiadomienia o zmianach kursów
- [ ] Dashboard z wykresami kursów walut
- [ ] Multi-currency checkout dla sklepów partnerskich
