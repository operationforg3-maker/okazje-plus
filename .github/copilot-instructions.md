# Okazje Plus — AI Coding Assistant Guide

Productivity-first guide for this codebase. Keep Polish-facing UI/text, avoid churn, and mirror existing patterns.

## Big picture architecture
- **Platform**: Product-comparison marketplace (M6+, like Ceneo/PriceRunner) — Next.js 15 app router + Firebase (Auth/Firestore/Storage) + Genkit AI + optional Typesense search
- **Deployment**: Firebase App Hosting (europe-west1); Cloud Functions in `okazje-plus/` subdirectory
- **App structure**: i18n with next-intl (`src/app/[locale]/*`); admin panel at `src/app/admin/*`; shadcn UI components
- **Data model (M6)**: **ProductCore** (immutable, deduped) + **Deal** (mutable, multiple per product). Types: `src/lib/types.ts`; queries: `src/lib/data.ts`
- **Automation layer (M6)**: Smart harvester/refiner in `src/lib/automation/*` — fetches from AliExpress/Amazon/Allegro, dedupes by identity hash, enriches with AI
- **Categories**: Three-level hierarchy via `mainCategorySlug`, `subCategorySlug`, `subSubCategorySlug` (see `Category`, `Subcategory`, `SubSubcategory` interfaces)
- **Ranking**: Temperature-based "heat" algorithm (not raw votes) for deals. See `src/lib/data.ts` and `src/components/deal-card.tsx`
- **Realtime features**: Optimistic UI updates for votes/comments. Hooks: `use-comments-count.ts`, `use-pagination.ts`, `use-notifications.ts`. Notifications via Cloud Function triggers

## Authentication & security
- **Dual Firebase config**: Server uses `FIREBASE_WEBAPP_CONFIG` (App Hosting runtime); client uses `NEXT_PUBLIC_*` env vars (embedded at build time)
- **Client auth**: Context provider `src/lib/auth.tsx` (uses `onAuthStateChanged`). Access via `useAuth()` hook
- **Server auth**: `src/lib/auth-server.ts` provides `getServerAuthSession()`, `requireAdmin()`, `requireModerator()` for API routes/server actions
- **Firestore rules**: `firestore.rules` defines role-based access (admin/moderator/user). Keep in sync with `firestore.indexes.json`
- **Admin checks**: Use `requireAdmin()` in server actions; check `session.role === 'admin'` in API routes

## Data layer patterns
- **ALWAYS use `src/lib/data.ts`**: Never query Firestore directly in components. Add new queries to this module
- **M6 Data Model**: Two-entity pattern:
  - **ProductCore** (immutable): One per unique product; identity = SHA-256(normalized_title + image_hash); contains specs, ratings, multilingual descriptions, best price, searchTags
  - **Deal** (mutable): Specific offer from seller; foreign key to ProductCore; price + shipping + source (AliExpress/Amazon/Allegro); price history for compliance; vote count & temperature
  - **Key queries**: `getHotDeals()` filters approved deals by temperature; `getProductCoreById()` + `getLinkedDeals()` for detail pages
- **Automation (M6)**: `src/lib/automation/*` orchestrates harvesting → deduplication → enrichment:
  - **Harvester** (`harvester.ts`): Fetches from APIs, calculates identity hash, creates/links ProductCores, creates Deal documents
  - **Refiner** (`refiner.ts`): AI-enriches specs, generates multilingual descriptions, calculates quality scores, extracts search tags
  - **Identity Matcher** (`identity-matcher.ts`): Prevents duplicate products via hash-based lookup
  - **Migration** (`migration.ts`): Legacy deal → M6 conversion (reference for schema understanding)
- **Caching strategy**: Redis if `REDIS_URL` present, else in-memory LRU. Helpers: `cacheGet(key)`, `cacheSet(key, value, ttl)`
- **Cache invalidation**: `src/lib/cache-invalidation.ts` exports invalidation helpers (e.g., `invalidateHotDealsCache()`). Call after mutations
- **Sanitization**: All data from Firestore passes through sanitizers (`src/lib/sanitizers.ts`) before returning to prevent XSS/injection
- **Status filtering**: Public queries MUST filter `status: "approved"`; admin queries can see all statuses (draft/pending/approved/rejected)
- **Batch operations**: Use `chunkArray()` helper (max 30 items) for Firestore `in` queries to avoid limits

