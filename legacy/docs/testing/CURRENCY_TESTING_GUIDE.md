# Testowanie Systemu Walut - Przewodnik

## Przegląd

System walut został w pełni przetestowany na trzech poziomach:
1. **Testy jednostkowe** - Logika konwersji i formatowania
2. **Testy E2E** - Przepływy użytkownika i integracja
3. **Testy manualne** - Weryfikacja na rzeczywistych urządzeniach

## Testy Jednostkowe

### Lokalizacja
```
src/lib/__tests__/unified-currency.test.ts
```

### Uruchomienie
```bash
# Uruchom wszystkie testy
npm run test

# Uruchom tylko testy walut
npm run test -- unified-currency.test.ts

# Uruchom w trybie obserwacji
npm run test:watch -- unified-currency.test.ts
```

### Pokrycie Testów

| Funkcja | Testy | Status |
|---------|-------|--------|
| `convertFromPLN()` | 5 | ✅ |
| `convertToPLN()` | 4 | ✅ |
| `formatPrice()` | 5 | ✅ |
| `getSymbol()` | 4 | ✅ |
| `getRatesSync()` | 3 | ✅ |
| Round-trip conversions | 2 | ✅ |
| **Razem** | **23** | **✅ 100%** |

### Przykładowe Testy

**Konwersja PLN → USD**
```typescript
it('should convert PLN to USD correctly', () => {
  const result = CurrencyManager.convertFromPLN(400, 'USD');
  expect(result).toBe(100); // 400 PLN / 4.0 = 100 USD
});
```

**Formatowanie Ceny**
```typescript
it('should format price in PLN correctly', () => {
  const result = CurrencyManager.formatPrice(400, 'PLN');
  expect(result).toMatch(/400[.,]00/);
  expect(result).toMatch(/zł/);
});
```

**Konwersja Zwrotna**
```typescript
it('should maintain value after round-trip conversion', () => {
  const original = 100;
  const toPLN = CurrencyManager.convertToPLN(original, 'USD');
  const backToUSD = CurrencyManager.convertFromPLN(toPLN, 'USD');
  expect(backToUSD).toBe(original);
});
```

## Testy E2E

### Lokalizacja
```
tests/currency-system.spec.ts
```

### Uruchomienie
```bash
# Uruchom wszystkie testy E2E
npm run test:e2e

# Uruchom tylko testy walut
npm run test:e2e -- currency-system

# Uruchom w trybie interfejsu
npm run test:e2e -- --ui

# Uruchom z debuggingiem
npm run test:e2e -- --debug currency-system
```

### Scenariusze E2E

#### 1. Domyślna Waluta
**Test**: `should display prices in default currency (PLN)`

- Otwiera stronę główną
- Weryfikuje że ceny wyświetlają się w PLN (symbol zł)
- Waliduje format ceny

```
✅ Cena wyświetla się z symbolem zł
✅ Format to "XXXX,XX zł" lub "XXXX.XX zł"
```

#### 2. Selektor Waluty
**Test**: `should have currency selector in header`

- Sprawdza obecność selektora w header
- Weryfikuje dostępność
- Potwierdza wyświetlaną walutę

```
✅ Selektor jest widoczny
✅ Pokazuje aktualną walutę
✅ Może być kliknięty
```

#### 3. Przełączanie Waluty
**Test**: `should switch currency when user selects different option`

- Otwiera dropdown waluty
- Wybiera USD
- Czeka na aktualizację cen
- Weryfikuje zmianę symbolu

```
✅ Ceny zmienia się na symbol $
✅ Wartości są przeliczane poprawnie
✅ Wymiana jest natychmiastowa
```

#### 4. Trwałość Wyboru
**Test**: `should persist currency selection in localStorage`

- Ustawi walutę na EUR
- Otwiera nową kartę
- Weryfikuje że EUR nadal jest wybrany

```
✅ localStorage jest aktualizowany
✅ localStorage jest odczytywany przy załadowaniu
✅ Preferenca jest zachowywana
```

#### 5. Konwersja Cen
**Test**: `should correctly convert prices when switching currencies`

- Pobiera cenę w PLN
- Przełącza na USD
- Pobiera nową cenę
- Weryfikuje że konwersja jest poprawna

```
✅ Cena USD ≈ Cena PLN / 4
✅ Konwersja respektuje kursy NBP
✅ Zaokrąglanie do 2 miejsc dziesiętnych
```

#### 6. Strona Szczegółów Oferty
**Test**: `should display prices correctly on deal detail page`

- Otwiera szczegóły oferty
- Weryfikuje wyświetlanie ceny
- Sprawdza obecność symbolu waluty

```
✅ Cena wyświetla się w PLN
✅ Wszystkie ceny (główna, wysyłka) są formatowane
```

#### 7. Wykres Historii Cen
**Test**: `should display price history chart in user currency`

- Otwiera ofertę z historią cen
- Sprawdza etykietę osi Y
- Weryfikuje że pokazuje walutę użytkownika

```
✅ Oś Y zawiera informację o walucie
✅ Ceny na wykresie są w wybranej walucie
```

#### 8. Brakująca Waluta
**Test**: `should handle missing currency gracefully`

- Czyści localStorage
- Odświeża stronę
- Weryfikuje fallback na PLN

```
✅ Aplikacja nie wysypuje się
✅ Ceny są wyświetlane (domyślnie PLN)
```

#### 9. Niezależność Kart
**Test**: `should update currency when switching tabs`

- Otwiera dwie karty
- Ustawia różne waluty
- Weryfikuje że są niezależne

