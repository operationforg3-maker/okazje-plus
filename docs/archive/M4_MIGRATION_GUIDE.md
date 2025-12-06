# M4 Smart Importing - Quick Migration Guide

## ⚠️ Breaking Changes & Migration

### Problem: TypeScript Errors po M4

Po implementacji M4 pojawi się ~40 błędów TypeScript w starym kodzie, który używa `product.price` jako `number`.

### Rozwiązanie: 3 opcje

#### Opcja 1: Quick Fix - Import Helper Functions (ZALECANE)

```typescript
// Zamiast:
const price = product.price; // Error: SmartPrice is not number

// Użyj:
import { getPriceAmount } from '@/lib/i18n-utils';
const price = getPriceAmount(product.price); // ✅ Works for both
```

**Wszystkie pomocnicze funkcje:**

```typescript
import { 
  getPriceAmount,      // Get base price (works for both formats)
  getTotalPrice,       // Get total with shipping
  formatPrice,         // Format as "99,99 PLN"
  isFreeShipping,      // Check if shipping is free
  getDiscountPercent   // Get discount percentage
} from '@/lib/i18n-utils';

// Example usage:
const price = getPriceAmount(product.price);           // 99.99
const total = getTotalPrice(product.price);            // 109.99
const formatted = formatPrice(product.price);          // "99,99 PLN"
const free = isFreeShipping(product.price);            // true/false
const discount = getDiscountPercent(product.price, 149.99); // 33
```

#### Opcja 2: Type Guard

```typescript
import { SmartPrice } from '@/lib/types';

function getPrice(price: SmartPrice | number): number {
  return typeof price === 'number' ? price : price.amount;
}

const amount = getPrice(product.price); // ✅ Works
```

#### Opcja 3: Migration Helper

```typescript
import { ensureSmartPrice, getDisplayPrice } from '@/lib/price-compat';

// Convert legacy product to SmartPrice
const product = ensureSmartPrice(legacyProduct);

// Get display price (handles both)
const price = getDisplayPrice(product.price); // ✅ Always number
```

---

## 🔧 Common Fixes

### Fix 1: Display Price

```typescript
// ❌ Before
<span>{product.price.toFixed(2)} PLN</span>

// ✅ After
import { getPriceAmount } from '@/lib/i18n-utils';
<span>{getPriceAmount(product.price).toFixed(2)} PLN</span>
```

### Fix 2: Price Comparison

```typescript
// ❌ Before
if (product.originalPrice > product.price) { ... }

// ✅ After
import { getPriceAmount } from '@/lib/i18n-utils';
const price = getPriceAmount(product.price);
const original = product.originalPrice ? getPriceAmount(product.originalPrice) : 0;
if (original > price) { ... }
```

### Fix 3: Price Calculation

```typescript
// ❌ Before
const discount = ((product.originalPrice - product.price) / product.originalPrice) * 100;

// ✅ After
import { getDiscountPercent } from '@/lib/i18n-utils';
const discount = getDiscountPercent(product.price, product.originalPrice);
```

### Fix 4: Formatting

```typescript
// ❌ Before
`${product.price} ${product.currency}`

// ✅ After
import { formatPrice } from '@/lib/i18n-utils';
formatPrice(product.price) // "99,99 PLN"
```

---

## 📝 Migration Checklist

### Components to Update:

- [ ] `src/components/product-card.tsx` - Display price
- [ ] `src/components/deal-card.tsx` - Price formatting
- [ ] `src/app/[locale]/products/[id]/product-detail-client.tsx` - Price calculations
- [ ] `src/components/admin/product-form.tsx` - Form price handling
- [ ] `src/components/deal-comparison-tool.tsx` - Price comparison
- [ ] `src/components/forum/attachment-card.tsx` - Price display
- [ ] `src/app/[locale]/admin/products/page.tsx` - Admin table

### Search & Replace Strategy:

```bash
# 1. Find all price usages
grep -r "product\.price" src/ | grep -v "node_modules"

# 2. Replace simple cases
# Before: product.price
# After:  getPriceAmount(product.price)

# 3. Add import at top of file
import { getPriceAmount } from '@/lib/i18n-utils';
```

---

## 🎯 Testing After Migration

