# Okazje Plus - Coming Soon Site 🚀

Minimalistyczna wersja "coming soon" platformy porównywania cen produktów z obsługą 3 języków (PL/EN/DE).

## 📁 Struktura projektu

```
okazje-plus/
├── src/                      # ✨ AKTYWNY KOD
│   ├── app/                  # Next.js App Router (coming-soon + auth)
│   │   ├── [locale]/         # Dynamiczne routy dla 3 języków
│   │   │   ├── page.tsx      # Strona główna
│   │   │   ├── login/        # Login
│   │   │   ├── register/     # Rejestracja
│   │   │   └── admin/        # Admin panel (coming-soon)
│   │   └── api/              # API routes (auth, newsletter)
│   └── lib/                  # Utilities, hooks
│       └── messages-loader.ts  # i18n message loader (static)
│
├── public/                   # Static assets (logo, fonts, images)
├── messages/                 # 📝 Tłumaczenia
│   ├── pl/                   # Polski
│   ├── en/                   # English
│   └── de/                   # Deutsch
│
├── okazje-plus/              # Cloud Functions (Node.js 22, separate package)
│
├── legacy/                   # 🗂️ ARCHIWUM
│   ├── src-legacy/           # Stara pełna wersja z M6 architekturą
│   ├── docs/                 # 200+ dokumentów technicznych
│   ├── scripts/              # Debug scripts (50+ .mjs, .js, .sh)
│   └── *.md                  # Stara dokumentacja
│
├── scripts/                  # npm scripts (package.json)
├── .github/                  # GitHub Actions workflows
├── .vscode/                  # VS Code settings + Copilot instructions

CONFIG FILES (root):
├── package.json              # 527 packages (minimized)
├── package.legacy.json       # Backup pełnych dependencies (~1600)
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts        # Tailwind CSS 4
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── apphosting.yaml
├── i18n.config.ts            # Konfiguracja next-intl
├── middleware.ts             # Routing dla [locale]
├── eslint.config.cjs
├── postcss.config.mjs        # Tailwind PostCSS
└── components.json           # shadcn/ui config

SECRETS (preserved):
├── serviceAccountKey.json    # Firebase Admin Key (gitignored)
├── .env.local                # Local environment variables
└── .git/                     # Full git history
```

## 🚀 Quick Start

### Instalacja
```bash
npm install  # 527 packages (~2 min)
```

### Development
```bash
npm run dev          # Next.js na http://localhost:9002
npm run typecheck    # TypeScript validation
npm run lint         # ESLint
npm run build        # Production build
```

### Deployment
```bash
git push origin main  # GitHub Actions deploy to Firebase App Hosting
```

## 🌍 Internationalization (i18n)

**Framework**: next-intl 4.7.0  
**Locales**: PL (default), EN, DE  
**Routing**: `/[locale]/...`

### Dodawanie tłumaczenia
```bash
# 1. Dodaj klucz do wszystkich 3 plików:
messages/pl/home.json   # { "newsletter": { "title": "Bądź na bieżąco" } }
messages/en/home.json   # { "newsletter": { "title": "Stay Updated" } }
messages/de/home.json   # { "newsletter": { "title": "Bleiben Sie auf dem Laufenden" } }

# 2. Użyj w komponencie (client):
'use client';
import { useTranslations } from 'next-intl';
export default function Component() {
  const t = useTranslations('home');
  return <h1>{t('newsletter.title')}</h1>;
}
```

## 📦 Minimized Dependencies

| Kategoria | Before | After | Zmiana |
|-----------|--------|-------|--------|
| Total packages | ~1600 | **527** | -67% ⬇️ |
| Dependencies | 72 | **12** | -83% ⬇️ |
| node_modules size | ~450MB | **~150MB** | -67% ⬇️ |
| Build time | ~60s | **~30s** | -50% ⬇️ |

### Zachowane essentials:
- ✅ Next.js 15.3.6 + React 19
- ✅ next-intl (3 języki)
- ✅ Firebase (client SDK only)
- ✅ Tailwind CSS 4
- ✅ shadcn/ui (3 komponenty: Button, Tabs, Label)
- ✅ Lucide icons

### Usunięte (backup w package.legacy.json):
- ❌ Genkit, Firebase Admin, Sharp (backend tools)
- ❌ Typesense, Redis (nie używane)
- ❌ Puppeteer, Cheerio (scraping)
- ❌ 60+ @radix-ui components (używane tylko 3)

## 🔧 Ważne pliki

| Plik | Rola |
|------|------|
| `i18n.config.ts` | Konfiguracja locales (pl, en, de) |
| `src/i18n.ts` | getRequestConfig dla next-intl |
| `middleware.ts` | Routing [locale] detection |
| `messages/*` | Translation JSONs (nested structure!) |
| `next.config.ts` | withNextIntl plugin |
| `src/lib/messages-loader.ts` | Static message loading |

## 🌐 Domeny

- **Production**: https://okazjeplus.pl
- **Routes**:
  - `/pl/` (Polish, default)
  - `/en/` (English)
  - `/de/` (German)

## 📚 Legacy Code

Cała stara architektura M6 przechowywana w `/legacy/`:

```bash
cd legacy/src-legacy  # Stara pełna wersja z Firebase, Genkit, AI
cd legacy/docs/       # 200+ dokumentów technicznych
cd legacy/scripts/    # 50+ debug scripts
```

**Aby przywrócić starą wersję:**
```bash
cp -r legacy/src-legacy/* src/
cp package.legacy.json package.json
npm install
npm run dev
```

## 🔐 Secrets Management

Zachowane w root (gitignored):
- `serviceAccountKey.json` - Firebase Admin SDK
- `.env.local` - Local dev environment
- `.git/` - Full commit history

## 🚢 CI/CD

**GitHub Actions**: `deploy-production.yml`
- ✅ Build check (npm run typecheck, lint)
- ✅ Deploy to Firebase App Hosting
- ✅ Automatic on push to main

**Logs**: `gh run list --workflow deploy-production.yml`

## 📊 Project Stats

- **Active code**: ~2000 lines (src/ + config)
- **Legacy code**: ~500MB (src-legacy/)
- **Git history**: 50+ commits preserved
- **Languages**: 3 (PL default, EN, DE)
- **Build time**: ~30s
- **Bundle size**: 136 kB (first load JS)

## 🤝 Contributing

1. **Modify coming-soon**: Edit `src/app/[locale]/page.tsx`
2. **Add translations**: Update all 3 `messages/*/home.json`
3. **Build & test**: `npm run build && npm run dev`
4. **Commit**: `git add -A && git commit -m "..."`
5. **Push**: `git push origin main` (auto-deploys)

## 📞 Support

- **Issues**: GitHub Issues
- **Docs**: See `/legacy/docs/` for old architecture
- **Deploy logs**: `gh run list --workflow deploy-production.yml`

---

**Last Updated**: Jan 9, 2026  
**Status**: ✅ Production (Coming Soon)  
**Next Phase**: Full M6 marketplace launch
