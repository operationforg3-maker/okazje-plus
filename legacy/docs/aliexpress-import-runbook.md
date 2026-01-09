# AliExpress Import System - Runbook

> **Last Updated**: December 2025  
> **Status**: Production Ready  
> **Maintainer**: Development Team

## Overview

The AliExpress import system allows automated importing and syncing of products from AliExpress to the Okazje Plus platform using real API data.

## Architecture

### Components

1. **AliExpress Client** (`src/lib/integrations/aliexpress-client.ts`)
   - Handles OAuth 2.0 authentication
   - HMAC-MD5 request signing
   - Rate limiting and retry logic
   - Token refresh automation

2. **Importer Module** (`src/lib/aliexpress-importer.ts`)
   - Main import orchestration
   - Deduplication logic
   - Currency conversion
   - Price history tracking
   - Detailed logging

3. **API Endpoints**
   - `/api/admin/imports/run` - Manual import trigger (POST)
   - `/api/cron/aliexpress-sync` - Scheduled sync (GET)

4. **Firestore Collections**
   - `importProfiles` - Import configuration profiles
   - `importRuns` - Import execution history
   - `importRuns/{id}/import_logs` - Detailed item logs
   - `products` - Imported product records
   - `deals` - Imported deal records

## Quick Start

### Prerequisites

1. AliExpress API credentials (App Key, App Secret)
2. Firebase Admin access
3. Import profile configured in Firestore

### Manual Import

```bash
# Trigger import via API
curl -X POST https://your-domain.com/api/admin/imports/run \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": "PROFILE_ID",
    "maxItems": 50,
    "dryRun": false,
    "autoApprove": true
  }'
```

### View Import Status

```bash
# Check import run status
firebase firestore:get importRuns/IMPORT_RUN_ID

# View detailed logs
firebase firestore:get importRuns/IMPORT_RUN_ID/import_logs
```

## Configuration

### Import Profile Structure

```typescript
{
  id: string;
  vendorId: 'aliexpress';
  name: string;
  enabled: boolean;
  filters: {
    searchQuery?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minOrders?: number;
    minDiscount?: number;
  };
  mapping: {
    targetMainCategory: string;
    targetSubCategory: string;
    targetSubSubCategory?: string;
    priceMarkup?: number;
    defaultStatus: 'draft' | 'approved';
  };
  deduplicationStrategy: 'skip' | 'update' | 'create_new';
  maxItemsPerRun?: number;
}
```

### Environment Variables

Required:
```bash
ALIEXPRESS_APP_KEY=your_app_key
ALIEXPRESS_APP_SECRET=your_app_secret
ALIEXPRESS_API_BASE=https://api-eu.aliexpress.com/router/rest
```

Optional:
```bash
ALIEXPRESS_AFFILIATE_ID=your_affiliate_id
ALIEXPRESS_ACCESS_TOKEN=cached_token
ALIEXPRESS_REFRESH_TOKEN=refresh_token
ALIEXPRESS_TOKEN_EXPIRES_IN=3600
CRON_SECRET=your_cron_secret
```

## Operations

### Scheduled Sync (Cron)

The cron job runs at configured intervals (recommended: every 6-12 hours) to:
- Refresh prices for existing products
- Check availability/stock status
- Update images if changed
- Import new hot products

**Setup Cloud Scheduler:**

```bash
# Create scheduler job
gcloud scheduler jobs create http aliexpress-sync \
  --schedule="0 */6 * * *" \
  --uri="https://your-domain.com/api/cron/aliexpress-sync" \
  --http-method=GET \
  --headers="Authorization=Bearer YOUR_CRON_SECRET" \
  --location=europe-west1
```

### Monitoring

**Check Recent Imports:**
```bash
firebase firestore:query importRuns \
  --orderBy startedAt desc \
  --limit 10
```

**View Error Summary:**
```bash
firebase firestore:query importRuns \
  --where status==failed \
  --orderBy startedAt desc
```

**Check Import Stats:**
```typescript
const run = await db.collection('importRuns').doc(runId).get();
console.log(run.data().stats);
// {
//   fetched: 50,
//   created: 45,
//   updated: 0,
//   skipped: 3,
//   duplicates: 2,
//   errors: 0,
//   autoApproved: 45
// }
```

## Troubleshooting

### Common Issues

#### 1. API Rate Limits

**Symptoms:**
- Error code: `RATE_LIMIT`
- HTTP 429 responses

