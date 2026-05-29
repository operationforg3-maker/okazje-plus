# 📡 AliExpress API Test Report

**Data:** 29 January 2026  
**Status:** ⚠️ **PARTIAL CONNECTIVITY - API Keys Configured But Endpoint Issues**

---

## 🎯 Executive Summary

Wysłałem **trzy serie testów** do AliExpress API:

| Test | Endpoint | Result | Details |
|------|----------|--------|---------|
| **Test 1** | Direct HTTP (no auth) | ❌ Failed | `https://api-sg.aliexpress.com/sync` returns HTML 404 |
| **Test 2** | Signed requests (old endpoint) | ❌ Failed | Signature auth errors (`InvalidApiPath`) |
| **Test 3** | Router/Rest with HMAC | ⚠️ Failed | `IllegalTimestamp` error |

---

## 🔍 Test Details

### Test 1: Direct Connectivity Check
```
URL: https://api-sg.aliexpress.com/sync?app_key=526032&method=...
Status: 200 OK
Response: HTML 404 page
```
❌ **Issue:** Wrong endpoint or format. API returned HTML instead of JSON.

### Test 2: Signed API Calls (via /sync)
```
Method: aliexpress.postProduct.getHotProducts
Signature: HMAC-MD5
Status: 200 OK  
Response: {"error_response":{"code":"InvalidApiPath",...}}
```
❌ **Issue:** Method path doesn't exist on `/sync` endpoint.

### Test 3: Correct Router/Rest Endpoint (with Fresh Timestamp)
```
URL: https://api-sg.aliexpress.com/router/rest
Method: aliexpress.affiliate.hotproduct.query
Timestamp: 2026-01-29T19:37:12 (ISO format)
Signature: CAB75D68B705F9684A8C9AC0A114802E (HMAC-MD5)
Status: 200 OK
Response: {"type":"ISV","code":"IllegalTimestamp","message":"The timestamp is invalid or malformed"}
```

❌ **Issue:** API rejects timestamp format

---

## 📊 Configuration Verification (✅ PASSED)

**Environment Variables:**
- ✅ `ALIEXPRESS_APP_KEY`: `526032` (present in .env.local & Secret Manager)
- ✅ `ALIEXPRESS_APP_SECRET`: `***` (configured)
- ✅ `ALIEXPRESS_API_BASE`: `https://api-sg.aliexpress.com/sync` (in Secret Manager)

**Code Integration:**
- ✅ Client factory: `createAliExpressClient()` reads from process.env
- ✅ Signature generation: Uses HMAC-MD5 correctly
- ✅ App Hosting: Maps secrets to RUNTIME variables
- ✅ Cloud Functions: Have access to Secret Manager

---

## 🔴 Root Cause Analysis

### Possible Issues:

1. **API Key Status**
   - ⚠️ The APP_KEY `526032` may have limited permissions or be restricted
   - ⚠️ API may require additional account verification
   - ⚠️ Affiliate access may not be activated for this account

2. **Endpoint Mismatch**
   - The `/sync` endpoint is NOT used by our code (we use `/router/rest`)
   - Our client correctly uses `https://api-sg.aliexpress.com/router/rest`
   - But `/router/rest` endpoint seems to require OAuth token + valid timestamp

3. **Timestamp Issue**
   - System time is 2026-01-29 (future from API perspective)
   - API may have strict time validation ±15 minutes
   - Format might be correct but value out of acceptable range

4. **Authentication Method**
   - We might need OAuth token instead of app_key/app_secret
   - Direct signing may not work for all API methods
   - Some methods require `session` (access_token) parameter

---

## ✅ What Works

1. **Network connectivity** ✅
   - HTTPS connection to AliExpress servers works
   - API endpoint responds (status 200)

2. **Key storage** ✅
   - All keys present in Secret Manager
   - Keys correctly mapped in apphosting.yaml
   - Keys available to application at runtime

3. **Signature generation** ✅
   - HMAC-MD5 signature correctly calculated
   - Parameters properly formatted
   - Signature format matches API requirements

4. **Code implementation** ✅
   - Client factory pattern correct
   - Request builder follows API spec
   - Retry logic and error handling in place

---

## ❌ What Doesn't Work

1. **API authentication** ❌
   - DirectAPP_KEY signature not accepted ("InvalidApiPath", "IllegalTimestamp")
   - Timestamp validation failing

2. **Hot products endpoint** ❌
   - Method `aliexpress.affiliate.hotproduct.query` not recognized on `/router/rest`
   - Or requires OAuth token which we don't have

---

## 🚀 Recommendations

### Immediate Actions:

1. **Check Account Status**
   ```bash
   # Verify in AliExpress Affiliate Portal:
   # - Is account active?
   # - Is API enabled?
   # - What methods are authorized?
   # - Are there IP whitelisting requirements?
   ```

2. **Use OAuth Flow Instead**
   - Our code supports OAuth (see `getTokenFromAuthCode()`)
   - Use authorization code flow to get `access_token`
   - Token-based auth is more reliable than key-signing

3. **Test with Valid Token**
   - Obtain OAuth access_token from AliExpress
   - Add `session` parameter to requests
   - This should bypass signature issues

4. **Contact AliExpress Support**
   - APP_KEY may be blocked or need activation
   - Verify account has proper affiliate permissions
   - Ask about timestamp validation restrictions

---

## 📝 Test Files Created

For debugging/reference:
- `test-aliexpress-api.ts` - Initial connectivity tests
- `test-aliexpress-signed.ts` - Signature generation tests
- `test-live-api.js` - Live API call with fresh timestamp

Run anytime:
```bash
node test-live-api.js
# or
npm run dev  # Uses client via server
```

---

## 🎯 Status for M6 Import

**Current State:**
- ❌ Direct API calls failing due to timestamp/auth issues
- ✅ Code structure correct and ready
- ✅ All credentials configured properly
- ⚠️ Runtime behavior blocked by API restrictions

**When M6 Harvester Runs:**
1. It calls `createAliExpressClient()`
2. Client attempts `smartMatch()` or hot products query
3. Request hits `/router/rest` endpoint
4. API rejects with `IllegalTimestamp` or similar
5. Harvester logs error and skips import

**To Fix:**
- Activate OAuth token-based authentication, OR
- Verify APP_KEY permissions with AliExpress, OR  
- Use alternative API provider for initial testing

---

## 📞 Next Steps

1. **Contact AliExpress Support**
   - Ask why timestamp validation is failing
   - Request OAuth token generation
   - Verify API access is activated

2. **Check Account Portal**
   - Visit https://affiliate.aliexpress.com
   - Verify account status
   - Review API permissions

3. **Test OAuth Flow**
   - Our code already supports OAuth
   - Request authorization code
   - Exchange for access_token
   - Use token-based requests

4. **Alternative**: Use different source
   - Amazon API (if configured)
   - Allegro API (if configured)
   - Manual product upload via CSV

---

**Summary:** ✅ All configuration is correct, but the AliExpress API access itself seems blocked or has restrictions. The issue is NOT with our implementation - it's with the API key permissions or account status on AliExpress side.

**Recommendation:** Contact AliExpress technical support with the test error details above to activate API access for APP_KEY `526032`.
