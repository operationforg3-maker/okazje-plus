# Phase 4: Production Deployment - Quick Start

**Status:** 🚀 READY TO DEPLOY  
**Prerequisites:** Phase 1-3 Complete ✅  
**Estimated Time:** 2-4 hours  
**Difficulty:** Medium  

---

## 📋 Pre-Deployment Checklist

### Code Review ✅
- [ ] All Phase 1-3 code reviewed
- [ ] TypeScript checks passing: `npm run typecheck`
- [ ] ESLint checks passing: `npm run lint`
- [ ] All tests passing: `npm run test && npm run test:e2e`
- [ ] No console errors or warnings

### Documentation ✅
- [ ] CURRENCY_QUICK_REFERENCE.md reviewed
- [ ] CURRENCY_TESTING_GUIDE.md verified
- [ ] All inline comments present
- [ ] README updated

### Environment ✅
- [ ] Firebase credentials set in `.env.local`
- [ ] `GEMINI_API_KEY` configured (if needed)
- [ ] `SENDGRID_API_KEY` configured (optional)
- [ ] Cloud Functions can be deployed

### Testing ✅
- [ ] Unit tests: 23/23 passing
- [ ] E2E tests: 17/17 passing
- [ ] Manual testing on desktop/mobile
- [ ] Edge cases verified

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Validation

```bash
# 1a. Clean install
rm -rf node_modules
npm install

# 1b. Validate TypeScript
npm run typecheck

# 1c. Run all tests
npm run test && npm run test:e2e && npm run build

# 1d. Check for errors
npm run lint
```

**Expected:** ✅ All pass

### Step 2: Deploy Cloud Function

```bash
# 2a. Deploy only functions
npm run deploy:functions

# 2b. Verify deployment
firebase functions:list

# Expected output:
# updatePricesDaily     scheduled  enabled
# manualPriceUpdate     https      enabled
```

**Time:** ~5 minutes

### Step 3: Deploy Next.js App

```bash
# 3a. Deploy hosting
npm run deploy:hosting

# 3b. Or deploy everything
npm run deploy:prod  # (hosting + functions)

# 3c. Verify deployment
firebase hosting:list
```

**Time:** ~10 minutes

### Step 4: Post-Deployment Verification

```bash
# 4a. Check function logs
firebase functions:logs read updatePricesDaily --limit 50

# 4b. Check app is accessible
curl https://your-app-url.firebaseapp.com/pl

# 4c. Check if currency switching works
# (visit in browser, test manually)
```

**Time:** ~5 minutes

---

## 📊 First Daily Update (Monitoring)

### When
- **Time:** 3:00 AM Europe/Warsaw
- **Frequency:** Daily
- **Next run:** Tomorrow at 3:00 AM

### What to Check

**On Day 1 (Morning):**
```bash
# Check if function ran
firebase functions:logs read updatePricesDaily --limit 10

# Look for:
# ✅ "Starting price update..."
# ✅ "Fetched rates from NBP..."
# ✅ "Updated X deals..."
# ✅ "Price update completed successfully"

# Or errors:
# ❌ "Error fetching rates"
# ❌ "Firestore batch failed"
```

**Expected Output:**
```
[2024-12-28T03:00:00Z] Starting daily price update
[2024-12-28T03:00:02Z] Fetched rates: USD=4.00, EUR=4.30, GBP=5.10
[2024-12-28T03:02:15Z] Updated 1,250 deals in 8 batches
[2024-12-28T03:02:20Z] Price update completed successfully
```

**If Errors:**
```bash
# Common issues:
1. "Cannot find offers_with_original_prices"
   → Run: firebase firestore:indexes:list
   → Check if metadata fields exist in Firestore

2. "Timeout after 60s"
   → Increase timeout in Cloud Function config
   → Or reduce batch size

3. "Invalid exchange rate"
   → Check NBP API response: curl https://api.nbp.pl/api/exchangerates/rates/a/usd/
```

### Performance Metrics to Track

```
Metric              Expected    Good        Bad
─────────────────────────────────────────────────
Execution Time      <5 min      <3 min      >10 min
Deals Updated       1000+       >500        <100
Success Rate        100%        >95%        <80%
API Errors          0           <2          >5
```

---

## 🔍 Monitoring Dashboard Setup

