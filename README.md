# Okazje Plus 🛍️

Polska platforma z okazjami i produktami (Next.js 15 + Firebase + Genkit AI). Ten README jest celowo zwięzły — pełna dokumentacja została przeniesiona do `docs/`.

## 🔗 Dokumentacja
Pełen indeks: `docs/INDEX.md`
Najważniejsze:
- Architektura / audyt: `docs/FRONTEND_BACKEND_AUDIT.md`
- Ostatni deploy: `docs/DEPLOY_STATUS.md`
- Optymalizacje: `docs/OPTIMIZATION_SUMMARY.md`
- Cache & unieważnianie: `docs/CACHE_INTEGRATION_GUIDE.md`
- Multi-marketplace: `docs/MILESTONE_4_README.md`
- Aktualizacje inkrementalne: `docs/updates/*`

## 🚀 Szybki start (skrót)
```bash
git clone <repo-url>
cd okazje-plus
npm install
npm run dev          # Next.js (port 9002)
npm run genkit:dev   # Genkit UI
```

Dodaj `.env.local` (Firebase `NEXT_PUBLIC_FIREBASE_*`, opcjonalnie Typesense, sekrety AliExpress lokalnie bez prefixu `NEXT_PUBLIC_`).

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
