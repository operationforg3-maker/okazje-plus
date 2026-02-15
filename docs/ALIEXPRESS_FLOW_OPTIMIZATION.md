# AliExpress Harvester Flow Optimization Plan

**Created:** Feb 12, 2026  
**Goal:** Perfect the AliExpress import flow with better enrichment and efficiency

## Current Flow Analysis

### What Works ✅
- API authentication OK (OAuth fallback to signature auth)
- Search products by keyword (sorted by volume/rating)
- Basic detail fetching for top 10 products
- Price conversion to PLN
- Multi-currency support
- Shipping estimation
- Rating extraction

### Identified Issues 🔴

#### 1. **Sequential Detail Fetching (Performance)**
- Currently fetches top 10 products sequentially with `Promise.all()`
- But only enriches first 10 from potentially 50 results
- Could batch-fetch 20-30 products for better coverage
- Details API should support batch requests or parallel execution

**Impact:** 100 products = 8-12 min (partially due to this)

#### 2. **Incomplete Specs Extraction**
- Extracts dimensions from title only (`extractDimensionsFromTitle()`)
- Ignores `product_props` field completely
- Misses RAM, Storage, Screen, Battery data
- Misses materials, colors, compatibility info

**Impact:** Poor product search & filtering on frontend

#### 3. **SKU/Variant Data Underutilized**
- Fetches `sku_list` but only extracts price from first variant
- Ignores minimum/maximum variant prices (real price range)
- Never looks at variant dimensions/specs
- Loses color/size availability info

**Impact:** Users see single price, miss deals on specific variants

#### 4. **Product Properties Not Parsed**
- `product_props` field contains structured attributes
- Could be HTML string OR array of `{attr_name, attr_value}`
- Need robust parser for both formats
- Extract standard props: Memory, Storage, Color, Brand, Weight, Dimensions

**Impact:** Loses valuable search facets

#### 5. **Shipping Info Discrepancy**
- Uses `ship_to_days` from search (often just `0` or empty)
- Alternative: call `getLogisticsInfo()` for accurate shipping
- Currently not used in harvester flow
- Calling it adds 1-2s per product but data quality improves

**Impact:** Users see inaccurate delivery estimates

#### 6. **Description Not Leveraged**
- Fetches `product_description` (raw HTML)
- Passed to RawProduct but...
- Refiner expects clean "text" description, not HTML
- Need HTML-to-text conversion OR pass as rich content

**Impact:** Refiner can't use description for AI enrichment

#### 7. **No Inventory/Availability Check**
- Ignores `sku_available_quantity`
- Some variants may be out of stock
- Should track minimum available qty across variants

**Impact:** Users may click products that are OOS

#### 8. **Gallery Handling Messy**
- Multiple image fields: `product_main_image_url`, `product_small_image_urls`, `all_images`, `second_level_image_url`, `first_level_image_url`
- Deduplication logic present but could be improved
- Video URL often lost

**Impact:** Gallery quality inconsistent

---

## Optimization Plan

### Phase 1: Quick Wins (No API Changes)

#### 1A: Improve Specs Extraction
**File:** `src/lib/automation/harvester.ts` → `fetchFromAliExpress()`

**Change:**
```typescript
// Before: specs from title only
specs: extractDimensionsFromTitle(p.title || p.product_title || '')

// After: title + properties + SKU
specs: {
  ...extractDimensionsFromTitle(p.title || ''),
  ...extractPropsFromProductProps(p.product_props),
  ...extractSpecsFromFirstSKU(p.sku_list?.[0]),
}
```

**Add function:** `extractPropsFromProductProps(props)`
```typescript
function extractPropsFromProductProps(props: any): Record<string, string> {
  const specs: Record<string, string> = {};
  
  if (!props) return specs;
  
  // Props can be: array of {attr_name, attr_value} OR JSON string
  let propsArray: any[] = [];
  if (Array.isArray(props)) {
    propsArray = props;
  } else if (typeof props === 'string') {
    try {
      const parsed = JSON.parse(props);
      propsArray = Array.isArray(parsed) ? parsed : [];
    } catch {
      return specs;
    }
  }
  
  // Map common attribute names to standard keys
  const standardKeys: Record<string, string[]> = {
    'memory': ['memory', 'ram', 'memorystyle', 'memory size'],
    'storage': ['storage', 'storage capacity', 'hard disk'],
    'color': ['color', 'colours', 'color classification'],
    'brand': ['brand', 'brand name'],
    'screen': ['screen', 'screen size', 'display size', 'screen type'],
    'battery': ['battery', 'battery capacity'],
    'processor': ['cpu', 'processor', 'processor type'],
    'os': ['operating system', 'os', 'system type'],
    'weight': ['weight', 'item weight'],
    'material': ['material', 'material type'],
  };
  
  // Extract and normalize
  propsArray.forEach(prop => {
    const name = String(prop.attr_name || '').toLowerCase().trim();
    const value = String(prop.attr_value || '').trim();
    
    if (!name || !value) return;
    
    for (const [standardKey, aliases] of Object.entries(standardKeys)) {
      if (aliases.some(alias => name.includes(alias))) {
        specs[standardKey] = value;
        break;
      }
    }
  });
  
  return specs;
}
```

#### 1B: Calculate Real Price Range from SKUs
**File:** Same as above

**Change:**
```typescript
// Before: just min price from any variant
price: skuMin > 0 ? skuMin : rawPrice

// After: track min AND max
const skuPrices = (p.sku_list || [])
  .map(s => parsePriceNumber(s.sku_sale_price || s.sku_price || s.offer_price || ''))
  .filter(p => p > 0);

const skuMin = skuPrices.length > 0 ? Math.min(...skuPrices) : 0;
const skuMax = skuPrices.length > 0 ? Math.max(...skuPrices) : 0;

// Store in specs for frontend
if (skuMin > 0 && skuMax > skuMin) {
  specs.priceRange = `${skuMin}-${skuMax} PLN`;
}
```

