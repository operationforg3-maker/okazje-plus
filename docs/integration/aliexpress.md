# AliExpress Integration Documentation (M1)

## Overview

This document describes the AliExpress integration for the Okazje+ platform, focusing on Milestone 1 (M1) implementation. M1 provides the foundational architecture, scaffolding, and placeholder implementations that will be completed in future milestones.

## Architecture

### Components

```
src/integrations/aliexpress/
├── client.ts          # API client with OAuth stubs
├── mappers.ts         # Data transformation (AliExpress → Okazje+ types)
├── ingest.ts          # Import pipeline with dry-run support
└── types.ts           # TypeScript interfaces

src/ai/flows/aliexpress/
├── aiSuggestCategory.ts      # AI category suggestion (stub)
├── aiNormalizeTitlePL.ts     # AI title normalization (stub)
└── aiDealQualityScore.ts     # AI deal quality scoring (stub)

src/search/
└── typesenseQueue.ts          # Typesense indexing queue (stub)

src/app/admin/imports/aliexpress/
└── page.tsx                   # Admin wizard UI (placeholder)

okazje-plus/src/
└── index.ts                   # Firebase Functions (scheduleAliExpressSync)
```

### Data Model

#### Firestore Collections

1. **vendors** - Stores vendor metadata (AliExpress, future vendors)
   ```typescript
   {
     id: string,
     name: "AliExpress",
     slug: "aliexpress",
     enabled: boolean,
     lastSyncAt?: string,
     config?: { apiEndpoint, rateLimitPerMinute },
     stats?: { totalProducts, totalDeals, lastImportCount }
   }
   ```

2. **importProfiles** - Import configuration profiles
   ```typescript
   {
     id: string,
     vendorId: string,
     name: string,
     enabled: boolean,
     schedule?: string, // cron expression
     filters: { minPrice, maxPrice, minRating, etc },
     mapping: { targetMainCategory, targetSubCategory, priceMarkup },
     deduplicationStrategy: 'skip' | 'update' | 'create_new',
     maxItemsPerRun?: number
   }
   ```

3. **importRuns** - Import execution history
   ```typescript
   {
     id: string,
     profileId: string,
     vendorId: string,
     status: 'pending' | 'running' | 'completed' | 'failed',
     dryRun: boolean,
     stats: { fetched, created, updated, duplicates, errors },
     startedAt: string,
     finishedAt?: string,
     durationMs?: number,
     errorSummary?: ImportError[]
   }
   ```

4. **products** (extended) - Product records with vendor metadata
   ```typescript
   {
     // ... existing fields
     metadata?: {
       source: 'aliexpress' | 'manual' | 'csv',
       originalId?: string,
       importedAt?: string,
       importedBy?: string,
       orders?: number,
       shipping?: string,
       merchant?: string
     }
   }
   ```

5. **deals** (extended) - Promotional deals derived from products
   ```typescript
   {
     // ... existing fields
     merchant?: string,
     shippingCost?: number
   }
   ```

## Configuration

### Environment Variables

Required environment variables for AliExpress integration:

```bash
# AliExpress API Credentials
ALIEXPRESS_APP_KEY=your_app_key_here
ALIEXPRESS_APP_SECRET=your_app_secret_here

# Optional: Override default API endpoint
ALIEXPRESS_API_ENDPOINT=https://api-sg.aliexpress.com/sync

# Optional: Custom rate limiting (requests per minute)
ALIEXPRESS_RATE_LIMIT=60

# Logging level
LOG_LEVEL=info  # debug | info | warn | error
```

### Secret Management

**M1 Status:** Environment variables only  
**M2 TODO:** Migrate to Google Secret Manager

#### Recommended Security Approach

1. **Development:** Use `.env.local` file (not committed to git)
2. **Production:** Store in Firebase App Hosting environment configuration
3. **Future (M2):** Migrate to Google Cloud Secret Manager

```bash
# Store secrets in Secret Manager (M2)
gcloud secrets create aliexpress-app-key \
  --data-file=- \
  --replication-policy=automatic

gcloud secrets create aliexpress-app-secret \
  --data-file=- \
  --replication-policy=automatic
```

### OAuth Setup (TODO - M2)

AliExpress API uses OAuth 2.0 for authentication:

