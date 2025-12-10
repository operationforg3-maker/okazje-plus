# Troubleshooting: Import Jobs Not Importing Products

## Problem Description

When creating import jobs in the Harvester (`/admin/harvester` → Jobs tab), the jobs are created successfully but **no products are being imported** to the database. Jobs may show as "running" indefinitely or complete with 0 products.

## Root Cause

The most common cause is **missing AliExpress API credentials**. The import system requires proper API configuration to fetch products from AliExpress.

### How to Identify This Issue

1. **UI Symptoms:**
   - Yellow warning banner appears at top of Jobs Monitor: "⚠️ AliExpress API nie jest skonfigurowane"
   - Job creation button is disabled when AliExpress source is selected
   - Jobs complete with 0 products imported
   - Console logs show errors about missing credentials

2. **Server Logs:**
   ```
   [Importer:Fetch] ❌ CRITICAL: AliExpress API not configured!
   [Importer:Fetch] Missing env vars: ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_API_BASE
   ```

3. **API Response:**
   - Health check endpoint `/api/admin/aliexpress/health` returns:
     ```json
     {
       "ok": false,
       "configured": false,
       "issues": ["Brak ALIEXPRESS_API_BASE", "Brak APP_KEY/APP_SECRET"]
     }
     ```

## Solution

### Step 1: Obtain AliExpress API Credentials

1. Register for AliExpress Affiliate Program: https://portals.aliexpress.com/
2. Create an app to get your credentials:
   - `APP_KEY` (also called App Key or API Key)
   - `APP_SECRET` (also called App Secret or API Secret)
3. Optionally get your `AFFILIATE_ID` (Tracking ID) for commission tracking

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file (for local development) or configure them in your hosting environment:

```bash
# Required for AliExpress import
ALIEXPRESS_API_BASE=https://api-sg.aliexpress.com/sync
ALIEXPRESS_APP_KEY=your_app_key_here
ALIEXPRESS_APP_SECRET=your_app_secret_here

# Optional - for affiliate tracking
ALIEXPRESS_AFFILIATE_ID=your_tracking_id_here
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
3. Look for the yellow warning banner - it should NOT appear if configured correctly
4. Alternatively, check the health endpoint:
   ```bash
   curl https://your-app-url/api/admin/aliexpress/health
   ```

## Additional Validation

The system now includes **pre-flight validation** that prevents job creation if credentials are missing:

- ✅ API credentials are checked **before** creating the job
- ✅ Clear error message is returned: "Cannot create import job: AliExpress API credentials are missing"
- ✅ Jobs fail immediately with descriptive errors instead of hanging
- ✅ Warning banner appears in UI when API is not configured

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