### 1. Visual Testing:

```bash
npm run dev
```

Visit:
- `/pl/products` - Product grid
- `/pl/products/[id]` - Product detail page
- `/pl/admin/products` - Admin product list

**Check:**
- [ ] Prices display correctly
- [ ] Discount percentages show
- [ ] Free shipping badges appear
- [ ] Total prices (with shipping) work

### 2. TypeScript Check:

```bash
npm run typecheck
```

Should show 0 errors.

### 3. Build Test:

```bash
npm run build
```

Should complete without errors.

---

## 🚀 New Features Available

### 1. Multi-Language Content:

```typescript
import { useContentLanguage } from '@/hooks/use-content-language';

function ProductCard({ product }) {
  const { getText } = useContentLanguage();
  
  return (
    <div>
      <h3>{getText(product.title)}</h3>
      <p>{getText(product.shortDescription)}</p>
    </div>
  );
}
```

### 2. Smart Pricing:

```typescript
import { SmartPrice } from '@/lib/types';

const price: SmartPrice = {
  amount: 99.99,
  currency: 'PLN',
  shippingCost: 10.00,
  totalPrice: 109.99,
  freeShipping: false,
  discountPercent: 33,
  originalPrice: 149.99,
};
```

### 3. Smart Cart:

```typescript
import { useSmartCart } from '@/lib/cart-context';

function AddToCartButton({ product }) {
  const { addItem, isInCart } = useSmartCart();
  
  return (
    <button onClick={() => addItem(product)}>
      {isInCart(product.id) ? 'W koszyku' : 'Dodaj do listy'}
    </button>
  );
}
```

---

## 📚 API Reference

### Helper Functions:

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `getPriceAmount()` | `SmartPrice \| number` | `number` | Get base price |
| `getTotalPrice()` | `SmartPrice \| number` | `number` | Get total (with shipping) |
| `formatPrice()` | `SmartPrice \| number` | `string` | Format as currency |
| `isFreeShipping()` | `SmartPrice \| number` | `boolean` | Check free shipping |
| `getDiscountPercent()` | `SmartPrice \| number, number?` | `number?` | Get discount % |
| `createSmartPrice()` | `number, string, number?` | `SmartPrice` | Create SmartPrice |

### Types:

```typescript
import { LocalizedText, SmartPrice, Product } from '@/lib/types';
import { SupportedLanguage } from '@/lib/i18n-utils';
```

---

## ❓ FAQ

### Q: Czy muszę migrować wszystko od razu?

**A:** Nie! Helper functions działają z oboma formatami. Możesz migrować stopniowo.

### Q: Co z istniejącymi produktami w Firestore?

**A:** Zachowają kompatybilność. Dodamy migration script później:

```typescript
// scripts/migrate-products.ts (TODO)
for (const product of products) {
  const smartPrice = createSmartPrice(product.price, 'PLN');
  await updateProduct(product.id, { price: smartPrice });
}
```

### Q: Czy mogę używać starego formatu price: number?

**A:** Legacy format jest deprecated, ale nadal działa dzięki helper functions. W nowych produktach używaj SmartPrice.

### Q: Jak przetestować import bestsellers?

**A:**

```bash
# 1. Start dev server
npm run dev

# 2. Call import endpoint (wymaga auth)
curl -X POST "http://localhost:9002/api/admin/import/bestsellers?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Sprawdź logi
tail -f logs/app.log
```

---

## 🎓 Learn More

- **Full Documentation:** `docs/M4_SMART_IMPORTING.md`
- **Type Definitions:** `src/lib/types.ts`
- **Helper Functions:** `src/lib/i18n-utils.ts`
- **AI Curator:** `src/ai/flows/aliexpress/aiCurateProduct.ts`

---

## 🤝 Need Help?

1. Check TypeScript error message
2. Find similar usage in migration guide
3. Use helper functions from `@/lib/i18n-utils`
4. Test with `npm run typecheck`

**Most common error:**
```
error TS2339: Property 'toFixed' does not exist on type 'SmartPrice'
```

**Fix:**
```typescript
import { getPriceAmount } from '@/lib/i18n-utils';
getPriceAmount(product.price).toFixed(2)
```

---

**Happy Migrating! 🚀**
