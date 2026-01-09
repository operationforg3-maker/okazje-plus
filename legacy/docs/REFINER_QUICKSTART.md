# Refiner - Quick Start

## Automatyczne uruchamianie (bez wskazywania produktów)

Refiner automatycznie znajduje produkty ze statusem `pending_approval` i je wzbogaca.

### Opcja 1: Skrypt bash (najszybszy)

```bash
# Domyślnie: limit 50 produktów
./scripts/run-refiner.sh

# Własny limit
./scripts/run-refiner.sh 100

# Lokalne środowisko
BASE_URL=http://localhost:9002 ./scripts/run-refiner.sh 20
```

### Opcja 2: Curl (ręcznie)

```bash
# 1. Wygeneruj token
TOKEN=$(node scripts/get-id-token.mjs | jq -r '.idToken')

# 2. Uruchom refiner
curl -X POST https://okazjeplus.pl/api/admin/refiner/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

### Opcja 3: UI Admin Panel

1. Wejdź na https://okazjeplus.pl/admin/catalog
2. Zakładka "Refiner"
3. Kliknij "Run AI Refiner on Pending Products"

## Co robi refiner?

1. Pobiera produkty z `status: "pending_approval"` (max `limit`)
2. Dla każdego produktu:
   - Normalizuje specs (RAM, Storage, Screen)
   - Generuje multilingual descriptions (PL/EN/DE)
   - Oblicza quality score (0-100)
   - Ekstraktuje search tags
   - Tworzy SEO meta (title, description)
3. Aktualizuje status na `approved` (jeśli quality score > 40)

## Parametry

| Parametr | Typ | Domyślnie | Opis |
|----------|-----|-----------|------|
| `limit` | number | 50 | Max produktów do przetworzenia |
| `dryRun` | boolean | false | Tylko symulacja (nie zapisuje) |

## Response

```json
{
  "success": true,
  "job": {
    "id": "refine_1766435837331_xyz",
    "status": "completed",
    "productsProcessed": 24,
    "productsSuccessful": 24,
    "productsFailed": 0,
    "startedAt": "2025-12-22T20:37:17.331Z",
    "completedAt": "2025-12-22T20:37:18.122Z",
    "logs": [...]
  }
}
```

## Przykłady

### Przetwórz wszystkie pending (max 100)
```bash
./scripts/run-refiner.sh 100
```

### Dry run (test bez zapisywania)
```bash
TOKEN=$(node scripts/get-id-token.mjs | jq -r '.idToken')
curl -X POST https://okazjeplus.pl/api/admin/refiner/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "dryRun": true}'
```

### Scheduled job (cron)
```bash
# Codziennie o 3:00 AM
0 3 * * * cd /path/to/okazje-plus && ./scripts/run-refiner.sh 200 >> /var/log/refiner.log 2>&1
```

## Troubleshooting

**Brak pending products:**
```json
{
  "success": true,
  "job": {
    "status": "skipped",
    "message": "No pending_approval products to refine",
    "productsFound": 0
  }
}
```

**Token expired:**
Wygeneruj nowy: `node scripts/get-id-token.mjs > /tmp/token.json`

**Unauthorized:**
Sprawdź czy użytkownik ma rolę `admin` w Firestore: `users/{uid}/role`
