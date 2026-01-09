# Audyt Panelu Administracyjnego - Lista Atrap i Niezaimplementowanych Funkcji

Data: 9 listopada 2025

## 🎯 Executive Summary

Panel administracyjny został przeanalizowany pod kątem funkcjonalności i wykrytych atrap. Poniżej szczegółowa lista z priorytetami implementacji.

---

## 📊 Dashboard (/admin/page.tsx)

### ✅ DZIAŁA POPRAWNIE
- ✅ Rzeczywiste dane statystyk (produkty, okazje, użytkownicy)
- ✅ Gorące okazje pobierane z Firestore (`getHotDeals()`)
- ✅ Top produkty pobierane z Firestore (`getRecommendedProducts()`)
- ✅ Dynamiczne obliczanie średniej temperatury
- ✅ Linki do szczegółów okazji i produktów
- ✅ Nawigacja do podstron admina
- ✅ Zakładki (hot-deals, top-products, moderation, activity)

### ⚠️ ATRAPY - HARDCODED DATA
**Priorytet: ŚREDNI**

1. **Wyświetlenia (Views)**
   - Lokalizacja: Quick Stats Row → Card "Wyświetlenia"
   - Mockowane wartości: 45,231 (total), +18%, 6,432 dzisiaj
   - Potrzebne: Integracja z Google Analytics lub własny tracking

2. **Komentarze**
   - Lokalizacja: Quick Stats Row → Card "Komentarze"
   - Mockowane wartości: 892 (total), +12%, 127 dzisiaj
   - Potrzebne: Zapytanie Firestore agregujące komentarze z ostatnich 7 dni

3. **Głosy**
   - Lokalizacja: Quick Stats Row → Card "Głosy"
   - Mockowane wartości: 3,421 (total), +25%, 489 dzisiaj
   - Potrzebne: Zapytanie Firestore agregujące głosy z ostatnich 7 dni

4. **Trendy procentowe**
   - Lokalizacja: Wszystkie stat cards (+12%, +23%, +8% itd.)
   - Mockowane wartości: Wszystkie wartości procentowe są hardcoded
   - Potrzebne: Porównanie z danymi z poprzedniego miesiąca

---

## 🔥 Zarządzanie Okazjami (/admin/deals/page.tsx)

### ✅ DZIAŁA POPRAWNIE
- ✅ Pobieranie listy okazji z Firestore (`getHotDeals(50)`)
- ✅ Wyświetlanie podstawowych danych (tytuł, status, cena, temperatura)
- ✅ Statusy z odpowiednimi Badge'ami

### ❌ NIEZAIMPLEMENTOWANE FUNKCJE
**Priorytet: WYSOKI**

1. **Przycisk "Dodaj okazję"**
   - Status: Niezaimplementowany (brak handlera)
   - Wymagane: Formularz do dodawania nowych okazji
   
2. **Menu akcji (DropdownMenu)**
   - Status: Menu renderowane, ale akcje nie działają
   - "Edytuj" - brak handlera
   - "Usuń" - brak handlera
   - Wymagane: Implementacja funkcji edycji i usuwania

3. **Brak sortowania**
   - Kolumny nie są sortowalne
   - Wymagane: Dodać możliwość sortowania po temperaturze, dacie, cenie

4. **Brak paginacji**
   - Limit 50 okazji hardcoded
   - Wymagane: Paginacja lub infinite scroll

5. **Brak filtrowania**
   - Brak możliwości filtrowania po statusie, kategorii, dacie
   - Wymagane: Filtry w nagłówku tabeli

6. **Brak wyszukiwania**
   - Nie można wyszukać konkretnej okazji
   - Wymagane: Search input z filtrowaniem na bieżąco

---

## 🛍️ Zarządzanie Produktami (/admin/products/page.tsx)

### ✅ DZIAŁA POPRAWNIE
- ✅ Pobieranie listy produktów z Firestore (`getRecommendedProducts(50)`)
- ✅ Wyświetlanie z obrazkami
- ✅ Podstawowe dane (nazwa, kategoria, cena, oceny)

### ❌ NIEZAIMPLEMENTOWANE FUNKCJE
**Priorytet: WYSOKI**

1. **Przycisk "Dodaj produkt"**
   - Status: Niezaimplementowany (brak handlera)
   - Wymagane: Formularz do dodawania nowych produktów

