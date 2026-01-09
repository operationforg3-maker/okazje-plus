# KROK 4: Expired Deals Handling - SEO Zombie Strategy

**Status:** ✅ CORE IMPLEMENTATION COMPLETE (Cron handler + API infrastructure)
**Implementation Date:** 2025-12-05
**Frontend UI & SEO Strategy:** PENDING (marked as not-started)

## Overview

Implements comprehensive "SEO Zombie" strategy for expired deals:
- **Automatic Processing**: Daily cron job detects & marks expired deals
- **Google De-indexing**: Removes expired deals from Google Search results
- **Internal Preservation**: Keeps expired deals indexed internally for SEO juice preservation
- **Graceful UX**: Frontend shows "Expired" banners with links to fresh deals
- **Category Aggregation**: Expired deals support category-level SEO strategies

## Architecture

### Lifecycle of a Deal

```
Deal Creation
├─ status: 'draft'
├─ expiryDate: null (never expires unless explicitly set)
└─ Or set custom expiryDate during creation

During Daily Cron (02:00 UTC)
├─ Query: status='draft' AND expiryDate <= today
├─ For each expired deal:
│  ├─ Update: status → 'rejected'
│  ├─ Add: expiredAt timestamp
│  ├─ Google Indexing API: URL_DELETED
│  └─ Log: seoZombieStrategy metadata
└─ Update Firestore audit log

Public API (User Views)
├─ Listings: Filter status='approved' → No expired deals shown
├─ Search: Only approved deals returned
└─ Deal Card: Shows "Expired" badge if status='rejected' & has seoZombieStrategy

Internal Search & Category Pages (FUTURE)
├─ Include rejected deals with seoZombieStrategy flag
├─ Show "Expired" badge + internal links
├─ Aggregate for "Recently Expired in This Category"
└─ 301 redirects to category page for external traffic
```

## Components

### 1. Cron Handler Endpoint ✅ COMPLETE

**File:** `src/app/api/admin/schedule/deals/expire-handler/route.ts`

**Purpose:** Detects expired deals and removes from Google Search Console

**Invocation:**
- Cloud Scheduler job (daily at 02:00 UTC)
- Manual trigger: `POST /api/admin/schedule/deals/expire-handler`
- Check status: `GET /api/admin/schedule/deals/expire-handler`

**Flow:**
```
POST /api/admin/schedule/deals/expire-handler
  ↓
1. Query Firestore:
   - Collection: deals
   - Where: status='draft' AND expiryDate <= today
   ↓
2. For each expired deal (batch processing):
   - Update: status → 'rejected'
   - Add: expiredAt, expireHandlerProcessedAt
   - Add: seoZombieStrategy metadata
   ↓
3. Google Indexing API:
   - Call: requestDealIndexing(dealId, 'URL_DELETED')
   - Effect: Removes from Google Search results
   - Not affected: Internal search, admin moderation
   ↓
4. Logging:
   - Save audit trail to config/expireHandlerLog
   - Track: processed count, indexing failures, timing
   ↓
Response: { success: true, processed: N, indexingFailed: M, ... }
```

**Example Response:**
```json
{
  "success": true,
  "message": "Processed 3 expired deals",
  "processed": 3,
  "indexingSucceeded": 3,
  "indexingFailed": 0,
  "processingTimeMs": 1250,
  "results": [
    {
      "dealId": "deal_abc123",
      "dealTitle": "Samsung Galaxy S24",
      "expiryDate": "2025-12-04T00:00:00.000Z",
      "indexed": true,
      "markedAt": "2025-12-05T02:00:15.123Z"
    },
    ...
  ]
}
```

### 2. Cloud Scheduler Configuration (NEEDS SETUP)

To enable daily cron job, configure in Firebase Console or via `apphosting.yaml`:

**Option A: Firebase Console**
1. Go to Cloud Scheduler
2. Create new job:
   - Name: `expire-deals-daily`
   - Frequency: `0 2 * * *` (Daily at 2 AM UTC)
   - Timezone: UTC
   - HTTP target:
     - URL: `https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/api/admin/schedule/deals/expire-handler`
     - HTTP method: POST
     - Auth header: Add OIDC token (service account)

**Option B: Via gcloud CLI**
```bash
gcloud scheduler jobs create http expire-deals-daily \
  --schedule="0 2 * * *" \
  --uri="https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app/api/admin/schedule/deals/expire-handler" \
  --http-method=POST \
  --oidc-service-account-email=default@appspot.gserviceaccount.com \
  --oidc-token-audience="https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app" \
  --location=europe-west1
```

**Option C: Pub/Sub Trigger (Alternative)**
```yaml
# In apphosting.yaml
# Configure Pub/Sub topic and Cloud Function
```

### 3. Frontend UI Banner (NOT YET IMPLEMENTED)

**Component:** `src/components/deal-card.tsx` enhancement

