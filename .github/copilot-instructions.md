# Okazje Plus — AI Coding Assistant Guide

**Updated:** December 27, 2025 | **Status:** M6 Product-Centric Architecture Complete  
**Architecture:** Product-comparison marketplace (Ceneo/PriceRunner style) with AI-powered harvesting & enrichment

Productivity-first guide for this codebase. **Polish-first UI policy** — all user-facing text MUST be in Polish. Mirror existing patterns, avoid data model churn.

## Big picture architecture
- **Platform**: Product-comparison marketplace (M6, like Ceneo/PriceRunner) — Next.js 15 app router + Firebase (Auth/Firestore/Storage) + Vertex AI Genkit + optional Typesense search
- **Deployment**: Firebase App Hosting (europe-west1); Cloud Functions in `okazje-plus/` subdirectory (Node.js 22)
- **App structure**: i18n with next-intl (`src/app/[locale]/*`); admin panel at `src/app/admin/*`; shadcn/ui components; server actions for mutations
- **Data model (M6)**: **ProductCore** (immutable, one per product) + **Deal** (mutable, multiple per product). Types in `src/lib/types.ts` (~2500 lines); all queries in `src/lib/data.ts` (~2600 lines)
- **Automation layer (M6)**: Harvester (fetch/dedupe) → Refiner (AI enrich) in `src/lib/automation/*`. Harvester creates ProductCore + Deal from raw API data; Refiner enriches with specs, descriptions, quality scores. Identity matching via SHA-256(title + image hash).
- **Categories**: Three-level hierarchy (`mainCategorySlug` → `subCategorySlug` → `subSubCategorySlug`). Admin seeds via `src/scripts/seed-categories-full.ts`.
- **Ranking**: Temperature-based "heat" (exponential decay on vote timestamp) for deals, not raw vote counts. Calculated server-side. See `getHotDeals()` in `src/lib/data.ts`.
- **Realtime features**: Optimistic UI updates (votes/comments) with rollback on error. Notifications via Cloud Function triggers (auto-comment-reply alerts). In-app notification polling every 30s.

## Authentication & security
- **Dual Firebase config**: Server uses `FIREBASE_WEBAPP_CONFIG` (App Hosting runtime); client uses `NEXT_PUBLIC_*` env vars (embedded at build time)
- **Client auth**: Context provider `src/lib/auth.tsx` (uses `onAuthStateChanged`). Access via `useAuth()` hook
- **Server auth**: `src/lib/auth-server.ts` provides `getServerAuthSession()`, `requireAdmin()`, `requireModerator()` for API routes/server actions
- **Firestore rules**: `firestore.rules` defines role-based access (admin/moderator/user). Keep in sync with `firestore.indexes.json`
- **Admin checks**: Use `requireAdmin()` in server actions; check `session.role === 'admin'` in API routes

## Data layer patterns
- **ALWAYS use `src/lib/data.ts`**: Never query Firestore directly in components. Add new queries to this module. NEVER access collections from UI code.
- **M6 Data Model**: Two-entity pattern with strict separation:
  - **ProductCore** (immutable): Firestore collection `product_cores`. One per unique product. Identity = SHA-256(normalized_title + image_hash). Fields: `title`, `imageUrl`, `specs` (key-value normalized), `description` (multilingual), `ratings`, `bestPrice`, `bestDealId`, `sourceLinks`, `status`, `qualityScore` (0-100), `searchTags`. Created/updated only by Harvester.
  - **Deal** (mutable): Firestore collection `deals`. Specific seller offer. Fields: `productCoreId` (FK), `sourceId`, `source` (AliExpress/Amazon/Allegro), `price`, `shippingCost`, `totalPrice`, `merchantRating`, `inStock`, `priceHistory` (timestamped, Omnibus compliance), `votes`, `temperature`, `status`, `comments`. User-facing mutations (votes, comments) here.
  - **Key queries**: `getHotDeals()` filters approved, sorted by temperature; `getProductCoreById()` fetches product; `getLinkedDeals(productCoreId)` fetches all deals for product; `getDealsForCategory()` for listing pages.
  - **Example pattern**: For product page → call `getProductCoreById()` then `getLinkedDeals(productId)` to show all offers
  - **Example pattern**: For category page → call `getDealsForCategory(categorySlug)` with status filter
  - **Example pattern**: For homepage → call `getHotDeals(20)` for trending section
