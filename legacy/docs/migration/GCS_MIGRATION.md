# Migration to Google Cloud Storage - Setup Guide

## Summary

✅ **Completed Changes:**
1. **Script Update** (`scripts/generate-tools-inventory.mjs`):
   - Added complete tool metadata (13 tools with descriptions, purpose, howItWorks)
   - Integrated Google Cloud Storage client (`@google-cloud/storage`)
   - Uploads CSV to GCS bucket: `gs://okazje-plus-reports/tools-inventory/current.csv`
   - Creates versioned backups: `gs://okazje-plus-reports/tools-inventory/archive/{date}.csv`
   - Falls back to local files if GCS unavailable

2. **API Route Update** (`src/app/api/admin/tools-inventory/route.ts`):
   - Reads inventory from GCS bucket (primary source)
   - Falls back to local files if GCS not available
   - Properly parses CSV with quoted fields (handles special characters)
   - Returns JSON with full tool details and statistics

3. **GitHub Actions Workflow** (`.github/workflows/tools-inventory.yml`):
   - Removed auto-commit behavior (no more version control conflicts!)
   - Added GCP authentication step
   - Uses `gcloud` CLI to verify upload
   - Now only reads permissions (changed from write)

## Setup Instructions

### Step 1: Create GCS Bucket (One-time)

```bash
# Replace PROJECT_ID with your actual GCP project
gcloud storage buckets create gs://okazje-plus-reports \
  --location=europe-west1 \
  --project=PROJECT_ID
```

### Step 2: Configure Environment Variables

**Local Development** (`.env.local`):
```bash
# Already present in App Hosting runtime:
GCS_BUCKET=okazje-plus-reports
```

**GitHub Secrets** (needed for CI/CD):
```bash
# Add to your GitHub repo settings:
GCP_SA_KEY          # JSON service account key with GCS permissions
GCS_BUCKET_NAME     # okazje-plus-reports (optional, defaults to this)
```

To get `GCP_SA_KEY`:
```bash
# Create service account with GCS permissions
gcloud iam service-accounts create github-actions --project=PROJECT_ID
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.admin

# Generate key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com

# Add key.json contents to GitHub Secrets as GCP_SA_KEY
```

### Step 3: Install Dependencies

```bash
npm install @google-cloud/storage
```

### Step 4: Clean Up Repository (Optional)

Remove generated reports from version control:
```bash
git rm --cached docs/reports/tools-inventory.{csv,md}
echo "docs/reports/" >> .gitignore
git commit -m "Remove auto-generated reports from git (moved to GCS)"
```

### Step 5: Test Locally

```bash
# Test script (generates CSV locally + attempts GCS upload)
npm run report:tools

# Test API endpoint
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/api/admin/tools-inventory

# Test CSV download
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/api/admin/tools-inventory?format=csv
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  GitHub Actions Workflow                        │
│  - Triggered on code changes                    │
│  - Runs: npm run report:tools                   │
│  - Uploads to GCS (no git commits!)             │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│  Google Cloud Storage                           │
│  gs://okazje-plus-reports/                      │
│  ├── tools-inventory/current.csv  ← Latest      │
│  └── archive/                                   │
│      └── 2025-01-15.csv           ← Backup      │
└─────────────────────────────────────────────────┘
                     ↑
┌─────────────────────────────────────────────────┐
│  Admin UI / API                                 │
│  - GET /api/admin/tools-inventory               │
│  - Reads from GCS (primary)                     │
│  - Falls back to local files                    │
└─────────────────────────────────────────────────┘
```

## Benefits

✅ **No More Merge Conflicts** - Reports not versioned in git
✅ **Scalable** - GCS handles large/frequent updates
✅ **Versioned Backups** - Daily snapshots in archive/
✅ **Fast Retrieval** - API caches and serves JSON efficiently
✅ **Fallback** - Local files work if GCS unavailable
✅ **CI/CD Ready** - GitHub Actions handles everything

## Monitoring

**Check latest upload:**
```bash
gcloud storage ls -L gs://okazje-plus-reports/tools-inventory/
```

**View versioned backups:**
```bash
gcloud storage ls gs://okazje-plus-reports/tools-inventory/archive/
```

**Debug API (local):**
```bash
# Test CSV parsing
curl http://localhost:3000/api/admin/tools-inventory?format=json | jq '.stats'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Bucket does not exist" | Create bucket via `gcloud storage buckets create` |
| GitHub Actions auth fails | Ensure `GCP_SA_KEY` secret is set in repo settings |
| API returns 404 | Check GCS permissions or use local fallback |
| Local files out of sync | Run `npm run report:tools` to regenerate |

## Next Steps

1. **Deploy** to Firebase App Hosting (automatic with GCS integration)
2. **Monitor** dashboard at `/admin/tools-inventory`
3. **Review** coverage metrics in admin panel
4. **Share** CSV export with team: `GET /api/admin/tools-inventory?format=csv`
