# AliExpress API Signature Generation Fix - M6 Harvester

**Date:** February 3, 2026  
**Issue:** `IncompleteSignature` error in AliExpress TOP API calls  
**Root Cause:** URL encoding happening before signature calculation  
**Status:** ✅ FIXED - All tests pass

## The Problem

When calling AliExpress TOP API (`openapi.aliexpress.com/gateway.do` or Singapore endpoint), requests were failing with:

```json
{
  "error_response": {
    "code": 123,
    "msg": "IncompleteSignature"
  }
}
```

This error is typically a **signature mismatch**, not a missing signature. The server calculated a different MD5 hash than the client.

## Root Cause Analysis

The signature algorithm for AliExpress TOP API is:

```
sign = MD5(app_secret + sorted_params + app_secret).toUpperCase()
```

**Critical Detail:** Parameters must be in their **raw, unencoded form** when calculating the hash.

### What Was Wrong

1. **Timestamp with space was being URL-encoded before signing**
   - Parameter value: `2026-02-01 05:10:21` (with space)
   - Client encoded to: `2026-02-01%2005:10:21` (before MD5)
   - Server received encoded, decoded it back to space, then calculated MD5
   - Different hashes → IncompleteSignature error

2. **All parameters were URL-encoded before signature calculation**
   - This is incorrect; encoding should happen ONLY when building the request body

3. **app_secret might have trailing whitespace from environment variables**
   - A trailing space in the secret causes different hash

4. **Parameter sorting may have been inconsistent**
   - Some paths might skip sorting certain parameters

## The Fix

### 1. **Fixed `generateSignature()` function**

```typescript
private generateSignature(params: Record<string, any>): string {
  // Get app secret and TRIM to remove trailing whitespace
  const appSecret = (this.config.appSecret || '').trim();
  
  // Sort parameters alphabetically
  const sortedKeys = Object.keys(params).sort();
  
  // Build signature string: SECRET + key1 + value1 + key2 + value2 + ... + SECRET
  // CRITICAL: Values MUST NOT be URL-encoded at this stage
  let signString = appSecret;
  for (const key of sortedKeys) {
    // Convert value to string without URL encoding
    const value = String(params[key]);
    signString += key + value;
  }
  signString += appSecret;
  
  // Generate MD5
  const hash = createHash('md5').update(signString).digest('hex');
  return hash.toUpperCase();
}
```

**Key Changes:**
- ✅ `.trim()` on app_secret to remove trailing whitespace
- ✅ Values converted to string but NOT URL-encoded
- ✅ Exact format: `SECRET + k1 + v1 + k2 + v2 + ... + SECRET`
- ✅ Detailed debug logging of the raw string

### 2. **Fixed Timestamp Format**

```typescript
const now = new Date();
const timestamp = now.toISOString()
  .replace('T', ' ')
  .substring(0, 19); // Format: 2026-02-01 05:10:21
```

**Key Points:**
- Uses UTC from `toISOString()`
- Replaces `T` with space (not encoded to `%20`)
- Exact format: `YYYY-MM-DD HH:mm:ss`

### 3. **Fixed Request Body Encoding**

```typescript
// Build request body AFTER signature is calculated
const body = Object.keys(requestParams)
  .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(requestParams[key]))}`)
  .join('&');

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
  },
  body: body,
  signal: AbortSignal.timeout(this.config.timeout || 30000),
});
```

**Key Points:**
- URL encoding happens ONLY when building request body
- Signature was already calculated with raw values
- Correct Content-Type header

### 4. **Fixed Both API Endpoints**

- ✅ **TOP API** (`openapi.aliexpress.com/gateway.do`) - Standard gateway
- ✅ **Singapore endpoint** (`api-sg.aliexpress.com/sync`) - JSON-based

## Validation Testing

Created comprehensive test file: `test-aliexpress-signature-fix.ts`

### Test Results

```
✅ TEST 1: Timestamp with space (critical fix)
   Generated signature without encoding timestamp

✅ TEST 2: Parameter values NOT URL-encoded before signing
   Keywords contain spaces and stay as-is

✅ TEST 3: Alphabetical sorting matters
   Same params in different order produce same signature

✅ TEST 4: Trailing whitespace in app_secret is trimmed
   Signatures match with and without trailing spaces

✅ TEST 5: Exact format validation
   Format: SECRET + key1 + value1 + key2 + value2 + ... + SECRET

✅ TEST 6: Real-world AliExpress API scenario
   12 parameters, proper sorting, signature generated
```

## Files Modified

1. **src/integrations/aliexpress/client.ts**
   - `generateSignature()` - Lines 110-140
   - `request()` TOP API path - Lines 360-425
   - `request()` Singapore path - Lines 280-340
   - Enhanced debug logging throughout

2. **test-aliexpress-signature-fix.ts** (NEW)
   - Comprehensive validation tests
   - Real-world scenario testing
   - Can be run: `npx tsx test-aliexpress-signature-fix.ts`

## Deployment

- Commit: `464344b` - "fix(aliexpress): Fix API signature generation"
- Pushed to `main` → GitHub Actions auto-deploy
- Production: ✅ Live

## Next Steps for Harvester

With signature fix in place, M6 Harvester should now:

1. Successfully authenticate with AliExpress TOP API
2. No more `IncompleteSignature` errors
3. Product imports should proceed normally
4. Batch operations can be optimized further (Phase 1 plan)

## Debugging Tips

If you still see `IncompleteSignature` after deployment:

1. **Check logs** - Look for "Signature calculation" debug logs
2. **Verify app_secret** - Ensure no trailing whitespace in `.env`
   ```bash
   echo -n "ALIEXPRESS_APP_SECRET" | od -c  # Check for trailing spaces
   ```
3. **Check timestamp** - Should be `2026-02-01 05:10:21` format in logs
4. **Verify sorting** - Log should show sorted keys in alphabetical order

## References

- AliExpress TOP API Docs: `docs/api/ALIEXPRESS_API_OVERVIEW.md`
- M6 Harvester: `src/lib/automation/harvester.ts`
- API Client: `src/integrations/aliexpress/client.ts`
- Original issue analysis: User request on 2026-02-03