- **Automation (M6)**: `src/lib/automation/*` orchestrates harvesting → deduplication → enrichment:
  - **Harvester** (`harvester.ts`): (1) Fetch from API; (2) Calculate identity hash; (3) Check if product exists via `IdentityMatch` lookup; (4) Create or link ProductCore; (5) Create Deal document; (6) Record IdentityMatch for future runs. **Returns:** HarvesterJob progress. Called from admin UI via server action. **Uses Firebase Admin SDK** for direct database writes without client SDK limitations.
  - **Refiner** (`refiner.ts`): (1) Fetch pending ProductCores; (2) Normalize specs (extract RAM/Storage/Screen from title/specs); (3) Call Gemini to generate multilingual descriptions; (4) Calculate quality score; (5) Extract searchTags. **Input:** ProductCore with minimal data. **Output:** Enriched ProductCore. Called via server action or Cloud Function. **Uses Firebase Admin SDK** for batch operations.
  - **Identity Matcher** (`identity-matcher.ts`): SHA-256 for title & image; fuzzy Levenshtein matching; dimension extraction (12GB RAM → "12GB"). Prevents duplicates.
  - **Migration** (`migration.ts`): Legacy Deal → M6 schema reference (read-only for understanding old structure).
- **Caching strategy**: Redis if `REDIS_URL` set, else in-memory LRU (max 500 entries, 60s default TTL). Lazy import on server only (`src/lib/cache.ts`).
- **Cache invalidation**: `src/lib/cache-invalidation.ts` exports helpers like `invalidateHotDealsCache()`, `invalidateProductCache(productId)`. Call **immediately after any Firestore mutation** (vote, comment, product update). Pattern: `await cacheInvalidationFn(); await dbMutation();` — invalidate first to avoid stale reads.
- **Sanitization**: All Firestore data sanitized via `sanitizeDealRecord()`, `sanitizeProductRecord()` in `src/lib/sanitizers.ts` before returning. Prevents XSS. **Do this in data.ts queries, not in components.**
- **Status filtering**: Public queries MUST filter `status: "approved"`. Admin queries (`getProductsForAdmin()`, `getDealsForAdmin()`) return all statuses. Never expose draft/pending/rejected to public without explicit check.
- **Batch operations**: Use `chunkArray(array, 30)` helper for Firestore `in` clauses (max 30 items per query). For bulk mutations use `writeBatch()` (max 500 ops per batch).

## AI/Genkit integration
- **Setup**: Entry point `src/ai/genkit.ts`, individual flows in `src/ai/flows/*`, local dev runner `src/ai/dev.ts`
- **Model**: Vertex AI Gemini 2.0 Flash Experimental (`vertexai/gemini-2.0-flash-exp`). Uses ADC (Application Default Credentials) in production; local dev can use `GEMINI_API_KEY`.
- **Dev workflow**: `npm run genkit:dev` starts interactive Genkit UI on port 4000; `npm run genkit:watch` for hot reload of flow code.
- **Flow registration**: Import flows in `src/ai/dev.ts` to register them in Genkit. Each flow exports named function decorated with `@genkit()`.
- **Common flows** (`src/ai/flows/`):
  - `enrichment.ts`: Cleans specs, generates descriptions, calculates quality score (used by Refiner)
  - `translation/`: Translates product descriptions to EN/DE
  - `category-mapping.ts`: Maps raw product → category hierarchy
  - `deals/`: Deal-specific enrichment (review summaries, trending predictions)
  - `aliexpress/`: Parse AliExpress HTML, extract specs
  - `draftDealFiller/`: Fill missing fields in new deals
- **Flow structure**: `defineFlow()` takes `{ name, description, inputSchema, outputSchema }` + async handler. Input/output validation automatic. Genkit provides structured logging.
- **Usage in automation**: Refiner calls `enrichment` flow for each ProductCore batch; Harvester may call translation flows for multilingual content. Server actions in admin UI directly call flows via `runFlow()`.
- **Error handling**: Flows auto-retry on transient errors. Catch exceptions in flow handlers; log context (product ID, flow name) for debugging. Genkit stores flow traces in Firestore for inspection.

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
- **Examples**:
  ```tsx
  // Client component
  const t = useTranslations('deals');
  <button>{t('filters.search')}</button> // "Szukaj" in Polish
  
  // Server component
  const t = await getTranslations('admin');
  return <h1>{t('nav.deals')}</h1>; // "Oferty" in Polish
  ```

