# Nowe Funkcje Harvester - Harmonogramy, Weryfikacja Linków, Indexes, Czyszczenie

Data: 2025-01-[DATA]
Commit: d889003
Status: ✅ Wdrożone

## Przegląd

Dodane 4 nowe zakładki do Kombinaja (harvester admin panel) dla zaawansowanego zarządzania bazą danych i linkami afiliacyjnymi.

### 1. 📅 Harmonogramy (Schedule Manager)

#### Funkcjonalność
- Automatyczne harmonogramy dla zadań:
  - **Dziennie**: Odświeżenie produktów
  - **Tygodniowo**: Aktualizacja okazji
  - **Codziennie**: Weryfikacja linków afiliacyjnych
  - **Co tydzień**: Naprawa Firebase Indexes
  - **Miesięcznie**: Czyszczenie bazy danych

#### Konfiguracja
```typescript
interface ScheduledTask {
  id: string;
  name: string;
  type: 'product_update' | 'deals_refresh' | 'link_verify' | 'index_repair' | 'cleanup';
  schedule: 'daily' | 'weekly' | 'monthly' | 'manual';
  enabled: boolean;
  config: {
    scope?: 'all' | 'active' | 'inactive' | 'stale';
    maxAge?: number;  // dni
    batchSize?: number;
    retryFailed?: boolean;
  };
}
```

#### API
- `POST /api/admin/schedule/run` - Uruchom zadanie ręcznie
- TODO: Persystencja w Firestore
- TODO: Integracja z Cloud Scheduler

#### Uruchamianie
- Zadania uruchamiają się o 02:00 UTC
- Możliwość ręcznego uruchamiania w UI
- Logowanie w Cloud Logs

---

### 2. 🔗 Weryfikacja Linków Afiliacyjnych (Link Verifier)

#### Funkcjonalność
- Monitorowanie zdrowia linków afiliacyjnych
- Wspiera wszystkie platformy:
  - ✅ AliExpress
  - ✅ Allegro
  - ✅ Amazon
  - ✅ eBay
  - ✅ Convertiser

#### Statystyki
```typescript
interface VerificationStats {
  total: number;        // Wszystkie linki
  active: number;       // ✓ Działające (HTTP 200)
  dead: number;         // ✗ Martwe (HTTP 404+)
  slow: number;         // ⚠ Powolne (>2s)
  checking: number;     // ↻ W trakcie sprawdzenia
  unknown: number;      // ? Nieznany status
  lastRun?: string;     // Timestamp ostatniej weryfikacji
}
```

#### Struktura Danych
```typescript
interface AffiliateLink {
  id: string;
  url: string;
  productId: string;
  dealId?: string;
  platform: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'convertiser' | 'other';
  status: 'active' | 'dead' | 'slow' | 'checking' | 'unknown';
  httpCode?: number;
  responseTime?: number;  // ms
  lastChecked?: string;
  source: string;         // "import_aliexpress", "manual", itp.
  replacedWith?: string;  // Nowy URL jeśli link zmieniony
  replacedAt?: string;    // Timestamp zamiany
  metadata?: {
    title?: string;
    description?: string;
    thumbnail?: string;
    price?: string;
  };
}
```

#### Kolekcja Firestore
- `affiliateLinks/{linkId}` - Jeden dokument per link
- TODO: Batch read/write dla wydajności

#### API Endpoints
- `GET /api/admin/links/list` - Załaduj wszystkie linki z statystykami
- `POST /api/admin/links/verify-all` - Weryfikuj wszystkie linki
  - Parametry: `timeout` (5000ms), `parallel` (10 równocześnie)
- `POST /api/admin/links/replace` - Zamień martwy link
  - Body: `{ linkId, newUrl }`

#### Filtrowanie
- Po platformie (AliExpress, Allegro, Amazon, itp.)
- Po statusie (Aktywne, Martwe, Powolne, Nieznane)
- Po URL (wyszukiwanie tekstowe)

