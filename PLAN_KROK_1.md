# PLAN IMPLEMENTACJI: KROK 1 - Smart Seeding & Community Simulation

**Cel:** Zamiast "lorem ipsum", wygenerować realistyczne dane seed'owe do bazy dla startu produkcyjnego.

**Plik wyjściowy:** `src/scripts/seed-production.ts`

---

## 1. ANALIZA ISTNIEJĄCYCH STRUKTUR

### 1.1 Kategorie (Deal Interface)
```
Deal {
  mainCategorySlug: string        // np. "elektronika"
  subCategorySlug: string         // np. "smartfony-telefony"
  subSubCategorySlug?: string     // np. "smartfony"
}
```

**Źródło:** `src/scripts/seed-categories-full.ts` - pełna struktura 3-poziomowa już dostępna.

### 1.2 User Interface
```
User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  role: 'admin' | 'moderator' | 'specjalista' | 'user'
}
```

**Lokacja:** `src/lib/types.ts:641`

### 1.3 Deal Interface
```
Deal {
  id: string
  title: string
  description: string
  price: number
  originalPrice?: number
  link: string
  image: string
  postedBy: string              // UID użytkownika
  postedAt: string              // ISO timestamp
  voteCount: number
  temperature: number           // 0-300+
  commentsCount: number
  status: 'draft' | 'approved' | 'rejected' | 'expired'
  mainCategorySlug: string
  subCategorySlug: string
  subSubCategorySlug?: string
  source?: 'manual' | 'aliexpress' | 'csv' | 'pepper' | 'mydealz' | 'reddit'
  expiryDate?: string
}
```

**Lokacja:** `src/lib/types.ts:474`

### 1.4 Comment Interface
```
Comment {
  id: string
  dealId: string
  userId: string
  userDisplayName: string
  userPhotoURL?: string
  content: string
  createdAt: string             // ISO
}
```

**Lokacja:** `src/lib/types.ts:680`

---

## 2. PLAN IMPLEMENTACJI

### SUBTASK 2.1: Moduł polskich imion i nicków (Bot Profiles)

**Plik:** Wbudowany w `seed-production.ts`

```typescript
const POLISH_FIRST_NAMES = [
  'Jan', 'Maria', 'Piotr', 'Anna', 'Krzysztof',
  'Barbara', 'Tomasz', 'Katarzyna', 'Jerzy', 'Joanna',
  'Stanisław', 'Marta', 'Andrzej', 'Ewa', 'Robert',
  'Halina', 'Wacław', 'Jadwiga', 'Edward', 'Zofia'
];

const POLISH_LAST_NAMES = [
  'Nowak', 'Kowalski', 'Wisniewski', 'Dabrowski', 'Lewandowski',
  'Szymanski', 'Kucharski', 'Wojtowicz', 'Kaminski', 'Lewandowski',
  'Wojcik', 'Szpak', 'Michalski', 'Grabowski', 'Pawlowski',
  'Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber'
];

const NICKNAME_SUFFIXES = ['_pl', '_deals', '_pro', '_hunter', '_fan', '_user', '_bot', '123', '2024'];

// Generować 50 unikalnych profili z kombinacją imion+nazwisk+suffixów
```

**Output:**
```typescript
interface BotProfile {
  uid: string;                    // 'bot_' + random hash
  displayName: string;            // "Jan Nowak" lub "JanNowak_deals"
  email: string;                  // 'bot_' + uid + '@seedbots.local'
  photoURL: string;              // Avatar URL (np. DiceBear API)
  role: 'user';
  createdAt: string;             // Rozłożone na 30 dni wstecz
}
```

### SUBTASK 2.2: Generator kategorii wstecznych i realistycznych slug'ów

**Plik:** Wbudowany w `seed-production.ts`

