# AliExpress Promotion Operations

Cel: utrzymać stabilne zbieranie i indeksowanie sygnałów promocyjnych (coupon, sale, flash, app sale) dla przyszłych importów.

## Komendy operacyjne

- Szybki smoke:
  - `npm run smoke:aliexpress-promotions`
- Monitoring z progiem alarmowym:
  - `npm run monitor:aliexpress-promotions`
- Pełny gate jakości:
  - `npm run verify:future-content`
- Backfill historyczny (dry-run):
  - `npm run backfill:aliexpress-promotions -- --only=both`
- Backfill historyczny (apply):
  - `npm run backfill:aliexpress-promotions -- --apply --only=both --page-size=300 --batch-size=300`

## Interpretacja wyników

- `status: ok` + `totalSignals > 0`:
  - pipeline działa poprawnie.
- `detailsFetched = 0` przy `status: ok`:
  - dopuszczalne; endpoint detali AliExpress bywa pusty dla części ID, ale sygnały promo nadal mogą być poprawnie wykrywane ze ścieżki search.
- `status: warning` lub `totalSignals = 0`:
  - traktuj jako alert operacyjny i sprawdź API/klucze.

## Runbook incydentu

1. Uruchom lokalnie:
   - `npm run verify:future-content`
   - `npm run smoke:aliexpress-promotions`
2. Sprawdź sekrety CI:
   - `ALIEXPRESS_APP_KEY`
   - `ALIEXPRESS_APP_SECRET`
3. Potwierdź dostępność endpointów AliExpress (search i detail).
4. Jeśli problem trwa, uruchom audyt:
   - `npm run audit:aliexpress`
5. Jeśli dotyczy historycznych rekordów, wykonaj backfill dry-run i potem apply.

## CI/Monitoring

- Build gate:
  - `.github/workflows/build-check.yml`
- Deploy gate:
  - `.github/workflows/deploy-production.yml`
- Harmonogram monitoringu:
  - `.github/workflows/aliexpress-promotion-health.yml` (co 6 godzin)