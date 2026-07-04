# Okazje-Plus Deployment Guide

This document defines the standardized deployment process for the `okazje-plus` project, relying exclusively on official Google/Firebase tools.

## 🚀 1. Frontend & API (Next.js)

The Next.js application (including all UI and API routes in `src/app`) is hosted on **Firebase App Hosting**. 
App Hosting is directly linked to the GitHub repository and automatically handles the build and deployment process.

### How to Deploy
1. Commit your changes locally.
2. Push your changes to the `main` branch on GitHub:
   ```bash
   git push origin main
   ```
3. Firebase App Hosting automatically detects the push, triggers a Google Cloud Build, reads the `apphosting.yaml` configuration, and deploys the new version to `okazjeplus.pl` with zero downtime.

**Note**: Do NOT use `firebase deploy --only hosting` for the Next.js app. The old `firebase-frameworks` integration has been deprecated in favor of Firebase App Hosting.

---

## ⚙️ 2. Backend (Cloud Functions & Firestore)

Cloud Functions (background jobs, triggers) and Firestore configurations (rules, indexes) are deployed manually using the Firebase CLI.

### How to Deploy

To deploy both Cloud Functions and Firestore rules at once, run:
```bash
npm run deploy:prod:backend
```

This command executes two scripts under the hood:
1. `npm run deploy:functions`: Builds the TypeScript code in the `okazje-plus` directory and deploys the Cloud Functions.
2. `npm run deploy:rules`: Deploys the `firestore.rules` and `firestore.indexes.json` files to update database security and indexing.

### Deploying Individually
If you only want to deploy Cloud Functions:
```bash
npm run deploy:functions
```

If you only want to deploy Firestore Rules and Indexes:
```bash
npm run deploy:rules
```

---

## 🔧 3. Environment & Configuration

- **Next.js Build Configuration**: Managed in `apphosting.yaml` (specifies instance limits, Cloud Run settings, and environment secrets mapped from Google Cloud Secret Manager).
- **Backend Configuration**: Handled by the standard Firebase `firebase.json` for functions and firestore.

### Adding New Secrets
To add a new secret that needs to be used by the Next.js App Hosting environment:
```bash
firebase apphosting:secrets:set SECRET_NAME
```
Then add it to the `apphosting.yaml` file under the `env` section with `secret: SECRET_NAME`.