```typescript
// Zamiast ręcznego list'a, dynamicznie generować z seed-categories-full.ts

import { CATEGORY_STRUCTURE } from './seed-categories-full';

// Validacja:
// - Każda kategoria musi mieć unikalny slug (bez spacji)
// - SEO-friendly (lowercase, no special chars)
// - Subcategories muszą być unikalny w ramach parent
```

**Input:** Istniejąca struktura z `seed-categories-full.ts`  
**Output:** Płaski mapping dla szybkiego dostępu:

```typescript
const CATEGORY_MAP = {
  'elektronika': { name: 'Elektronika', subs: {...} },
  'dom-ogrod': { name: 'Dom i ogród', subs: {...} },
  ...
};

// Funkcja: getRandomCategory() => { main, sub, subSub }
```

### SUBTASK 2.3: Generator 100 okazji (Deals) z rozkładem statusu

**Plik:** `generateSeeds(): Promise<Deal[]>` w `seed-production.ts`

**Logika:**
```
100 okazji (100%)
├─ 60 deals → status: 'approved'  (wyświetlane na głównej)
├─ 20 deals → status: 'expired'   (testowanie long-tail SEO)
├─ 10 deals → status: 'draft'     (testowanie moderacji)
├─ 5 deals → status: 'rejected'   (testowanie filtrów)
└─ 5 deals → temperature >= 100   (hot deals - losowo rozmieszczone w approved)
```

**Parametry każdej okazji:**

```typescript
{
  title: string;              // Realistyczne produkty (nie "Lorem ipsum")
  description: string;        // 50-200 znaków
  price: number;              // 10-5000 PLN (realistyczne)
  originalPrice?: number;     // Zawsze > price (discount = (orig-price)/orig)
  link: string;               // Fake pero SEO-friendly URL
  image: string;              // Placeholder image URL
  postedBy: string;           // Random UID z 50 botów
  postedAt: string;           // ISO timestamp (losowo z ostatnich 30 dni)
  temperature: number;        // 0-300 (20 deals: >= 100)
  voteCount: number;          // 0-50 (korelacja z temperature)
  commentsCount: number;      // 0-10
  status: 'approved' | 'expired' | 'draft' | 'rejected'
  mainCategorySlug: string;   // Random z kategorii
  subCategorySlug: string;    // Random z subcategory
  source: 'manual' | 'aliexpress' | 'reddit'
  expiryDate?: string;        // Dla expired: data wstecz
}
```

**Źródła danych:**

```typescript
// Realistyczne tytuły produktów
const PRODUCT_TEMPLATES = {
  'smartfony-telefony': [
    'Samsung Galaxy S24 Ultra 256GB Silver',
    'iPhone 15 Pro Max 512GB Space Black',
    'OnePlus 12 5G 12GB RAM',
    'Xiaomi 14 Pro 12GB RAM',
    'Google Pixel 8 Pro 256GB',
  ],
  'laptopy': [
    'MacBook Pro 16" M3 Max 48GB RAM',
    'ASUS VivoBook 15 OLED Core i7 RTX 4070',
    'Dell XPS 13 Plus Intel i7',
    'HP Pavilion Gaming 15.6"',
  ],
  // ... dla każdej kategorii 3-5 szablonów
};

// Placeholder URLs
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/500x500?text=Deal';
const PLACEHOLDER_LINKS = [
  'https://aliexpress.com/item/...',
  'https://amazon.pl/dp/...',
  'https://sklepinternet.pl/...',
];
```

### SUBTASK 2.4: Generator komentarzy (Comments)

**Plik:** `generateComments(): Promise<Comment[]>` w `seed-production.ts`

**Logika:**
```
100 okazji
├─ 40 deals → 0 komentarzy (cisza)
├─ 40 deals → 1-3 komentarze (aktywne)
└─ 20 deals → 4-8 komentarzy (bardzo aktywne)

Komentarze = 50 botów + różne czasowe (do 30 dni wstecz)
```

**Szablony komentarzy (pozytywne i neutralne):**