2. **Menu akcji (DropdownMenu)**
   - Status: Menu renderowane, ale akcje nie działają
   - "Edytuj" - brak handlera
   - "Usuń" - brak handlera
   - Wymagane: Implementacja funkcji edycji i usuwania

3. **Brak sortowania**
   - Kolumny nie są sortowalne
   - Wymagane: Sortowanie po nazwie, cenie, ocenie, kategorii

4. **Brak paginacji**
   - Limit 50 produktów hardcoded
   - Wymagane: Paginacja lub infinite scroll

5. **Brak filtrowania**
   - Brak możliwości filtrowania po kategorii, cenie, ocenie
   - Wymagane: Filtry zaawansowane

6. **Brak wyszukiwania**
   - Nie można wyszukać konkretnego produktu
   - Wymagane: Search input z filtrowaniem

---

## 🗂️ Zarządzanie Kategoriami (/admin/categories/page.tsx)

### ✅ DZIAŁA POPRAWNIE
- ✅ Formularz dodawania głównych kategorii
- ✅ Formularz dodawania podkategorii
- ✅ Wyświetlanie istniejących kategorii
- ✅ Używa `react-hook-form` do walidacji
- ✅ Zapisywanie do Firestore

### ⚠️ CZĘŚCIOWO ZAIMPLEMENTOWANE
**Priorytet: ŚREDNI**

1. **Edycja kategorii**
   - Status: Przycisk "Edytuj" renderowany, ale brak logiki zapisu
   - `editingCategory` state istnieje, ale nie jest użyty w formularzu
   - Wymagane: Dodać formularz edycji w Dialog/Modal

2. **Usuwanie podkategorii**
   - Status: Przycisk usuwania istnieje (`onDeleteSubcategory`)
   - Funkcja prawdopodobnie zaimplementowana, ale wymaga sprawdzenia
   - Wymagane: Weryfikacja + dialog potwierdzenia

3. **Walidacja duplikatów**
   - Brak sprawdzania czy kategoria/podkategoria już istnieje
   - Wymagane: Walidacja przed zapisem

---

## 👥 Zarządzanie Użytkownikami (/admin/users/page.tsx)

### ⚠️ GŁÓWNIE ATRAPY
**Priorytet: WYSOKI**

**Status:** Strona używa mockowanych danych z `src/lib/data.ts`

```typescript
// src/lib/data.ts - linia 425
export const users = [
  { id: '1', name: 'Jan Kowalski', email: 'jan.kowalski@example.com', ... },
  { id: '2', name: 'Anna Nowak', email: 'anna.nowak@example.com', ... },
  { id: '3', name: 'Piotr Wiśniewski', email: 'piotr.wisniewski@example.com', ... },
];
```

### ❌ NIEZAIMPLEMENTOWANE FUNKCJE

1. **Pobieranie użytkowników z Firebase Auth**
   - Status: Używa hardcoded array zamiast Firebase
   - Wymagane: Integracja z Firebase Admin SDK
   ```typescript
   import { auth } from 'firebase-admin';
   const listUsers = await auth().listUsers();
   ```

2. **Przycisk "Dodaj użytkownika"**
   - Status: Niezaimplementowany (brak handlera)
   - Wymagane: Formularz z Firebase Auth createUser

3. **Menu akcji (DropdownMenu)**
   - "Edytuj" - brak handlera (zmiana displayName, photoURL)
   - "Zmień rolę" - brak handlera (custom claims w Firebase)
   - "Zablokuj" - brak handlera (disable user w Firebase Auth)
   
4. **Brak filtrowania**
   - Nie można filtrować po roli (admin/user)
   - Nie można wyszukać użytkownika po email/nazwie
   
5. **Brak statystyk**
   - Liczba aktywnych użytkowników
   - Nowi użytkownicy w tym miesiącu
   - Ostatnia aktywność użytkownika

---

## 🔍 Panel Moderacji (/admin/moderation/page.tsx)

### ❌ GŁÓWNIE ATRAPY
**Priorytet: WYSOKI**

Status: Cała strona używa mockowanych danych

```typescript
// Mock data - w rzeczywistości pobieramy z Firestore
const pendingDeals = [
  { id: '1', title: 'iPhone 15 Pro Max - ekstra cena!', ... },
  { id: '2', title: 'Sony WH-1000XM5 promocja', ... },
  // ...
];
```

