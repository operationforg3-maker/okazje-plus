#!/usr/bin/env bash
set -euo pipefail

# Script to create secrets in Google Secret Manager and grant App Hosting access.
# Usage:
#   PROJECT=okazje-plus ./scripts/setup-gcloud-secrets.sh
# Optionally export values as env vars before running, e.g.:
#   export ALIEXPRESS_API_BASE="https://gw.api.alibaba.com"
#   export ALIEXPRESS_APP_KEY="<key>" \
#   export ALIEXPRESS_APP_SECRET="<secret>" \
#   export ALIEXPRESS_AFFILIATE_ID="<id>" \
#   ./scripts/setup-gcloud-secrets.sh

PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}
if [ -z "$PROJECT" ]; then
  echo "Project not set. Set environment variable PROJECT or run 'gcloud config set project <PROJECT>'" >&2
  exit 1
fi

SECRETS=(
  TEST_USER_EMAIL
  TEST_USER_PASSWORD
  TEST_ADMIN_EMAIL
  TEST_ADMIN_PASSWORD
  ALIEXPRESS_API_BASE
  ALIEXPRESS_APP_KEY
  ALIEXPRESS_APP_SECRET
  ALIEXPRESS_AFFILIATE_ID
  TYPESENSE_HOST
  TYPESENSE_PORT
  TYPESENSE_PROTOCOL
  TYPESENSE_SEARCH_ONLY_API_KEY
)

# Ensure firebase CLI is logged in
if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI not found in PATH. Install it: npm i -g firebase-tools" >&2
  exit 1
fi

echo "Using project: $PROJECT"

for name in "${SECRETS[@]}"; do
  echo "---\nProcessing secret: $name"
  # Check if secret exists
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    echo "Secret $name already exists."
  else
    echo "Creating secret $name..."
    gcloud secrets create "$name" --replication-policy="automatic" --project="$PROJECT"
    echo "Created $name"
  fi

  # If environment variable with same name exists, add it as a new version
  if [ -n "${!name-}" ]; then
    echo "Adding provided environment value for $name as a new secret version..."
    printf '%s' "${!name}" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT"
    echo "Added version for $name"
  else
    echo "No env var provided for $name — adding an empty placeholder version to ensure existence."
    printf '%s' "" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT"
  fi

  # Grant App Hosting backend access to the secret. Use firebase CLI helper which wraps appropriate IAM bindings.
  echo "Granting App Hosting access to $name via firebase CLI..."
  if firebase apphosting:secrets:grantaccess "$name" --project="$PROJECT"; then
    echo "Granted access for $name"
  else
    echo "firebase CLI grantaccess failed; trying IAM binding fallback..."
    # Fallback: grant Secret Accessor to the App Hosting service account (best effort)
    # App Hosting backend uses service account: service-PROJECT_NUMBER@gcp-sa-hosting.iam.gserviceaccount.com
    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='get(projectNumber)')
    SA="service-${PROJECT_NUMBER}@gcp-sa-hosting.iam.gserviceaccount.com"
    echo "Granting roles/secretmanager.secretAccessor to $SA on secret $name"
    gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" --project="$PROJECT"
    echo "IAM binding applied for $name -> $SA"
  fi

  echo "Done $name"
done

echo "All done. Next steps: commit any changes to apphosting.yaml and push. Re-run your build." 
