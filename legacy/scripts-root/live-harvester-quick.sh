#!/usr/bin/env bash
# Quick live harvester test via curl
# Requires: ID_TOKEN env var
# Optional: BASE_URL (default: https://okazjeplus.pl)

set -euo pipefail
BASE_URL="${BASE_URL:-https://okazjeplus.pl}"

if [[ -z "${ID_TOKEN:-}" ]]; then
  echo "ID_TOKEN env var required" >&2
  exit 1
fi

echo "POST $BASE_URL/api/admin/harvester/run"
curl -s -X POST "$BASE_URL/api/admin/harvester/run" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"aliexpress","query":"usb c kabel","maxResults":10,"mode":"single"}' | python3 -m json.tool || true

echo "\nGET $BASE_URL/api/admin/harvester-jobs?limit=10"
curl -s "$BASE_URL/api/admin/harvester-jobs?limit=10" \
  -H "Authorization: Bearer $ID_TOKEN" | python3 -m json.tool || true