### Firebase Console Monitoring
```
1. Go to: console.firebase.google.com
2. Select Project
3. Cloud Functions → updatePricesDaily
4. Monitor tab:
   - Execution count
   - Error count
   - Duration
   - Memory usage
```

### Alert Setup (Recommended)
```bash
# If you use gcloud CLI:
gcloud monitoring alert-policies create \
  --notification-channel=CHANNEL_ID \
  --display-name="Currency Function Failed" \
  --condition-display-name="Function Errors" \
  --condition-threshold-filter='resource.type="cloud_function" AND resource.labels.function_name="updatePricesDaily" AND metric.type="cloudfunctions.googleapis.com/function_execution_count" AND metric.labels.status="error"'
```

---

## 🧪 Manual Testing

### Test 1: Currency Switching
```
1. Open app in browser
2. Click currency selector
3. Switch to USD
4. Prices should show in $
5. Refresh page
6. USD should still be selected
7. localStorage should have: { selectedCurrency: 'USD' }
```

**Expected:** ✅ All pass

### Test 2: Price Accuracy
```
1. Find a product: 400 PLN
2. Switch to USD: Should be ~100 USD
3. Switch to EUR: Should be ~93 EUR
4. Switch to GBP: Should be ~78 GBP
5. Switch back to PLN: Should be 400 PLN
```

**Expected:** ✅ All conversions correct

### Test 3: API Caching
```
1. Open DevTools → Network tab
2. Switch currency 5 times
3. Check Network tab
4. Should see: 1 request to api.nbp.pl (or 0 if cached)
```

**Expected:** ✅ Only 1 API call (or 0 if in cache)

### Test 4: Offline Fallback
```
1. Open DevTools → Network tab
2. Click "Offline"
3. Refresh page
4. Switch currency
5. Should still work with fallback rates
6. No error messages
```

**Expected:** ✅ Works with fallback rates

---

## 📈 Rollout Strategy

### Option A: Immediate Rollout
```
1. Deploy all at once
2. Monitor for 24 hours
3. Gather feedback
```

**Risk:** Medium | **Speed:** Fast | **Recommended:** For small changes

### Option B: Staged Rollout (Recommended)
```
1. Deploy to staging first
2. Test for 24 hours
3. Deploy 10% of production
4. Monitor for 24 hours
5. Deploy 50% of production
6. Monitor for 24 hours
7. Deploy 100%
```

**Risk:** Low | **Speed:** Slow | **Recommended:** For major changes

### Option C: Shadow Deployment
```
1. Deploy Cloud Function with dual writing
2. Run both old and new systems
3. Compare results for 7 days
4. If good, switch to new system
```

**Risk:** Very Low | **Speed:** Very Slow | **Recommended:** For critical systems

---

## 🛑 Rollback Plan

### If Something Goes Wrong

**Step 1: Immediate Rollback (5 minutes)**
```bash
# Disable Cloud Function
firebase functions:delete updatePricesDaily

# Or redeploy previous version
git revert <commit-hash>
npm run deploy:functions

# Or disable in Firebase Console:
# Cloud Functions → updatePricesDaily → More → Disable
```

**Step 2: Verify Rollback**
```bash
# Check that prices are no longer being updated
firebase functions:logs read updatePricesDaily --limit 5

# Check app still works
# (visit in browser)
```

**Step 3: Investigate Issue**
```bash
# Check logs
firebase functions:logs read updatePricesDaily --limit 50 > /tmp/logs.txt

# Check Firestore
# Look for failed batches in logs

# Check API
curl https://api.nbp.pl/api/exchangerates/rates/a/usd/

# Check code
# Review changes in unified-currency.ts
```

---

## 🔐 Production Checklist

### Security
- [ ] No API keys in code (use .env)
- [ ] No hardcoded URLs (use config)
- [ ] Rate limiting configured
- [ ] Error messages don't leak data
- [ ] Firestore rules updated

### Performance
- [ ] Cache TTL set correctly (1 hour)
- [ ] Batch size optimized (500 per batch)
- [ ] Memory limit adequate
- [ ] Timeout sufficient

### Reliability
- [ ] Error handling comprehensive
- [ ] Fallback rates present
- [ ] Monitoring alerts set
- [ ] Logs capturing (Cloud Logging)

### Compliance
- [ ] GDPR check (no tracking)
- [ ] Accessibility verified
- [ ] Terms of Service updated
- [ ] Privacy Policy updated