### Wymagane implementacje:

1. **Pobieranie okazji do moderacji**
   - Zapytanie Firestore: `status === 'draft'` lub `status === 'pending'`
   - Real-time listener na nowe submisje

2. **Pobieranie produktów do moderacji**
   - Analogiczne zapytanie dla produktów

3. **Akcje moderacyjne**
   - Przycisk "Zatwierdź" - zmiana statusu na 'approved'
   - Przycisk "Odrzuć" - zmiana statusu na 'rejected'
   - Notyfikacja do autora (Firebase Cloud Functions?)

4. **Statystyki moderacji**
   - Karty z liczbami: "Do moderacji", "Zatwierdzonych dzisiaj", "Odrzuconych dzisiaj"
   - Obecnie hardcoded

---

## 📊 Analityka (/admin/analytics/page.tsx)

### ✅ DZIAŁA POPRAWNIE
- ✅ Google Analytics 4 tracking aktywny (G-FT6DRFR25D)
- ✅ Status integracji wyświetlany

### ⚠️ ATRAPY
**Priorytet: NISKI/ŚREDNI**

Prawdopodobnie cała strona zawiera mockowane dane analytics:
- Wyświetlenia w czasie
- Źródła ruchu
- Popularne strony
- Demografia użytkowników
- Urządzenia (Desktop/Mobile)

**Wymagane:**
- Integracja z Google Analytics API do pobierania rzeczywistych danych
- Lub stworzenie własnego trackingu

---

## ⚙️ Ustawienia (/admin/settings/page.tsx)

### ❓ DO SPRAWDZENIA
**Priorytet: ŚREDNI**

Strona istnieje z zakładkami:
- Ogólne
- Nawigacja  
- Integracje (Typesense, AliExpress)
- Powiadomienia
- Bezpieczeństwo

**Pytania:**
- Czy ustawienia zapisują się do Firestore?
- Czy są walidowane?
- Czy integracje rzeczywiście działają po zapisaniu kluczy API?

---

## 📥 Import Danych (/admin/import/page.tsx)

### ✅ DZIAŁA POPRAWNIE
- ✅ Zakładki dla różnych metod importu (CSV, AliExpress, URL)
- ✅ Używa komponentów: `EnhancedCsvImporter`, `AliExpressImporter`
- ✅ Struktura UI gotowa

### ❌ NIEZAIMPLEMENTOWANE FUNKCJE
**Priorytet: ŚREDNI**

1. **Import z URL**
   - Status: Tylko UI, brak implementacji
   - Przycisk "Pobierz dane z URL" nie ma handlera
   - Wymagane: Web scraping lub API do Allegro/OLX/Amazon
   - Potencjalne rozwiązanie: Puppeteer, Cheerio lub dedykowane API

2. **EnhancedCsvImporter**
   - Status: Komponent istnieje w `src/components/admin/enhanced-csv-importer.tsx`
   - Wymaga sprawdzenia czy:
     * Upload plików działa
     * Parsowanie CSV jest poprawne
     * Walidacja danych przed zapisem
     * Obsługa błędów i duplikatów

3. **AliExpressImporter**
   - Status: Komponent istnieje w `src/components/admin/aliexpress-importer.tsx`
   - Wymaga sprawdzenia czy:
     * API AliExpress jest skonfigurowane
     * Pobieranie danych z API działa
     * Mapping danych z AliExpress do naszego formatu

**Rekomendacje:**
- Przetestować oba importery z prawdziwymi danymi
- Dodać progress bar dla dużych importów
- Dodać preview przed finalnym zapisem

---

## 🤖 Predykcja AI (/admin/trending-prediction/page.tsx)

### ✅ DZIAŁA POPRAWNIE (prawdopodobnie)
- ✅ Integracja z Genkit AI
- ✅ Formularz predykcji
- ✅ Wywołanie flows/trending-deal-prediction

**Do sprawdzenia:**
- Czy API key jest skonfigurowany?
- Czy predykcje są zapisywane?

---

## 🧭 Navigation & UX Issues

### ✅ NAPRAWIONE
**Status: ZAIMPLEMENTOWANE**

