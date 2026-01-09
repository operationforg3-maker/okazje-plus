#!/bin/bash

# Small import test script to verify fix on live
# This creates a minimal import job and monitors it

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   LIVE IMPORT TEST - VERIFY FIX         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Get Firebase token from environment or use default
TOKEN=${FIREBASE_TOKEN:-"eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk1MTg5MTkxMTA3NjA1NDM0NGUxNWUyNTY0MjViYjQyNWVlYjNhNWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vb2themplLXBsdXMiLCJhdWQiOiJva2F6amUtcGx1cyIsImF1dGhfdGltZSI6MTc2NTQ0MzAzNywidXNlcl9pZCI6IjhVc0k2aWhGRGJhcnppRk1KcEoyTzVYd3ZUYjIiLCJzdWIiOiI4VXNJNmloRkRiYXJ6aUZNSnBKMk81WHd2VGIyIiwiaWF0IjoxNzY1NDQzMDM3LCJleHAiOjE3NjU0NDY2MzcsImVtYWlsIjoiYWRtaW5Ab2themplcGx1cy5wbCIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJhZG1pbkBva2F6amVwbHVzLnBsIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.Of9-1OnIJ0CAbAaa8K3up9g4X3DQLR2gxt8u12XbKX7zBfbV3Z2LJ4C4RgA2Y_3KwsgSzDF5GNUf0vRP2W5SZWBuuHSk9mofbItfAi3haLX4AnSYCY7dXCU0N0J4n1WQ29xh6935RUx1gghKPo4jTDkx4LV3yX0t8TaX7K2gzoQRM8y05iVBW3--AW85I-n8KsG8yocMqXpZnFsHHdjKmBZhcdHo-bXS_L_8Ocoyq4GMP7ycVRjCPEele4imO2IMBD4-0upmB23xOtD0FM720ujFK6_FvTNuQN6o62AM96XInR3wnGx8jtVEET7Gm9r0WjAGCXBH84AjhAqunWhy_Q"}

echo "1️⃣  Waiting 10 seconds for App Hosting rebuild..."
sleep 10

echo "2️⃣  Starting test import..."

# Create test import
RESPONSE=$(curl -s -X POST https://okazjeplus.pl/api/admin/import/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "full",
    "importerType": "keyword-search",
    "maxItemsPerSubcategory": 5
  }')

echo "Response: $RESPONSE" | head -20
echo ""

# Extract job ID if possible
JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "❌ Failed to create job"
  exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

echo "3️⃣  Waiting 30 seconds for processing..."
sleep 30

echo ""
echo "4️⃣  Checking results..."

# Run diagnostic script
node scripts/diagnose-live-import.js

echo ""
echo "If you see 'Fetched > 0 AND Deduplicated > 0' → FIX IS WORKING! 🎉"
echo "If you see 'Fetched > 0 AND Deduplicated = 0' → FIX NOT DEPLOYED YET"
echo ""