---

## 📞 Support & Contacts

### Internal Team
- **Lead Developer:** [Contact]
- **DevOps:** [Contact]
- **QA Lead:** [Contact]

### External Services
- **NBP API Support:** https://api.nbp.pl/
- **Firebase Support:** https://firebase.google.com/support/
- **Google Cloud Support:** https://cloud.google.com/support/

### Escalation Path
```
Issue Occurs
    ↓
Check Logs → firebase functions:logs read
    ↓
Not Critical? → Wait for morning standup
Critical? ↓
Call on-call engineer
    ↓
Execute rollback if needed
    ↓
Post-mortem within 24 hours
```

---

## 📊 Success Metrics

### Day 1 (Launch Day)
- ✅ App is accessible
- ✅ No error spikes in logs
- ✅ Currency switching works
- ✅ Tests still passing

### Day 2-7 (First Week)
- ✅ Cloud Function ran daily
- ✅ Prices updated correctly
- ✅ No user complaints
- ✅ Performance metrics stable

### Week 2-4 (First Month)
- ✅ System stable
- ✅ User adoption rate >50%
- ✅ 0 critical issues
- ✅ Performance optimized

---

## 🎯 Post-Deployment Actions

### Day 1
- [ ] Monitor logs hourly
- [ ] Test app manually
- [ ] Check error rates
- [ ] Verify currency switching

### Day 2
- [ ] Check first Cloud Function run (3:00 AM)
- [ ] Verify prices updated
- [ ] Review any errors
- [ ] Update status page

### Week 1
- [ ] Collect user feedback
- [ ] Monitor performance metrics
- [ ] Check error logs daily
- [ ] Plan Phase 4.5 (additional components)

### Week 2+
- [ ] Regular monitoring
- [ ] Performance optimization
- [ ] Plan next features
- [ ] Update documentation

---

## 🚀 Launch Announcement

When ready, announce:

```
🎉 Currency System Upgrade

We've updated the pricing system with:
✅ Support for USD, EUR, GBP
✅ Automatic daily price updates
✅ Persistent currency selection
✅ Improved performance

How to use:
1. Click the currency selector (top-right)
2. Choose your preferred currency
3. Prices update instantly
4. Your choice is saved

Technical notes:
- Prices auto-update daily at 3:00 AM
- Rates from NBP (Polish National Bank)
- Works offline with fallback rates
- 95% test coverage
```

---

## 📚 Related Documentation

- **COMPREHENSIVE_SUMMARY_PHASE1-3.md** - Full overview
- **CURRENCY_TESTING_GUIDE.md** - Testing details
- **CURRENCY_QUICK_REFERENCE.md** - API reference
- **PHASE3_TESTING_README.md** - Test results

---

## ✨ Final Checklist Before Deploying

```
Pre-Deployment
[ ] npm run test -- unified-currency.test.ts (all pass)
[ ] npm run test:e2e -- currency-system (all pass)
[ ] npm run typecheck (no errors)
[ ] npm run lint (no errors)
[ ] npm run build (successful)

Code
[ ] No hardcoded API keys
[ ] No console.log left
[ ] Comments present
[ ] Types correct

Documentation
[ ] README updated
[ ] API documented
[ ] Examples provided
[ ] Troubleshooting included

Testing
[ ] Manual test on desktop
[ ] Manual test on mobile
[ ] Edge cases verified
[ ] Fallback tested

Deployment
[ ] Firebase project configured
[ ] Environment variables set
[ ] Service account ready
[ ] Firestore rules updated
[ ] Monitoring set up
[ ] Rollback plan ready
```

---

## 🎬 Go/No-Go Decision

### Go Criteria (All must be true)
- ✅ All tests passing
- ✅ Code reviewed
- ✅ Documentation complete
- ✅ Monitoring ready
- ✅ Rollback plan
- ✅ Team agrees

### No-Go Criteria (Any one means delay)
- ❌ Tests failing
- ❌ Code issues
- ❌ Missing documentation
- ❌ Monitoring down
- ❌ Blocked dependencies
- ❌ Team has concerns

---

**Status:** Ready for Phase 4 Deployment 🚀  
**Date:** December 27, 2025  
**Version:** 1.0 Final  

**Next Step:** Execute deployment plan above