**Changes Needed:**
```tsx
// Show "Expired" badge for rejected deals with seoZombieStrategy
{deal.status === 'rejected' && deal.seoZombieStrategy ? (
  <Badge variant="destructive" className="absolute top-2 right-2">
    Wygasła
  </Badge>
) : null}

// Show internal links to similar fresh deals
{deal.seoZombieStrategy ? (
  <div className="mt-3 p-3 bg-gray-50 rounded">
    <p className="text-sm text-gray-600">
      Ta okazja już wygasła. 
      <Link href={`/pl/${deal.seoZombieStrategy.redirectCategory}`}>
        Sprawdź nowe oferty w kategorii →
      </Link>
    </p>
  </div>
) : null}
```

### 4. Category Page Aggregation (NOT YET IMPLEMENTED)

**File:** `src/app/[locale]/deals/page.tsx` enhancement

**Changes Needed:**
```tsx
// Include expired deals in category pages for SEO
const expiredRecently = await getRecentlyExpiredDeals({
  mainCategorySlug: categorySlug,
  limit: 5,
  maxAge: 30 * 24 * 60 * 60 * 1000, // Last 30 days
});

// Display as "Recently Expired" section
{expiredRecently.length > 0 && (
  <section className="bg-yellow-50 p-6 rounded-lg">
    <h2>Niedawno wygasłe okazje</h2>
    <p className="text-sm">Może interesować cię aktualnie dostępne oferty:</p>
    {/* Links to fresh deals */}
  </section>
)}
```

### 5. SEO Zombie Strategy (NOT YET IMPLEMENTED)

**Purpose:** Preserve SEO value of expired deals

**Implementation:**
1. **Internal Linking**: Expired deal pages link to fresh deals in same category
2. **301 Redirects**: External traffic redirects category page → fresh deals
3. **Meta Robots**: Add `noindex,follow` to expired deal pages
4. **Breadcrumbs**: Keep taxonomy linkage for search crawlers
5. **Aggregation**: Category pages aggregate fresh + recently expired for engagement

**Firestore Schema:**
```typescript
// Added to expired deals by cron handler
seoZombieStrategy: {
  originalCategory: "elektronika/smartfony",  // For aggregation
  expiryDate: "2025-12-04T00:00:00Z",         // When it expired
  redirectCategory: "elektronika/smartfony",   // Where to link
  internalLinkStrategy: "category",            // Link type
  lastCrawlDate: "2025-12-05T02:00:15Z",     // Track freshness
}
```

## Data Schema

### Deal Fields (Relevant to Expiry)

```typescript
{
  id: "deal_abc123",
  title: "Samsung Galaxy S24",
  status: "draft" | "approved" | "rejected",  // "rejected" = expired
  
  // Expiry dates
  expiryDate?: Timestamp,        // When deal expires (draft only)
  expiredAt?: Timestamp,         // When cron handler marked as expired
  expireHandlerProcessedAt?: Timestamp,
  
  // SEO Zombie metadata (added by cron handler)
  seoZombieStrategy?: {
    originalCategory: string;     // Main category of expired deal
    expiryDate: Timestamp;        // Original expiry date
    redirectCategory: string;     // Where to redirect traffic
    internalLinkStrategy: "category" | "hot-deals" | "custom";
    lastCrawlDate?: Timestamp;    // For monitoring
  }
}
```

## Processing Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Cloud Scheduler Trigger                                    │
│  Daily at 02:00 UTC                                         │
│  (or manual POST /api/admin/schedule/deals/expire-handler)  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
            ┌────────────────────┐
            │ Query Firestore    │
            │ status='draft' &&   │
            │ expiryDate<=today   │
            └────────┬───────────┘
                     │
        ┌────────────▼──────────────┐
        │ For each expired deal:    │
        │ (batch with 100ms delay)  │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ Update Firestore:                         │
        │ - status → 'rejected'                     │
        │ - Add expiredAt timestamp                 │
        │ - Add seoZombieStrategy metadata          │
        └────────────┬───────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ Google Indexing API:                      │
        │ requestDealIndexing(dealId, 'URL_DELETED')│
        └────────────┬───────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ Log Results:                              │
        │ - Save audit trail                        │
        │ - Track success/failure                   │
        └────────────┬───────────────────────────────┘
                     │
                     ▼
      ┌──────────────────────────────────────┐
      │ Return Summary Response              │
      │ { success, processed, failed, ... }  │
      └──────────────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────┐
        │ Public APIs (unchanged):         │
        │ - Listings show only 'approved'  │
        │ - Search excludes expired deals  │
        └──────────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────┐
        │ Frontend (TBD):                  │
        │ - Shows "Expired" badge          │
        │ - Links to fresh deals           │
        │ - Category page aggregation      │
        └──────────────────────────────────┘
```

## Integration with Previous KROKs

### KROK 1: Smart Seeding
- Seed data includes 9 deals with expiryDate set to past dates
- Cron handler will process these on first run
- Confirms KROK 4 infrastructure works correctly

### KROK 2: Google Indexing API
- Cron handler calls `requestDealIndexing(dealId, 'URL_DELETED')`
- Removes expired deals from Google Search results
- Preserves internal Firestore state for SEO strategy

### KROK 3: AI Pipeline Refactor
- Quality scores can inform expiry decisions
- Low-quality deals might expire faster
- (Future: Predictive expiry based on engagement)

## Testing

### Manual Test 1: Create Expired Deal
```typescript
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

