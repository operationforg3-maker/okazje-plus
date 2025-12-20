# AliExpress Autopilot - Automated Import System

## Overview

Fully automated AliExpress import system with:
- Live FX currency conversion
- Profile-based filtering (price, rating, orders, discount)
- Admin UI for profile management
- Scheduled cron jobs (every 6 hours)
- Manual trigger from admin panel
- Comprehensive logging and error handling

## Architecture

### Components

1. **Live FX API** (`src/lib/fx.ts`)
   - Real-time currency conversion via exchangerate.host
   - 10-minute cache with fallback to static rates
   - Used by importer for USD/EUR → PLN conversion

2. **AliExpress Importer** (`src/lib/aliexpress-importer.ts`)
   - Profile-based imports with configurable filters
   - Deduplication on originalId+source
   - Auto-approve configuration
   - Price history tracking
   - Detailed logging to importRuns and import_logs

3. **Admin Autopilot Endpoint** (`src/app/api/admin/autopilot/run/route.ts`)
   - Admin-only manual trigger
   - Runs all enabled profiles
   - Optional maxItemsPerProfile override

4. **Cron Sync Endpoint** (`src/app/api/cron/aliexpress-sync/route.ts`)
   - Triggered by Cloud Scheduler every 6 hours
   - OIDC authentication
   - Runs enabled profiles with 20-item limit

5. **Admin UI** (`src/components/admin/aliexpress-importer.tsx`)
   - AutopilotCard component for profile management
   - Enable/disable toggle per profile
   - "Run now" per profile
   - "Run all" button for manual autopilot

## Setup

### 1. Environment Variables

Already configured in `apphosting.yaml`:
- `FX_API_URL`: https://api.exchangerate.host/latest
- `CRON_SECRET`: (from Secret Manager)
- AliExpress credentials: APP_KEY, APP_SECRET, AFFILIATE_ID

### 2. Cloud Scheduler

Created and enabled:
```bash
Job: aliexpress-sync
Schedule: 0 */6 * * * (every 6 hours)
URL: /api/cron/aliexpress-sync
Auth: OIDC via firebase-adminsdk-fbsvc@okazje-plus.iam.gserviceaccount.com
Timezone: Europe/Warsaw
```

### 3. Import Profiles

Three profiles seeded to Firestore:
1. **Elektronika - Best Sellers** (enabled)
   - Query: electronics wireless
   - Filters: 10-500 PLN, rating ≥4.0, orders ≥100, discount ≥20%
   - Target: elektronika/audio
   - Max items: 50

2. **Dom i Ogród - Hot Deals** (enabled)
   - Query: home garden tools
   - Filters: 5-300 PLN, rating ≥4.5, orders ≥50, discount ≥30%
   - Target: dom-i-ogrod/narzedzia
   - Max items: 30

3. **Sport - Fitness Equipment** (disabled)
   - Query: fitness sports equipment
   - Filters: 20-1000 PLN, rating ≥4.0, orders ≥200, discount ≥25%
   - Target: sport/fitness
   - Max items: 20

## Usage

### Manual Autopilot (Admin Panel)

1. Navigate to `/admin/import`
2. View "Autopilot AliExpress" card
3. Toggle profiles on/off
4. Click "Uruchom teraz" per profile OR "Uruchom autopilota teraz" for all

### Scheduled Autopilot (Cron)

Runs automatically every 6 hours:
- Next run: Check Cloud Scheduler in GCP Console
- Logs: Firestore `importRuns` collection

### Programmatic Trigger

```bash
# Admin endpoint (requires admin token)
curl -X POST https://your-domain.com/api/admin/autopilot/run \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxItemsPerProfile": 20}'
```

## Monitoring

### Import Runs
```typescript
// Firestore query
const runs = await db.collection('importRuns')
  .where('vendorId', '==', 'aliexpress')
  .orderBy('startedAt', 'desc')
  .limit(10)
  .get();
```

### Import Logs
```typescript
// Per-run logs
const logs = await db.collection('importRuns')
  .doc(runId)
  .collection('import_logs')
  .get();
```

### Cloud Scheduler Logs
```bash
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=aliexpress-sync" --limit 50
```

## Filters

All filters are applied before Firestore writes:
- `minPrice` / `maxPrice`: PLN (after FX conversion)
- `minRating`: 0-5 scale (AliExpress uses 0-100, auto-converted)
- `minOrders`: Total order count
- `minDiscount`: Percentage (calculated from original vs sale price)

Items failing filters are logged as "skipped" with reason.

## Testing

Unit tests:
```bash
npm test -- src/lib/__tests__/fx.test.ts
npm test -- src/components/admin/__tests__/autopilot-card.test.tsx
```

Manual test:
1. Enable a profile in admin UI
2. Click "Uruchom teraz"
3. Check `importRuns` collection for new run
4. Verify `products` collection for new items

## Troubleshooting

### No items imported
- Check import run logs for filter failures
- Verify AliExpress API credentials in Secret Manager
- Check FX API connectivity (fallback to static rates if down)

### Duplicate items
- Deduplication is by `metadata.originalId` + `metadata.source`
- Logged as "skipped" with reason "Duplicate"

### Cron not running
- Verify Cloud Scheduler job is enabled
- Check OIDC service account permissions
- Review Cloud Scheduler execution logs

### FX conversion errors
- Check `FX_API_URL` reachability
- Fallback rates used automatically on failure
- Logged as warning with fallback indicator

## Future Enhancements

- [ ] Add deal support (currently products only)
- [ ] AI enrichment integration (enable via profile config)
- [ ] Price monitoring and alerts
- [ ] Multi-region AliExpress support (EU/US/SG)
- [ ] Category auto-mapping via AI
- [ ] Webhook notifications on import completion
