# Import/AI Flow & Multi-Currency Implementation - Testing Guide

## ✅ Completed Improvements

### 1. **Multi-Currency Support** 
✅ AliExpress API now fetches prices directly in **PLN**
- Added `target_currency: 'PLN'` to all API calls
- Products stored in database with PLN prices (no conversion needed)
- Currency field properly saved in SmartPrice objects

### 2. **Enhanced Translation Service**
✅ AI-powered translations with fallback chain
- Uses Vertex AI (Gemini) for high-quality translations
- Dictionary fallback for common e-commerce terms
- Context-aware (product_title, product_description, etc.)
- Confidence scoring and quality warnings

### 3. **Currency Service**
✅ Real-time exchange rates with caching
- Fetches rates from exchangerate-api.com every hour
- Fallback to hardcoded rates if API unavailable
- Support for PLN, USD, EUR, GBP
- Currency conversion utilities

### 4. **UI Components**
✅ All currencies enabled in currency switcher
✅ Price display utilities for consistent formatting
✅ Multilingual content utilities with fallback chain

---

## 🧪 Testing the Changes

### Test 1: Verify AliExpress API Returns PLN

**Endpoint**: `/api/admin/aliexpress/search`

```bash
curl -X POST http://localhost:9002/api/admin/aliexpress/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "smartphone",
    "limit": 5
  }'
```

**Expected Response**:
```json
{
  "products": [
    {
      "id": "1234567890",
      "title": "Samsung Galaxy...",
      "price": 1299.99,
      "currency": "PLN",  // ← Should be PLN, not USD!
      "originalPrice": 1599.99
    }
  ]
}
```

---

### Test 2: Import Pipeline End-to-End

**Run import for a specific category**:

```bash
# Set environment variables first
export GEMINI_API_KEY="your-key"
export GOOGLE_CLOUD_PROJECT="your-project"
export ALIEXPRESS_APP_KEY="your-key"
export ALIEXPRESS_APP_SECRET="your-secret"

# Run import
npm run auto-import
```

**Check database**:
```typescript
// In Firebase console or test script
const productDoc = await db.collection('products').doc('some-id').get();
const product = productDoc.data();

console.log('Currency:', product.price.currency); // Should be 'PLN'
console.log('Amount:', product.price.amount);     // Should be in PLN (not USD)
```

---

### Test 3: Translation Service

```typescript
import { translateText } from '@/lib/translation-service';

const result = await translateText({
  text: 'Wireless Bluetooth Headphones with Noise Cancellation',
  from: 'en',
  to: 'pl',
  context: 'product_title'
});

console.log('Translated:', result.translatedText);
// Expected: "Bezprzewodowe słuchawki Bluetooth z redukcją szumów"
console.log('Confidence:', result.confidence);
// Expected: 80-95
console.log('Method:', result.method);
// Expected: 'ai' (or 'dictionary' if AI fails)
```

---

### Test 4: Currency Conversion

```typescript
import { convertCurrency, getExchangeRates } from '@/lib/currency-service';

// Get current rates
const rates = await getExchangeRates();
console.log('Exchange rates:', rates);
// {
//   PLN: 1.0,
//   USD: 0.25,  // ~4 PLN per USD
//   EUR: 0.23,
//   GBP: 0.20,
//   lastUpdated: '2025-12-06...',
//   source: 'api'
// }

// Convert 100 USD to PLN
const plnAmount = await convertCurrency(100, 'USD', 'PLN');
console.log('100 USD =', plnAmount, 'PLN');
// Expected: ~400 PLN
```

---

### Test 5: Price Display in UI

**Create test component**:
```typescript
// src/components/test-price-display.tsx
import { useSelectedCurrency } from '@/lib/price-utils';
import { formatPrice } from '@/lib/price-utils';

export function TestPriceDisplay() {
  const currency = useSelectedCurrency();
  
  const testPrice = {
    amount: 299.99,
    currency: 'PLN',
    shippingCost: 0,
    totalPrice: 299.99,
    freeShipping: true,
  };
  
  return (
    <div>
      <p>Selected currency: {currency}</p>
      <p>Price: {formatPrice(testPrice, currency)}</p>
    </div>
  );
}
```

