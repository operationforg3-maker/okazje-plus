# System Testów Automatycznych

## Przegląd

System testów automatycznych umożliwia kompleksowe testowanie aplikacji z poziomu panelu administracyjnego. Testy są podzielone na cztery kategorie: **techniczne**, **funkcjonalne**, **biznesowe** i **security** (bezpieczeństwo Firestore).

## Architektura

### 1. Test Service (`src/lib/test-service.ts`)

Centralna logika testów. Eksportuje:

- **`TestResult`** - interfejs wyniku pojedynczego testu
  - `id`: string - unikalny identyfikator
  - `name`: string - nazwa testu
  - `category`: 'technical' | 'functional' | 'business' | 'security'
  - `status`: 'pass' | 'fail' | 'warning' | 'skip'
  - `message`: string - opis wyniku
  - `duration`: number - czas wykonania w ms
  - `details?`: any - dodatkowe informacje

- **`TestAuthOptions`** - opcje uwierzytelniania dla testów security
  - `userEmail?`: string - email testowego użytkownika
  - `userPassword?`: string - hasło testowego użytkownika
  - `adminEmail?`: string - email testowego admina
  - `adminPassword?`: string - hasło testowego admina
  - `preferAnonymous?`: boolean - użyj anonimowego użytkownika

- **`TestSuiteResult`** - interfejs wyniku całego zestawu testów
  - `timestamp`: string - ISO timestamp
  - `duration`: number - całkowity czas wykonania
  - `totalTests`: number - liczba wszystkich testów
  - `passed`: number - zaliczone
  - `failed`: number - niezaliczone
  - `warnings`: number - ostrzeżenia
  - `skipped`: number - pominięte
  - `results`: TestResult[] - szczegółowe wyniki

- **`runAllTests(options?: TestAuthOptions)`** - główna funkcja uruchamiająca wszystkie testy

### 2. API Endpoint (`src/app/api/admin/tests/run/route.ts`)

**POST /api/admin/tests/run**

Endpoint uruchamiający testy. Wymaga autentykacji (header `Authorization`).

**Request:**
```bash
POST /api/admin/tests/run
Authorization: Bearer admin
Content-Type: application/json

{
  "userEmail": "test@example.com",
  "userPassword": "testpass",
  "adminEmail": "admin@example.com",
  "adminPassword": "adminpass"
}
```

**Zmienne środowiskowe (fallback):**
- `TEST_USER_EMAIL` - email testowego użytkownika
- `TEST_USER_PASSWORD` - hasło testowego użytkownika
- `TEST_ADMIN_EMAIL` - email testowego admina
- `TEST_ADMIN_PASSWORD` - hasło testowego admina

**Response (success):**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "duration": 2340,
    "totalTests": 26,
    "passed": 21,
    "failed": 1,
    "warnings": 2,
    "skipped": 2,
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

### Testy Biznesowe (5)

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

### Testy Security (13)

Testują reguły bezpieczeństwa Firestore dla różnych ról użytkowników. **Wymagają poświadczeń testowych użytkowników** (przekazanych przez API lub zmienne środowiskowe).

14. **sec-001: Guest Read Approved Deal**
    - Gość (niezalogowany) może odczytać zatwierdzone deale
    - Pass jeśli odczyt się udał

15. **sec-002: Guest Read Draft Deal Should Fail**
    - Gość NIE może odczytać draft deals
    - Pass jeśli odczyt zablokowany przez reguły

16. **sec-003: User Create Draft Deal**
    - Zalogowany user może stworzyć draft deal
    - Skip jeśli brak poświadczeń użytkownika

17. **sec-004: User Update Own Deal**
    - User może edytować własny draft deal
    - Pass jeśli update się udał

18. **sec-005: User Cannot Delete Deal**
    - User NIE może usunąć deala (nawet własnego)
    - Pass jeśli delete zablokowany przez reguły

19. **sec-006: Admin Read Draft Deal**
    - Admin może odczytać dowolny draft deal
    - Skip jeśli brak poświadczeń admina

20. **sec-007: Admin Moderate Deal**
    - Admin może zmienić status deala (draft → approved)
    - Pass jeśli update się udał

21. **sec-008: User Vote Updates**
    - User może aktualizować temperature/voteCount
    - Testuje ograniczone update (tylko dozwolone pola)

