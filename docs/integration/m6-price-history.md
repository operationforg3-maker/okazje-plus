# M6 Price History Engine & Dynamic Alert System

## Overview

This document describes the configuration and setup for the M6 Price History Engine and Dynamic Alert System. These features enable automated price tracking, alert notifications, and historical price analysis.

## Architecture

### Components

1. **Price History Engine** (`src/integrations/priceHistory/`)
   - `snapshotEngine.ts`: Core logic for capturing price snapshots
   - `scheduler.ts`: Wrapper for scheduled snapshot operations

2. **Alert System** (`src/integrations/alerts/`)
   - `alertsService.ts`: Alert management and condition checking
   - `notificationChannels.ts`: Multi-channel notification delivery

3. **Data Models** (`src/lib/models/`)
   - `priceHistory.ts`: PriceSnapshot, PriceHistoryRecord
   - `alerts.ts`: UserAlert, AlertProfile, NotificationRecord

4. **Firebase Function**
   - `okazje-plus/src/index.ts`: `scheduledPriceHistorySync` - Scheduled function for automated price capture

5. **API Routes**
   - `POST /api/alerts/subscribe`: User alert subscription endpoint

6. **Admin UI**
   - `/admin/alerts`: Alert management dashboard
   - `/admin/price-history`: Price history visualization

## Environment Variables

### Required Variables

```bash
# Feature Flags
NEXT_PUBLIC_PRICE_MONITORING_ENABLED=false    # Enable price monitoring feature
NEXT_PUBLIC_PRICE_ALERTS_ENABLED=false        # Enable price alerts feature
NEXT_PUBLIC_PRICE_HISTORY_UI_ENABLED=false    # Show price history in UI

# Price Monitoring Configuration
PRICE_MONITORING_ENABLED=false                 # Server-side feature flag
PRICE_MONITORING_DRY_RUN=true                  # Dry-run mode (no DB writes)
PRICE_MONITORING_INTERVAL_HOURS=24             # How often to capture snapshots
NEXT_PUBLIC_MANUAL_PRICE_SNAPSHOT_ENABLED=false  # Allow manual admin triggers

# Notification Channels
NOTIFICATION_EMAIL_ENABLED=false               # Enable email notifications
NOTIFICATION_WEB_PUSH_ENABLED=false            # Enable web push notifications
NOTIFICATION_IN_APP_ENABLED=true               # Enable in-app notifications (default)
```

### Optional Variables (M7+)

```bash
# Email Provider (SendGrid example)
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your_sendgrid_api_key
EMAIL_FROM_ADDRESS=alerts@okazjeplus.pl
EMAIL_FROM_NAME=Okazje Plus
EMAIL_TEMPLATE_PRICE_DROP=d-xxxxxxxxxxxxx
EMAIL_TEMPLATE_BACK_IN_STOCK=d-xxxxxxxxxxxxx

# Web Push (VAPID keys)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:alerts@okazjeplus.pl

# AWS SES (Alternative to SendGrid)
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=eu-west-1
```

## Firebase Configuration

### Firestore Collections

The M6 feature uses the following Firestore collections:

1. **`priceSnapshots`** - Individual price captures
   ```
   {
     productId: string,
     price: number,
     currency: string,
     originalPrice?: number,
     capturedAt: string (ISO),
     source: string,
     inStock: boolean,
     ...
   }
   ```

2. **`priceHistory`** - Aggregated price stats per product
   ```
   {
     productId: string,
     currentPrice: number,
     lowestPrice: number,
     highestPrice: number,
     averagePrice: number,
     snapshotCount: number,
     ...
   }
   ```

3. **`userAlerts`** - User alert subscriptions
   ```
   {
     userId: string,
     productId: string,
     alertProfile: {
       targetPrice: number,
       condition: 'below' | 'above' | 'drops_by_percent' | 'any_change',
       active: boolean,
       ...
     },
     channels: ['email', 'web_push', 'in_app'],
     ...
   }
   ```

4. **`notificationRecords`** - Notification delivery logs
   ```
   {
     userId: string,
     alertId: string,
     productId: string,
     type: 'price_drop' | 'price_target_met' | 'back_in_stock',
     channel: 'email' | 'web_push' | 'in_app',
     delivered: boolean,
     createdAt: string (ISO),
     ...
   }
   ```

5. **`priceHistoryRuns`** - Scheduled function execution logs
   ```
   {
     status: 'running' | 'completed' | 'failed',
     dryRun: boolean,
     stats: { productsProcessed, snapshotsCreated, errors, ... },
     startedAt: string (ISO),
     finishedAt: string (ISO),
     ...
   }
   ```

### Firestore Security Rules

Add these rules to `firestore.rules`:

