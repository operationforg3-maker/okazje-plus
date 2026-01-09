# Troubleshooting: Import Jobs Not Importing Products

## Problem Description

When creating import jobs in the Harvester (`/admin/harvester` → Jobs tab), the jobs are created successfully but **no products are being imported** to the database. Jobs may show as "running" indefinitely or complete with 0 products.

## Root Cause

The most common cause is **missing marketplace API credentials**. The import system requires proper API configuration for the marketplace sources you want to use.

### How to Identify This Issue

1. **UI Symptoms:**
   - Yellow warning banner appears at top of Jobs Monitor: "⚠️ Niektóre źródła nie są skonfigurowane"
   - Sources show yellow warning icon (⚠) instead of green checkmark (✓)
   - Checkboxes for unconfigured sources are disabled
   - Jobs complete with 0 products imported
   - Console logs show errors about missing credentials

2. **Server Logs:**
   ```
   [POST /api/admin/import/queue] ❌ API configuration errors: [source]: MISSING_VAR_1, MISSING_VAR_2
   ```

3. **API Response:**
   - Health check endpoint `/api/admin/marketplaces/health` returns unconfigured sources:
     ```json
     {
       "ok": true,
       "sources": {
         "aliexpress": { "configured": false, "missingVars": ["ALIEXPRESS_API_BASE", "ALIEXPRESS_APP_KEY"] },
         "convertiser": { "configured": true, "missingVars": [] }
       }
     }
     ```

## Solution

### Step 1: Check Which Sources Are Available

The system supports multiple marketplace sources. Check configuration status at:
```bash
curl https://okazjeplus.pl/api/admin/marketplaces/health
```

### Step 2: Obtain Missing API Credentials

Depending on which source you want to use:

#### AliExpress
1. Register for AliExpress Affiliate Program: https://portals.aliexpress.com/
2. Create an app to get your credentials:
   - `ALIEXPRESS_APP_KEY`
   - `ALIEXPRESS_APP_SECRET`
   - `ALIEXPRESS_API_BASE` (usually: https://api-sg.aliexpress.com/sync)

#### Convertiser
1. Login to your Convertiser account: https://convertiser.com/
2. Navigate to API settings
3. Generate API token: `CONVERTISER_API_TOKEN`

#### Allegro
1. Register at: https://developer.allegro.pl
2. Create application
3. Get credentials:
   - `ALLEGRO_APP_KEY`
   - `ALLEGRO_APP_SECRET`

#### Amazon
1. Join Amazon Associates: https://affiliate-program.amazon.com/
2. Get Product Advertising API credentials:
   - `AMAZON_ACCESS_KEY`
   - `AMAZON_SECRET_KEY`
   - `AMAZON_PARTNER_TAG`

#### eBay
1. Register at: https://developer.ebay.com/
2. Create application
3. Get credentials:
   - `EBAY_APP_ID`
   - `EBAY_CERT_ID`

### Step 3: Configure Environment Variables

**All credentials should already be in GCloud Secrets Manager or Firebase Secrets.**

If you need to add/update credentials:

**Via Firebase Console:**
1. Go to Firebase Console → Settings → Secrets
2. Add/update the required secrets

**Via gcloud CLI:**
```bash
gcloud secrets create ALIEXPRESS_APP_KEY --data-file=-
# Enter value and press Ctrl+D

gcloud secrets create CONVERTISER_API_TOKEN --data-file=-
# etc...
```

**For local development only (.env.local):**
```bash
# AliExpress
ALIEXPRESS_API_BASE=https://api-sg.aliexpress.com/sync
ALIEXPRESS_APP_KEY=your_key
ALIEXPRESS_APP_SECRET=your_secret

# Convertiser
CONVERTISER_API_TOKEN=your_token

# Allegro
ALLEGRO_APP_KEY=your_key
ALLEGRO_APP_SECRET=your_secret

# Amazon
AMAZON_ACCESS_KEY=your_key
AMAZON_SECRET_KEY=your_secret
AMAZON_PARTNER_TAG=your_tag

# eBay
EBAY_APP_ID=your_app_id
EBAY_CERT_ID=your_cert_id
```

### Step 3: Restart the Application

For changes to take effect:

**Local Development:**
```bash
npm run dev
```

**Production (Firebase App Hosting):**
1. Add secrets via Firebase Console or CLI
2. Redeploy the application

### Step 4: Verify Configuration

1. Visit `/admin/harvester` page
2. Go to "Zadania" (Jobs) tab
3. Check source status:
   - ✓ Green checkmark = Configured
   - ⚠ Yellow warning = NOT configured
4. Warning banner should NOT appear for configured sources
5. Alternatively, check the unified health endpoint:
   ```bash
   curl https://okazjeplus.pl/api/admin/marketplaces/health
   ```

## Additional Validation

The system now includes **pre-flight validation for all marketplace sources**:

- ✅ API credentials are checked **before** creating the job for each selected source
- ✅ Clear error message returned with specific missing variables per source
- ✅ Jobs fail immediately with descriptive errors instead of hanging
- ✅ Warning banner appears in UI showing which sources need configuration
- ✅ Visual indicators (✓/⚠) show status for each source

## Other Potential Issues

### 1. Invalid Credentials
**Symptoms:** Jobs fail with authentication errors
**Solution:** Double-check your APP_KEY and APP_SECRET are correct

### 2. API Rate Limiting
**Symptoms:** Some batches succeed, others fail with 429 errors
**Solution:** Reduce `maxProductsPerCategory` or add delays between requests

### 3. Network Issues
**Symptoms:** Intermittent failures, timeout errors
**Solution:** Check server network connectivity to `api-sg.aliexpress.com`

### 4. Firestore Permissions
**Symptoms:** Products fetch successfully but fail to save
**Solution:** Check Firestore security rules allow admin writes to `products` collection

## Testing Without AliExpress API

If you want to test the system without configuring AliExpress:

1. Use other import sources that don't require API keys (if available)
2. Or manually add test products via Firebase Console
3. Or use the CSV import feature in the Harvester

## Need Help?

If you've configured the API correctly and still face issues:

1. Check server logs for detailed error messages
2. Verify all three environment variables are set (API_BASE, APP_KEY, APP_SECRET)
3. Test the health endpoint to confirm configuration is loaded
4. Ensure you're using valid AliExpress affiliate API credentials (not regular AliExpress account)

## Related Documentation

- [AliExpress Integration Guide](../integration/aliexpress.md)
- [Admin Panel Guide](../guides/PRZEWODNIK_ADMINA.md)
- README.md - Environment Variables section
