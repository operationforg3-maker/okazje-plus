# System Testów Automatycznych

## Przegląd

System testów automatycznych umożliwia kompleksowe testowanie aplikacji z poziomu panelu administracyjnego. Testy są podzielone na trzy kategorie: **techniczne**, **funkcjonalne** i **biznesowe**.

## Architektura

### 1. Test Service (`src/lib/test-service.ts`)

Centralna logika testów. Eksportuje:

- **`TestResult`** - interfejs wyniku pojedynczego testu
  - `id`: string - unikalny identyfikator
  - `name`: string - nazwa testu
  - `category`: 'technical' | 'functional' | 'business'
  - `status`: 'pass' | 'fail' | 'warning' | 'skip'
  - `message`: string - opis wyniku
  - `duration`: number - czas wykonania w ms
  - `details?`: any - dodatkowe informacje

- **`TestSuiteResult`** - interfejs wyniku całego zestawu testów
  - `timestamp`: string - ISO timestamp
  - `duration`: number - całkowity czas wykonania
  - `totalTests`: number - liczba wszystkich testów
  - `passed`: number - zaliczone
  - `failed`: number - niezaliczone
  - `warnings`: number - ostrzeżenia
  - `skipped`: number - pominięte
  - `results`: TestResult[] - szczegółowe wyniki

- **`runAllTests()`** - główna funkcja uruchamiająca wszystkie testy

### 2. API Endpoint (`src/app/api/admin/tests/run/route.ts`)

**POST /api/admin/tests/run**

Endpoint uruchamiający testy. Wymaga autentykacji (header `Authorization`).

**Request:**
```bash
POST /api/admin/tests/run
Authorization: Bearer admin
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "duration": 2340,
    "totalTests": 14,
    "passed": 11,
    "failed": 1,
    "warnings": 2,
    "skipped": 0,
    "results": [...]
  }
}
```

**GET /api/admin/tests/run**

Zwraca informacje o dostępnych testach.

### 3. UI Component (`src/components/admin/tests-tab.tsx`)

Komponent React z interfejsem użytkownika:

- Przycisk "Uruchom Testy"
- Loading state podczas wykonywania
- Karty podsumowania (total, passed, failed, warnings, duration)
- Szczegółowe wyniki grupowane po kategoriach
- Expandable details dla każdego testu
- Color-coded status indicators

### 4. Integracja z Admin Panel (`src/app/admin/page.tsx`)

Zakładka "Testy" dodana do głównego panelu administracyjnego jako piąta zakładka obok Hot Deals, Top Products, Moderation i Activity.

## Testy

### Testy Techniczne (3)

1. **tech-001: Firestore Connection**
   - Weryfikuje połączenie z Firestore
   - Próbuje pobrać 1 dokument z kolekcji deals

2. **tech-002: Collections Exist**
   - Sprawdza istnienie kluczowych kolekcji: deals, products, users, categories, notifications
   - Warning jeśli któraś brakuje

3. **tech-003: Firestore Indexes**
   - Testuje composite index: `status + temperature desc`
   - Warning jeśli brakuje indeksu (link do Firebase Console)

### Testy Funkcjonalne (5)

4. **func-001: Deals CRUD Operations**
   - Odczyt deals z Firestore
   - Walidacja struktury (wymagane pola: title, price, link, mainCategorySlug, temperature, status)
   - Warning jeśli brak danych

5. **func-002: Products CRUD Operations**
   - Odczyt products z Firestore
   - Walidacja struktury (wymagane pola: name, price, affiliateUrl, mainCategorySlug, ratingCard)
   - Warning jeśli brak danych

6. **func-003: Comments Counter Accuracy**
   - Porównuje `commentsCount` w dokumencie z rzeczywistą liczbą komentarzy w subkolekcji
   - Fail jeśli liczby się nie zgadzają
   - Skip jeśli brak deals z komentarzami

7. **func-004: Voting System Logic**
   - Sprawdza poprawność temperatury względem liczby głosów
   - Oczekiwany zakres: `voteCount * 10` do `voteCount * 10 + 100`
   - Warning jeśli temperatura nietypowa
   - Skip jeśli brak deals z głosami