1. **Register application** on AliExpress Open Platform
2. **Configure redirect URL:** `https://your-domain.com/api/auth/aliexpress/callback`
3. **Obtain credentials:** App Key and App Secret
4. **Implement OAuth flow:**
   - Authorization URL: `https://oauth.aliexpress.com/authorize`
   - Token URL: `https://oauth.aliexpress.com/token`
   - Token refresh logic

**M1 Status:** OAuth stubs in place, not fully implemented

## Usage

### Dry-Run Import

Test import without writing to database:

```typescript
import { runImport } from '@/integrations/aliexpress/ingest';

const result = await runImport('profile-id-here', {
  dryRun: true,
  maxItems: 10
});

console.log(result);
// {
//   ok: true,
//   dryRun: true,
//   stats: {
//     fetched: 10,
//     wouldCreate: 8,
//     wouldUpdate: 2,
//     duplicates: 1,
//     errors: 0
//   }
// }
```

### Manual Import

Trigger import manually from admin panel or server action:

```typescript
import { runImport } from '@/integrations/aliexpress/ingest';

const result = await runImport('profile-id-here', {
  dryRun: false,
  triggeredBy: 'manual',
  triggeredByUid: 'admin-uid',
  maxItems: 50
});
```

### Scheduled Import

Automatic imports run via Firebase Scheduled Function:

- **Function name:** `scheduleAliExpressSync`
- **Schedule:** Daily at 2:00 AM (Europe/Warsaw timezone)
- **Region:** europe-west1
- **Behavior:** Processes all enabled import profiles sequentially

**M1 Status:** Function created but calls stub logic  
**M2 TODO:** Connect to actual import pipeline

## RBAC (Role-Based Access Control)

### User Roles

Extended from original `admin | user` to:

```typescript
type UserRole = 'admin' | 'moderator' | 'specjalista' | 'user';
```

#### Role Hierarchy

1. **admin** - Full system access
   - Manage imports
   - Manage users
   - Configure system settings
   - Access all features

2. **moderator** - Content moderation
   - Approve/reject deals and products
   - Moderate comments
   - Cannot manage imports or users

3. **specjalista** - Specialist/contributor
   - Create and edit content
   - Access admin panel (limited)
   - Cannot moderate or manage imports

4. **user** - Basic user
   - View content
   - Create deals (pending approval)
   - Comment and vote

### Authorization Guards

```typescript
import { canManageImports, canModerate } from '@/lib/rbac';

// Check if user can manage imports
if (canManageImports(user)) {
  // Show import management UI
}

// Check if user can moderate
if (canModerate(user)) {
  // Show moderation controls
}
```

## AI Integration (Stubs)

### Category Suggestion

```typescript
import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';

const suggestion = await aiSuggestCategory({
  title: "Wireless Bluetooth Headphones",
  description: "High quality audio...",
  price: 129.99
});

// Returns: {
//   mainCategorySlug: "elektronika",
//   subCategorySlug: "audio",
//   confidence: 0.85,
//   reasoning: "Product matches audio category patterns"
// }
```

**M1 Status:** Returns mock data  
**M2 TODO:** Implement Genkit flow with Gemini

### Title Normalization

```typescript
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';

const result = await aiNormalizeTitlePL({
  title: "HOT SALE!!! Wireless Earbuds FREE SHIPPING",
  language: "en"
});

// Returns: {
//   normalizedTitle: "Bezprzewodowe słuchawki douszne",
//   translated: true,
//   changes: ["Translated to Polish", "Removed spam keywords"]
// }
```

**M1 Status:** Basic cleanup only  
**M2 TODO:** Full AI-powered translation and normalization

### Deal Quality Scoring

```typescript
import { aiDealQualityScore } from '@/ai/flows/aliexpress/aiDealQualityScore';

const score = await aiDealQualityScore({
  title: "Product title",
  price: 99.99,
  originalPrice: 199.99,
  discountPercent: 50,
  rating: 4.5,
  reviewCount: 1250
});

// Returns: {
//   score: 78,
//   recommendation: "approve",
//   factors: { priceQuality: 80, discountLegitimacy: 70, ... },
//   warnings: []
// }
```

**M1 Status:** Simple heuristics  
**M2 TODO:** ML-based quality assessment

## Typesense Integration (Stubs)