```typescript
const COMMENT_TEMPLATES = [
  // Pozytywne
  'Świetna cena! Polecam 👍',
  'Właśnie kupiłem, bardzo zadowolony',
  'Super deal, dziękuję za wskazówkę!',
  'Warto! Zaraz zamawiam',
  'Najlepsza okazja tego miesiąca',
  
  // Neutralne
  'Czy to jeszcze dostępne?',
  'Link nie działa, ktoś sprawdzić?',
  'Jaka jakość za taką cenę?',
  'Testowałem, ale mi nie pasowała',
  'Dobre by było wiedzieć gdzie wysyłają',
];
```

**Struktura Comment:**

```typescript
{
  dealId: string;
  userId: string;             // Random bot UID
  userDisplayName: string;    // Bot displayName
  userPhotoURL?: string;      // Bot photoURL
  content: string;            // Random template
  createdAt: string;          // ISO (1-30 dni przed postedAt okazji)
}
```

### SUBTASK 2.5: Funkcje auxiliarne

**Logika dystrybucji czasowej:**

```typescript
function generateRandomDateInPast(days: number = 30): string {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000);
  return past.toISOString();
}

// Korelacja temperature-temperature:
// - comments >= 5 → temp >= 50
// - comments >= 8 → temp >= 100
```

**Generator URL'i (fake ale realistyczne):**

```typescript
function generateFakeDealLink(source: 'aliexpress' | 'amazon' | 'other'): string {
  if (source === 'aliexpress') {
    return `https://aliexpress.com/item/${Math.random().toString(36).substring(7)}.html`;
  }
  if (source === 'amazon') {
    return `https://amazon.pl/dp/${generateRandomASIN()}`;
  }
  return `https://example.com/deal/${Math.random().toString(36).substring(7)}`;
}
```

**Generator avatarów (z external service):**

```typescript
function generateBotAvatar(name: string): string {
  // DiceBear API - deterministyczne, reproducible
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
}
```

---

## 3. STRUKTURA PLIKU `src/scripts/seed-production.ts`

```typescript
/**
 * Production Seeding Script
 * 
 * Generates realistic seed data for database launch:
 * - 50 bot users with Polish names/avatars
 * - 100 deals (60 approved, 20 expired, 10 draft, 5 rejected)
 * - 20 deals with temperature >= 100 (hot)
 * - 150-250 comments from bots
 * 
 * Run: npx ts-node src/scripts/seed-production.ts
 */

import { adminDb } from '../lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import type { User, Deal, Comment } from '../lib/types';

// ===== SECTIONS =====

// 1. CONSTANTS & DATA

// 2. BOT PROFILE GENERATION
function generateBotProfiles(count: number = 50): User[]
function generateBotAvatar(name: string): string

// 3. CATEGORY UTILITIES
function getCategoryMap(): Record<string, any>
function getRandomCategory(): { main: string; sub: string; subSub?: string }

// 4. DEAL GENERATION
interface GenerateDealOptions {
  userId: string;
  statusDistribution: { approved: number; expired: number; draft: number; rejected: number; }
  hotDealsCount: number;
}

function generateDeals(options: GenerateDealOptions): Deal[]
function generateDealForCategory(botUid: string, status: string): Deal

// 5. COMMENT GENERATION
function generateComments(deals: Deal[], botUsers: User[]): Comment[]
function getRandomComment(userDisplayName: string): string

// 6. DISTRIBUTION FUNCTIONS
function distributeTemperatures(deals: Deal[], hotCount: number): Deal[]
function correlateTemperatureWithComments(deals: Deal[]): Deal[]

// 7. DATABASE WRITE OPERATIONS
async function seedBots(users: User[]): Promise<void>
async function seedDeals(deals: Deal[]): Promise<void>
async function seedComments(comments: Comment[]): Promise<void>

// 8. MAIN ORCHESTRATION
async function main(): Promise<void>

// ===== EXPORTS =====
export { generateBotProfiles, generateDeals, generateComments };

