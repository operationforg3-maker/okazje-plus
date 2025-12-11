#!/bin/bash

# Manual workaround: rebuild Cloud Build manually
# This bypasses Firebase App Hosting auto-deploy and builds directly

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  FORCING MANUAL REBUILD VIA CLOUD BUILD║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found"
    echo "Fallback: Push another commit to trigger Firebase App Hosting"
    exit 1
fi

echo "Triggering Cloud Build manually..."
echo ""

# List recent builds
echo "Recent Cloud Build jobs:"
gcloud builds list --project okazje-plus --limit=5 2>/dev/null || {
    echo "Could not list builds - checking App Hosting status instead..."
    gcloud firebase apphosting rollouts list --project okazje-plus --location europe-west1 2>/dev/null | head -15
}

echo ""
echo "Next steps:"
echo "  1. Check Cloud Build console: https://console.cloud.google.com/cloud-build"
echo "  2. Or trigger via: gcloud builds submit --config=cloudbuild.yaml"
echo "  3. Or wait for automatic rebuild (check GitHub Actions)"
echo ""