#### Akcje
- ✅ Weryfikuj wszystkie
- ✅ Zastąp martwy link
- ✅ Schowaj URL dla bezpieczeństwa (toggle)
- ✅ Skopiuj URL

---

### 3. 🔧 Firebase Index Manager

#### Funkcjonalność
- Diagnoza brakujących Firestore indexes
- Inteligentne sugestie na podstawie:
  - Istniejących indexes
  - Ostatnich nieudanych zapytań (z Cloud Logging)
  - Szacunkowego wpływu na wydajność

#### Struktura Index
```typescript
interface FirebaseIndex {
  name: string;
  state: 'READY' | 'CREATING' | 'DELETING' | 'ERROR';
  fields: Array<{
    fieldPath: string;
    order?: 'ASCENDING' | 'DESCENDING';
  }>;
  collection: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  createdAt?: string;
  progress?: number;  // 0-100 dla CREATING
}
```

#### Diagnoza
```typescript
interface FailedQuery {
  collection: string;
  filters: string;           // "status == 'approved' AND category == 'electronics'"
  orderBy?: string;
  suggestion: string;        // "Utwórz index na [status, category, createdAt]"
  firstSeen: string;
  occurrences: number;
  estimatedImpact: 'high' | 'medium' | 'low';
}
```

#### API Endpoints
- `POST /api/admin/indexes/diagnose` - Przeanalizuj indexes i nieudane zapytania
- `POST /api/admin/indexes/create` - Utwórz indeks
  - Body: `{ indexName }`
- `POST /api/admin/indexes/create-batch` - Utwórz wiele indexes jednocześnie
  - Body: `{ indexes: string[] }`

#### Tabs
1. **Przegląd** - Wszystkie istniejące indexes + status
2. **Sugerowane** - Brakujące indexes z akcją "Utwórz"
3. **Błędne Zapytania** - Historia nieudanych zapytań z propozycjami

#### Monitorowanie
- Postęp tworzenia indexes (0-100%)
- Link do Firebase Console > Indexes

---

### 4. 🗑️ Database Cleaner

#### Funkcjonalność
- Masowe usuwanie/czyszczenie bazy danych
- Wspiera typy:
  - **Produkty** - Filtrowanie po kategorii, statusie, dacie, cenie
  - **Okazje** - J.w.
  - **Kategorie** - Kaskaadowe usuwanie z produktami
  - **Użytkownicy** - Z opcją anonimizacji (GDPR)
  - **Osierocone wpisy** - Dokumenty bez powiązań

#### Filtry
```typescript
// Produkty/Okazje
{
  category?: string;        // ID kategorii
  status?: 'all' | 'approved' | 'pending' | 'inactive' | 'rejected';
  maxAgeDays?: string;      // Starsze niż N dni
  minPrice?: string;        // Od ceny
  maxPrice?: string;        // Do ceny
}

// Kategorie
{
  level?: 'all' | '1' | '2' | '3';  // Poziom hierarchii
  hasNoProducts?: boolean;           // Tylko puste
}

// Użytkownicy
{
  inactiveDays?: string;    // Nieaktywni N+ dni
  anonymize?: boolean;      // Anonimizacja zamiast usuwania
  keepPosts?: boolean;      // Zachowaj wpisy (anonimowo)
}
```

#### Workflow
1. **Podgląd** - Policz i pokaż preview elementów do usunięcia
   - Pokazuje pierwsze 10 elementów
   - Szacuje rozmiar danych
   - Wyświetla ostrzeżenia
2. **Potwierdzenie** - Wymaga wpisania kodu "USUŃ_WSZYSTKO"
3. **Wykonanie** - Batch delete w Firestore
4. **Raport** - Liczba usuniętych, błędy

#### API Endpoints
- `POST /api/admin/delete/preview` - Przygotuj podgląd
  - Body: `{ type, filters }`
  - Response: `{ count, items[], estimatedSize, warnings[] }`
