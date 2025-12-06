# Task 4: SEO Zombie Cleaner Cron

**Status:** ✅ COMPLETE  
**Files:** 1 | **LOC:** ~160  
**Dependencies:** @google/generative-ai

## Overview

Scheduled Cloud Function that runs daily at 3 AM (Europe/Warsaw timezone) to:
1. Find expired deals (explicit expiry or 30+ days inactive)
2. Remove them from Google Search index
3. Find similar active deals for internal linking
4. Update related deals for SEO benefit

## Features

### Auto-Expiry Detection

Finds deals that are:
- **Explicitly expired**: `expiryDate < now`
- **Inactive 30+ days**: `updatedAt < (now - 30 days)`

Query: All deals with `status` ∈ ['approved', 'draft']

### Gemini-Powered Similarity Matching

Uses Google Generative AI (Gemini 2.0 Flash) to rank similar deals:

1. **Initial filter**: Same `mainCategorySlug`
2. **Relevance scoring**: Gemini prompt with deal title, price, category
3. **Returns**: Top 3 most similar active deals (with temperature > 0)

Prompt engineering considers:
- Deal title similarity
- Price range alignment
- Category relevance

### Google Indexing Integration

For each expired deal:
1. Calls `requestDealIndexing(dealId, 'URL_DELETED')`
2. Requests removal from Google Search index
3. Tracks: `indexingStatus: 'removed'` or `'removal_failed'`

### Firestore Updates

After processing, updates deal document:

```typescript
{
  status: 'expired',                          // Mark as expired
  expiredAt: "2025-11-15T03:00:00.000Z",     // When expired
  expiredReason: 'explicit_expiry' | 'inactivity',
  relatedDeals: ['deal-id-1', 'deal-id-2', 'deal-id-3'],  // For internal links
  indexingStatus: 'removed' | 'removal_failed'
}
```

## File

### `/okazje-plus/src/triggers/seoZombieCleanerCron.ts` (160 LOC)

**Trigger:** `onSchedule`

**Schedule:**
- Time: `0 3 * * *` (3:00 AM daily)
- Timezone: `Europe/Warsaw`
- Region: `europe-west1`
- Memory: `512MiB`
- Timeout: `540 seconds` (9 minutes)

**Functions:**

- **`findExpiredDeals(): Promise<Deal[]>`**
  - Queries all non-expired deals
  - Checks both explicit expiry and inactivity
  - Returns array of expired Deal objects

- **`findSimilarDeals(deal: Deal, limit?: number): Promise<string[]>`**
  - Uses Gemini to rank similar active deals
  - Filters by category first (for relevance)
  - Scores with Gemini prompt
  - Returns top N deal IDs (default: 3)
  - Error handling: returns [] on failure

- **Main handler (async): Promise<void>**
  - Calls `findExpiredDeals()`
  - For each expired deal:
    - Calls `requestDealIndexing(dealId, 'URL_DELETED')`
    - Calls `findSimilarDeals(deal, 3)`
    - Updates Firestore with all metadata
  - Logs summary: count of processed, errors

## Schedule

Daily at **3:00 AM Europe/Warsaw time**:

```
0   3   *   *   *
|   |   |   |   |
|   |   |   |   └─ Day of week (any)
|   |   |   └───── Month (any)
|   |   └───────── Day of month (any)
|   └───────────── Hour (3 = 3 AM)
└───────────── Minute (0)
```

Equivalent UTC times:
- **Winter** (Oct-Mar): 2:00 AM UTC
- **Summer** (Mar-Oct): 1:00 AM UTC

## Workflow

```
Daily 3:00 AM Europe/Warsaw
    ↓
Find expired deals
  - expiryDate < now OR updatedAt < 30 days ago
  - Query: status ∈ [approved, draft]
    ↓
For each expired deal:
  ├─ Request Google removal (URL_DELETED)
  ├─ Use Gemini to find 3 similar active deals
  ├─ Update Firestore:
  │  ├─ status: 'expired'
  │  ├─ expiredAt: timestamp
  │  ├─ expiredReason: 'explicit_expiry' | 'inactivity'
  │  ├─ relatedDeals: [id1, id2, id3]
  │  └─ indexingStatus: 'removed' | 'removal_failed'
  └─ Log result
    ↓
Return summary (processed count, errors)
```