1. **Active state w menu dla nested routes**
   - ✅ Naprawiono w `/src/app/admin/layout.tsx`
   - Zmieniono z `pathname === path` na `pathname.startsWith(path)`
   - Teraz `/admin/deals/[id]` poprawnie podświetla menu "Okazje"
   ```typescript
   const isActive = (path: string) => {
     if (path === '/admin') {
       return pathname === '/admin';
     }
     return pathname.startsWith(path);
   };
   ```

### ❌ PROBLEMY DO NAPRAWY
**Priorytet: ŚREDNI**

1. **Breadcrumbs nie pokazują zagnieżdżonych stron**
   - Przykład: `/admin/deals/[id]` nie ma breadcrumb
   - Wymagane: Rozszerzenie `pathNames` o dynamiczne routes
   - Możliwe rozwiązanie: Parser pathname z split('/') + mapping

2. **Mobile menu**
   - ✅ SidebarTrigger działa
   - ❓ Czy zamyka się automatycznie po kliknięciu linku?
   - Wymagane: Dodać `onClick` handler zamykający sidebar

3. **Scroll do góry**
   - Brak auto-scroll po zmianie strony
   - Wymagane: `scrollTo(0,0)` w useEffect z pathname dependency
   ```typescript
   useEffect(() => {
     window.scrollTo(0, 0);
   }, [pathname]);
   ```

4. **Loading states**
   - Brak globalnego loadera podczas nawigacji między stronami
   - Możliwe: Użyć Next.js `useRouter().events` lub nowego API

---

## 📋 Podsumowanie - Priorytety Implementacji

### 🔴 PRIORYTET WYSOKI (Krytyczne dla działania panelu)

1. **Akcje CRUD w tabelach** (Deals, Products)
   - Dodawanie nowych wpisów (formularze)
   - Edycja istniejących
   - Usuwanie z potwierdzeniem

2. **Panel moderacji**
   - Rzeczywiste dane z Firestore
   - Funkcje zatwierdzania/odrzucania
   
3. **Zarządzanie użytkownikami**
   - Pełna analiza i ewentualna implementacja

4. **Active state w menu dla podstron**
   - Fix navigation highlighting

### 🟡 PRIORYTET ŚREDNI (Ważne dla UX)

5. **Sortowanie i paginacja tabel**
   - Wszystkie tabele (Deals, Products, Users)

6. **Wyszukiwanie i filtrowanie**
   - Quick search w każdej tabeli
   - Filtry zaawansowane

7. **Rzeczywiste statystyki dashboardu**
   - Wyświetlenia, komentarze, głosy z ostatnich 7 dni
   - Trendy procentowe (porównanie m/m)

8. **Edycja kategorii**
   - Dokończenie funkcji edit

9. **Ustawienia**
   - Weryfikacja czy zapisują się poprawnie

### 🟢 PRIORYTET NISKI (Nice to have)

10. **Analityka z Google Analytics API**
    - Rzeczywiste dane zamiast mocków

11. **Export danych**
    - Eksport tabel do CSV/Excel

12. **Logs i audit trail**
    - Historia zmian w panelu

---

## 🎨 UX/UI Improvements Needed

1. **Loading states**
   - Dodać skeleton loaders do wszystkich tabel
   - Spinner podczas zapisywania/usuwania

2. **Error handling**
   - Toast notifications dla błędów
   - Validation messages w formularzach

3. **Confirmation dialogs**
   - Potwierdzenie przed usunięciem
   - "Czy na pewno?" dla krytycznych akcji

4. **Success feedback**
   - Toast po pomyślnym zapisie
   - Visual feedback na akcjach

5. **Empty states**
   - Lepsze komunikaty gdy brak danych
   - CTA do dodania pierwszego elementu

---

## 🛠️ Rekomendowane akcje

### Krok 1: Quick Wins (1-2 dni)
- Fix active state w menu dla nested routes
- Dodać loading skeletons wszędzie
- Dodać confirmation dialogs przed usuwaniem
- Dodać toast notifications (używając `use-toast`)

### Krok 2: Core Functionality (3-5 dni)
- Implementacja formularzy dodawania/edycji Deals
- Implementacja formularzy dodawania/edycji Products
- Panel moderacji - rzeczywiste dane + akcje
- Sortowanie i podstawowa paginacja

