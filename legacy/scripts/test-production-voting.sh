#!/usr/bin/env bash
# PRODUCTION VOTING SYSTEM - COMPREHENSIVE LIVE TEST
# Run on production WITHOUT any local dependencies

set -e

SITE_URL="${SITE_URL:-https://okazjeplus.pl}"
BEARER_TOKEN="${BEARER_TOKEN:-}"

echo "=========================================="
echo "VOTING SYSTEM PRODUCTION TEST"
echo "=========================================="
echo "Site: $SITE_URL"
echo "Time: $(date)"
echo ""

# Check if bearer token provided
if [ -z "$BEARER_TOKEN" ]; then
  echo "⚠️  BEARER_TOKEN not set. Testing unauthenticated endpoints only."
  echo ""
  echo "To test authenticated endpoints, set:"
  echo "  export BEARER_TOKEN='your-firebase-token'"
  echo ""
fi

# Test 1: Health endpoint
echo "[1/6] Testing /api/health..."
HEALTH_RESPONSE=$(curl -s -X GET "$SITE_URL/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)
if [ "$HEALTH_STATUS" = "ok" ]; then
  echo "  ✅ Health check OK"
else
  echo "  ❌ Health check FAILED"
  echo "$HEALTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
fi
echo ""

# Test 2: Vote health endpoint
echo "[2/6] Testing /api/health/vote..."
VOTE_HEALTH=$(curl -s -X GET "$SITE_URL/api/health/vote")
VOTE_STATUS=$(echo "$VOTE_HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)
if [ "$VOTE_STATUS" = "ok" ]; then
  echo "  ✅ Vote health check OK"
else
  echo "  ❌ Vote health check FAILED"
fi
echo ""

# Test 3: Unauthenticated vote request (should fail with 401)
echo "[3/6] Testing vote endpoint without token (expect 401)..."
UNAUTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SITE_URL/api/deals/test-deal/vote" \
  -H "Content-Type: application/json" \
  -d '{"action":"up"}')

if [ "$UNAUTH_HTTP" = "401" ]; then
  echo "  ✅ Correctly rejected (401)"
else
  echo "  ❌ Expected 401, got $UNAUTH_HTTP"
fi
echo ""

# Test 4: Admin voting test endpoint
echo "[4/6] Testing /api/admin/tests/voting endpoint..."
if [ -z "$BEARER_TOKEN" ]; then
  echo "  ⏭️  Skipped (no bearer token)"
else
  ADMIN_HTTP=$(curl -s -o /tmp/admin_test.json -w "%{http_code}" -X POST "$SITE_URL/api/admin/tests/voting" \
    -H "Authorization: Bearer $BEARER_TOKEN" \
    -H "Content-Type: application/json")
  
  if [ "$ADMIN_HTTP" = "200" ]; then
    echo "  ✅ Admin test endpoint OK (200)"
    cat /tmp/admin_test.json | python3 -m json.tool 2>/dev/null | grep -E '"passed"|"failed"' || true
  else
    echo "  ❌ Admin test failed (HTTP $ADMIN_HTTP)"
    cat /tmp/admin_test.json | python3 -m json.tool 2>/dev/null | head -20 || cat /tmp/admin_test.json
  fi
fi
echo ""

# Test 5: Authenticated vote request (if token provided)
echo "[5/6] Testing authenticated vote..."
if [ -z "$BEARER_TOKEN" ]; then
  echo "  ⏭️  Skipped (no bearer token)"
else
  AUTH_HTTP=$(curl -s -o /tmp/auth_test.json -w "%{http_code}" -X POST "$SITE_URL/api/deals/test-deal-id/vote" \
    -H "Authorization: Bearer $BEARER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"action":"up"}')
  
  if [ "$AUTH_HTTP" = "404" ]; then
    echo "  ✅ Vote endpoint accessible (404 = deal not found, which is OK)"
  elif [ "$AUTH_HTTP" = "200" ]; then
    echo "  ✅ Vote successful (200)"
    cat /tmp/auth_test.json | python3 -m json.tool 2>/dev/null || cat /tmp/auth_test.json
  else
    echo "  ⚠️  Unexpected response: HTTP $AUTH_HTTP"
    cat /tmp/auth_test.json | python3 -m json.tool 2>/dev/null || cat /tmp/auth_test.json
  fi
fi
echo ""

# Test 6: Summary
echo "[6/6] Summary"
echo "=========================================="
echo "✅ Production voting system tests complete"
echo ""
echo "Key endpoints:"
echo "  GET  /api/health           → Health check"
echo "  GET  /api/health/vote      → Vote system check"
echo "  POST /api/deals/[id]/vote  → Cast vote (requires Bearer token)"
echo "  POST /api/admin/tests/voting → Admin voting test (requires admin Bearer token)"
echo ""
echo "To run authenticated tests:"
echo "  1. Login at https://okazjeplus.pl"
echo "  2. Open browser console: const token = await firebase.auth().currentUser.getIdToken(); console.log(token)"
echo "  3. Run: export BEARER_TOKEN='<token>'"
echo "  4. Run this script again"
echo "=========================================="
