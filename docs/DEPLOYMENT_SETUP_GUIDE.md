# Deployment & Configuration Guide (Dec 2025)

## 1. Local Development Setup

### Prerequisites
- Node.js 18+
- Firebase CLI
- Typesense (optional, can use cloud version)

### Installation

```bash
# Clone repo
git clone https://github.com/operationforg3-maker/okazje-plus.git
cd okazje-plus

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables Checklist

**Critical (required for functionality):**
- ✅ `CONVERTISER_API_TOKEN=1xQahDClPsBXK15toSIABQ1GRDacHI`
- ✅ `GOOGLE_CLOUD_PROJECT=okazje-plus-project`
- ✅ `VERTEX_LOCATION=europe-west1`
- Firebase config (NEXT_PUBLIC_FIREBASE_*)
- Typesense config (NEXT_PUBLIC_TYPESENSE_*)

**Optional (for advanced features):**
- `ALIEXPRESS_APP_KEY` + `ALIEXPRESS_APP_SECRET` (for AliExpress imports)
- `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON)

### Running Locally

```bash
# Development
npm run dev
# Starts on http://localhost:9002

# Build
npm run build

# Production run
npm run start

# Typecheck
npm run typecheck

# Lint
npm run lint

# Tests
npm run test
npm run test:e2e
```

---

## 2. Database Setup (Firestore)

### Collections Structure

```
firestore/
├── deals/
│   ├── {dealId}
│   │   ├── id: string
│   │   ├── title: string
│   │   ├── description: string
│   │   ├── price: {amount, currency}
│   │   ├── affiliateUrl: string
│   │   ├── mainCategorySlug: string
│   │   ├── subCategorySlug: string
│   │   ├── status: "draft" | "approved" | "rejected"
│   │   ├── createdAt: timestamp
│   │   ├── metadata: {...}
│   │   └── ...
│   └── ...
│
├── products/
│   ├── {productId}
│   │   ├── title: {pl, en, de}
│   │   ├── description: {pl, en, de}
│   │   ├── price: SmartPrice
│   │   └── ...
│   └── ...
│
├── categories/
│   ├── electronics
│   │   ├── name: string
│   │   ├── subcategories: {...}
│   │   └── ...
│   └── ...
│
├── jobs/
│   ├── {jobId}
│   │   ├── type: "import_pipeline"
│   │   ├── status: "pending" | "processing" | "completed" | "failed"
│   │   ├── payload: {...}
│   │   └── ...
│   └── ...
│
├── users/
│   ├── {uid}
│   │   ├── email: string
│   │   ├── displayName: string
│   │   ├── role: "admin" | "moderator" | "user"
│   │   └── ...
│   └── ...
│
└── votes/
    ├── {dealId}/{userId}
    │   ├── direction: "up" | "down"
    │   └── createdAt: timestamp
    └── ...
```

### Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access to approved deals
    match /deals/{dealId} {
      allow read: if resource.data.status == "approved";
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.createdBy || 
                               get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ["admin", "moderator"];
    }

    // Products - public read
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth.uid == resource.data.createdBy || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    // Votes - authenticated write
    match /votes/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Jobs - admin only
    match /jobs/{jobId} {
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    // Users - own document or admin
    match /users/{userId} {
      allow read: if request.auth.uid == userId || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## 3. Vertex AI Setup

### Enable APIs in GCP

```bash
gcloud services enable vertexai.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

### Create Service Account

```bash
# Create SA
gcloud iam service-accounts create okazje-plus-sa \
  --display-name="Okazje Plus Service Account"

# Add roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:okazje-plus-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Generate key
gcloud iam service-accounts keys create key.json \
  --iam-account=okazje-plus-sa@PROJECT_ID.iam.gserviceaccount.com
```

### Environment

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
export GOOGLE_CLOUD_PROJECT=okazje-plus-project
export VERTEX_LOCATION=europe-west1
```

---

## 4. Typesense Setup (Optional)

### Docker (Local Development)

```bash
docker run -p 8108:8108 -v typesense-data:/data typesense/typesense:latest
```

### Cloud Deployment

- Use **Typesense Cloud** (recommended for production)
- Update `NEXT_PUBLIC_TYPESENSE_*` env vars

### Initialize Collections

```bash
# Via helper function (from admin panel):
curl -X POST http://localhost:3000/api/admin/maintenance/typesense-heal \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 5. Firebase App Hosting Deployment

### Deploy to App Hosting (europe-west1)

```bash
# Build
npm run build

# Deploy
firebase deploy --only hosting,functions

# Check status
firebase hosting:channel:list
```

### Environment Variables in App Hosting

Set via Firebase Console → App Hosting → Settings:

```
CONVERTISER_API_TOKEN=1xQahDClPsBXK15toSIABQ1GRDacHI
GOOGLE_CLOUD_PROJECT=okazje-plus-project
VERTEX_LOCATION=europe-west1
NODE_ENV=production
```

---

## 6. Cloud Scheduler (Maintenance Tasks)

### Link Validation Job

```bash
gcloud scheduler jobs create http validate-links \
  --location=europe-west1 \
  --schedule="0 2 * * *" \
  --uri="https://YOUR_APP_URL/api/admin/maintenance/validate-links" \
  --http-method=POST \
  --oidc-service-account-email=okazje-plus-sa@PROJECT_ID.iam.gserviceaccount.com
```

### Duplicate Detection Job

```bash
gcloud scheduler jobs create http find-duplicates \
  --location=europe-west1 \
  --schedule="0 3 * * 0" \
  --uri="https://YOUR_APP_URL/api/admin/maintenance/dedup" \
  --http-method=POST
```

---

## 7. Monitoring & Logging

### Cloud Logging

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Or use Firebase Console → Logs
```

### Error Tracking

- Sentry integration (optional): add `@sentry/nextjs`
- Cloud Error Reporting (built-in)

### Metrics

- Monitor Typesense indexing latency
- Vertex AI API usage + costs
- Convertiser API rate limits

---

## 8. Security Checklist

- ✅ API keys stored in `.env.local` (git-ignored)
- ✅ Firestore rules restrict admin operations
- ✅ HTTPS enforced (Firebase Hosting default)
- ✅ CORS configured for affiliate links
- ✅ Input validation on all endpoints
- ✅ Rate limiting on public APIs (via Cloud Armor)
- ✅ Service account key rotated quarterly

---

## 9. Scaling Recommendations

| Component | Dev | Prod |
|-----------|-----|------|
| Firestore | ~100 ops/sec | 10k+ ops/sec w/ indexes |
| Typesense | Local Docker | Cloud cluster |
| Vertex AI | Pay-per-call | Budget alert: $100/mo |
| App Hosting | 1x instance | 2-5x instances auto-scaling |

---

## 10. Troubleshooting

### "Unauthorized" on Convertiser API
- Check `CONVERTISER_API_TOKEN` in `.env.local`
- Token may be expired; regenerate in Convertiser console

### "Project not found" on Vertex AI
- Verify `GOOGLE_CLOUD_PROJECT` matches GCP project ID
- Check service account has `Vertex AI User` role

### Typesense index empty
- Run: `curl -X POST http://localhost:3000/api/admin/maintenance/typesense-heal`
- Check Firestore has "approved" deals

### Build fails: "Module not found"
- Clear cache: `rm -rf .next node_modules && npm install`
- Check TypeScript: `npm run typecheck`

---

## 11. Quick Deploy Checklist

Before pushing to production:

- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Run `npm run test`
- [ ] Set environment variables in Firebase Console
- [ ] Test Convertiser API: `curl -H "Authorization: Token ..." https://api.convertiser.com/system/currencies/`
- [ ] Test Vertex AI: ensure SA has proper roles
- [ ] Verify Firestore rules allow your operations
- [ ] Set Typesense API key
- [ ] Create Cloud Scheduler jobs (if using)
- [ ] Enable Cloud Logging

---

## 12. Support & Resources

- **Convertiser API:** https://docs.convertiser.com/
- **Vertex AI:** https://cloud.google.com/vertex-ai/docs
- **Firebase:** https://firebase.google.com/docs
- **Typesense:** https://typesense.org/docs/
- **Next.js 15:** https://nextjs.org/docs