22. **sec-009: User Add Comment**
    - User może dodać komentarz do zatwierdzonego deala
    - Pass jeśli addDoc się udał

23. **sec-010: User Cannot Edit Others Comment**
    - User NIE może edytować cudzych komentarzy
    - Pass jeśli update zablokowany przez reguły

24. **sec-011: Favorites Isolation**
    - Favorites są prywatne (tylko owner może odczytać)
    - Pass jeśli gość nie może odczytać cudzego favorita

25. **sec-012: Notifications Isolation**
    - Notyfikacje są prywatne (tylko owner może odczytać)
    - Pass jeśli gość nie może odczytać cudzej notyfikacji

26. **sec-013: Product Rating Own Doc**
    - User może ustawić własną ocenę produktu (doc ID = user ID)
    - Pass jeśli setDoc się udał

## Użycie

### Z Panelu Admina

1. Przejdź do `/admin`
2. Kliknij zakładkę "Testy"
3. Kliknij przycisk "Uruchom Testy"
4. Poczekaj na wyniki (zazwyczaj 5-10 sekund z testami security)
5. Przejrzyj szczegółowe wyniki:
   - Zielone = Pass ✅
   - Czerwone = Fail ❌
   - Żółte = Warning ⚠️
   - Szare = Skip ⏭️
6. Kliknij kartę testu aby zobaczyć szczegóły (details JSON)

**Uwaga:** Testy security będą **skipped** jeśli nie przekażesz poświadczeń testowych użytkowników (przez API POST body lub zmienne środowiskowe).

### Programowo

```typescript
import { runAllTests } from '@/lib/test-service';

// Bez testów security
const results = await runAllTests();

// Z testami security (pełne)
const resultsWithSecurity = await runAllTests({
  userEmail: 'testuser@example.com',
  userPassword: 'testpass123',
  adminEmail: 'admin@example.com',
  adminPassword: 'adminpass123'
});

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
# Bez testów security
curl -X POST http://localhost:9002/api/admin/tests/run \
  -H "Authorization: Bearer admin" \
  -H "Content-Type: application/json"

# Z testami security (pełna weryfikacja reguł)
curl -X POST http://localhost:9002/api/admin/tests/run \
  -H "Authorization: Bearer admin" \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "testuser@example.com",
    "userPassword": "testpass123",
    "adminEmail": "admin@example.com",
    "adminPassword": "adminpass123"
  }'
```

**Zmienne środowiskowe (alternatywa):**

Ustaw w `.env.local` lub environment:
```bash
TEST_USER_EMAIL=testuser@example.com
TEST_USER_PASSWORD=testpass123
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=adminpass123
```

## Interpretacja Wyników

### Status Codes

- **Pass (green)**: Test zaliczony, wszystko działa poprawnie
- **Fail (red)**: Test niezaliczony, wymaga natychmiastowej uwagi
- **Warning (amber)**: Potencjalny problem, nie krytyczny ale warto sprawdzić
- **Skip (gray)**: Test pominięty, brak danych do przetestowania lub poświadczeń

### Typowe Scenariusze

#### Wszystko OK
```
Total: 26 | Passed: 24 | Failed: 0 | Warnings: 0 | Skipped: 2
```
Aplikacja działa idealnie. Security tests skipped (brak credentials).

#### Pełna Weryfikacja z Security
```
Total: 26 | Passed: 26 | Failed: 0 | Warnings: 0 | Skipped: 0
```
Wszystkie testy (włącznie z security) zaliczone.

#### Brak Danych Testowych
```
Total: 26 | Passed: 12 | Failed: 0 | Warnings: 4 | Skipped: 10
```
Aplikacja działa, ale brakuje danych (normalne w środowisku dev).

#### Problemy Techniczne
```
Total: 26 | Passed: 18 | Failed: 4 | Warnings: 2 | Skipped: 2
```
Sprawdź failed tests - mogą wskazywać na:
- Brak indeksów Firestore
- Problemy z połączeniem
- Błędy w logice biznesowej
- Nieprawidłowe reguły security (jeśli security tests failed)

#### Problemy z Jakością Danych
```
Total: 26 | Passed: 20 | Failed: 0 | Warnings: 4 | Skipped: 2
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
export async function runAllTests(options?: TestAuthOptions): Promise<TestSuiteResult> {
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
