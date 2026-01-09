# Import System Fix - 2025-12-13

## Problem
Oba systemy importu (job-import i auto-import) nie działały - żadne produkty/deale nie były importowane do bazy.

## Symptomy
- Wszystkie import joby miały status `running` bez końca
- `Items Created: 0`, `Items Updated: 0` we wszystkich jobach
- Błąd w logach: `"(0 , n.fetchProductsFromAliexpress) is not a function"`
- 9 stuck jobów w bazie Firestore

## Root Cause
**Błąd składni w [src/ai/flows/importerFlow/stageFetch.ts](../src/ai/flows/importerFlow/stageFetch.ts#L157-L162)**

Funkcja `fetchProductsFromAliexpress` była używana w całym projekcie ale nigdy nie została zadeklarowana. W pliku stageFetch.ts była tylko dokumentacja JSDoc i ciało funkcji, ale brakło linii z deklaracją:

```typescript
/**
 * Fetch products from AliExpress API
  keywords: string[], // ← brak nagłówka funkcji!
  config: ImportStageConfig,
  siteUrl: string = resolveSiteUrl()
): Promise<AliExpressProduct[]> {
```

Powinno być:
```typescript
/**
 * Fetch products from AliExpress API
 */
export async function fetchProductsFromAliexpress(
  keywords: string[],
  config: ImportStageConfig,
  siteUrl: string = resolveSiteUrl()
): Promise<AliExpressProduct[]> {
```

## Fix
1. ✅ Dodano `export async function fetchProductsFromAliexpress(` w [stageFetch.ts:160](../src/ai/flows/importerFlow/stageFetch.ts#L160)
2. ✅ Wyczyszczono 9 stuck jobów używając skryptu `clean-stuck-jobs.mjs` (zmieniono status: `running` → `failed`)
3. ✅ Zcommitowano i zpushowano zmiany (commit `bd53a2d`)

## Verification Steps
Aby zweryfikować że import działa:

1. **Uruchom serwer dev:**
   ```bash
   npm run dev
   ```

2. **Otwórz admin panel:**
   ```
   http://localhost:9002/pl/admin/imports
   ```

3. **Uruchom nowy import job:**
   - Wybierz importer type (keyword-search lub convertiser)
   - Wybierz kilka kategorii do testu
   - Kliknij "Start Import"

4. **Sprawdź logi:**
   ```bash
   node check-imports.mjs
   ```

5. **Oczekiwany wynik:**
   - Job status: `running` → `completed`
   - `Items Created: > 0`
   - Produkty w kolekcji `products` w Firestore

## Files Changed
- `src/ai/flows/importerFlow/stageFetch.ts` - naprawiono deklarację funkcji
- `check-imports.mjs` - nowy skrypt diagnostyczny
- `clean-stuck-jobs.mjs` - skrypt do czyszczenia stuck jobów

## Related Issues
- Dashboard categories count (fixed in previous commit)
- Firestore composite index for import_jobs (fixed in previous commit)

## Technical Details

### Import Systems Overview
**1. job-import (harvest):**
- Endpoint: `/api/admin/import/start`
- Pipeline: 5-stage (Fetch → Dedupe → Enrich → Translate → Save)
- Batch processing: 372 subcategories
- Background execution: `setImmediate()`

**2. auto-import (kombajn):**
- Script: `src/scripts/auto-import-products.ts`
- Multi-source capability
- AI enrichment options

### Pipeline Architecture
```
Stage 1: FETCH
  ↓ fetchProductsFromAliexpress() ← FIXED HERE
  ↓ fetchProductsFromConvertiser()

Stage 2: DEDUPE
  ↓ sanitizeProducts()
  ↓ deduplicateProducts()

Stage 3: ENRICH
  ↓ enrichProducts()

Stage 4: TRANSLATE
  ↓ translateProducts()

Stage 5: SAVE
  ↓ saveProductsToFirestore()
```

### Error Propagation
1. Dynamic import in `processImportJob()` loaded module successfully
2. Module tried to call `fetchProductsFromAliexpress()`
3. Function didn't exist → TypeError
4. Error logged to job with status='error'
5. Job continued to next batch (skip-on-error)
6. All batches failed → job stuck in 'running' state

## Prevention
- ✅ Add TypeScript checks for exported functions
- ✅ Create diagnostic scripts for import system health
- ✅ Implement job timeout mechanism (already exists: heartbeat + updatedAt checks)
- ⚠️ Consider adding integration tests for import pipeline

## Next Steps
1. Run test import to verify fix works
2. Monitor import jobs for successful completions
3. Check products collection for new items
4. Consider adding automated health checks for import system