8. **func-005: Categories Structure**
   - Weryfikuje istnienie kategorii i podkategorii
   - Fail jeśli brak kategorii (krytyczne dla nawigacji)
   - Zwraca liczby: main categories, subcategories

### Testy Biznesowe (6)

9. **biz-001: Approved Content Availability**
   - Liczba zatwierdzonych deals i products
   - Warning jeśli brak zatwierdzonych treści (puste strony dla użytkowników)

10. **biz-002: Moderation Queue Status**
    - Liczba elementów oczekujących na moderację (status: draft, pending)
    - Warning jeśli kolejka > 50 elementów

11. **biz-003: User Activity Metrics**
    - Całkowita liczba użytkowników
    - Liczba deals dodanych w ostatnich 30 dniach
    - Warning jeśli brak użytkowników

12. **biz-004: Hot Deals Presence**
    - Liczba "gorących" deals (temperatura >= 300)
    - Warning jeśli brak (homepage może wyglądać pusto)

13. **biz-005: Data Quality Check**
    - Procent deals bez obrazków
    - Liczba deals bez opisów
    - Warning jeśli > 30% bez obrazków

## Użycie

### Z Panelu Admina

1. Przejdź do `/admin`
2. Kliknij zakładkę "Testy"
3. Kliknij przycisk "Uruchom Testy"
4. Poczekaj na wyniki (zazwyczaj 2-5 sekund)
5. Przejrzyj szczegółowe wyniki:
   - Zielone = Pass ✅
   - Czerwone = Fail ❌
   - Żółte = Warning ⚠️
   - Szare = Skip ⏭️
6. Kliknij kartę testu aby zobaczyć szczegóły (details JSON)

### Programowo

```typescript
import { runAllTests } from '@/lib/test-service';

const results = await runAllTests();
console.log(`Passed: ${results.passed}/${results.totalTests}`);
console.log(`Duration: ${results.duration}ms`);

results.results.forEach(test => {
  if (test.status === 'fail') {
    console.error(`FAILED: ${test.name} - ${test.message}`);
  }
});
```

### Przez API

```bash
curl -X POST http://localhost:9002/api/admin/tests/run \
  -H "Authorization: Bearer admin" \
  -H "Content-Type: application/json"
```

## Interpretacja Wyników

### Status Codes

- **Pass (green)**: Test zaliczony, wszystko działa poprawnie
- **Fail (red)**: Test niezaliczony, wymaga natychmiastowej uwagi
- **Warning (amber)**: Potencjalny problem, nie krytyczny ale warto sprawdzić
- **Skip (gray)**: Test pominięty, brak danych do przetestowania

### Typowe Scenariusze

#### Wszystko OK
```
Total: 14 | Passed: 14 | Failed: 0 | Warnings: 0 | Skipped: 0
```
Aplikacja działa idealnie.

#### Brak Danych Testowych
```
Total: 14 | Passed: 8 | Failed: 0 | Warnings: 4 | Skipped: 2
```
Aplikacja działa, ale brakuje danych (normalne w środowisku dev).

#### Problemy Techniczne
```
Total: 14 | Passed: 10 | Failed: 3 | Warnings: 1 | Skipped: 0
```
Sprawdź failed tests - mogą wskazywać na:
- Brak indeksów Firestore
- Problemy z połączeniem
- Błędy w logice biznesowej

#### Problemy z Jakością Danych
```
Total: 14 | Passed: 12 | Failed: 0 | Warnings: 2 | Skipped: 0
```
Warning zazwyczaj oznacza problemy z contentem:
- Brak obrazków w deals
- Duża kolejka moderacji
- Brak hot deals

## Rozszerzanie Systemu

### Dodawanie Nowego Testu

1. **Utwórz funkcję testową w `test-service.ts`:**

```typescript
async function testMyFeature(): Promise<{ 
  status: TestResult['status']; 
  message: string; 
  details?: any 
}> {
  try {
    // Your test logic
    const result = await someCheck();
    
    if (result.isValid) {
      return { 
        status: 'pass', 
        message: 'Feature works correctly' 
      };
    } else {
      return { 
        status: 'fail', 
        message: 'Feature broken',
        details: { reason: result.error }
      };
    }
  } catch (error: any) {
    return { 
      status: 'fail', 
      message: `Error: ${error.message}` 
    };
  }
}
```