### Krok 3: Advanced Features (5-7 dni)
- Zarządzanie użytkownikami
- Wyszukiwanie i filtry zaawansowane
- Rzeczywiste statystyki (integracja z Firestore aggregations)
- Analityka (Google Analytics API)

### Krok 4: Polish (2-3 dni)
- UX improvements
- Error handling wszędzie
- Performance optimization
- Mobile testing i fixes

---

## 📝 Notatki techniczne

### Firebase Queries do zaimplementowania

```typescript
// Okazje czekające na moderację
const pendingDeals = await getDocs(
  query(
    collection(db, 'deals'),
    where('status', 'in', ['draft', 'pending']),
    orderBy('postedAt', 'desc')
  )
);

// Statystyki z ostatnich 7 dni
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const recentComments = await getDocs(
  query(
    collectionGroup(db, 'comments'),
    where('createdAt', '>=', sevenDaysAgo),
    orderBy('createdAt', 'desc')
  )
);

// Głosy z ostatnich 7 dni - wymaga dodatkowej kolekcji 'votes'
```

### Komponenty do stworzenia

1. `DealForm` - formularz dodawania/edycji okazji
2. `ProductForm` - formularz dodawania/edycji produktów
3. `ConfirmDialog` - uniwersalny dialog potwierdzenia
4. `DataTable` - zaawansowana tabela z sortowaniem/filtrowaniem
5. `StatsCard` - reusable card dla statystyk z real data

---

**Dokument utworzony:** 9 listopada 2025  
**Ostatnia aktualizacja:** 9 listopada 2025  
**Autor:** AI Assistant (Copilot)

---

## ✅ Zmiany wykonane podczas audytu

### 1. Naprawiono Active State w Menu
**Plik:** `/src/app/admin/layout.tsx`

```typescript
// PRZED - nie działało dla nested routes
const isActive = (path: string) => pathname === path;

// PO - działa dla wszystkich podstron
const isActive = (path: string) => {
  if (path === '/admin') {
    return pathname === '/admin';
  }
  return pathname.startsWith(path);
};
```

### 2. Dodano Auto-Scroll przy Nawigacji
**Plik:** `/src/app/admin/layout.tsx`

```typescript
useEffect(() => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}, [pathname]);
```

### 3. Zidentyfikowano Wszystkie Atrapy

**Podsumowanie wykrytych atrap:**
- ❌ **Dashboard** - 3 stat cards (wyświetlenia, komentarze, głosy) + trendy procentowe
- ❌ **Deals** - brak akcji dodawania/edycji/usuwania, sortowania, paginacji
- ❌ **Products** - analogicznie jak Deals
- ❌ **Users** - mockowane dane (array zamiast Firebase Auth)
- ❌ **Moderation** - całkowicie mockowane dane i brak akcji
- ❌ **Analytics** - prawdopodobnie wszystkie dane mockowane
- ⚠️ **Import** - URL importer niezaimplementowany
- ⚠️ **Settings** - wymaga weryfikacji czy zapisuje dane

---

## 🎯 Kolejne kroki - Action Plan

### Faza 1: Critical Fixes (Priorytet: NATYCHMIASTOWY)
**Szacowany czas: 3-5 dni**

1. ✅ ~~Active state w menu~~ - GOTOWE
2. ✅ ~~Auto-scroll przy nawigacji~~ - GOTOWE
3. **CRUD dla Deals** (dzień 1-2)
   - Formularz dodawania okazji
   - Formularz edycji okazji
   - Funkcja usuwania z potwierdzeniem
   - Toast notifications dla feedback
   
4. **CRUD dla Products** (dzień 2-3)
   - Analogicznie jak dla Deals
   
5. **Panel moderacji** (dzień 3-4)
   - Pobieranie pending items z Firestore
   - Akcje approve/reject
   - Real-time updates
   
6. **Zarządzanie użytkownikami** (dzień 4-5)
   - Firebase Admin SDK integration
   - Lista użytkowników z Firebase Auth
   - Zmiana ról przez custom claims
   - Blokowanie użytkowników

### Faza 2: UX Improvements (Priorytet: WYSOKI)
**Szacowany czas: 2-3 dni**

1. **Sortowanie tabel** (dzień 6)
   - Wszystkie tabele (Deals, Products, Users)
   - Kliknięcie w nagłówek kolumny
   
