# Okazje Plus 🛍️

Polska platforma z okazjami i produktami (Next.js 15 + Firebase + Genkit AI). Ten README jest celowo zwięzły — pełna dokumentacja została przeniesiona do `docs/`.

## 🔗 Dokumentacja
**Główny hub dokumentacji**: `docs/MASTER_INDEX.md`

Najważniejsze:
- Architektura / audyt: `docs/FRONTEND_BACKEND_AUDIT.md`
- Ostatni deploy: `docs/DEPLOY_STATUS.md`
- **Zestawienie implementacji vs docs**: `docs/IMPLEMENTATION_VS_DOCUMENTATION_AUDIT.md`
- **Gotowość mobile/PWA**: `docs/MOBILE_READINESS_GUIDE.md`
- Cache & unieważnianie: `docs/CACHE_INTEGRATION_GUIDE.md`
- **Notifications & Price Alerts (M5)**: `docs/M5_COMPLETION_SUMMARY.md`
- Aktualizacje inkrementalne: `docs/updates/*`

## ✨ Nowe funkcje (M5 - 23.11.2025)

### 🔔 System Powiadomień
- **In-app notifications**: dropdown w navbar z real-time updates
- **Email notifications**: integracja SendGrid dla wszystkich typów powiadomień
- **Auto-triggers**: Cloud Functions automatycznie powiadamiają o odpowiedziach na komentarze

### 💰 Price Monitoring & Alerts
- **Alerty cenowe**: użytkownicy mogą ustawić powiadomienia przy spadku ceny
- **Scheduled monitoring**: Cloud Function sprawdza ceny co godzinę
- **Historia cen**: wykresy zmian w czasie (30 dni)
- **Email notifications**: automatyczne powiadomienia gdy cena spadnie

### 💬 Comment Enhancements
- **Edycja komentarzy**: inline editing z oznaczeniem "(edytowano)"
- **Spam protection**: 5-sekundowy cooldown między komentarzami
- **Threading**: odpowiedzi na komentarze z powiadomieniami

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

## ✅ Jakość
```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 🔄 Konwencje
- Logika dostępu do danych tylko w `data.ts`.
- Polski język w UI i nazwach; techniczne komentarze mogą być po angielsku.
- Status publiczny: `status: "approved"`.
- Optymistyczne UI dla interakcji (głosy, komentarze).

## �️ Wsparcie
Problemy / pytania → załóż issue. Rozbudowane opisy rozwiązań: zobacz pliki w `docs/`.

---
Made with ❤️ in Poland 🇵🇱
