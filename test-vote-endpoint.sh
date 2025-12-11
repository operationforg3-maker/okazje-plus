#!/bin/bash
# Simple test to verify vote endpoint response

echo "=== Testing Vote Endpoint Response Format ==="

# Find a deal ID from the site
echo "1. Checking available deals..."
DEALS_CHECK=$(curl -s "https://okazjeplus.pl/api/health" | grep -o '"found [0-9]*' || echo "unknown")
echo "   Health check: $DEALS_CHECK"

# Try to get a valid firebase token
echo ""
echo "2. Getting test token..."
# For now, let's just test endpoint connectivity
ENDPOINT="https://okazjeplus.pl/api/deals/test-123/vote"
echo "   Testing: POST $ENDPOINT"

curl -v -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-test" \
  -d '{"action":"up"}' 2>&1 | grep -E "< HTTP|error|success|message" | head -20

echo ""
echo "=== Test Complete ==="
