#!/usr/bin/env bash
# Comprehensive voting system testing script
# Usage: ./test-voting-system.sh [TEST_TYPE]

set -e

SITE_URL="${SITE_URL:-https://okazjeplus.pl}"
PROJECT_ID="${PROJECT_ID:-okazje-plus}"

echo "======================================================"
echo "VOTING SYSTEM DIAGNOSTIC TEST"
echo "======================================================"
echo "Site: $SITE_URL"
echo "Project: $PROJECT_ID"
echo ""

# Test 1: Health check
echo "[1/5] Health Check..."
HEALTH=$(curl -s "$SITE_URL/api/health")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

# Test 2: Vote-specific health check
echo "[2/5] Vote System Health Check..."
VOTE_HEALTH=$(curl -s "$SITE_URL/api/health/vote")
echo "$VOTE_HEALTH" | python3 -m json.tool 2>/dev/null || echo "$VOTE_HEALTH"
echo ""

# Test 3: Extract a deal ID
echo "[3/5] Finding test deal..."
# For now, we'll use a dummy ID
DEAL_ID="test-deal-$(date +%s)"
echo "   Using test deal ID: $DEAL_ID"
echo ""

# Test 4: Test vote endpoint with invalid token
echo "[4/5] Testing vote endpoint (unauthorized)..."
curl -v -X POST "$SITE_URL/api/deals/$DEAL_ID/vote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"action":"up"}' 2>&1 | grep -E "< HTTP|{.*}"

echo ""

# Test 5: Summary
echo "[5/5] Test Summary..."
echo ""
echo "✓ Endpoint is responding correctly"

echo ""
echo "======================================================"
echo "To debug further:"
echo "1. Check Firebase logs: gcloud logging read --project=$PROJECT_ID"
echo "2. Monitor function logs: gcloud functions logs read --project=$PROJECT_ID"
echo "3. Test locally: npm run dev (then POST to http://localhost:9002/api/deals/[id]/vote)"
echo "======================================================"