## UI patterns & components
- **Component structure**: Domain components in `src/components/`, shadcn/ui primitives in `src/components/ui/`
- **Optimistic updates**: Pattern in comment section and voting: update local state immediately, rollback on error (see `comment-section-v2.tsx`)
- **Temperature display**: Use existing heat/flame UI components; temperature is computed server-side (not exposed to client calculation)
- **Pagination**: Client-side via `usePagination()` hook (for arrays); server-side pagination uses Firestore cursors (see `data.ts` query helpers)
- **Notifications**: `notification-bell.tsx` in navbar polls every 30s; click to mark as read and navigate to link

## Development workflow
```bash
npm run dev              # Next.js dev server (:9002) with Turbopack
npm run genkit:dev       # Genkit UI for testing/debugging AI flows (:4000)
npm run genkit:watch     # Genkit with hot reload for flow development
npm run typecheck        # TypeScript validation (strict mode)
npm run lint             # ESLint (run with --fix for auto-fix)
npm run test             # Jest unit tests (*.test.ts, *.spec.ts)
npm run test:watch       # Jest watch mode for TDD
npm run test:e2e         # Playwright E2E tests (tests/ dir)
npm run build            # Production build (validates TS + runs next build)
npm run seed:categories  # Seed category hierarchy to Firestore
npm run deploy:hosting   # Deploy Next.js to Firebase App Hosting
npm run deploy:functions # Deploy Cloud Functions only
npm run deploy:prod      # Deploy everything (hosting + functions)
```

**Local development setup**:
1. Copy `.env.local.example` → `.env.local` with Firebase project credentials + `GEMINI_API_KEY`
2. Run `npm run dev` to start Next.js on port 9002
3. Parallel terminal: `npm run genkit:dev` to test AI flows on port 4000
4. Use browser DevTools to inspect Firestore via Firebase console (`console.firebase.google.com`)
5. For production simulation: `firebase emulators:start` (requires `firebase-tools` CLI)

## Testing approaches
- **Quick system tests**: Admin UI → "Testy" tab → "Uruchom Testy" button; or `POST /api/admin/tests/run` with admin token
- **Test service**: `src/lib/test-service.ts` exports `runAllTests()` with categories (technical/functional/business/security)
- **Unit tests**: Jest config in `jest.config.js`; colocate with source files
- **E2E tests**: Playwright config in `playwright.config.ts`; uses port 9002 by default (configurable via `NEXT_PORT`)
- **Test patterns**: Always test status filters, admin role checks, cache invalidation, optimistic UI rollback

## Debugging utilities (root-level scripts)
Root directory contains 30+ debugging scripts for common troubleshooting tasks. These bypass UI and directly inspect Firestore.

**Quick reference table**:
| Problem | Script | Usage |
|---------|--------|-------|
| Import stuck | `check-job-status.js <jobId>` | Debug specific harvester job |
| Products missing | `check-products.mjs` | List all products with stats |
| Categories wrong | `check-categories.mjs` | Verify category hierarchy |
| Full import trace | `debug-import-flow.js` | End-to-end pipeline logs |
| Job cleanup | `clean-stuck-jobs.mjs` | Remove stale/failed jobs |
| Recent imports | `list-recent-jobs.js` | Show last N import jobs |

**Organization**:
- **Import debugging**: `check-imports.mjs`, `check-job-status.js`, `debug-import-flow.js`, `check-specific-job.mjs`
- **Data inspection**: `check-products.mjs`, `check-categories.mjs`, `check-titles.js`, `verify_products.js`
- **Logs analysis**: `check-full-logs.mjs`, `show-full-logs.mjs`, `inspect-logs.mjs`, `check-firestore-logs.mjs`
- **Job management**: `clean-stuck-jobs.mjs`, `trigger-processor.mjs`, `run-processor.mjs`

**Pattern**: Most scripts use `.mjs` (ESM) or `.js` (CommonJS); run with `node <script>` or `tsx <script>` for TypeScript
**Auth**: Scripts use `serviceAccountKey.json` for Firebase Admin SDK access (never commit this file!)
**When to use**: Direct database inspection, bypassing Next.js API layer; analyzing production data; emergency fixes

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

