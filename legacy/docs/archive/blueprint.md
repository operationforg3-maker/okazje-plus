# **App Name**: Okazje+

Polska platforma agregująca okazje i produkty, inspirowana serwisami Pepper.com i MyDealz. Aplikacja łączy funkcje odkrywania najlepszych okazji z inteligentnym systemem głosowania i predykcją trendów za pomocą AI.

## Core Features:

### 🛍️ Katalog Produktów
- Przeglądanie katalogu produktów z zaawansowanymi filtrami
- Sortowanie według kategorii, ceny, ocen
- Hierarchiczny system kategorii (główna + podkategoria)
- Linki afiliacyjne do produktów
- Karty ocen z średnią i liczbą głosów

### 🔥 System Okazji
- Wyświetlanie najnowszych i najpopularniejszych okazji
- System "temperatury" (heat index) zamiast tradycyjnych upvote'ów
- Głosowanie użytkowników wpływa na temperaturę okazji
- Sortowanie według: temperatury, daty, liczby komentarzy
- Status moderacji: draft/approved/rejected
- Automatyczne aktualizowanie liczników komentarzy

### 🔍 Wyszukiwarka
- Szybkie wyszukiwanie produktów i okazji
- Integracja z Typesense dla wydajnego full-text search
- Graceful degradation jeśli Typesense nie jest skonfigurowany
- Filtrowanie wyników po kategorii
- Auto-complete suggestions

### 🔐 Autoryzacja Użytkowników
- Bezpieczne konta użytkowników z Firebase Auth
- Login/rejestracja przez email i hasło
- Context-based authentication w całej aplikacji
- HOC pattern (`withAuth`) dla chronionych route'ów
- Role-based access control (user/admin)

### 👤 Profile Użytkowników
- Spersonalizowane profile użytkowników
- Historia dodanych okazji
- Zapisane okazje (ulubione)
- Ustawienia konta
- Statystyki aktywności

### 💬 System Komentarzy
- Komentowanie okazji i produktów przez zalogowanych użytkowników
- **Threading**: odpowiedzi na komentarze (parentId)
- **Edycja**: użytkownicy mogą edytować swoje komentarze z oznaczeniem "edited"
- **Spam protection**: 5-sekundowy cooldown między komentarzami
- Licznik komentarzy aktualizowany automatycznie przez Cloud Function
- Sortowanie komentarzy chronologicznie
- Walidacja autoryzacji przed dodaniem komentarza

### 🔔 System Powiadomień
- **In-app notifications**: dropdown w navbar z badge pokazującym liczbę nieprzeczytanych
- **Email notifications**: integracja z SendGrid dla powiadomień email
- **Typy powiadomień**: 
  - `comment_reply` - odpowiedź na komentarz użytkownika
  - `system` - alerty cenowe i powiadomienia systemowe
  - `new_deal` - nowa okazja od obserwowanego użytkownika
  - `deal_approved` / `deal_rejected` - moderacja okazji użytkownika
- **Cloud Functions**: automatyczne triggery przy tworzeniu komentarzy
- Polling co 30s dla aktualizacji w czasie rzeczywistym
- Oznaczanie jako przeczytane po kliknięciu

### 💰 Price Monitoring & Alerts
- **Price Snapshots**: automatyczne zapisywanie historii cen
- **Price History**: wykresy zmian cen w czasie (30 dni)
- **User Alerts**: użytkownicy mogą ustawić alerty cenowe
  - `target_price` - powiadomienie przy osiągnięciu ceny docelowej
  - `price_drop` - powiadomienie przy spadku o X%
  - `back_in_stock` - powiadomienie gdy produkt wraca na stan
  - `coupon_expiry` - przypomnienie przed wygaśnięciem kuponu
- **Scheduled Monitoring**: Cloud Function uruchamiana co godzinę
- **Notifications**: automatyczne powiadomienia in-app + email przy triggered alerts
- **UI Components**: PriceAlertButton, PriceHistoryChart

### 📝 Pre-registration System
- **Beta Access**: system zaproszeń na zamknięte beta
- **JWT Tokens**: bezpieczne tokeny aktywacyjne ważne 7 dni
- **Email Invitations**: automatyczne wysyłanie zaproszeń przez SendGrid
- **Landing Page**: countdown do public release z dynamicznym formatowaniem dat
- **Timezone**: Europe/Warsaw dla konsystencji SSR/CSR

### ⚙️ Panel Administracyjny
- Bezpieczny interface dla adminów
- Zarządzanie produktami (dodawanie, edycja, usuwanie)
- Moderacja okazji (zatwierdzanie, odrzucanie)
- Zarządzanie użytkownikami (role, status)
- Zarządzanie kategoriami
- CSV import dla produktów i okazji (bulk operations)
- Dashboard ze statystykami

### 🤖 AI: Predykcja Trendów
- Google Genkit z modelem Gemini 2.5 Flash
- Analiza okazji pod kątem potencjału trendowania
- Wejście: nazwa, ocena, liczba ocen, temperatura, status
- Wyjście: heatIndex (0-100) i wyjaśnienie (trendingReason)
- Development server dla testowania AI flows
- Użycie w panelu admin do optymalizacji moderacji

## Tech Stack:

### Frontend
- **Next.js 15**: App Router, Server Components, Server Actions
- **React 18**: Hooks, Context API
- **Tailwind CSS**: Utility-first styling, responsive design
- **shadcn/ui**: High-quality component library
- **TypeScript**: Full type safety

### Backend & Database
- **Firebase Firestore**: NoSQL database
- **Firebase Auth**: User authentication
- **Firebase Cloud Functions**: Serverless backend (Node 22)
- **Firebase App Hosting**: Deployment platform (europe-west1)

