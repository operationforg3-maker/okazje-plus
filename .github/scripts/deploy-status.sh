#!/usr/bin/env bash
set -euo pipefail

echo "== Okazje Plus :: Deployment Status Check =="
echo "Date: $(date -Is)"
echo "Runner: $(uname -a)"

echo "Commit: ${GITHUB_SHA:-unknown}"
echo "Branch: ${GITHUB_REF_NAME:-unknown}"
echo "Repo: ${GITHUB_REPOSITORY:-unknown}"

echo "Node: $(node --version || echo 'n/a')"
echo "npm: $(npm --version || echo 'n/a')"

required_secrets=(
  FIREBASE_PROJECT_ID
  FIREBASE_SERVICE_ACCOUNT_JSON
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
  NEXT_PUBLIC_SITE_URL
)

missing=()
for key in "${required_secrets[@]}"; do
  val=$(printenv "$key" || true)
  if [[ -z "${val:-}" ]]; then
    missing+=("$key")
  fi
  printf "Secret %s: %s\n" "$key" "$( [[ -n "${val:-}" ]] && echo 'present' || echo 'missing' )"
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "\n❌ Missing required secrets: ${missing[*]}"
  echo "Set them in GitHub → Settings → Secrets and variables → Actions"
  exit 1
else
  echo "\n✅ All required secrets are present"
fi

if command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI: $(firebase --version)"
else
  echo "Firebase CLI not installed; skipping hosting status"
fi

echo "\nStatus check complete."