#### 1C: HTML-to-Text for Description
**File:** Same as above

**Add:**
```typescript
import { convert } from 'html-to-text';

const cleanDescription = p.product_description
  ? convert(p.product_description, {
      wordwrap: false,
      selectors: [
        { selector: 'img', options: { ignoreHref: true } },
        { selector: 'script', options: { ignoreHref: true } },
      ],
    }).substring(0, 500)
  : '';

return {
  ...
  description: cleanDescription || '',
  ...
}
```

#### 1D: Improve Image Gallery
**File:** Same as above

**Change:**
```typescript
// Consolidate from multiple fields
const imageUrls = new Set<string>();

// Primary
if (p.product_main_image_url) imageUrls.add(p.product_main_image_url);

// Gallery arrays
[p.product_small_image_urls, p.all_images]
  .filter(Array.isArray)
  .forEach(arr => arr.forEach((url: string) => imageUrls.add(url)));

// Secondary
[p.second_level_image_url, p.first_level_image_url]
  .filter(Boolean)
  .forEach((url: string) => imageUrls.add(url));

// Remove invalid URLs
const validImages = Array.from(imageUrls)
  .filter(url => url && url.startsWith('http'))
  .slice(0, 15); // Limit to 15 images

return {
  ...
  images: validImages,
  imageUrl: validImages[0] || '',
  ...
}
```

#### 1E: Track Minimum Available Quantity
**File:** Same as above

```typescript
const minAvailability = p.sku_list
  ? Math.min(...p.sku_list
      .map(s => parseInt(s.sku_available_quantity || '0'))
      .filter(q => q > 0))
  : undefined;

return {
  ...
  // In specs or as separate field
  offerMeta: {
    ...offerMeta,
    minimumAvailableQuantity: minAvailability || undefined,
  }
  ...
}
```

---

### Phase 2: Refiner Integration (Optional)

#### 2A: Pass Rich Description to Refiner
**File:** `src/lib/automation/refiner.ts`

Currently refiner receives just `description` field. Enhancement:
```typescript
// Accept optional richDescription field
interface ProductCore {
  description: string; // Clean text
  richDescription?: string; // Raw HTML for deeper analysis
}

// In flow:
if (richDescription) {
  // Let Gemini analyze HTML for additional context
  // Could extract tables, lists, structured data
}
```

#### 2B: Use Specs for Structure Data
**File:** Refiner AI flow

```typescript
// More targeted spec extraction by Gemini
// Input: product_props + sku_list
// Output: normalized specs matching our schema
```

---

### Phase 3: Performance (Batch Detail Fetching)

**Problem:** Sequential fetching of 10 products is slow.

**Solution:**
```typescript
// Increase batch size
const productsToEnrich = response.products.slice(0, 20); // Was 10

// Batch in groups of 3-5 (API throttling)
const batchSize = 5;
const batches = [];
for (let i = 0; i < productsToEnrich.length; i += batchSize) {
  batches.push(productsToEnrich.slice(i, i + batchSize));
}

const detailedProducts = [];
for (const batch of batches) {
  const results = await Promise.all(
    batch.map(p => 
      client.getProductDetails({ 
        productId: String(p.item_id || p.product_id || ''),
        targetCurrency: 'PLN',
        targetLanguage: 'PL',
      }).catch(() => p) // Fallback to basic info
    )
  );
  detailedProducts.push(...results);
  await new Promise(r => setTimeout(r, 500)); // Rate limit between batches
}
```

---

## Testing Strategy

### Test 1: Run Local Flow Test
```bash
npx tsx src/lib/automation/tests/aliexpress-flow-test.ts
```

**Validates:**
- API connectivity
- Search response structure
- Detail fetch success
- Logistics available
- Data transformation complete

### Test 2: Create Quick Test Button
Already added in M6 dashboard:
```tsx
<button onClick={() => runHarvesterTest({ 
  source: 'aliexpress', 
  query: 'laptop', 
  maxResults: 5 
})}>
  AliExpress Quick Test (5)
</button>
```

**Monitors:**
- Import job status
- Number of products created
- Number of duplicates detected
- Specs extracted per product
- Data quality score

### Test 3: Validate Refiner Input
Once harvester improves, run refiner on sample:
```bash
Button: "Refiner Quick Test (Specs only)" → 5 products
# Check if specs are extracted better
# Check if description quality improved
```

---

## Rollout Order

1. ✅ **Local test** - Run flow diagnostics
2. ⏳ **Phase 1A** - Implement `extractPropsFromProductProps()`
3. ⏳ **Phase 1B** - Add SKU price range calculation
4. ⏳ **Phase 1C** - HTML-to-text for descriptions
5. ⏳ **Phase 1D** - Consolidate image gallery
6. ⏳ **Phase 1E** - Track availability
7. ⏳ **Test** - Run quick test buttons
8. ⏳ **Phase 2** - Optional refiner enhancements
9. ⏳ **Phase 3** - Batch detail fetching (if Phase 1-2 still slow)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Specs per product | ~3 fields | ~8+ fields |
| Description length | 0-200 chars | 300+ chars |
| Image count | 1-5 | 5-15 |
| SKUs per product | Listed but unused | Used in price range |
| Import time (100 items) | 8-12 min | 2-3 min |
| Search quality | Basic | Better for filtering |

---

## Notes

- **Backward compatible:** All improvements maintain `RawProduct` interface
- **Non-breaking:** Can be added incrementally
- **Safe:** Fallback to existing behavior if new fields missing
- **Radio-ally useful:** Each optimization independently improves UX