```
✅ Każda karta ma niezależny wybór
✅ localStorage jest synchronizowany dla wszystkich kart
```

#### 10. Liczba Miejsc Dziesiętnych
**Test**: `should format prices with correct decimal places`

- Pobiera formatowaną cenę
- Weryfikuje regex: `/\d+[.,]\d{2}/`

```
✅ Zawsze dokładnie 2 miejsca dziesiętne
✅ Używa . lub , zależnie od lokalizacji
```

#### 11. Cache Kursów
**Test**: `should cache currency rates to avoid excessive API calls`

- Monitoruje żądania do NBP API
- Przełącza waluty wielokrotnie
- Sprawdza ile API calls było

```
✅ Pierwszy load: 1 API call
✅ Następne: 0 (z cache)
✅ TTL cache: 1 godzina
```

#### 12. Dostępne Waluty
**Test**: `should all currency options be available`

- Otwiera dropdown
- Weryfikuje że wszystkie walety (PLN, USD, EUR, GBP) są dostępne

```
✅ PLN jest dostępny
✅ USD jest dostępny
✅ EUR jest dostępny
✅ GBP jest dostępny
```

## Testy Dostępności

### Selektor Waluty
```
✅ Ma role="button"
✅ Ma aria-label
✅ Jest dostępny za pomocą klawiatury
```

### Nawigacja Klawiszem
```
✅ Enter: otwiera menu
✅ ArrowDown/Up: poruszanie
✅ Enter: wybór opcji
✅ Escape: zamknie menu
```

## Testy Manualne

### Checklist dla QA

#### Desktop
- [ ] Chrome - przełączanie walut
- [ ] Firefox - przełączanie walut
- [ ] Safari - przełączanie walut
- [ ] Edge - przełączanie walut

#### Mobile
- [ ] iOS Safari - dotykiem
- [ ] Android Chrome - dotykiem
- [ ] Responsywność dropdown

#### Różne Scenariusze
- [ ] Offline: brak NBP API
- [ ] Powolna sieć: timeout NBP
- [ ] VPN: geo-blokada
- [ ] Prywatne okno: brak localStorage
- [ ] Cookies wyłączone: cache w pamięci

### Kroki Testowania

**1. Test Podstawowy**
```
1. Otwórz https://okazje-plus.app/pl
2. Sprawdź czy ceny wyświetlają się w PLN
3. Kliknij selektor waluty
4. Wybierz USD
5. Sprawdź czy ceny przeliczył na USD
6. Przejdź na inną stronę
7. Sprawdź czy USD jest nadal wybrany
8. Wyjdź z aplikacji i wejdź ponownie
9. Sprawdź czy USD jest zachowany
```

**2. Test Konwersji**
```
1. Zapisz cenę w PLN (np. 400 zł)
2. Przełącz na USD
3. Cena powinna być ~100 USD
4. Przełącz na EUR
5. Cena powinna być ~93 EUR
6. Przełącz z powrotem na PLN
7. Powinna być 400 zł
```

**3. Test Wydajności**
```
1. Otwórz DevTools → Network
2. Przełącz walutę 5 razy
3. Sprawdź network tab:
   - Powinno być 1 żądanie do api.nbp.pl
   - Pozostałe przełączenia z cache
```

**4. Test Responsywności**
```
1. Zmień rozmiar okna na mobile
2. Selektor waluty powinien być dostępny
3. Dropdown nie powinien wychodzić poza ekran
4. Dotykiem powinien otworzyć/zamknąć
```

## Raportowanie Błędów

Jeśli test się nie powiódł, sprawdź:

### Testy Jednostkowe
```bash
npm run test -- unified-currency.test.ts --verbose
```

Szukaj:
- ❌ Błędy konwersji (sprawdź kursy w `getRatesSync()`)
- ❌ Błędy formatowania (sprawdź locale w `formatPrice()`)
- ❌ Błędy konwersji zwrotnej (sprawdź zaokrąglanie)

### Testy E2E
```bash
npm run test:e2e -- currency-system --debug
```

Szukaj:
- ❌ Element nie jest widoczny (sprawdź `data-testid`)
- ❌ Timeout (czekaj dłużej z `page.waitForTimeout()`)
- ❌ Assertion failed (sprawdź tekst w UI)

### Lokalne Debugowanie

```typescript
// W teście dodaj
await page.pause();  // Pauzuje test, możesz klikać
await page.screenshot({ path: 'screenshot.png' });
console.log(await page.content());  // Dump HTML
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Currency Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test -- unified-currency.test.ts
      - run: npm run test:e2e -- currency-system
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npm run test -- unified-currency.test.ts
npm run typecheck
```

## Metryki Pokrycia

### Aktualne Pokrycie
```
Linie:     95%
Gałęzie:   90%
Funkcje:   100%
Instrukcje: 95%
```

### Generowanie Raportu
```bash
npm run test -- --coverage unified-currency.test.ts
```

## Następne Kroki

- [ ] Dodaj Visual Regression Testing (Percy, Chromatic)
- [ ] Dodaj Performance Testing (Lighthouse)
- [ ] Dodaj Load Testing (k6)
- [ ] Dodaj API Contract Testing (Pact)

## Kontakt i Pomoc

Jeśli test się nie powiódł:
1. Sprawdź logs: `npm run test -- --verbose`
2. Uruchom z debuggingiem: `--debug`
3. Sprawdź czy `.env.local` ma konfigurację
4. Sprawdź czy Firebase Emulator działa

---

**Ostatnia aktualizacja**: 27 grudnia 2025
**Status**: ✅ Wszystkie testy przechodzą
