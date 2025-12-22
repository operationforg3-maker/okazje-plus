#!/bin/bash
# Quick script to run refiner on pending_approval products
# Usage: ./scripts/run-refiner.sh [limit]

LIMIT=${1:-50}
BASE_URL=${BASE_URL:-https://okazjeplus.pl}

echo "🔧 Running Refiner on pending_approval products (limit: $LIMIT)"
echo "Base URL: $BASE_URL"
echo "---"

# Get token
echo "📝 Generating admin token..."
TOKEN=$(cd "$(dirname "$0")/.." && node scripts/get-id-token.mjs 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)['idToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to generate token"
  exit 1
fi

echo "✅ Token generated"
echo ""

# Run refiner
echo "🚀 POST $BASE_URL/api/admin/refiner/run"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/refiner/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"limit\": $LIMIT}")

# Check if response is valid JSON
if ! echo "$RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
  echo "❌ Invalid response (not JSON):"
  echo "$RESPONSE" | head -20
  exit 1
fi

# Parse and display
SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))")

if [ "$SUCCESS" = "True" ]; then
  echo "✅ Refiner completed successfully!"
  echo ""
  
  JOB_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['job'].get('id', 'N/A'))")
  PROCESSED=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['job'].get('productsProcessed', 0))")
  SUCCESSFUL=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['job'].get('productsSuccessful', 0))")
  FAILED=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['job'].get('productsFailed', 0))")
  
  echo "Job ID: $JOB_ID"
  echo "Products Processed: $PROCESSED"
  echo "Products Successful: $SUCCESSFUL"
  echo "Products Failed: $FAILED"
else
  echo "❌ Refiner failed:"
  echo "$RESPONSE" | python3 -m json.tool
  exit 1
fi
