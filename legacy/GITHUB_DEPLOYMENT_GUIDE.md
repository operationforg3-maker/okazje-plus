# 🚀 Production Deployment Guide (GitHub Actions)

**Status:** Currency System Phase 1-3 Ready for Production  
**Date:** December 28, 2025  
**Environment:** Firebase App Hosting (europe-west1)  

---

## 📋 Pre-Deployment Checklist

### Code Status
- ✅ All tests passing (40/40)
- ✅ TypeScript strict mode
- ✅ ESLint compliant
- ✅ Code reviewed
- ✅ No console errors

### Environment Setup
- [ ] Firebase project configured
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` secret added to GitHub
- [ ] All `NEXT_PUBLIC_*` secrets configured
- [ ] `GOOGLE_GENAI_API_KEY` configured (if needed)

### Documentation
- [ ] PHASE4_PRODUCTION_DEPLOYMENT_GUIDE.md reviewed
- [ ] Monitoring plan confirmed
- [ ] Rollback plan ready
- [ ] Team notified

---

## 🔐 GitHub Secrets Setup

### Step 1: Create Firebase Service Account

```bash
# In Firebase Console:
1. Go to Project Settings
2. Service Accounts tab
3. Click "Generate Private Key"
4. Save as JSON file
```

### Step 2: Add Secrets to GitHub

Navigate to: **GitHub Repo → Settings → Secrets and variables → Actions**

Add these secrets:

```
FIREBASE_PROJECT_ID
├─ Value: Your Firebase project ID
└─ Example: okazje-plus-prod

FIREBASE_SERVICE_ACCOUNT_JSON
├─ Value: Full JSON content from service account key
└─ ⚠️ Keep this VERY SECRET

NEXT_PUBLIC_FIREBASE_API_KEY
├─ Value: From Firebase Console → Project Settings
└─ This is public (NEXT_PUBLIC_)

NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
├─ Format: project-id.firebaseapp.com
└─ Example: okazje-plus-prod.firebaseapp.com

NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
├─ Format: project-id.appspot.com
└─ Example: okazje-plus-prod.appspot.com

NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
├─ Value: From Firebase Console
└─ Example: 123456789012

NEXT_PUBLIC_FIREBASE_APP_ID
├─ Format: 1:NUMBER:web:HASH
└─ From Firebase Console

NEXT_PUBLIC_SITE_URL
├─ Value: Your production URL
└─ Example: https://okazje-plus.app

GOOGLE_GENAI_API_KEY (optional)
├─ Value: Gemini API key
└─ Leave as placeholder if not used
```

### Step 3: Verify Secrets Added

```bash
# GitHub CLI (if installed)
gh secret list

# Should show:
# FIREBASE_PROJECT_ID
# FIREBASE_SERVICE_ACCOUNT_JSON
# NEXT_PUBLIC_FIREBASE_API_KEY
# ... etc
```

---

## 🎯 Deployment Methods

### Method 1: Manual Trigger (Recommended for testing)

1. Go to **Actions** tab in GitHub
2. Select **"Deploy to Production"** workflow
3. Click **"Run workflow"**
4. Select branch: `main`
5. Click **"Run workflow"** button

**Time:** ~10 minutes

### Method 2: Push Tag (For releases)

```bash
# Create version tag
git tag -a v1.0.0 -m "Currency System Phase 1-3 Release"

# Push tag
git push origin v1.0.0

# Workflow automatically triggers
```

### Method 3: Manual Command (Emergency)

```bash
# If GitHub Actions fails, deploy manually:

# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Authenticate
firebase login

# 3. Deploy
firebase deploy --only hosting,functions \
  --project your-project-id \
  --non-interactive
```

---

## 📊 Deployment Pipeline

```
Commit pushed to main
          ↓
GitHub Actions triggered
          ↓
├─ Checkout code
├─ Install dependencies
├─ TypeScript check ✅
├─ ESLint check ✅
├─ Run currency tests ✅
├─ Build Next.js app
├─ Build Cloud Functions
├─ Deploy to Firebase
└─ Send notification
          ↓
Deployment complete
```

**Total time:** ~15 minutes

---

## 🔍 Monitor Deployment

### During Deployment

```bash
# View logs in real-time
gh workflow view deploy-production --log

# Or in GitHub UI:
Actions → Deploy to Production → [latest run]
```

### Verify Deployment

```bash
# 1. Check hosting is live
curl https://your-domain.com/pl

# 2. Check functions deployed
firebase functions:list --project your-project-id

# 3. Check logs
firebase functions:logs read --project your-project-id
```

### Check Specific Component

```bash
# Is currency system working?
1. Visit site
2. Click currency selector
3. Try switching to USD
4. Verify price updates
5. Refresh page
6. Verify USD still selected
```

---

## ✅ Post-Deployment Checks

### Immediate (5 minutes)
- [ ] Site is accessible
- [ ] No 500 errors
- [ ] Console has no errors
- [ ] Currency selector visible

### Short-term (30 minutes)
- [ ] Mobile responsive
- [ ] All pages load
- [ ] Currency switching works
- [ ] Prices display correctly

### Monitoring (Daily)
- [ ] Check Cloud Function logs
- [ ] Monitor error rate
- [ ] Check performance metrics
- [ ] Gather user feedback

---

## 🚨 If Deployment Fails

### Common Issues

**Issue 1: "Firebase not authenticated"**
```
Solution:
1. Check FIREBASE_SERVICE_ACCOUNT_JSON secret
2. Verify JSON is valid (not truncated)
3. Check Firebase project ID matches
```

**Issue 2: "Build failed"**
```
Solution:
1. Check npm ci succeeds locally
2. Run npm run build locally
3. Check for missing env vars
4. Check Node version (should be 20)
```

**Issue 3: "Deploy timed out"**
```
Solution:
1. Check internet connection
2. Try manual deploy
3. Check Firebase project status
4. Increase timeout if needed
```

### Rollback

**If something goes wrong:**

```bash
# Option 1: Revert to previous version
git revert <commit-hash>
git push origin main
# GitHub Actions will re-deploy