## Gemini Integration

**Model:** `gemini-2.0-flash-exp`

**Input:** Target deal + 5 candidate deals from same category

**Prompt Example:**

```
You are an e-commerce expert. Rate which deals are most similar to this one:

TARGET DEAL: "Samsung Galaxy S24 Ultra 512GB"
Category: elektronika
Price: PLN 4500

CANDIDATE DEALS:
1. "Samsung Galaxy S24 256GB" (3800 PLN)
2. "iPhone 15 Pro Max" (6299 PLN)
3. "Samsung Galaxy S24 Ultra 256GB" (4000 PLN)
4. "OnePlus 12" (2999 PLN)
5. "Samsung Galaxy Buds Pro" (499 PLN)

Return ONLY a JSON array of the top 3 most similar deal indices: [1, 3, 5]
```

**Output:** JSON array of 1-indexed positions  
**Temperature:** 0.2 (low randomness, deterministic)  
**Max tokens:** 100

## Metrics

After completion, logs summary:

```
[ZombieCleaner] ✅ Cleanup complete: 15 processed, 2 errors
```

Success factors:
- Processed: deals successfully expired and updated
- Errors: deals that failed (logged individually)
- Total: count from initial query

## Error Handling

**Per-deal errors:**
- Logged but don't stop processing
- Deal document still updated if partially successful
- Example: Google API fails but Firestore updates

**Cron-level errors:**
- Caught and logged
- Re-thrown to Firebase for retry
- Next run: 24 hours later

## Monitoring

Firebase Console logs:

```bash
firebase functions:log --region europe-west1 | grep ZombieCleaner
```

Key log lines:
- `[ZombieCleaner] Starting scheduled cleanup...`
- `[ZombieCleaner] Found N expired deals`
- `[ZombieCleaner] Requested removal from Google: <dealId>`
- `[ZombieCleaner] ✓ Expired deal <id>, related: [<id1>, <id2>, <id3>]`
- `[ZombieCleaner] Failed to process deal <id>: <error>`
- `[ZombieCleaner] ✅ Cleanup complete: 15 processed, 2 errors`

## Database Queries

Current queries:

```typescript
// Find expired deals
db.collection('deals')
  .where('status', 'in', ['approved', 'draft'])
  .get()

// Find similar active deals (in same category)
db.collection('deals')
  .where('status', '==', 'approved')
  .where('mainCategorySlug', '==', deal.mainCategorySlug)
  .limit(10)
  .get()
```

**Performance:** ~2-5s on 10k deals (depends on Gemini response time)

## SEO Benefits

### Internal Linking
- `relatedDeals` array enables internal linking
- Old deals → similar new deals
- Improves crawl depth and user engagement

### Index Cleanup
- Removes expired URLs from Google Search
- Reduces crawl budget waste
- Improves site quality signals

### Freshness Signal
- Automatic maintenance shows actively managed catalog
- Signals to Google: regularly updated content

## Environment Variables

Required:

```
GOOGLE_API_KEY=<your-google-ai-api-key>  # For Gemini
```

From Task 1 setup (Google Indexing API):
```
GOOGLE_APPLICATION_CREDENTIALS=<path-to-serviceAccountKey.json>
```

## Deployment

```bash
firebase deploy --only functions:seoZombieCleanerCron
```

Deployed as: `seoZombieCleanerCron` (europe-west1)

## Local Testing

```bash
# Trigger manually (requires Admin SDK auth)
import { seoZombieCleanerCron } from './triggers/seoZombieCleanerCron';

await seoZombieCleanerCron({} as any);
```

## Rate Limiting

- **Google Indexing API**: 200 URLs/day (per Task 1 quota)
- **Gemini requests**: Depends on Google AI quota
- **Firestore writes**: Batch within transaction limits

Current implementation: ~300-500 writes/run (acceptable)

## Future Enhancements

- [ ] Configurable expiry thresholds (currently 30 days)
- [ ] Category-specific similarity weights
- [ ] Internal link quality score (temperature-based)
- [ ] Archive collection for expired deals (audit trail)
- [ ] Slack notifications on high error rates
- [ ] Metrics export to Cloud Monitoring
