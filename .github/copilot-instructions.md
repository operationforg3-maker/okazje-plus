# Okazje Plus — AI Coding Assistant Guide

Productivity-first notes for this repo. Keep Polish-facing UI/text, avoid churn, and mirror existing patterns.

## Big picture
- Polska platforma z okazjami (Next.js 15 app router + Firebase Auth/Firestore/Storage + Genkit AI). Optional Typesense search. Deployed on Firebase App Hosting (europe-west1); Cloud Functions live in `okazje-plus/`.
- Core data flow: `src/lib/data.ts` centralizes Firestore queries/mutations (status filters like `status: "approved"` for public). Types live in `src/lib/types.ts` (SSOT), categories via `mainCategorySlug` + `subCategorySlug`.
- Ranking uses temperature-style "heat" (not raw votes) across list/card components; see `src/components/deals-list.tsx` and `src/components/deal-card.tsx` for vote + optimistic UI patterns.
- Comments/pagination: hooks `src/hooks/use-comments-count.ts` and `src/hooks/use-pagination.ts` keep realtime counts and paged fetches; preserve optimistic updates.

## Auth, config, and env
- Dual Firebase config: server uses `FIREBASE_WEBAPP_CONFIG`; client uses `NEXT_PUBLIC_*` vars. Env in `.env.local`; secrets for App Hosting via console/apphosting.yaml.
- Auth provider/context in `src/lib/auth.tsx`; guard admin with `withAuth()` and role checks in server actions/routes.
- AI/Genkit: entry `src/ai/genkit.ts`, flows in `src/ai/flows/`, local runner `src/ai/dev.ts`; needs `GEMINI_API_KEY`. Admin calls flows via server actions.

## Data, caching, and integrations
- Data access + cache invalidation live in `src/lib/data.ts` and `src/lib/cache-invalidation.ts`; caching uses Redis if `REDIS_URL` set, falls back to in-memory LRU. Follow existing TTLs and invalidation helpers when adding queries.
- Typesense optional: when `NEXT_PUBLIC_TYPESENSE_*` missing, features must degrade gracefully (keep Firestore fallback).
- AliExpress signed admin endpoint `/api/admin/aliexpress/search` (server-side secrets); other marketplace guides under `docs/api/` and `docs/integration/`.
- Cloud Functions share types from `../src/lib/types` (avoid duplicating models); CSV/bulk imports and scheduled jobs live there.

## UI and i18n
- Components: domain comps in `src/components/`, shadcn in `src/components/ui/`. Keep Polish copy; tech comments can be EN. Translation catalogs in `messages/` per locale; follow existing keys (e.g., `home.json`, `deals.json`).
- Notifications + price alerts (M5): real-time + email (SendGrid). Ensure new actions emit notifications and respect cooldowns/alert schedules.

## Dev workflow
- Dev: `npm run dev` (Next.js on :9002, Turbopack). Genkit UI: `npm run genkit:dev` (or `genkit:watch`).
- Quality gates: `npm run typecheck`, `npm run lint`, `npm run test` (Jest `*.test.ts|*.spec.ts`), `npm run test:e2e` (Playwright in `tests/`), `npm run build`.
- Quick system tests: from UI `/admin` → zakładka "Testy" → "Uruchom Testy"; or POST `/api/admin/tests/run` with bearer admin; or `runAllTests` from `src/lib/test-service`.

## File map to remember
- Config: `src/lib/firebase.ts` (dual config), `next.config.ts`, `firebase.json`, `firestore.indexes.json` (keep indexes in sync).
- AI flows: `src/ai/flows/*`; admin pages under `src/app/admin/` illustrate flow wiring.
- Functions package: `okazje-plus/src/index.ts` (+ `package.json`); uses shared types and Zod validation respecting `firestore.rules`.

## Before you commit/deploy
- Keep data access in `data.ts`; reuse helpers for heat, pagination, and cache invalidation.
- Verify env presence for Firebase + Gemini (+ optional Typesense/SendGrid/Redis/AliExpress). Run typecheck, lint, unit, e2e, and build.

Questions or unclear conventions? Start with `README.md`, `docs/INDEX.md`, and `docs/updates/2025-11-10-comments-and-pagination.md`; mirror existing patterns.