await adminDb.collection('deals').add({
  title: "Test Expired Deal",
  status: 'draft',
  expiryDate: Timestamp.fromDate(yesterday),
  price: 100,
  // ... other fields
});

// Manually trigger cron handler
const response = await fetch(
  'https://app-url/api/admin/schedule/deals/expire-handler',
  { method: 'POST' }
);

// Check result
const result = await response.json();
console.log(result); // Should show processed=1
```

### Manual Test 2: Verify Google Indexing
```bash
# Check handler status
curl https://app-url/api/admin/schedule/deals/expire-handler

# Should show last execution details in response
```

### Integration Test: Full Lifecycle
```typescript
test('expired deal should be removed from Google and marked rejected', async () => {
  // 1. Create deal with expiry date = yesterday
  const deal = await createDeal({
    title: "Test",
    expiryDate: yesterday,
    status: 'draft'
  });

  // 2. Run cron handler
  const response = await fetch('/.../expire-handler', { method: 'POST' });
  expect(response.status).toBe(200);

  // 3. Verify deal marked as rejected
  const updated = await getDeal(deal.id);
  expect(updated.status).toBe('rejected');
  expect(updated.seoZombieStrategy).toBeDefined();

  // 4. Verify should not appear in public listings
  const listings = await getPublicDeals();
  expect(listings.find(d => d.id === deal.id)).toBeUndefined();
});
```

## Configuration

### Environment Variables

```env
# In .env.local or Firebase Console Secrets
NEXT_PUBLIC_APP_URL=https://okazje-plus.pl
# Google API credentials (already configured for Google Indexing)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Firestore Rules (Optional Enhancement)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow reading expired deals internally only
    match /deals/{dealId} {
      allow read: if 
        request.auth.uid != null &&  // Authenticated
        (resource.data.status == 'approved' ||  // OR approved
         request.auth.token.admin == true);  // OR admin
    }
  }
}
```

## Monitoring & Alerts

### Metrics to Track
1. **Processed deals**: Should increase daily
2. **Indexing success rate**: Should be >99%
3. **Processing time**: Should stay <5 minutes for 1000s of deals
4. **Error rate**: Alert if >5% failures

### Log Monitoring
```bash
# View recent handler logs
gcloud firestore databases describe default --location=europe-west1

# Check handler execution
curl https://app-url/api/admin/schedule/deals/expire-handler
```

### Error Alerts (TBD)
- Configure Cloud Monitoring alerts
- Alert channels: Slack, Email
- Conditions: Processing failures, quota exceeded, etc.

## Quota & Performance

### Google Indexing API Quotas
- **Per day**: 200 URLs
- **Per second**: 2 QPS
- **Cron handler**: ~100 deals/minute (with 100ms delay)
- **Overflow handling**: Leftover deals retry next day

### Processing Performance
- **Per deal**: ~100-200ms (includes API call)
- **1000 deals**: ~100-200 seconds (~3 minutes)
- **Function timeout**: 300 seconds (5 minutes) - plenty of headroom

### Firestore Writes
- **Batch update**: One batch per 500 deals
- **Cost**: ~500 write operations per 500 deals
- **Optimization**: Could use batch writing to reduce cost by 10x

## Future Enhancements

1. **Predictive Expiry**: ML model predicts deal quality → auto-expiry
2. **Smart Redirects**: Route expired deal traffic to similar fresh deals (not just category)
3. **Engagement Recovery**: Show "Customers also viewed..." on expired deals
4. **Analytics**: Track which expired deals get re-engaged via internal links
5. **Webhook Notifications**: Alert subscribers when deals in their categories expire
6. **Automatic Renewal**: Auto-extend popular deals before expiry
7. **Seasonal Archiving**: End-of-season expired deals move to "Archive" view

## Files Modified

✅ **Created:**
- `src/app/api/admin/schedule/deals/expire-handler/route.ts` (Cron handler)

📝 **Pending Implementation:**
- Frontend UI banner component (src/components/deal-card.tsx)
- Category page aggregation (src/app/[locale]/deals/page.tsx)
- SEO strategy implementation (routing, redirects, meta tags)
- Monitoring & alerting configuration

## Related Documentation

- **KROK 1**: Seeded 9 deals with expiryDate in past (test data for KROK 4)
- **KROK 2**: Google Indexing API integration (URL_DELETED endpoint)
- **KROK 3**: Deal quality scoring (could inform expiry strategy)

## Deployment Checklist

- [ ] Deploy expire-handler endpoint to production
- [ ] Test manually on dev/staging
- [ ] Configure Cloud Scheduler job (02:00 UTC daily)
- [ ] Verify Google Indexing API calls are successful
- [ ] Implement frontend UI (KROK 4.2)
- [ ] Implement SEO zombie strategy (KROK 4.3)
- [ ] Set up monitoring & alerting
- [ ] Document for support team

---

**Author**: AI Coding Assistant  
**Status**: CORE COMPLETE, UI & SEO PENDING  
**Next Step**: Implement frontend UI banner (KROK 4.2)