2. **Dodaj do `runAllTests()`:**

```typescript
export async function runAllTests(): Promise<TestSuiteResult> {
  // ... existing code ...
  
  results.push(await runTest(
    'func-006', 
    'My New Feature', 
    'functional', 
    testMyFeature
  ));
  
  // ... rest of tests ...
}
```

3. **Restart dev server** - testy są uruchamiane server-side

### Dodawanie Nowej Kategorii

Jeśli chcesz dodać czwartą kategorię (np. 'security'):

1. Rozszerz typ w `TestResult`:
```typescript
category: 'technical' | 'functional' | 'business' | 'security';
```

2. Dodaj nową sekcję w `tests-tab.tsx` do grupowania:
```typescript
{groupedResults?.security && (
  <div>
    <h3>Security Tests</h3>
    {/* ... render tests ... */}
  </div>
)}
```

## Troubleshooting

### Test Timeout
Jeśli testy nie kończą się w rozsądnym czasie (> 30s):
- Sprawdź connection do Firestore
- Ogranicz `limit()` w queries
- Użyj `getCountFromServer()` zamiast `getDocs()` gdzie możliwe

### False Positives
Jeśli testy przechodzą ale aplikacja nie działa:
- Dodaj więcej asercji w testach
- Sprawdź edge cases
- Dodaj testy integracyjne (E2E)

### Memory Issues
Przy dużych kolekcjach (> 100k dokumentów):
- Użyj pagination w testach
- Ogranicz zakres czasowy queries
- Użyj aggregation queries zamiast pobierania wszystkich docs

## Najlepsze Praktyki

1. **Uruchamiaj testy regularnie** - przed każdym deployment
2. **Monitoruj trendy** - zapisuj wyniki w Firestore dla historii
3. **Reaguj na warnings** - dzisiaj warning, jutro fail
4. **Rozszerzaj suite** - dodawaj testy dla nowych features
5. **Dokumentuj oczekiwania** - każdy test powinien mieć jasny cel

## Przyszłe Rozszerzenia

### Planowane Features

- **Test History**: Zapis wyników w Firestore + wykres trendów
- **Scheduled Tests**: Automatyczne uruchamianie co 1h/24h
- **Email Alerts**: Powiadomienia gdy testy failują
- **Performance Tests**: Testy szybkości queries
- **E2E Tests**: Testy UI z Playwright
- **CI/CD Integration**: Automatyczne testy w GitHub Actions

### Nice to Have

- Export wyników do PDF
- Porównanie wyników (diff między runs)
- Test coverage metrics
- Custom test suites (wybór konkretnych testów)
- Test mocking dla isolated testing

## Wydajność

Typowe czasy wykonania (na localhost z lokalnym Firestore emulator):

- **Technical Tests**: ~200-500ms
- **Functional Tests**: ~800-1500ms
- **Business Tests**: ~600-1200ms
- **Total Suite**: ~2-4 sekund

W produkcji (Firebase hosting + cloud Firestore):
- **Total Suite**: ~3-8 sekund (zależnie od network latency)

## Security Notes

⚠️ **TODO**: Aktualnie endpoint używa prostego Bearer token check. W produkcji należy:

1. Zintegrować z Firebase Auth
2. Sprawdzać user role (isAdmin)
3. Rate limiting (max 1 run na 5 minut per user)
4. Audit logging (kto i kiedy uruchomił testy)

## Podsumowanie

System testów automatycznych dostarcza:
- ✅ Szybką weryfikację stanu aplikacji
- ✅ Wczesne wykrywanie problemów
- ✅ Dokumentację oczekiwanych zachowań
- ✅ Confidence przed deploymentem
- ✅ Visibility dla całego teamu (nie tylko devs)

Uruchamiaj regularnie i utrzymuj testy aktualne wraz z rozwojem aplikacji! 🚀