## Common pitfalls & quick fixes
| Issue | Cause | Fix |
|-------|-------|-----|
| "Missing index" error | New compound query | Check logs, add to `firestore.indexes.json` |
| Stale data after mutation | Cache not invalidated | Call `invalidate*Cache()` before mutation |
| Auth error on server | Wrong auth module | Use `src/lib/auth-server.ts`, not `auth.tsx` |
| Deal won't save | Status check missing | Ensure `status: "approved"` for public queries |
| Import stuck at 0% | Job not processing | Run `node check-job-status.js <jobId>` |
| Product duplicates | Identity mismatch | Check `IdentityMatch` collection for hash |
| Polish text missing | Wrong translation file | Add key to `messages/pl/*.json` |
| Price display inconsistent | Multiple currency systems | **See CURRENCY_ISSUES_REPORT.md** - needs unification |
| Currency switch not working | Components ignore choice | Use `useCurrency()` hook, not hardcoded PLN |

## Before committing
1. Keep all Firestore access in `data.ts`; reuse existing helpers (heat calculation, pagination, cache invalidation)
2. Run quality gates: `npm run typecheck && npm run lint && npm run test && npm run build`
3. Verify required env vars present (Firebase + Gemini minimum)
4. Check Firestore indexes if adding new compound queries (`firestore.indexes.json`)
5. Update cache invalidation if modifying data mutations
6. Add i18n keys to **all** locale files (not just Polish) — check `messages/pl/`, `messages/en/`, `messages/de/`

## Documentation
- **Index**: `docs/INDEX.md` (comprehensive guide to all docs, updated Dec 2025)
- **Quick start**: `docs/QUICK_START.md`
- **Latest milestones**: 
  - M6 (Dec 2025): `docs/milestones/M6_PRODUCT_CENTRIC_ARCHITECTURE.md` + `M6_EXECUTION_SUMMARY.md` (Product-centric model, smart harvester/refiner, identity matching)
  - M5 (Nov 2025): `docs/milestones/M5_COMPLETION_SUMMARY.md` (notifications + price alerts + email integration)
- **API guides**: `docs/api/*` (AliExpress, Allegro, Vertex AI)
- **Testing**: `docs/testing/tests-quickstart.md`
- **Troubleshooting**: `docs/troubleshooting/IMPORT_JOBS_NOT_WORKING.md`

**Quick troubleshooting links**:
- Import not working → `docs/troubleshooting/IMPORT_JOBS_NOT_WORKING.md`
- Admin panel access → `docs/guides/PRZEWODNIK_ADMINA.md`
- Harvester setup → `docs/REFINER_QUICKSTART.md`
- API integration → `docs/api/ALIEXPRESS_API_OVERVIEW.md`
- Deploy issues → `docs/deployment/DEPLOY_STATUS.md`

When in doubt about patterns, check existing implementations in the same domain (e.g., deals vs products follow parallel structures).

## Advanced patterns & gotchas
- **Server-side vs client code**: Server actions/API routes must use `src/lib/auth-server.ts`. Client components use `useAuth()` hook. Never import server modules into client code.
- **Temperature calculation**: Done server-side in `getHotDeals()` via decay formula. Never expose raw vote counts to UI; always use temperature. See line ~65 in `src/lib/data.ts`.
- **Deal vs Product mutations**: Vote/comment on Deal, not Product. Product fields are immutable except `status`. Refiner updates ProductCore, not user mutations.
- **Identity hash stability**: Once a ProductCore is created with a hash, the hash must never change (data consistency). Always recalculate identically or lookup existing via `IdentityMatch` table.
- **Firestore index gotchas**: Compound queries (orderBy + where + limit) require indexes in `firestore.indexes.json`. Firestore auto-suggests them; check logs if query fails with "FAILED_PRECONDITION".
- **Admin vs moderator**: `requireAdmin()` is strict (only admin role). Moderator role exists but has fewer permissions (see `firestore.rules`). Assign judiciously.
- **Cloud Function cold starts**: Deploy is slow; test locally via `firebase emulators:start`. Functions file size matters (keep sharp, @sendgrid minimal).
- **Next.js app router quirks**: No `next/router`; use URL params in `[id]` directories. Static generation not fully used; mostly dynamic due to real-time nature.
- **Currency & pricing (RESOLVED - M6)**: ✅ **Phase 1-3 Complete (Dec 27, 2025)**. System now has unified CurrencyManager singleton with single source of truth. For price display use `useCurrency()` hook from `src/lib/unified-currency.ts`. All conversions based on PLN (internal base), with daily automatic updates via Cloud Function. See `COMPREHENSIVE_SUMMARY_PHASE1-3.md` for full details, `CURRENCY_TESTING_GUIDE.md` for testing approach. 23 unit tests + 17 E2E tests validate system. When in doubt: `const { formatPrice } = useCurrency();` then `formatPrice(pricePLN)`.