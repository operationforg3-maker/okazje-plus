# Okazje Plus 🛍️

Polska platforma z okazjami i produktami (Next.js 15 + Firebase + Genkit AI).  
**Social Commerce Marketplace** w stylu Ceneo/HotDeals — masowy import z AliExpress & Convertiser, AI enrichment, moderacja społecznościowa.

## 📖 Dokumentacja

> **Single Source of Truth:** [`docs/MASTER.md`](docs/MASTER.md)

Zawiera: architekturę M6, model danych, pipeline Harvestera, integracje API (AliExpress), SEO/Rich Results, UX Mobile-First, Firebase/GCloud infrastructure, roadmap monetyzacji.

## ✨ Aktywne funkcje (M6 — Marzec 2026)

### 🏗️ M6 Product-Centric Architecture
- **ProductCore + Deal model**: niezmienialny katalog produktów + mutowalne oferty cenowe
- **Bulk Harvester**: masowy import z AliExpress/Convertiser, lokalny routing przez JSON drzewo kategorii
- **AI Enrichment**: Product Refiner (coreSpecs + 6-lang opisy) + Deal Refiner (sellingPoints)
- **Social Commerce (Poczekalnia)**: oferty wchodzą do głosowania, próg +15 = Strona Główna
- **Typesense**: wyszukiwarka (95% browse ruchu), sortowanie po `temperature` (time-decay)
- **SEO**: JSON-LD Product schema, AggregateOffer, BreadcrumbList, Rich Results Google

### 🔔 Powiadomienia (M5)
- **In-app notifications**: dropdown w navbar z real-time updates
- **Email notifications**: integracja SendGrid
- **Auto-triggers**: Cloud Functions dla odpowiedzi na komentarze

### 💰 Price Monitoring
- **Alerty cenowe**: powiadomienia przy spadku ceny
- **Historia cen**: Omnibus Directive compliance (30 dni)

## 🚀 Szybki start (skrót)
```bash
git clone <repo-url>
cd okazje-plus
npm install
npm run dev          # Next.js (port 9002)
npm run genkit:dev   # Genkit UI
```

### Environment Variables
Dodaj `.env.local`:

```bash
# Firebase (wymagane)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Gemini AI (wymagane dla AI flows - bulk import, tłumaczenia)
# Pobierz klucz z: https://aistudio.google.com/apikey
GEMINI_API_KEY=AIza...

# SendGrid Email (opcjonalne - dla powiadomień email)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@okazje.plus

# Typesense Search (opcjonalne)
NEXT_PUBLIC_TYPESENSE_HOST=xxx
NEXT_PUBLIC_TYPESENSE_PORT=443
NEXT_PUBLIC_TYPESENSE_PROTOCOL=https
NEXT_PUBLIC_TYPESENSE_API_KEY=xxx

# AliExpress Integration (opcjonalne)
ALIEXPRESS_APP_KEY=xxx
ALIEXPRESS_APP_SECRET=xxx
```

## � Kluczowe ścieżki
`src/lib/types.ts` (SSOT typów)  
`src/lib/data.ts` (Firestore operacje)  
`src/lib/firebase.ts` (dual config)  
`src/ai/flows/*` (AI flows)  
`okazje-plus/src/index.ts` (Cloud Functions)  

## 🤖 AI
Uruchom: `npm run genkit:dev` i otwórz panel lokalny (port 4000) do testu flowów.

## ✅ Jakość kodu
```bash
npm run typecheck
npm run lint
npm run build
```

> `npm test` usunięty (Jan 2026). Testy systemowe: Panel Admin → zakładka "Testy".

## 🔄 Kluczowe konwencje
- **Logika danych**: tylko w `src/lib/data/` (nigdy bezpośrednio w komponentach)
- **Język UI**: Polski (`messages/pl/*.json`)
- **Status publiczny**: zawsze `status: "approved"`
- **Optimistic UI**: głosy i komentarze z rollback na błąd
- **Afiliacja**: każdy Deal musi mieć poprawny `affiliateLink` (to nasz przychód)

## 🗺️ Wsparcie
Problemy → załóż issue. Rozbudowane rozwiązania → [`docs/MASTER.md`](docs/MASTER.md).

---
Made with ❤️ in Poland 🇵🇱