## AI/Genkit integration
- **Setup**: Entry point `src/ai/genkit.ts`, individual flows in `src/ai/flows/*`, local dev runner `src/ai/dev.ts`
- **Model**: Vertex AI Gemini 2.0 Flash (uses ADC credentials in production, `GEMINI_API_KEY` for local dev)
- **Dev workflow**: `npm run genkit:dev` starts Genkit UI on port 4000; `npm run genkit:watch` for hot reload
- **Flow structure**: Import flows in `dev.ts` to register them. Admin panel calls flows via server actions (see `src/app/admin/*` pages)
- **Common flows**: Translation (`translation/`), category mapping, product enrichment (specs → multilingual descriptions), import validation (see `src/ai/flows/` subdirs)
- **Usage in automation**: Refiner uses AI to enrich ProductCore with descriptions & quality scores; Harvester may call translation flows for multilingual content

## Notifications system (M5)
- **In-app**: NotificationBell component in navbar; polls every 30s for unread notifications; auto-marks as read on click
- **Email**: SendGrid integration (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` env vars); graceful fallback if unconfigured
- **Types**: `comment_reply` (auto-triggered), `system` (price alerts), `new_deal`, `deal_approved`, `deal_rejected`
- **Cloud Function triggers**: `notifyOnDealCommentReply`, `notifyOnProductCommentReply` (okazje-plus/src/index.ts); create notification on parent comment author reply
- **Data layer**: `createNotification()`, `getNotifications()`, `getUnreadNotifications()`, `markNotificationAsRead()` in `src/lib/data.ts`
- **When adding**: Use existing notification types; pass metadata for rich content; ensure email templates in Cloud Function match type

## Cloud Functions (`okazje-plus/`)
- **Location**: Separate Node.js package in `okazje-plus/` with own `package.json` and `tsconfig.json`
- **Monorepo structure**: Subfolder acts like separate project but imports types from parent (`../../src/lib/types`)
- **Shared types**: Import from `../../src/lib/types` (NOT duplicated). Respect `firestore.rules` in Function logic
- **Entry point**: `okazje-plus/src/index.ts` (2000+ lines) exports all triggers/callables
- **Triggers**: Document triggers (comments → notifications), scheduled jobs (price monitoring), callable functions (CSV import)
- **Deployment**: `npm run deploy:functions` or `npm run deploy:prod` (builds both Next.js and Functions)
- **Local dev**: Functions run via Firebase Emulator; `firebase emulators:start` for full local stack
- **Build**: Separate `tsconfig.json` in `okazje-plus/`; must `npm install` inside subfolder before first deploy
- **Notifications (M5)**: Auto-notification triggers for comment replies + email integration (SendGrid)

## Internationalization (i18n)
- **Framework**: next-intl with route-based locales (`/pl/`, `/en/`, `/de/`)
- **Translations**: JSON catalogs in `messages/` directory (e.g., `home.json`, `deals.json`, `admin.json`)
- **Pattern**: Polish is default locale. Keep ALL user-facing text in Polish; tech comments/docs can be English
- **Adding keys**: Follow existing namespacing (e.g., `deals.filters.search`, `admin.nav.deals`). Use dot notation for nesting
- **Server/client**: Use `useTranslations()` hook in client components, `await getTranslations()` in server components

## UI patterns & components
- **Component structure**: Domain components in `src/components/`, shadcn/ui primitives in `src/components/ui/`
- **Optimistic updates**: Pattern in comment section and voting: update local state immediately, rollback on error (see `comment-section-v2.tsx`)
- **Temperature display**: Use existing heat/flame UI components; temperature is computed server-side (not exposed to client calculation)
- **Pagination**: Client-side via `usePagination()` hook (for arrays); server-side pagination uses Firestore cursors (see `data.ts` query helpers)
- **Notifications**: `notification-bell.tsx` in navbar polls every 30s; click to mark as read and navigate to link

## Development workflow
```bash
npm run dev              # Next.js dev server (:9002) with Turbopack
npm run genkit:dev       # Genkit UI for testing AI flows (:4000)
npm run genkit:watch     # Genkit with hot reload
npm run typecheck        # TypeScript validation (strict mode)
npm run lint             # ESLint (auto-fix with --fix)
npm run test             # Jest unit tests (*.test.ts, *.spec.ts)
npm run test:e2e         # Playwright E2E tests (tests/ dir)
npm run build            # Production build
npm run deploy:hosting   # Deploy Next.js to App Hosting
npm run deploy:functions # Deploy Cloud Functions only
npm run deploy:prod      # Deploy everything
```

## Testing approaches
- **Quick system tests**: Admin UI → "Testy" tab → "Uruchom Testy" button; or `POST /api/admin/tests/run` with admin token
- **Test service**: `src/lib/test-service.ts` exports `runAllTests()` with categories (technical/functional/business/security)
- **Unit tests**: Jest config in `jest.config.js`; colocate with source files
- **E2E tests**: Playwright config in `playwright.config.ts`; uses port 9002 by default (configurable via `NEXT_PORT`)
- **Test patterns**: Always test status filters, admin role checks, cache invalidation, optimistic UI rollback

## Debugging utilities (root-level scripts)
Root directory contains 30+ debugging scripts for common troubleshooting tasks. These bypass UI and directly inspect Firestore:
- **Import debugging**: `check-imports.mjs`, `check-job-status.js`, `debug-import-flow.js`, `check-specific-job.mjs`
- **Data inspection**: `check-products.mjs`, `check-categories.mjs`, `check-titles.js`, `verify_products.js`
- **Logs analysis**: `check-full-logs.mjs`, `show-full-logs.mjs`, `inspect-logs.mjs`, `check-firestore-logs.mjs`
- **Job management**: `clean-stuck-jobs.mjs`, `trigger-processor.mjs`, `run-processor.mjs`
- **Quick checks**: `simple_check.js`, `check_batch.js`, `fetch_products.js`
- **Pattern**: Most scripts use `.mjs` (ESM) or `.js` (CommonJS); run with `node <script>` or `tsx <script>` for TypeScript
- **Service account**: Scripts use `serviceAccountKey.json` for Firebase Admin SDK access (never commit this file!)
- **When to use**: Direct database inspection, bypassing Next.js API layer; analyzing production data; emergency fixes

## API routes & server actions
- **Route pattern**: API routes in `src/app/api/**/route.ts` export `GET`, `POST`, etc. as named async functions
- **Auth in routes**: Import `getServerAuthSession()` from `src/lib/auth-server.ts`; call at top of handler to get session
- **Server actions**: Colocated with page components or in `src/app/actions/*.ts`; always start with `'use server'` directive
- **Admin endpoints**: Prefix admin-only routes with `/api/admin/*`; use `requireAdmin()` helper before logic
- **CORS**: Not explicitly configured — relies on Next.js defaults. For external API access, add headers manually
- **Error handling**: Throw `HttpsError` in Cloud Functions; return `NextResponse` with status codes in API routes

## Environment variables (`.env.local`)
**Required**:
```bash
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Gemini AI (local dev)
GEMINI_API_KEY=AIza...
```

**Optional** (graceful degradation):
```bash
REDIS_URL=redis://...              # Caching (fallback: in-memory LRU)
SENDGRID_API_KEY=SG.xxx            # Email notifications
SENDGRID_FROM_EMAIL=noreply@...
NEXT_PUBLIC_TYPESENSE_HOST=...     # Search (fallback: Firestore)
ALIEXPRESS_APP_KEY=xxx             # Marketplace integration
```

## Critical file locations
- **Config**: `src/lib/firebase.ts` (dual config), `next.config.ts`, `firebase.json`, `apphosting.yaml`
- **Types**: `src/lib/types.ts` (2000+ lines, SSOT for all interfaces)
- **Data**: `src/lib/data.ts` (2200+ lines, all Firestore operations)
- **Auth**: `src/lib/auth.tsx` (client), `src/lib/auth-server.ts` (server)
- **AI flows**: `src/ai/flows/*` (organized by feature subdirs)
- **Functions**: `okazje-plus/src/index.ts` (2000+ lines)
- **Rules**: `firestore.rules`, `firestore.indexes.json` (keep in sync!)

## Before committing
1. Keep all Firestore access in `data.ts`; reuse existing helpers (heat calculation, pagination, cache invalidation)
2. Run quality gates: `npm run typecheck && npm run lint && npm run test && npm run build`
3. Verify required env vars present (Firebase + Gemini minimum)
4. Check Firestore indexes if adding new compound queries (`firestore.indexes.json`)
5. Update cache invalidation if modifying data mutations
6. Add i18n keys to all locale files (not just Polish)

## Documentation
- **Index**: `docs/INDEX.md` (comprehensive guide to all docs, updated Dec 2025)
- **Quick start**: `docs/QUICK_START.md`
- **Latest milestones**: 
  - M6 (Dec 2025): `docs/milestones/M6_PRODUCT_CENTRIC_ARCHITECTURE.md` + `M6_EXECUTION_SUMMARY.md` (Product-centric model, smart harvester/refiner, identity matching)
  - M5 (Nov 2025): `docs/milestones/M5_COMPLETION_SUMMARY.md` (notifications + price alerts + email integration)
- **API guides**: `docs/api/*` (AliExpress, Allegro, Vertex AI)
- **Testing**: `docs/testing/tests-quickstart.md`
- **Troubleshooting**: `docs/troubleshooting/IMPORT_JOBS_NOT_WORKING.md`

When in doubt about patterns, check existing implementations in the same domain (e.g., deals vs products follow parallel structures).