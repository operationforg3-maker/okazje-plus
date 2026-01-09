# Price & Variant Audit Report
**Date:** 2025-12-27  
**Status:** ⚠️ CRITICAL ISSUES FOUND

## Executive Summary

### ✅ WORKING CORRECTLY
1. **Currency Conversion** - USD → PLN works perfectly via NBP API
   - Example: $21.29 USD → 85.17 PLN (rate: ~4.0)
   - All stored prices are in PLN
   - Fallback rate (4.0) if NBP API fails

2. **Price Storage** - Consistent across ProductCore and Deal
   - ProductCore.bestPrice: `{amount: 85.17, currency: "PLN"}`
   - Deal.priceV2: `{amount: 85.17, currency: "PLN"}`
   - Deal.price: `85.17` (legacy field)

### ❌ CRITICAL ISSUES

#### 1. ZERO VARIANTS COLLECTED
- **Impact:** HIGH - Users cannot select colors/sizes
- **Current State:** 0% of 50+ products have variants
- **Root Cause:** Harvester uses `searchProducts()` which returns basic product info WITHOUT variants
- **Solution Required:** Call `getProductDetails(productId)` for each product to fetch variants

```typescript
// Current flow (NO VARIANTS):
searchProducts() → basic info → ProductCore

// Required flow (WITH VARIANTS):
searchProducts() → basic info
  ↓
forEach product:
  getProductDetails(productId) → full info with variants
  ↓
ProductCore with variants
```

#### 2. bestPrice = 0 for Some Products
- **Impact:** MEDIUM - UI may show "0 PLN" for some products
- **Affected:** ~30% of products
- **Root Cause:** `updateProductBestPrice()` runs but ProductCore.bestPrice not always set
- **Workaround:** Deals have correct prices, but ProductCore.bestPrice is 0

## Technical Details

### Currency Conversion Flow
```
AliExpress API → USD price
  ↓
Harvester.fetchFromAliExpress()
  ↓
convertToPLN(sourcePrice, 'USD')
  ↓
NBP API (https://api.nbp.pl/api/exchangerates/rates/a/USD)
  ↓
PLN price stored in DB
```

### Variant Problem

**AliExpress TOP API Methods:**
- `aliexpress.affiliate.product.query` - Search products (NO variants)
- `aliexpress.affiliate.productdetail.get` - Product details (WITH variants) ❌ NOT USED

**What's Missing:**
```typescript
// src/integrations/aliexpress/client.ts has getProductDetails() defined
// BUT harvester never calls it!

async getProductDetails(params: { productId: string }) {
  // Returns full product with variants[] array
}
```

### Sample Data

**Product with 0 variants:**
```json
{
  "id": "02qd5QBdK0obmjcSndKS",
  "title": "Car Floor Mats...",
  "bestPrice": { "amount": 85.17, "currency": "PLN" },
  "variants": undefined,  // ← MISSING!
  "metadata": {
    "source": "aliexpress",
    "originalId": "1005009320030413"
  }
}
```

**Associated Deal (has price):**
```json
{
  "productCoreId": "02qd5QBdK0obmjcSndKS",
  "price": 85.17,
  "priceV2": { "amount": 85.17, "currency": "PLN" },
  "status": "pending"
}
```

## Recommendations

### Priority 1: Add Variant Fetching
```typescript
// In harvester.ts after searchProducts():
for (const product of results) {
  try {
    const details = await client.getProductDetails({
      productId: product.item_id,
      targetCurrency: 'USD'
    });
    
    if (details.variants && details.variants.length > 0) {
      product.variants = details.variants;
    }
  } catch (err) {
    // Log but don't fail - variants are optional
    this.addLog('warn', `Failed to fetch variants for ${product.item_id}`);
  }
}
```

### Priority 2: Fix bestPrice=0 Issue
```typescript
// In updateProductBestPrice(), ensure fallback:
await productRef.update({
  bestPrice: {
    amount: bestPrice !== Infinity ? bestPrice : (deals[0]?.priceV2?.amount || 0),
    currency: bestCurrency,
  },
  // ...
});
```

### Priority 3: Add Variant UI
Once variants are collected, update product detail page to show:
- Color/size selector
- Per-variant pricing
- Per-variant stock status

## Testing Plan

1. **Run one harvest with variant fetching:**
   ```bash
   # After implementing getProductDetails() calls
   npx tsx scripts/test-harvest-with-variants.ts
   ```

2. **Verify in database:**
   ```bash
   node scripts/audit-prices.mjs
   # Should show: "With variants: 80%+" instead of "0%"
   ```

3. **Check UI:**
   - Product detail page shows color/size options
   - Prices update per variant selection
   - Add to cart works with selected variant

## References

- AliExpress TOP API Docs: https://developers.aliexpress.com/en/doc.htm
- NBP API Docs: https://api.nbp.pl/
- Harvester code: `src/lib/automation/harvester.ts`
- AliExpress client: `src/integrations/aliexpress/client.ts`
