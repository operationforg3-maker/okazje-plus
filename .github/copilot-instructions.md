# Okazje Plus — AI Coding Assistant Quick Guide

Productivity-first cheat sheet for this repo. Keep changes minimal, Polish-facing UI text, and follow the patterns below.

## What this is
- Polish deals platform (Pepper/MyDealz style) on Next.js 15 + Firebase + Genkit AI; optional Typesense search; deployed on Firebase App Hosting (europe-west1).

## Core paths
- Types & data: `src/lib/types.ts` (SSOT), `src/lib/data.ts` (Firestore ops)
- Firebase config: `src/lib/firebase.ts` (dual server/client env)
- Auth: `src/lib/auth.tsx` (context + `withAuth()` HOC)
- AI: `src/ai/genkit.ts`, flows in `src/ai/flows/`, local runner `src/ai/dev.ts`
- Cloud Functions: `okazje-plus/src/index.ts` (separate package.json)
- UI: `src/components/` (domain comps), `src/components/ui/` (shadcn)

## Architectural patterns
- Dual Firebase config: server uses `FIREBASE_WEBAPP_CONFIG`; client uses `NEXT_PUBLIC_*`.
- Categories: `Deal.mainCategorySlug` + `subCategorySlug` (see `src/lib/types.ts`).
- Ranking: temperature-based “heat” (not raw upvotes) used across lists/cards.

## Conventions that matter
- Data access centralized in `src/lib/data.ts`; status filters like `status: "approved"` for public views.
- Auth everywhere: wrap admin with `withAuth()`, check roles on server actions.
- Polish language across UI/text/variables; English allowed in low-level technical comments.
- Optimistic UX for interactions (voting, comments). Comment system uses real-time count + pagination (see hooks `src/hooks/use-comments-count.ts`, `src/hooks/use-pagination.ts`).

## Dev, tests, and AI
- Dev: `npm run dev` (Next.js on :9002, Turbopack).
- Genkit: `npm run genkit:dev` (or `genkit:watch`) to test flows; admin UIs call flows via server actions.
- Build: `npm run build`; TypeScript: `npm run typecheck`; Lint: `npm run lint`.
- Tests: unit via Jest `npm run test` (files `*.test.ts|*.spec.ts` in `src/`), E2E via Playwright `npm run test:e2e` (in `tests/`).

## External integration points
- Typesense optional; degrade gracefully if `NEXT_PUBLIC_TYPESENSE_*` missing.
- AliExpress server-side secrets via App Hosting (set in `apphosting.yaml`/Firebase Console). Signed admin endpoint: `/api/admin/aliexpress/search`.

## Functions and types
- Import shared types into Functions: `import { Deal, Product } from "../src/lib/types"`.
- CSV/bulk imports live in Functions; keep validation with Zod and respect `firestore.rules`.

## Before you commit/deploy
- Run: typecheck, lint, unit tests, E2E tests, and ensure `npm run build` passes.
- Env: local uses `.env.local`; server uses `FIREBASE_WEBAPP_CONFIG` + App Hosting Secrets; see `README.md` for required vars.

## Good examples to follow
- Deal listing/card patterns: `src/components/deals-list.tsx`, `src/components/deal-card.tsx` (heat, vote controls, optimistic UI).
- Admin + AI flow wiring: `src/ai/flows/*` with `src/ai/genkit.ts`; admin pages under `src/app/admin/`.

Questions or unclear conventions? Check `README.md` and `docs/updates/2025-11-10-comments-and-pagination.md` and mirror existing file/module patterns.