**Solution:**
- Reduce `maxItemsPerRun` in profile
- Increase delay between scheduled runs
- Check rate limit config in profile

#### 2. Duplicate Products

**Symptoms:**
- Items skipped with reason "Duplicate"
- High `duplicates` count in stats

**Solution:**
- Deduplication is working correctly
- Review `deduplicationStrategy` in profile
- Check if `originalId` mapping is correct

#### 3. Failed Imports

**Symptoms:**
- Status: `failed` in importRun
- Errors in `errorSummary` array

**Solution:**
```bash
# View error details
firebase firestore:get importRuns/FAILED_RUN_ID

# Check specific item errors
firebase firestore:query importRuns/FAILED_RUN_ID/import_logs \
  --where action==error
```

#### 4. Currency Conversion Issues

**Symptoms:**
- Incorrect prices
- Wrong currency display

**Solution:**
- Check `CURRENCY_RATES` in `aliexpress-importer.ts`
- Verify `target_currency` in API requests
- Update conversion rates if needed

#### 5. Missing Images

**Symptoms:**
- Products without images
- Broken image links

**Solution:**
- Check AliExpress API response structure
- Verify image URL extraction logic
- Enable logging to see raw API response

## Best Practices

### 1. Testing

Always test with `dryRun: true` first:
```typescript
{
  profileId: 'test-profile',
  dryRun: true,  // No actual writes
  maxItems: 10   // Small batch
}
```

### 2. Gradual Rollout

- Start with small `maxItemsPerRun` (10-20)
- Monitor for 24-48 hours
- Gradually increase to 50-100

### 3. Quality Control

- Set appropriate filters:
  - `minRating: 4.0` (minimum product rating)
  - `minOrders: 100` (minimum sales volume)
  - `minDiscount: 10` (minimum discount percentage)

### 4. Category Mapping

- Create separate profiles for each category
- Use specific `targetMainCategory`/`targetSubCategory`
- Avoid mixing unrelated products

### 5. Monitoring

- Check import logs daily
- Review error rates weekly
- Monitor duplicate rates monthly

## Maintenance

### Weekly Tasks

- [ ] Review failed imports
- [ ] Check error rates
- [ ] Verify price accuracy
- [ ] Monitor duplicate detection

### Monthly Tasks

- [ ] Update currency conversion rates
- [ ] Review and adjust filters
- [ ] Optimize category mappings
- [ ] Archive old import logs

### Quarterly Tasks

- [ ] Review API usage and costs
- [ ] Update AliExpress API credentials if needed
- [ ] Audit import quality metrics
- [ ] Optimize deduplication strategy

## API Reference

### POST /api/admin/imports/run

**Request:**
```json
{
  "profileId": "string (required)",
  "searchQuery": "string (optional)",
  "categoryFilter": "string (optional)",
  "minPrice": "number (optional)",
  "maxPrice": "number (optional)",
  "minRating": "number (optional)",
  "minOrders": "number (optional)",
  "minDiscount": "number (optional)",
  "maxItems": "number (optional, default: 50)",
  "dryRun": "boolean (optional, default: false)",
  "autoApprove": "boolean (optional, default: true)",
  "enableAI": "boolean (optional, default: false)"
}
```

**Response:**
```json
{
  "success": true,
  "importRunId": "string",
  "stats": {
    "fetched": 50,
    "created": 45,
    "updated": 0,
    "skipped": 3,
    "duplicates": 2,
    "errors": 0,
    "autoApproved": 45
  },
  "errors": []
}
```

### GET /api/cron/aliexpress-sync

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "synced": 3,
  "total": 3,
  "results": [
    {
      "profileId": "profile-1",
      "name": "Electronics",
      "success": true,
      "stats": { /* ... */ }
    }
  ]
}
```

## Security

### Access Control

- Import endpoints require admin role
- Cron endpoint secured with `CRON_SECRET`
- API credentials stored in Secret Manager
- Never expose credentials in logs

### Data Privacy

- No personal data from AliExpress
- Product data is public information
- Comply with AliExpress Terms of Service
- Respect rate limits

## Support

### Contact

- **Technical Issues**: Development Team
- **API Issues**: AliExpress Support Portal
- **Urgent**: Check #alerts channel in Slack

### Resources

- [AliExpress API Documentation](https://openservice.aliexpress.com/doc/api.htm)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Project Documentation](../README.md)