### AI & Search
- **Google Genkit**: AI flow orchestration
- **Gemini 2.5 Flash**: Google's AI model
- **Typesense**: Fast search engine (optional)

### Development Tools
- **Turbopack**: Fast Next.js bundler
- **tsx**: TypeScript execution for Genkit
- **ESLint**: Code linting
- **Firebase Emulators**: Local development

## Style Guidelines:

### Kolory
- **Primary**: Saturated blue (#2979FF) - zaufanie i profesjonalizm w e-commerce
- **Background**: Light blue (#E3F2FD) - czyste i przestronne tło
- **Accent**: Purple (#9C27B0) - wyróżnianie kluczowych akcji
- **Text**: Domyślne Tailwind gray scale dla czytelności
- **Success**: Green dla pozytywnych akcji (temperatura w górę)
- **Danger**: Red dla negatywnych akcji (temperatura w dół)

### Typografia
- **Headline**: 'Space Grotesk', sans-serif - nowoczesny, techniczny styl dla nagłówków
- **Body**: 'Inter', sans-serif - doskonała czytelność dla treści
- **Polski język**: Wszystkie teksty interfejsu w języku polskim
- **Emoji**: 🎯 Gorące Okazje, 🛍️ Polecane Produkty, itp.

### Ikony
- **lucide-react**: Minimalistyczne, spójne ikony
- Reprezentacja kategorii produktów
- Akcje użytkownika (głosowanie, komentarze)
- Nawigacja i UI feedback

### Layout
- **Responsive Grid**: Optymalna prezentacja na wszystkich urządzeniach
- **Mobile-first**: Projektowanie od najmniejszych ekranów
- **Container**: Centrowane, maksymalna szerokość dla czytelności
- **Spacing**: Konsystentne odstępy (gap-6, gap-8, gap-12)

### Interakcje
- **Subtle transitions**: Płynne animacje dla lepszego UX
- **Hover states**: Feedback wizualny dla interaktywnych elementów
- **Loading states**: Skeleton loaders i spinner'y
- **Toast notifications**: Sonner dla informacji zwrotnych
- **Optimistic updates**: Natychmiastowa reakcja na akcje użytkownika

### Komponenty
- **Cards**: Dla okazji i produktów (cienie, rounded corners)
- **Buttons**: Variants (default, ghost, outline) dla różnych kontekstów
- **Forms**: React Hook Form + Zod validation
- **Dialogs**: Modal'e dla akcji wymagających potwierdzenia
- **Badges**: Status indicators (draft, approved, rejected)

## Architectural Patterns:

### 1. Dual Firebase Configuration
```typescript
// Server używa FIREBASE_WEBAPP_CONFIG (App Hosting)
// Client używa NEXT_PUBLIC_* env vars
const firebaseConfig = isServer 
  ? JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}')
  : { /* client env vars */ };
```

### 2. Type Safety
```typescript
// src/lib/types.ts - Single source of truth
// Import w Cloud Functions: import { Deal } from "../src/lib/types"
```

### 3. Data Layer Abstraction
```typescript
// src/lib/data.ts - Wszystkie operacje Firestore
// Centralizacja logiki zapytań i aktualizacji
```

### 4. Auth Pattern
```typescript
// Context + HOC dla autoryzacji
const { user, loading } = useAuth();
export const ProtectedPage = withAuth(YourComponent);
```

### 5. Server Actions
```typescript
// Formularze admin używają Server Actions
'use server';
export async function handlePrediction(formData: FormData) { }
```

## Data Model:

### Collections
- **deals**: Okazje (mainCategorySlug, subCategorySlug, temperature, status)
- **products**: Produkty (mainCategorySlug, subCategorySlug, affiliateUrl, ratingCard)
- **users**: Profile (uid, email, displayName, role, createdAt)
- **categories**: Kategorie (id=slug, name, subcategories[])
- **comments**: Komentarze (dealId, userId, content, createdAt)
- **votes**: Głosy użytkowników (dealId, userId, vote: 1|-1)

### Indexes
- deals: (status, temperature desc)
- products: (status, mainCategorySlug, subCategorySlug)
- comments: (dealId, createdAt desc)

## Deployment:

### Firebase App Hosting
- Region: europe-west1
- Auto-deploy z Git (main branch)
- Environment variables w Firebase Console
- Skalowanie automatyczne

### Cloud Functions
- Node 22 runtime
- Deploy: `firebase deploy --only functions`
- Trigery: onDocumentWritten dla liczników

## Development Workflow:

```bash
# Start local dev
npm run dev                 # Next.js (port 9002)
npm run genkit:dev          # AI flows development

# Testing
npm run typecheck           # TypeScript validation
firebase emulators:start    # Local Firebase

# Deployment
firebase deploy             # Full deploy
firebase deploy --only functions
firebase deploy --only hosting
```

## Security:

### Firestore Rules
- Publiczny odczyt dla approved content
- Autoryzacja dla write operations
- Admin role dla zarządzania
- Validation schema enforcement

### Auth Guards
- Client-side: withAuth HOC
- Server-side: Auth checks w Server Actions
- Admin routes: Role verification

## Future Enhancements:

- Notyfikacje push dla obserwowanych okazji
-社会化分享 (Social sharing)
- Zaawansowane filtry (cenowe, czasowe)
- Personalizowane rekomendacje (AI)
- Aplikacja mobilna (React Native)
- Newsletter z najlepszymi okazjami
- System punktów i gamifikacja
- API dla partnerów afiliacyjnych