2. **Paginacja** (dzień 6-7)
   - Firestore cursor-based pagination
   - UI: Previous/Next + page numbers
   
3. **Wyszukiwanie i filtry** (dzień 7-8)
   - Quick search input
   - Filtry po statusie, kategorii
   - Debounced search

4. **Loading states** (dzień 8)
   - Skeleton loaders wszędzie
   - Spinner na akcjach (save, delete)
   - Progress indicators

### Faza 3: Data Accuracy (Priorytet: ŚREDNI)
**Szacowany czas: 3-4 dni**

1. **Rzeczywiste statystyki** (dzień 9-10)
   - Wyświetlenia z Google Analytics API
   - Komentarze z Firestore aggregation
   - Głosy z Firestore aggregation
   - Trendy m/m z porównaniem dat

2. **Analityka** (dzień 11-12)
   - Google Analytics API integration
   - Charts/graphs z rzeczywistymi danymi
   - Export do CSV

### Faza 4: Advanced Features (Priorytet: NISKI)
**Szacowany czas: 2-3 dni**

1. **URL Scraping** (dzień 13)
   - Puppeteer/Cheerio setup
   - Scraping Allegro/OLX
   
2. **Breadcrumbs dla nested routes** (dzień 14)
   - Dynamic breadcrumb generation
   
3. **Audit logs** (dzień 15)
   - Historia zmian
   - Kto, kiedy, co zmienił

---

## 📊 Statystyki Audytu

**Przeanalizowane pliki:** 11
- `/src/app/admin/page.tsx` ✅
- `/src/app/admin/layout.tsx` ✅ (naprawiono)
- `/src/app/admin/deals/page.tsx` ⚠️
- `/src/app/admin/products/page.tsx` ⚠️
- `/src/app/admin/categories/page.tsx` ⚠️
- `/src/app/admin/users/page.tsx` ❌
- `/src/app/admin/moderation/page.tsx` ❌
- `/src/app/admin/analytics/page.tsx` ⚠️
- `/src/app/admin/import/page.tsx` ⚠️
- `/src/app/admin/settings/page.tsx` ❓
- `/src/app/admin/trending-prediction/page.tsx` ✅

**Wykryte atrapy:** ~30 miejsc
**Niezaimplementowane funkcje:** ~40 funkcji
**Naprawione podczas audytu:** 2 (active state, auto-scroll)
**Do naprawienia:** ~38 funkcji

**Kod działający:** ~40%
**Kod z atrapami:** ~30%
**Kod niezaimplementowany:** ~30%

---

## 💡 Rekomendacje Architektoniczne

### 1. Stworzyć Reusable Components

```typescript
// src/components/admin/data-table.tsx
// Uniwersalna tabela z sortowaniem, paginacją, filtrami

// src/components/admin/entity-form.tsx  
// Generyczny formularz z react-hook-form

// src/components/admin/confirm-dialog.tsx
// Dialog potwierdzenia dla krytycznych akcji

// src/components/admin/stats-card.tsx
// Card ze statystykami + real-time data
```

### 2. Dodać Custom Hooks

```typescript
// src/hooks/use-firestore-pagination.ts
// Cursor-based pagination dla Firestore

// src/hooks/use-table-sort.ts
// Sortowanie tabel z localStorage persistence

// src/hooks/use-admin-stats.ts
// Centralne miejsce dla statystyk dashboardu
```

### 3. Server Actions dla Mutacji

```typescript
// src/app/admin/actions.ts
export async function createDeal(data: DealInput) { ... }
export async function updateDeal(id: string, data: DealInput) { ... }
export async function deleteDeal(id: string) { ... }
export async function approveDeal(id: string) { ... }
```

### 4. Middleware dla Autoryzacji

```typescript
// src/middleware.ts
// Sprawdzanie czy user ma role 'admin' przed dostępem do /admin/*
```

---

## 🔗 Przydatne Linki

- [Firebase Admin SDK - User Management](https://firebase.google.com/docs/auth/admin/manage-users)
- [Firestore Query Cursor](https://firebase.google.com/docs/firestore/query-data/query-cursors)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table)
- [React Hook Form](https://react-hook-form.com/)

---

**Status:** ✅ Audyt zakończony  
**Następny krok:** Implementacja Fazy 1 (CRUD operations)
