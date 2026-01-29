# Deploy Action Configuration

## 🚀 GitHub Actions Deployment

### Workflow File
**Location**: `.github/workflows/deploy-production.yml`

### Trigger Events
- ✅ Manual trigger: `workflow_dispatch` (via GitHub Actions UI)
- ✅ Auto-trigger: Push to `main` branch

### Deployment Target
- **Platform**: Firebase App Hosting (Cloud Run)
- **Region**: `europe-west1`
- **Project**: `okazje-plus`

### What Gets Deployed

#### 1. Next.js Application (Hosting)
- All pages in `src/app/`
- API routes
- Static assets
- Middleware

#### 2. Cloud Functions
- All functions from `okazje-plus/src/index.ts`
- Including new: `createForumThreadCloudFunction`

#### 3. Firestore Configuration
- Rules: `firestore.rules`
- Indexes: `firestore.indexes.json`

### Environment Secrets Required
```yaml
FIREBASE_SERVICE_ACCOUNT_JSON      # Full service account key JSON
FIREBASE_PROJECT_ID                # okazje-plus
NEXT_PUBLIC_FIREBASE_API_KEY       # Firebase public key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN   # Firebase auth domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID    # Firebase project ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_SITE_URL               # https://okazjeplus.pl
GOOGLE_GENAI_API_KEY               # For AI/Genkit
```

### Deployment Pipeline

```
Code Push → GitHub Actions Triggered
    ↓
Checkout & Setup Node v22
    ↓
Install Dependencies (App)
    ↓
TypeScript Check (npm run typecheck)
    ↓
ESLint (npm run lint)
    ↓
Build Next.js (npm run build)
    ↓
Install Dependencies (Cloud Functions)
    ↓
Build Cloud Functions (okazje-plus)
    ↓
Setup Firebase CLI
    ↓
Configure Credentials (GOOGLE_APPLICATION_CREDENTIALS)
    ↓
Clean Stale Functions (if any)
    ↓
Deploy: hosting + functions (--force)
    ↓
Cleanup Credentials
    ↓
✅ COMPLETE or ❌ FAILED
```

### Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `concurrency.group` | `deploy-production` | Only one deployment at a time |
| `cancel-in-progress` | `false` | Wait for current deploy to finish |
| `runs-on` | `ubuntu-latest` | GitHub-hosted runner |
| `environment` | `production` | Use prod secrets |
| `node-version` | `22` | LTS version |

### Build Artifacts Generated

During deployment:
1. `Next.js Build Output` → `.next/` folder
2. `Cloud Functions Bundle` → `okazje-plus/lib/` folder
3. `Firebase Manifest` → Deployment metadata

### Deployment Commands Executed

```bash
# Build phase
npm ci                    # Clean install (exact versions)
npm run typecheck         # TypeScript validation
npm run lint              # ESLint validation
npm run build             # Next.js production build

# Cloud Functions
cd okazje-plus
npm ci
npm run build             # TypeScript → JavaScript

# Deploy phase
firebase experiments:enable webframeworks
firebase deploy --only hosting,functions --force --non-interactive
```

### Success Criteria

Deployment is considered successful when:
- ✅ All build steps pass (no errors)
- ✅ Firebase CLI deployment returns status 0
- ✅ Hosting deployment complete (preview URL available)
- ✅ Cloud Functions deployed (status: ACTIVE)
- ✅ No Firestore rules compilation errors

### Monitoring & Alerts

After deployment:
1. **Firebase Console** shows deployment complete
2. **GitHub Actions** shows workflow success ✅
3. **Cloud Functions** dashboard shows ACTIVE status
4. **Firestore** rules applied successfully

### Manual Trigger

If you want to deploy without pushing code:

1. Go to GitHub Repository
2. Click "Actions" tab
3. Select "Deploy to Production" workflow
4. Click "Run workflow" → "Run workflow"
5. Check logs in real-time

### Failure Handling

If deployment fails:
1. Check GitHub Actions logs for error message
2. Common issues:
   - Missing secrets → Add to GitHub Secrets
   - Build error → Fix locally, push again
   - Firestore rules compilation error → Fix firestore.rules
   - Cloud Functions error → Check okazje-plus/src/index.ts

### Rollback Procedure

If production issues found:
```bash
# Revert last deploy
git revert HEAD
git push origin main

# Or manual Firebase rollback
firebase hosting:versions:list
firebase hosting:versions:promote <version-id>
```

---

## ✨ Current Deployment Status

**Latest commit deployed**: `37663c5`
**Deployment triggered**: 29 January 2026 @ 17:51 UTC
**Status**: In GitHub Actions queue

**View deployment progress**: 
👉 https://github.com/operationforg3-maker/okazje-plus/actions

**Estimated time**: ~10-15 minutes

---

**This deployment includes**:
- ✅ Cloud Function: Forum thread creation
- ✅ Frontend: Forum new thread page
- ✅ Firestore rules update
- ✅ Full production-ready system