# Option 2: Manual rollback
firebase hosting:releases:list --project your-project-id
firebase hosting:rollback --project your-project-id
# Select previous version to restore

# Option 3: Emergency disable
firebase hosting:disable --project your-project-id
# (Use only in critical situations)
```

---

## 📈 Monitoring Setup

### Cloud Functions Monitoring

```bash
# View logs
firebase functions:logs read updatePricesDaily \
  --project your-project-id

# Follow logs in real-time
firebase functions:logs read --follow \
  --project your-project-id
```

### Error Tracking

```bash
# Check for errors in past 24h
firebase functions:logs read --project your-project-id \
  --filter "severity>=ERROR" \
  --limit 50
```

### Performance Metrics

```bash
# In Firebase Console:
1. Functions → Select updatePricesDaily
2. Monitor tab
3. View:
   - Execution count
   - Error count
   - Duration
   - Memory usage
```

---

## 📞 Alerts & Notifications

### Setup Email Alerts (Firebase Console)

```
1. Go to: Project Settings → Notifications
2. Enable:
   ├─ Function errors
   ├─ Function performance
   └─ Deployment status
```

### GitHub Actions Notifications

```bash
# Automatic notifications for:
├─ Workflow started
├─ Workflow completed
├─ Workflow failed
└─ Manual approval needed
```

---

## 🔄 Continuous Deployment

### Enable Auto-Deploy on Tags

To automatically deploy when you create a version tag:

**File:** `.github/workflows/deploy-production.yml`

Uncomment these lines:
```yaml
on:
  workflow_dispatch:
  push:
    tags: ["v*"]  # ← Uncomment this line
```

**Usage:**
```bash
# Create version
git tag -a v1.0.0 -m "Release"
git push origin v1.0.0
# Auto-deploys!
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally
- [ ] Code review complete
- [ ] Firebase project configured
- [ ] Secrets added to GitHub
- [ ] Monitoring set up
- [ ] Team notified

### During Deployment
- [ ] Watch GitHub Actions logs
- [ ] Monitor no errors
- [ ] Check build succeeds
- [ ] Verify deploy completes

### Post-Deployment
- [ ] Test site manually
- [ ] Check currency system works
- [ ] Verify Cloud Function runs
- [ ] Monitor error logs
- [ ] Get user feedback

### Success Criteria
- ✅ Site loads without errors
- ✅ All pages responsive
- ✅ Currency selection works
- ✅ Prices display correctly
- ✅ No console errors
- ✅ Cloud Function scheduled
- ✅ Monitoring active

---

## 🎯 Production Deployment Timeline

```
Dec 28, 2025:
├─ 10:00 - Final checks
├─ 10:15 - Deploy to production
├─ 10:30 - Verify site live
├─ 10:45 - Monitor logs
├─ 11:00 - Manual testing
└─ 12:00 - Full verification

Dec 29, 2025:
├─ 03:00 - First scheduled price update
├─ 09:00 - Check logs
└─ 17:00 - Gather user feedback

Jan 1, 2026:
├─ Weekly monitoring review
└─ Prepare Phase 4.5 (more components)
```

---

## 🚀 Next Steps After Deployment

### Day 1
- [ ] Monitor continuously
- [ ] Check error logs hourly
- [ ] Test all major features
- [ ] Verify currency switching

### Week 1
- [ ] Check Cloud Function logs
- [ ] Verify daily price updates
- [ ] Collect user feedback
- [ ] Monitor performance

### Week 2+
- [ ] Optimize performance
- [ ] Plan component migrations
- [ ] Update documentation
- [ ] Schedule next release

---

## 📚 Related Documentation

- **[PHASE4_PRODUCTION_DEPLOYMENT_GUIDE.md](PHASE4_PRODUCTION_DEPLOYMENT_GUIDE.md)** - Full deployment guide
- **[CURRENCY_TESTING_GUIDE.md](docs/testing/CURRENCY_TESTING_GUIDE.md)** - Testing guide
- **[CURRENCY_QUICK_REFERENCE.md](CURRENCY_QUICK_REFERENCE.md)** - API reference
- **[.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)** - Workflow definition

---

## 🔗 Useful Links

- **GitHub Actions Log:** https://github.com/operationforg3-maker/okazje-plus/actions
- **Firebase Console:** https://console.firebase.google.com/
- **Deploy History:** https://github.com/operationforg3-maker/okazje-plus/actions/workflows/deploy-production.yml
- **Releases:** https://github.com/operationforg3-maker/okazje-plus/releases

---

## ✨ Success Message

Once deployment completes successfully:

```
✅ DEPLOYMENT SUCCESSFUL

Site: https://your-domain.com
Functions: Deployed ✅
Hosting: Live ✅
Monitoring: Active ✅

Next: Check first daily price update at 03:00 AM
```

---

**Ready to deploy? Let's go! 🚀**

Follow steps above and you'll have the new currency system in production!

---

**Version:** 1.0  
**Last Updated:** December 28, 2025  
**Status:** Ready for Production  
