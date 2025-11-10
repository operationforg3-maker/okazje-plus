# Okazje Plus 🛍️

Polska platforma agregująca okazje i produkty, zbudowana z Next.js 15, Firebase i Genkit AI. Aplikacja inspirowana serwisami takimi jak Pepper/MyDealz, umożliwiająca użytkownikom odkrywanie, głosowanie i komentowanie najlepszych okazji.

## 🚀 Szybki Start

### Wymagania wstępne

- **Node.js**: v22+ (obecnie używamy v24.9.0)
- **npm**: v11+
- **Java**: OpenJDK 25+ (dla Firebase Emulators)
- **Firebase CLI**: v14+
- **Google Cloud SDK**: v546+
- **Genkit CLI**: v1.22+

### Instalacja

```bash
# Sklonuj repozytorium
git clone <repo-url>
cd okazje-plus

# Zainstaluj zależności głównej aplikacji
npm install

# Zainstaluj zależności Firebase Functions
cd okazje-plus
npm install
cd ..
```

### Konfiguracja środowiska

Utwórz plik `.env.local` w głównym katalogu:

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Typesense Search (opcjonalne)
NEXT_PUBLIC_TYPESENSE_HOST=localhost
NEXT_PUBLIC_TYPESENSE_PORT=443
NEXT_PUBLIC_TYPESENSE_PROTOCOL=https
NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_API_KEY=your_search_key

# Google AI dla Genkit
GOOGLE_GENAI_API_KEY=your_google_ai_key
```

### Uruchomienie projektu

```bash
# Development server (port 9002 z Turbopack)
npm run dev

# Genkit AI development server
npm run genkit:dev

# Genkit z hot reload
npm run genkit:watch

# Weryfikacja TypeScript
npm run typecheck

# Build produkcyjny
npm run build

# Start produkcyjny
npm start
```

## 🔔 Ostatnie zmiany (2025-11-10)

- Usprawnienia systemu komentarzy: real-time licznik, optymistyczne UI przy dodawaniu komentarza oraz paginacja dla pobierania komentarzy.
- Testy zostały zaktualizowane aby korzystać z `collectionGroup('comments')` — testy są teraz bardziej odporne i wydajne.
- Szczegóły zmian i instrukcje testowe znajdziesz w: `docs/updates/2025-11-10-comments-and-pagination.md`


## 🏗️ Architektura

### Stack Technologiczny

- **Frontend**: Next.js 15 (App Router), React 18, Tailwind CSS
- **UI**: shadcn/ui components
- **Backend**: Firebase (Firestore, Auth, Functions)
- **AI**: Google Genkit z Gemini 2.5 Flash
- **Search**: Typesense (opcjonalne)
- **Deployment**: Firebase App Hosting (europe-west1)

### Kluczowe Koncepcje

#### 1. Dual Firebase Configuration
Aplikacja używa różnych konfiguracji Firebase dla serwera i klienta:

```typescript
// src/lib/firebase.ts
const firebaseConfig = isServer
  ? JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}')  // App Hosting
  : { /* client env vars */ };
```

#### 2. System Hierarchicznych Kategorii
Wszystkie okazje i produkty używają struktury `mainCategorySlug` + `subCategorySlug`:

```typescript
interface Deal {
  mainCategorySlug: string; // np. "elektronika"
  subCategorySlug: string;  // np. "smartfony"
}
```

#### 3. Temperature-Based Ranking
System "temperatury" (jak w Pepper.com) zamiast tradycyjnych upvote'ów:
- Głosy użytkowników wpływają na temperaturę okazji
- Im wyższa temperatura, tym wyżej w rankingu
- System zapobiega manipulacji (jeden głos na użytkownika)

## 📁 Struktura Projektu

```
okazje-plus/
├── src/
│   ├── ai/                      # Genkit AI flows
│   │   ├── genkit.ts           # Konfiguracja AI
│   │   └── flows/              # AI flows (trending prediction)
│   ├── app/                    # Next.js App Router
│   │   ├── admin/              # Panel administracyjny
│   │   ├── deals/              # Strony okazji
│   │   ├── products/           # Strony produktów
│   │   └── profile/            # Profil użytkownika
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── auth/               # Komponenty autoryzacji
│   │   └── admin/              # Komponenty admin
│   ├── lib/                    # Utilities & core logic
│   │   ├── firebase.ts         # Firebase config
│   │   ├── types.ts            # TypeScript types (źródło prawdy)
│   │   ├── data.ts             # Firestore operations
│   │   ├── auth.tsx            # Auth context & HOC
│   │   └── typesense.ts        # Search client
│   └── scripts/                # Utility scripts
├── okazje-plus/                # Firebase Functions
│   └── src/
│       └── index.ts            # Cloud Functions
├── public/                     # Static assets
└── docs/                       # Dokumentacja