// ===== EXECUTION =====
if (require.main === module) {
  main().catch(console.error);
}
```

---

## 4. EXECUTION FLOW

```mermaid
seed-production.ts main()
├─ generateBotProfiles(50)
│  ├─ POLISH_FIRST_NAMES + POLISH_LAST_NAMES
│  ├─ UUID dla każdego (bot_xxxxx)
│  ├─ generateBotAvatar() - DiceBear URL
│  └─ output: User[] (50 items)
│
├─ getCategoryMap()
│  └─ import CATEGORY_STRUCTURE z seed-categories-full.ts
│
├─ generateDeals(100)
│  ├─ 60 → status: 'approved'
│  ├─ 20 → status: 'expired'
│  ├─ 10 → status: 'draft'
│  ├─ 5 → status: 'rejected'
│  ├─ Losowa kategoria dla każdego
│  ├─ Losowy bot jako postedBy
│  ├─ Realistyczne title/description
│  ├─ Cena: 10-5000 PLN
│  └─ output: Deal[] (100 items)
│
├─ distributeTemperatures(deals, 20)
│  ├─ Losowo wybrać 20 deals
│  ├─ Ustawić temperature 100-300
│  ├─ Zwiększyć voteCount (korelacja)
│  └─ output: Deal[] (updated)
│
├─ generateComments(deals, botUsers)
│  ├─ Na 100 deals:
│  │  ├─ 40 → 0 komentarzy
│  │  ├─ 40 → 1-3 komentarze
│  │  └─ 20 → 4-8 komentarzy
│  ├─ Losowy bot jako userId
│  ├─ Comment template (pozytywny/neutralny)
│  ├─ createdAt 1-30 dni wstecz
│  └─ output: Comment[] (150-250 items)
│
├─ seedBots(50 users)
│  └─ Firestore: collection('users')
│
├─ seedDeals(100 deals)
│  └─ Firestore: collection('deals')
│
├─ seedComments(comments)
│  └─ Firestore: collection('deals/{id}/comments')
│
└─ Console output: ✅ Seeded X users, X deals, X comments
```

---

## 5. OUTPUT VALIDATION

Po wykonaniu skryptu, sprawdzić w Firebase Console:

```
✓ users collection: 50 dokumentów
  - uid: 'bot_xxxxx'
  - displayName: Polish names
  - photoURL: DiceBear avatars

✓ deals collection: 100 dokumentów
  - status distribution: 60 approved, 20 expired, 10 draft, 5 rejected
  - temperature: 20 deals >= 100
  - comments rozsiane na ~50% deals

✓ deals/{id}/comments subcollection
  - Total: 150-250 comments
  - userDisplayName matches bot names
  - createdAt w zakresie 30 dni
```

---

## 6. KWESTIE DO ROZWIĄZANIA W PLANIE

- [ ] Czy importować z `seed-categories-full.ts` czy duplikować?
  - **Decyzja:** Importować (DRY principle)

- [ ] Czy Firestore transaction dla consistency?
  - **Decyzja:** Batch write + error handling

- [ ] Czy używać real image URLs czy placeholders?
  - **Decyzja:** Placeholder (szybsza, mniej bandwidth)

- [ ] Jakie ceny są realistyczne dla polskiego rynku?
  - **Decyzja:** 10-5000 PLN (covers wszystko od drozdek po RTX)

- [ ] Czy `expiryDate` dla expired deals ma być wstecz czy przyszłość?
  - **Decyzja:** Zawsze wstecz (ponieważ status = 'expired')

---

## 7. NEXT STEPS (KROKI 2-4)

Po zatwierdzeniu KROKU 1:

- **KROK 2:** Google Indexing API Service (`src/lib/google-indexing.ts`)
- **KROK 3:** AI Pipeline Refactor (`src/ai/DealEnricher.ts`)
- **KROK 4:** Expired Deals Handling (Cron + Frontend)