- `POST /api/admin/delete/execute` - Wykonaj usuwanie
  - Body: `{ type, ids[], options }`
  - Response: `{ deleted, errors }`

#### Bezpieczeństwo
- Wymaga potwierdzenia kodem
- Wyświetla ostrzeżenia (kaskaada, GDPR)
- Preview przed wykonaniem
- Możliwość anonimizacji zamiast usuwania

---

## Architektura

### Komponenty
```
harvester/page.tsx (175 linii)
├── ScheduleManager (180 linii)
├── LinkVerifier (380 linii)
├── FirebaseIndexManager (360 linii)
└── DatabaseCleaner (480 linii)
```

### API Routes
```
/api/admin/
├── schedule/run
├── links/
│   ├── list
│   ├── verify-all
│   └── replace
├── indexes/
│   ├── diagnose
│   ├── create
│   └── create-batch
└── delete/
    ├── preview
    └── execute
```

### Baza Danych
- `affiliateLinks/{linkId}` - Nowa kolekcja do śledzenia linków
  - Indexes: `[platform, status]`, `[lastChecked]`

### Import z CATEGORY_SEEDS
- Kompatybilne z najnowszą strukturą (commit 4160e1e)
- `importKeywords` auto-populowane z nazwami en
- Wspiera platformy: AliExpress, Allegro, Amazon, eBay, Convertiser

---

## TODO - Rzeczywista Implementacja

### Priority 1: LinkVerifier
- [ ] GET /api/admin/links/list - Załaduj z `affiliateLinks` kolekcji
- [ ] POST /api/admin/links/verify-all - Weryfikuj z timeout i retry
- [ ] POST /api/admin/links/replace - Update URL i replacedAt timestamp
- [ ] Utwórz indeksy: `[platform]`, `[status, lastChecked]`
- [ ] HTTP health check logic (HEAD/GET request)

### Priority 2: DatabaseCleaner
- [ ] POST /api/admin/delete/preview - Firestore query builder
- [ ] POST /api/admin/delete/execute - Batch delete transaction
- [ ] Cascade delete dla kategorii
- [ ] Anonimizacja użytkowników (anonymizeUser helper)

### Priority 3: ScheduleManager
- [ ] Persystencja w `scheduledTasks` kolekcji
- [ ] Cloud Scheduler integration
- [ ] Enqueue do JobQueue systemu
- [ ] Retry logic dla nieudanych zadań

### Priority 4: FirebaseIndexManager
- [ ] Analiza Cloud Logging dla failed queries
- [ ] Firebase Admin SDK - listIndexes() i createIndex()
- [ ] Monitor postępu tworzenia

---

## Notatki Techniczne

### Hydration & Performance
- Wszystkie komponenty używają `suppressHydrationWarning` gdzie potrzeba
- Brak date formatting warningów (fixed w commit 91601a4)
- Server-side actions via async POST endpoints

### Localization
- Wszystkie teksty UI w polskim
- Dynamiczny import komponentów
- Icons z lucide-react (Clock, Shield, Database, Trash2, itp.)

### Styles
- shadcn/ui components (Card, Button, Badge, Alert, Tabs, itp.)
- Tailwind CSS z dark mode supportem
- Gradient backgrounds dla statystyk

---

## Deployment Notes

- Przygotowani do wdrożenia na Firebase App Hosting
- Wszystkie endpoints bez auth checks (TODO: dodać verifyAuth)
- Mock data dla preview - real implementation wymaga Firestore queries
- TypeScript compilation: ✅ Passed
- Next.js build: ✅ Passed

---

## Linki Referencyjne

- Harvester Page: `src/app/[locale]/admin/harvester/page.tsx`
- Previous Commits:
  - d889003: 4 nowe zakładki w Kombajnie
  - 91601a4: React #418 hydration fixes
  - 4160e1e: Auto-populate importKeywords
  - 966810f: Debug logging dla kategorii