Index products and deals for search:

```typescript
import { queueProductForIndexing, queueDealForIndexing } from '@/search/typesenseQueue';

// Queue single items
await queueProductForIndexing('product-id');
await queueDealForIndexing('deal-id');

// Batch operations
import { queueProductsForIndexing } from '@/search/typesenseQueue';
await queueProductsForIndexing(['id1', 'id2', 'id3']);
```

**M1 Status:** Functions exist but do nothing (log only)  
**M2 TODO:** Implement actual Typesense indexing

## Error Handling

### Error Types

```typescript
type ImportErrorCode = 
  | 'NETWORK'        // API connection failed
  | 'RATE_LIMIT'     // Rate limit exceeded
  | 'MAPPING'        // Data transformation failed
  | 'VALIDATION'     // Product validation failed
  | 'UNKNOWN';       // Unexpected error
```

### Error Recovery

**M1 Status:** Errors are logged and accumulated  
**M2 TODO:** Implement retry logic with exponential backoff

```typescript
// TODO M2: Retry logic example
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  // Exponential backoff implementation
}
```

## Logging

### Structured Logging

```typescript
import { logger, createImportLogger } from '@/lib/logging';

// General logging
logger.info('Import started', { profileId: 'abc123' });
logger.error('Import failed', { error: err.message });

// Context-specific logger
const importLogger = createImportLogger(importRunId, profileId);
importLogger.info('Processing product', { productId: 'xyz' });
```

### Log Levels

- **debug:** Detailed information for debugging
- **info:** General informational messages
- **warn:** Warning messages (non-critical issues)
- **error:** Error messages (critical issues)

Set log level via environment: `LOG_LEVEL=debug`

## Testing

### Unit Tests (TODO - M2)

```bash
npm run test -- src/integrations/aliexpress
```

Test coverage areas:
- Mappers: Data transformation correctness
- Validation: Filter and validation logic
- Client: API request building (mocked)

### Manual Testing

1. **Navigate to admin panel:**
   ```
   http://localhost:9002/admin/imports/aliexpress
   ```

2. **Check wizard steps display correctly**

3. **Verify Firebase Function deployed:**
   ```bash
   firebase deploy --only functions:scheduleAliExpressSync
   ```

## Development Checklist

### M1 Complete ✅

- [x] Data model interfaces defined
- [x] RBAC extensions implemented
- [x] AliExpress client scaffolding
- [x] Data mappers implemented
- [x] Ingest pipeline with dry-run
- [x] AI flow stubs created
- [x] Typesense queue stubs
- [x] Admin wizard placeholder
- [x] Scheduled sync function
- [x] Logging utility
- [x] Documentation

### M2 TODO 📋

- [ ] Implement OAuth flow
- [ ] Real API client with signing
- [ ] Deduplication with embeddings
- [ ] Full AI flows (Genkit + Gemini)
- [ ] Typesense indexing
- [ ] Category mapping UI
- [ ] Import history dashboard
- [ ] Real-time import progress
- [ ] Error recovery with retry
- [ ] Rate limiting implementation
- [ ] Unit tests
- [ ] E2E tests

### M3 TODO 📋

- [ ] Advanced filtering UI
- [ ] Bulk operations
- [ ] Import analytics
- [ ] Performance optimization
- [ ] Multi-vendor support
- [ ] Automated moderation
- [ ] Price tracking
- [ ] Stock monitoring

## Troubleshooting

### Issue: "AliExpress credentials not found"

**Solution:** Set environment variables:
```bash
export ALIEXPRESS_APP_KEY=your_key
export ALIEXPRESS_APP_SECRET=your_secret
```

### Issue: Build fails with module not found

**Solution:** Install dependencies:
```bash
npm install --legacy-peer-deps
```

### Issue: Function deployment fails

**Solution:** Check region configuration:
```bash
firebase deploy --only functions:scheduleAliExpressSync --project your-project
```

### Issue: Dry-run returns 0 fetched items

**Expected behavior in M1:** API client is stubbed and returns empty results.  
**M2 Fix:** Implement actual API calls.

## Support

For questions or issues:
1. Check this documentation
2. Review code comments (TODO markers)
3. Check existing GitHub issues
4. Contact development team

## License

Internal use only - Okazje+ platform