```

## 🔑 Kluczowe Pliki

- **`src/lib/types.ts`**: Single source of truth dla wszystkich typów
- **`src/lib/firebase.ts`**: Dual environment Firebase configuration
- **`src/lib/data.ts`**: Wszystkie operacje na Firestore
- **`src/lib/auth.tsx`**: Context i HOC dla autoryzacji
- **`src/ai/genkit.ts`**: Konfiguracja Genkit AI
- **`okazje-plus/src/index.ts`**: Firebase Cloud Functions

## 🎨 Konwencje Projektu

### Autoryzacja
- Context-based auth w `src/lib/auth.tsx`
- HOC pattern: `withAuth()` dla chronionych komponentów
- Role-based access control dla panelu admin

### Komponenty
- UI components w `src/components/ui/` (shadcn/ui)
- Business components w `src/components/` z prefiksami domenowymi
- Server actions dla formularzy (szczególnie admin)

### Data Patterns
- Wszystkie zapytania w `src/lib/data.ts`
- Polski język w całym codebase (UI, zmienne, komentarze)
- Status-based filtering (`status: "approved"`) dla publicznej treści
- Optimistic updates dla głosowania/interakcji

### Styling
- Tailwind CSS z responsive-first approach
- `font-headline` dla nagłówków (Space Grotesk)
- Emoji w nagłówkach sekcji (🎯 Gorące Okazje, 🛍️ Polecane Produkty)

## 🤖 Integracja AI

Genkit AI używany do predykcji trendujących okazji:

```typescript
// src/ai/flows/trending-deal-prediction.ts
export async function trendingDealPrediction(input: TrendingDealPredictionInput) {
  // Analiza: nazwa, ocena, liczba ocen, temperatura, status
  // Zwraca: heatIndex (0-100) i trendingReason
}
```

Użycie w panelu admin:
```bash
npm run genkit:dev  # Uruchom Genkit development server
# Następnie otwórz http://localhost:4000
```

## 🔥 Firebase

### Firestore Collections
- `deals`: Okazje użytkowników
- `products`: Produkty z linkami afiliacyjnymi
- `users`: Profile użytkowników
- `categories`: Hierarchiczne kategorie
- `comments`: Komentarze do okazji

### Cloud Functions
- `importDealsFromCSV`: Bulk import okazji
- `importProductsFromCSV`: Bulk import produktów
- `updateDealCommentsCount`: Trigger aktualizujący liczniki

### Security Rules
Zasady w `firestore.rules` kontrolują dostęp:
- Publiczny odczyt zatwierdzonych treści
- Autoryzacja dla głosowania i komentarzy
- Admin role dla zarządzania treścią

## 🔍 Search (Typesense)

Opcjonalna integracja z Typesense dla szybkiego wyszukiwania:
- Graceful degradation jeśli nie skonfigurowane
- Wyszukiwanie produktów i okazji
- Auto-complete suggestions

## 🚢 Deployment

### Firebase App Hosting

```bash
# Logowanie do Firebase
firebase login

# Deploy
firebase deploy

# Deploy tylko functions
firebase deploy --only functions

# Deploy tylko hosting
firebase deploy --only hosting
```

Konfiguracja w `firebase.json` i `apphosting.yaml`.

## 📝 Scripts

```bash
# Development
npm run dev              # Next.js dev server (port 9002)
npm run genkit:dev       # Genkit AI server
npm run genkit:watch     # Genkit z hot reload

# Build & Test
npm run build            # Production build
npm run typecheck        # TypeScript validation
npm run lint             # ESLint

# Firebase
firebase emulators:start # Uruchom emulatory
firebase deploy          # Deploy do produkcji
```

## 🤝 Współpraca

1. Fork repozytorium
2. Utwórz branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit zmiany (`git commit -m 'Add some AmazingFeature'`)
4. Push do brancha (`git push origin feature/AmazingFeature`)
5. Otwórz Pull Request

## 📄 Licencja

Private project - wszystkie prawa zastrzeżone.

## 🙋 Wsparcie

Dla pytań i problemów, otwórz issue w repozytorium.

---

Made with ❤️ in Poland 🇵🇱
