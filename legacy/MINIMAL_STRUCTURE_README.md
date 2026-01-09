# Okazje Plus - Minimalna Struktura (Coming Soon)

**Data utworzenia:** 9 stycznia 2026  
**Gałąź:** `feature/simplify-app-coming-soon`  
**Backup:** `backup/pre-simplification-2026-01-09`

## 🎯 Cel

Uproszczona wersja aplikacji z samą stroną "Coming Soon" podczas gdy pełna wersja jest w fazie rozwoju.

## 📁 Struktura

```
/
├── src/                          # ← NOWA minimalna aplikacja
│   ├── app/
│   │   ├── layout.tsx           # Root layout (bez i18n)
│   │   ├── page.tsx             # Home = Coming Soon
│   │   ├── globals.css          # Tailwind + podstawowe style
│   │   └── api/
│   │       └── newsletter/
│   │           └── subscribe/
│   │               └── route.ts # Newsletter signup API
│   ├── components/
│   │   └── coming-soon-landing.tsx
│   └── lib/
│       └── README.md
│
├── src-legacy/                   # ← LEGACY dla referencji (READ ONLY)
│   └── [pełna aplikacja M6]
│
├── package.json                 # Bez zmian (dokumentacja pakietów)
├── next.config.ts               # Wyłączone next-intl
└── tsconfig.json                # Bez zmian
```

## ✅ Co zostało usunięte/wyłączone

- ❌ next-intl (wielojęzyczność) - tylko polski
- ❌ Admin panel (`/admin/*`)
- ❌ Deal/Product komponenty
- ❌ Voting system
- ❌ Comment system  
- ❌ Notifications system
- ❌ Price history/charts
- ❌ Category browsing
- ❌ Search functionality
- ❌ Firebase (na razie)
- ❌ Genkit AI flows
- ❌ Cloud Functions triggers

## 🎨 Co jest aktywne

- ✅ Coming Soon landing page
- ✅ Newsletter signup (mock API)
- ✅ Tailwind CSS
- ✅ Next.js 15 App Router
- ✅ TypeScript
- ✅ Lucide Icons (Mail, Sparkles)

## 🚀 Development

```bash
npm run dev              # Start on :9002
npm run build            # Production build
npm run typecheck        # TypeScript validation
```

## 📚 Referencje do Legacy

Pełna aplikacja dostępna w `src-legacy/` zawiera:
- Kompletny admin panel
- M6 Product-Centric Architecture
- Harvester & Refiner system
- AI enrichment flows
- Multi-currency system
- Moderation system
- Wszystkie integracje (AliExpress, Amazon, Allegro)

**Zobacz:** `src-legacy/app/`, `src-legacy/lib/`, `src-legacy/components/`

## 🔄 Migration Back

Gdy będzie gotowa pełna wersja:

```bash
git checkout main
git merge backup/pre-simplification-2026-01-09
# Resolve conflicts, keep wanted features
```

Albo przywróć starą wersję:

```bash
rm -rf src
mv src-legacy src
# Revert next.config.ts
```

## 📝 Uwagi

- **Package.json** niezmieniony celowo - dokumentuje co było używane
- **Firebase** configs pozostały (`.env.local`) ale nieużywane
- **Wszystkie skrypty** debug/import pozostały w root dla referencji
- **Docs/** folder niezmieniony - pełna dokumentacja M6

## 🎯 Next Steps (w przyszłości)

1. Dodać prawdziwą integrację newsletter (SendGrid/Mailchimp)
2. Firebase Auth dla early access lista
3. Stopniowo przenosić komponenty z `src-legacy/` gdy potrzebne
4. Budować nową wersję od zera ucząc się z błędów legacy

---

**Status:** ✅ Functional - Coming Soon deployed  
**Dev Server:** http://localhost:9002