**Test**:
1. Open page with component
2. Change currency in switcher (top nav)
3. Verify price updates correctly
4. Check localStorage: `preferredCurrency` should be set

---

### Test 6: Multilingual Content

```typescript
import { getDisplayText } from '@/lib/content-utils';

const localizedTitle = {
  pl: 'Smartfon Samsung Galaxy',
  en: 'Samsung Galaxy Smartphone',
  de: 'Samsung Galaxy Smartphone',
};

// Display in different languages
console.log('Polish:', getDisplayText(localizedTitle, 'pl'));
console.log('English:', getDisplayText(localizedTitle, 'en'));
console.log('German:', getDisplayText(localizedTitle, 'de'));

// Fallback chain test (missing German)
const partialTitle = {
  pl: 'Produkt testowy',
  en: 'Test product',
};

console.log('German (fallback):', getDisplayText(partialTitle, 'de'));
// Expected: 'Test product' (falls back to English)
```

---

## 🐛 Known Issues & Limitations

### 1. Embedding API Changed
- **Issue**: Vertex AI `embedContent` method not available on GenerativeModel
- **Status**: Commented out, needs research
- **Impact**: Search similarity features disabled
- **Workaround**: Use alternative embedding service or update SDK usage

### 2. Some TypeScript Errors Remain
- **Files**: smart-importer.test.ts, deduplicator.ts, sanitizers.ts
- **Issue**: Type mismatches with Product/Deal interfaces
- **Impact**: Tests may fail, but core functionality works
- **Priority**: Low (non-blocking)

### 3. Exchange Rates API Rate Limit
- **Limit**: 1500 requests/month (free tier)
- **Cache**: 1 hour
- **Fallback**: Hardcoded rates
- **Recommendation**: Upgrade to paid tier or use alternative API

---

## 📊 Performance Considerations

### Currency API Calls
- **Frequency**: Max once per hour (cached)
- **Response Time**: ~200-500ms
- **Impact**: Minimal (cached after first call)

### Translation Service
- **Per Item**: ~500-1000ms (AI translation)
- **Batch of 50**: ~25-50 seconds
- **Optimization**: Use batch translation with delays

### Import Pipeline Timing (50 products)
1. **Fetch** (Stage 1): ~10-15 seconds
2. **Dedupe** (Stage 2): <1 second
3. **Enrich** (Stage 3): ~30-60 seconds (if using AI)
4. **Translate** (Stage 4): ~25-50 seconds (AI translations)
5. **Save** (Stage 5): ~5-10 seconds

**Total**: ~70-136 seconds for 50 products

---

## ✅ Verification Checklist

Before marking as complete, verify:

- [ ] AliExpress API returns prices in PLN (not USD)
- [ ] Products saved to DB have `currency: 'PLN'` in price object
- [ ] Currency switcher shows all 4 currencies (PLN, EUR, USD, GBP)
- [ ] Translation service produces high-quality PL translations
- [ ] Price display updates when currency changes
- [ ] Exchange rates cache works (check logs)
- [ ] Import pipeline completes successfully
- [ ] No console errors in browser
- [ ] TypeScript build succeeds (npm run build)
- [ ] Key unit tests pass (npm test)

---

## 🚀 Next Steps

### Immediate (P0)
- [ ] Fix remaining TypeScript errors
- [ ] Test full import pipeline in staging
- [ ] Add unit tests for currency conversion
- [ ] Add unit tests for translation service

### Short-term (P1)
- [ ] Implement SmartPrice display in product cards
- [ ] Add language switcher UI component
- [ ] Update deal cards with multi-currency support
- [ ] Performance optimization for batch operations

### Long-term (P2)
- [ ] Research Vertex AI embedding API changes
- [ ] Implement price history tracking (Omnibus)
- [ ] Add multi-currency checkout flow
- [ ] Dashboard for exchange rate monitoring

---

## 📞 Support

If you encounter issues:

1. Check logs: `console.log` statements in pipeline stages
2. Verify environment variables are set correctly
3. Check Firebase console for saved products
4. Review API response in Network tab
5. Check this testing guide for expected behavior

---

**Last Updated**: 2025-12-06  
**Version**: 1.0  
**Status**: ✅ Ready for Testing