```
// Price Snapshots (read-only for authenticated users, write for server)
match /priceSnapshots/{snapshotId} {
  allow read: if request.auth != null;
  allow write: if false; // Only server can write
}

// Price History (read for authenticated users)
match /priceHistory/{productId} {
  allow read: if request.auth != null;
  allow write: if false; // Only server can write
}

// User Alerts (users can manage their own)
match /userAlerts/{alertId} {
  allow read: if request.auth != null && resource.data.userId == request.auth.uid;
  allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
  allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
}

// Notification Records (users can read their own)
match /notificationRecords/{notificationId} {
  allow read: if request.auth != null && resource.data.userId == request.auth.uid;
  allow write: if false; // Only server can write
}

// Price History Runs (admins only)
match /priceHistoryRuns/{runId} {
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  allow write: if false; // Only server can write
}
```

### Firestore Indexes

Add these indexes to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "priceSnapshots",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productId", "order": "ASCENDING" },
        { "fieldPath": "capturedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "userAlerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "alertProfile.active", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "userAlerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productId", "order": "ASCENDING" },
        { "fieldPath": "alertProfile.active", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notificationRecords",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Deployment

### 1. Initial Setup (Bootstrap Phase)

```bash
# Install dependencies (if not already done)
npm install

# Set environment variables in .env.local
cp .env.example .env.local
# Edit .env.local and set M6 variables

# Test that everything compiles
npm run typecheck
npm run build
```

### 2. Enable Feature Flags (Gradual Rollout)

Start with **dry-run mode** to test without affecting production data:

```bash
# Enable in dry-run mode first
PRICE_MONITORING_ENABLED=true
PRICE_MONITORING_DRY_RUN=true
NEXT_PUBLIC_PRICE_MONITORING_ENABLED=false  # Keep UI hidden initially
```

### 3. Deploy Firebase Function

```bash
# Deploy only the price history function
cd okazje-plus
npm install
firebase deploy --only functions:scheduledPriceHistorySync
```

The function will run on the configured schedule (default: daily at 3 AM Europe/Warsaw time).

### 4. Test in Dry-Run Mode

Monitor the function logs in Firebase Console:

```bash
# View logs
firebase functions:log --only scheduledPriceHistorySync
```

Check `priceHistoryRuns` collection in Firestore to see run statistics.

### 5. Enable Production Mode

Once confident the system works correctly:

```bash
# Disable dry-run mode
PRICE_MONITORING_DRY_RUN=false

# Enable UI for users
NEXT_PUBLIC_PRICE_MONITORING_ENABLED=true
NEXT_PUBLIC_PRICE_HISTORY_UI_ENABLED=true
```

### 6. Enable Alerts (Optional)

```bash
# Enable alerts feature
NEXT_PUBLIC_PRICE_ALERTS_ENABLED=true
NOTIFICATION_IN_APP_ENABLED=true

# Configure email/push later in M7
```

## Usage

### Admin Usage

1. **Monitor Price History**
   - Navigate to `/admin/price-history`
   - View statistics and recent snapshots
   - (M7) Trigger manual snapshots for specific products

2. **Manage Alerts**
   - Navigate to `/admin/alerts`
   - View active user alerts
   - (M7) View notification delivery stats

### User Usage (M7+)

Users can subscribe to price alerts via:
- Product detail pages (button to "Set Price Alert")
- Profile settings (manage all alerts)
- API: `POST /api/alerts/subscribe`

## API Examples

### Subscribe to Price Alert

```bash
POST /api/alerts/subscribe
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "productId": "prod_123",
  "targetPrice": 99.99,
  "condition": "below",
  "channels": ["email", "in_app"]
}
```

Response:
```json
{
  "success": true,
  "alertId": "alert_456",
  "message": "Alert created successfully"
}
```

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Snapshot Success Rate**
   - Check `priceHistoryRuns` collection for failed runs
   - Monitor error counts in run stats

2. **Alert Trigger Rate**
   - How many alerts are being triggered daily
   - Notification delivery success rate

3. **Function Execution Time**
   - Monitor Cloud Functions dashboard
   - Optimize if approaching timeout limits

### Troubleshooting

**Problem: Function times out**
- Solution: Reduce batch size, process products in smaller chunks
- Consider increasing timeout or memory allocation

**Problem: Too many snapshots being created**
- Solution: Adjust price change threshold in snapshotEngine.ts
- Skip snapshots if price change is less than 0.1%

**Problem: Notifications not being sent**
- Solution: Check notification channel configuration
- Verify email/web push provider credentials
- Check user's email confirmation status

## Next Steps (M7/M8)

1. **M7 - Full Implementation**
   - Connect to real price sources (AliExpress API, web scraping)
   - Implement actual email/push notification sending
   - Add charts and visualization in admin UI
   - Build user-facing alert management UI

2. **M8 - Advanced Features**
   - AI-powered price prediction
   - Anomaly detection for price spikes
   - Multi-marketplace price comparison
   - Automated alert optimization

## Support

For questions or issues:
- Check implementation TODOs in source files
- Review Firebase Function logs
- Contact dev team for configuration help

## References

- [Firebase Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [SendGrid API](https://docs.sendgrid.com/)
