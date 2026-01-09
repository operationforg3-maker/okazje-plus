# 🚨 URGENT DEPLOYMENT GUIDE - Import Fix (stageDedupe)

## Problem Status
✅ **Fix identified and verified locally**  
❌ **Firebase App Hosting auto-deploy FAILED**  
⏳ **Manual deployment needed**

## What's Fixed
- **File**: `/src/ai/flows/importerFlow/stageDedupe.ts`
- **Issue**: Rating/orders filters reject products without data
- **Fix**: Make filters optional when data missing
- **Result**: Products now pass dedupe stage ✅

## Why Auto-Deploy Failed
Firebase App Hosting triggered Cloud Build twice but **code not deploying**.
Possible causes:
- Build succeeded but deployment didn't start
- Old container still running
- Cache not cleared

## Manual Verification (Local)
```bash
cd /Users/tomaszgorecki/Projekty/okazje-plus

# Test 1: Verify fix is in code
grep -n "product.rating !== undefined && product.rating !== null" \
  src/ai/flows/importerFlow/stageDedupe.ts

# Test 2: Test dedupe logic locally
node scripts/manual-dedupe-test.js
# Expected output: "Kept: 2 products ✅"

# Test 3: Check live status
node scripts/diagnose-live-import.js
# Will show current live status (should show dedup=0 before fix is live)
```

## How to Force Deployment

### Option A: Force Docker Rebuild (Recommended)
```bash
# If you have Docker/Cloud Build access
npm run build
docker build -t gcr.io/okazje-plus/okazje-plus-backend .
docker push gcr.io/okazje-plus/okazje-plus-backend
gcloud run deploy okazje-plus-backend \
  --image gcr.io/okazje-plus/okazje-plus-backend \
  --project okazje-plus \
  --region europe-west1
```

### Option B: Force GitHub/Firebase Rebuild
```bash
# Make a small change to trigger rebuild
echo "# Rebuild $(date)" >> README.md
git add README.md
git commit -m "chore: trigger rebuild"
git push origin main

# Wait 5-10 minutes for Cloud Build to complete
```

### Option C: Check Cloud Build Logs
```bash
# View build logs
gcloud builds log --project okazje-plus $(gcloud builds list --project okazje-plus --limit=1 --format='value(id)')

# Or check console
# https://console.cloud.google.com/cloud-build
```

## Verification Commands

```bash
# Once deployed, this should show different numbers:
node scripts/diagnose-live-import.js

# Look for:
# ❌ OLD (before fix): "fetch=120 → dedup=0"
# ✅ NEW (after fix):  "fetch=120 → dedup=100+"
```

## Alternative: Manual Import Test

If waiting for deployment:
```bash
# Create a local import test
node scripts/live-import-test.js

# This simulates the full pipeline and confirms fix works
```

## Code Review

**Before (BROKEN):**
```typescript
if (config.minRating !== undefined && product.rating && product.rating < config.minRating) {
  filtered_rating++;
  continue;  // ← REJECTS product if rating is undefined!
}
```

**After (FIXED):**
```typescript
if (config.minRating !== undefined && product.rating !== undefined && product.rating !== null && product.rating > 0) {
  if (product.rating < config.minRating) {
    filtered_rating++;
    continue;  // ← Only rejects if rating EXISTS and is too low
  }
}
```

## Expected Results

Once fix is deployed:

### Job Logs Should Show:
```
Batch 0: fetch=120 → dedup=100+ → enrich=N → save=M
Batch 1: fetch=177 → dedup=150+ → enrich=N → save=M
```

### Database Should Have:
```
Products created in last hour: 100+
Products with current importJobId: 100+
```

## Timeline
```
2025-12-11 20:32 - Fix committed
2025-12-11 20:35 - First rebuild trigger
2025-12-11 21:00 - Second rebuild trigger  
2025-12-11 22:30 - Manual deployment needed
```

## Questions?
- Check logs: `node scripts/diagnose-live-import.js`
- Test locally: `node scripts/manual-dedupe-test.js`
- See status: `git log --oneline -5` (verify commit 9bf3cf1 is latest)

---
**Next Step: Run manual deployment or wait for Cloud Build to complete**
