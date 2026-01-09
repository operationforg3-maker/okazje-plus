#!/bin/bash

# Test importu deali na produkcji
# Wywołuje fillCategoriesWithDeals na live i sprawdza wyniki

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   LIVE DEALS IMPORT TEST                ║"
echo "╚════════════════════════════════════════╝"
echo ""

TOKEN=${FIREBASE_TOKEN:-"eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk1MTg5MTkxMTA3NjA1NDM0NGUxNWUyNTY0MjViYjQyNWVlYjNhNWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vb2themplLXBsdXMiLCJhdWQiOiJva2F6amUtcGx1cyIsImF1dGhfdGltZSI6MTc2NTQ0MzAzNywidXNlcl9pZCI6IjhVc0k2aWhGRGJhcnppRk1KcEoyTzVYd3ZUYjIiLCJzdWIiOiI4VXNJNmloRkRiYXJ6aUZNSnBKMk81WHd2VGIyIiwiaWF0IjoxNzY1NDQzMDM3LCJleHAiOjE3NjU0NDY2MzcsImVtYWlsIjoiYWRtaW5Ab2themplcGx1cy5wbCIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJhZG1pbkBva2F6amVwbHVzLnBsIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.Of9-1OnIJ0CAbAaa8K3up9g4X3DQLR2gxt8u12XbKX7zBfbV3Z2LJ4C4RgA2Y_3KwsgSzDF5GNUf0vRP2W5SZWBuuHSk9mofbItfAi3haLX4AnSYCY7dXCU0N0J4n1WQ29xh6935RUx1gghKPo4jTDkx4LV3yX0t8TaX7K2gzoQRM8y05iVBW3--AW85I-n8KsG8yocMqXpZnFsHHdjKmBZhcdHo-bXS_L_8Ocoyq4GMP7ycVRjCPEele4imO2IMBD4-0upmB23xOtD0FM720ujFK6_FvTNuQN6o62AM96XInR3wnGx8jtVEET7Gm9r0WjAGCXBH84AjhAqunWhy_Q"}

echo "🚀 Uruchamiam import deali na produkcji..."
echo ""

RESPONSE=$(curl -s -X POST https://okazjeplus.pl/api/admin/ai/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "fillCategoriesWithDeals"}')

echo "📥 Odpowiedź API:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Sprawdź czy sukces
if echo "$RESPONSE" | grep -q "success.*true"; then
  echo "✅ Import uruchomiony!"
  echo ""
  echo "⏳ Czekam 2 minuty na zakończenie importu..."
  sleep 120
  
  echo ""
  echo "🔍 Sprawdzam wyniki w bazie..."
  node scripts/check-deals.mjs
else
  echo "❌ Błąd podczas uruchamiania importu!"
  exit 1
fi
