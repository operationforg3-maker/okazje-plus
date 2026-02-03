# ✅ Convertiser Production Deployment Checklist

**Date**: 2026-02-02 | **Status**: READY FOR DEPLOYMENT

---

## Pre-Deployment Verification

### Code Quality ✅
- [x] `npm run build` passes
- [x] `npm run typecheck` passes (0 errors)
- [x] `npm run lint` passes
- [x] No console errors in browser DevTools
- [x] All git changes committed (commits 739f6da, 2415e18)
- [x] No uncommitted changes: `git status` clean

### Configuration ✅
- [x] CONVERTISER_API_TOKEN in gcloud secrets
- [x] apphosting.yaml has RUNTIME availability
- [x] Firestore rules deployed (firestore.rules)
- [x] No missing environment variables
- [x] Firebase project ID: okazje-plus

### Database ✅
- [x] moderationQueue collection exists
- [x] Security rules apply (allow create, read admin, update admin)
- [x] No data migration needed
- [x] Existing 567 deals unaffected
- [x] ProductCores intact (181 total)

### Tests ✅
- [x] Pipeline status verified
- [x] Collection structure validated
- [x] Security rules syntax correct
- [x] No schema breaking changes

---

## Deployment Steps

### Step 1: Final Verification
```bash
# Last check before deploy
npm run build           # ✅ Build passes
npm run typecheck       # ✅ No TypeScript errors
npm run lint            # ✅ Lint passes
git log --oneline -2   # ✅ Shows commits 739f6da, 2415e18
```

### Step 2: Deploy to Production
**Option A: Full Deploy (Recommended)**
```bash
npm run deploy:prod
```
This deploys:
- Next.js to App Hosting
- Cloud Functions (if modified)
- Firestore rules

**Option B: Hosting Only**
```bash
firebase deploy --only hosting
```

**Option C: Manual via Firebase CLI**
```bash
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

### Step 3: Verify Deployment
```bash
# Check deployment status
firebase deploy:list

# View logs
firebase functions:log --limit 50

# Check Firestore rules
firebase firestore:indexes:list
```

### Step 4: Production Testing

**Option 1: Admin UI**
1. Go to `https://okazjeplus.pl/admin/catalog`
2. Click "Uruchom Harvester"
3. Select source: **Convertiser**
4. Enter query: `phone`
5. Set maxResults: **5**
6. Click "Start"
7. Monitor progress

**Option 2: Via API (requires auth token)**
```bash
curl -X POST https://okazjeplus.pl/api/admin/harvester/start \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "convertiser",
    "query": "phone",
    "maxResults": 5
  }'
```

**Option 3: Monitor via Functions**
```bash
firebase functions:log --follow
```

---

## Post-Deployment Validation

### Step 1: Check Harvester Job
- [ ] Job created successfully
- [ ] Status shows "running" or "completed"
- [ ] No error logs
- [ ] Job took ~30-60 seconds

### Step 2: Verify Deals Created
```javascript
// In Firebase console or via script
db.collection('deals')
  .where('status', '==', 'draft')
  .limit(10)
  .get()
  .then(snapshot => {
    console.log(`Draft deals: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
      console.log(`- ${doc.data().title} (${doc.id})`);
    });
  });
```

Expected: 5 new deals with `status='draft'`

### Step 3: Verify moderationQueue Registration
```javascript
// In Firebase console or via script
db.collection('moderationQueue')
  .where('source', '==', 'harvester')
  .limit(10)
  .get()
  .then(snapshot => {
    console.log(`Queue items: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Deal ${data.dealId} (${data.priority})`);
    });
  });
```

Expected: 5 new moderationQueue items with HIGH priority

### Step 4: Admin Panel Verification
1. Go to `/admin/moderation`
2. Look for "Convertiser" deals
3. Click approve on one deal
4. Verify status changed to "approved"
5. Check if deal appears in live catalog (`/deals?status=approved`)

### Step 5: Deal-Refiner Enrichment
- [ ] Deal-Refiner runs automatically on approved deals
- [ ] Descriptions populated
- [ ] Images downloaded
- [ ] Product specs extracted
- [ ] Quality score calculated

---

## Rollback Plan

If issues occur, rollback is simple (no data migration):

### Option 1: Revert Code
```bash
git revert 739f6da 2415e18
npm run build
npm run deploy:prod
```

### Option 2: Disable Harvester Temporarily
```bash
# Set Convertiser source to "disabled" in admin UI
# Or remove Convertiser from available sources
```

### Option 3: Manual Database Cleanup
```javascript
// Delete test deals if needed
db.collection('deals').where('source', '==', 'convertiser').get()
  .then(snapshot => {
    snapshot.docs.forEach(doc => {
      db.collection('deals').doc(doc.id).delete();
      db.collection('moderationQueue').where('dealId', '==', doc.id).get()
        .then(mq => mq.docs.forEach(m => m.ref.delete()));
    });
  });
```

---

## Monitoring

### Real-Time Logs
```bash
# Follow harvester execution
firebase functions:log --follow
```

### Key Metrics
- [ ] Harvester completion time (target: <60s for 5 items)
- [ ] moderationQueue growth
- [ ] Deal creation success rate
- [ ] Error count

### Alerts to Watch
- ⚠️ "CONVERTISER_API_TOKEN not found" → Token not in env
- ⚠️ "Missing 'create' rule" → Firestore rules not deployed
- ⚠️ "0 deals created" → API connectivity issue
- ⚠️ "moderationQueue registration failed" → Firestore error

---

## Success Criteria

**Deployment is successful if:**
1. ✅ No build errors
2. ✅ Harvester finds Convertiser products
3. ✅ Deals created with `status='draft'`
4. ✅ Deals registered in moderationQueue
5. ✅ Admin can see deals in moderation panel
6. ✅ Admin can approve deals
7. ✅ Approved deals appear in live catalog
8. ✅ Deal-Refiner enriches approved deals

---

## Support

If deployment fails:

1. **Check logs**: `firebase functions:log --limit 100`
2. **Verify token**: `gcloud secrets list | grep CONVERTISER`
3. **Check rules**: `firebase firestore:indexes:list`
4. **Test locally**: `npm run dev` + export CONVERTISER_API_TOKEN
5. **Contact**: See TROUBLESHOOTING.md

---

## Notes

- No database migration needed
- No downtime expected
- Backward compatible with existing deals
- Can be deployed during business hours
- Rollback takes <5 minutes if needed

---

**Deployment authorized by**: [Your name]  
**Date deployed**: _____________  
**Deployment duration**: _____________  
**Issues encountered**: _____________  
**Deployment status**: [ ] Success [ ] Partial [ ] Rollback

