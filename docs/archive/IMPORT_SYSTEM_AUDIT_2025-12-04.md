# 🔍 Audit: Import System AI Usage & Frontend i18n/Currency Ready (4 Dec 2025)

## 📊 Executive Summary

✅ **Frontend JEST gotowy** na wielojęzyczność (pl/en/de) i waluty (USD/PLN/EUR)
✅ **Import system ma AI**, ale **tylko w Stage 3 (Enrich)** - brakuje w translation
⚠️ **Translation Stage 4 używa hardcoded dictionary** zamiast AI/Genkit
❌ **Brakuje integracji z Genkit flows** do translacji

---

## 1️⃣ AI Usage in Import Flow

### Stage 3: ENRICH ✅ (AI ACTIVE)

```typescript
// src/ai/flows/importerFlow/stageEnrich.ts
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';

// PER ITEM AI CALL: 300ms delay between items to avoid rate limits
titleNormalizedEN = await aiNormalizeTitlePL({ rawTitle: product.title });
```

**Detale:**
- **Batch size**: 5 items
- **Delay between items**: 300ms (AI rate limiting)
- **Delay between batches**: 2000ms
- **Co robi**: AI normalizuje tytuły z AliExpress (usuwa spam jak "HOT SALE 2025!!!")
- **Problem**: Funkcja się nazywa `aiNormalizeTitlePL` ale normalizuje do ENGLISH
  - Nazwa jest myląca - powinno być `aiNormalizeTitleEN`

### Stage 4: TRANSLATE ❌ (NO AI - DICTIONARY ONLY)

```typescript
// src/ai/flows/importerFlow/stageTranslate.ts - PROBLEM!
if (finalConfig.targetLanguage === 'pl') {
  product.titlePL = translateTitleToPolish(product.titleNormalizedEN);  // ← DICTIONARY
  product.descriptionPL = translateDescriptionToPolish(product.descriptionEN); // ← DICTIONARY
}

// Hardcoded dictionary mappings:
function translateTitleToPolish(titleEN: string): string {
  const dict = {
    'smartphone': 'smartfon',
    'headphones': 'słuchawki',
    // ~20 more mappings...
  };
  
  let result = titleEN;
  for (const [en, pl] of Object.entries(dict)) {
    result = result.replaceAll(en, pl);
  }
  return result;
}
```

**Problem:**
- ❌ Tłumaczenie to TYLKO простой find-replace
- ❌ Brakuje AI Genkit flows dla translacji
- ❌ Nie obsługuje compound words, kontekstu, gramatyki
- ❌ Dla produktów "Samsung Galaxy A55 5G smartphone 256GB" → bym tylko zmienił "smartphone" na "smartfon"
  - Idealnie: "Samsung Galaxy A55 5G smartfon 256GB" (kompletna i naturalna PL)

**Result:**
- ✅ Works for simple cases
- ❌ Poor for complex technical titles
- ❌ Missing semantic understanding

---

## 2️⃣ Frontend i18n Support ✅

### Multi-Language System (READY)

**Languages supported:** pl, en, de
**Default:** pl

#### Routing
```typescript
// src/i18n/routing.ts
locales: ['pl', 'en', 'de']
defaultLocale: 'pl'
localePrefix: 'always' // Always show /pl, /en, /de in URL
```

#### LocalizedText Type (M4 Standard)
```typescript
export interface LocalizedText {
  pl: string;  // Polish (required)
  en: string;  // English (required)
  de?: string; // German (optional)
  fr?: string; // French (optional)
  es?: string; // Spanish (optional)
}
```

#### Content Detection
```typescript
// src/hooks/use-content-language.ts
export function useContentLanguage() {
  const getText = (text: LocalizedText | string | undefined): string => {
    // Priority: requested lang → English → Polish
    return getLocalizedText(text, language);
  };
}
```

**Features:**
- ✅ Fallback chain: pl → en → de
- ✅ Browser language detection
- ✅ localStorage preference persistence
- ✅ Backward compatible with legacy string fields

### Product Card Usage
```tsx
// src/components/product-card.tsx
const displayTitle = getText(product.title) || product.name;
const displayDesc = getText(product.shortDescription);

// Multi-language text working:
const itemPrice = getPriceAmount(product.price);
const shippingCost = product.price.shippingCost || 0;
const totalPrice = getTotalPrice(product.price);
```

---

## 3️⃣ Currency Support ✅

### SmartPrice Type (M4 Standard)
```typescript
export interface SmartPrice {
  amount: number;               // Base price
  currency: string;              // PLN, USD, EUR
  shippingCost: number;         // Separate
  totalPrice: number;            // amount + shippingCost (displayed)
  originalPrice?: number;        // For omnibus directive
  discountPercent?: number;      // Auto-calculated
  freeShipping?: boolean;
  lastUpdated?: string;          // ISO timestamp
}
```

### Currency Context
```typescript
// src/context/currency-context.tsx
type Currency = 'USD' | 'PLN' | 'EUR';

exchangeRates: {
  USD: 1.0,
  PLN: 4.0,      // 1 USD = 4 PLN
  EUR: 0.92,     // 1 USD = 0.92 EUR
}

formatPrice(100, 'USD') → "100,00 USD"
formatPrice(100, 'PLN') → "400,00 PLN"
```

**Features:**
- ✅ Intl.NumberFormat for locale-specific formatting
- ✅ USD base, convert to PLN/EUR
- ✅ Correct decimal separators (pl-PL, de-DE, en-US)
- ✅ Product card uses `getTotalPrice()` (item + shipping)

---

## 🚨 Problems Found

### 1. Translation Stage Uses Dictionary, Not AI ❌

**Issue**: Stage 4 (Translate) is hardcoded dictionary-based, not AI-powered

**Current Code (WRONG):**
```typescript
function translateTitleToPolish(titleEN: string): string {
  const dict = {
    'smartphone': 'smartfon',
    'headphones': 'słuchawki',
    'laptop': 'laptop', // Falls back to EN
    // Only ~20 mappings
  };
  
  let result = titleEN;
  for (const [en, pl] of Object.entries(dict)) {
    result = result.replaceAll(en, pl);
  }
  return result;
}
```

**Example Failure:**
- Input EN: `"POCO X6 Pro 5G smartphone 12GB RAM 256GB storage black"`
- Dictionary result: `"POCO X6 Pro 5G smartfon 12GB RAM 256GB storage black"` (bad)
- Needed PL: `"POCO X6 Pro 5G smartfon 12GB RAM 256GB czarny"` (nie wspomina "storage" po PL, lepszy layout)

**Fix**: Use Genkit flows for AI translation

```typescript
// SHOULD BE:
import { aiTranslateTitleToPL } from '@/ai/flows/translation/aiTranslateTitleToPL';

titlePL = await aiTranslateTitleToPL({
  titleEN: product.titleNormalizedEN,
  categoryEN: product.categorySlugEN,
  context: 'product_title'
});
```

---

### 2. Naming Inconsistency: `aiNormalizeTitlePL` ❌

**Current (WRONG NAME):**
```typescript
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';

// But it returns ENGLISH!
titleNormalizedEN = await aiNormalizeTitlePL({ rawTitle: product.title });
```

**Should be:**
```typescript
import { aiNormalizeTitleEN } from '@/ai/flows/aliexpress/aiNormalizeTitleEN';
titleNormalizedEN = await aiNormalizeTitleEN({ rawTitle: product.title });
```

---

### 3. Exchange Rates Hardcoded ⚠️

**Current (HARDCODED):**
```typescript
const exchangeRates = {
  USD: 1.0,
  PLN: 4.0,      // Fixed
  EUR: 0.92,     // Fixed
};
```

**Problem**: Exchange rates change daily
- 1 USD ≈ 4.0-4.2 PLN (fluctuates)
- Should be fetched from config or API

**Better Approach:**
```typescript
// In Firestore config/importSettings document
{
  currencyRate: 4.15,  // Updated daily
  lastUpdated: "2025-12-04T10:00:00Z"
}
```

---

## ✅ What's Working

### Frontend i18n ✅
- ✅ 3 languages (pl/en/de)
- ✅ Automatic language detection
- ✅ Fallback chain working
- ✅ LocalizedText extraction with `getText()`
- ✅ Product card uses correct language

### Frontend Currency ✅
- ✅ SmartPrice model with separate shipping
- ✅ Currency detection
- ✅ Locale-specific formatting
- ✅ Total landed cost display

### Backend Import ✅
- ✅ Stage 3 (Enrich) uses AI for title normalization
- ✅ Stages 1-5 complete
- ✅ Configurable delays to prevent 504
- ✅ Batch processing optimized

---

## 📋 Recommendations

### Priority 1: Fix Translation Stage (HIGH) 🔴
**Effort**: 4-6 hours | **Impact**: Major quality improvement

1. Create `src/ai/flows/translation/aiTranslateTitleToPL.ts` Genkit flow
2. Call it from Stage 4 instead of dictionary
3. Context-aware translation (product category affects terminology)
4. Batch processing with AI rate limiting (200ms between items)

**Expected Result:**
- Professional Polish product titles
- Better CTR and conversions
- Proper product metadata

---

### Priority 2: Rename AI Functions (MEDIUM) 🟡
**Effort**: 15 minutes | **Impact**: Code clarity

```bash
# Rename in codebase
aiNormalizeTitlePL.ts → aiNormalizeTitleEN.ts
function call: aiNormalizeTitlePL() → aiNormalizeTitleEN()
```

---

### Priority 3: Dynamic Exchange Rates (MEDIUM) 🟡
**Effort**: 2-3 hours | **Impact**: Accuracy

1. Add `currencyRate` to Firestore config document
2. Fetch in `processImportJob()` before pipeline starts
3. Use in stageEnrich for USD→PLN conversion
4. Update currency-context to fetch from config daily

---

### Priority 4: Additional Language Tiers (LOW) 🟢
**Effort**: 1-2 days | **Impact**: Market expansion

Current: pl, en, de
Add: de (German), fr (French), es (Spanish)

Genkit flows for each language:
- `aiTranslateTitleToDE.ts`
- `aiTranslateTitleToFR.ts`
- `aiTranslateTitleToES.ts`

---

## 📊 Impact Summary

| Feature | Current | Status | Gap |
|---------|---------|--------|-----|
| **Multi-Language UI** | pl/en/de | ✅ Ready | None |
| **Product Title Translation** | Dictionary-based | ⚠️ Works poorly | Needs AI |
| **Description Translation** | Dictionary-based | ⚠️ Works poorly | Needs AI |
| **Price Display** | SmartPrice model | ✅ Ready | None |
| **Currency Conversion** | Hardcoded rates | ⚠️ Inaccurate | Needs dynamic |
| **AI Title Normalization** | EN (Stage 3) | ✅ Working | None |
| **Genkit Integration** | Stage 3 only | ⚠️ Partial | Needs Stage 4 |

---

## 🎯 Conclusion

✅ **Frontend** is **FULLY READY** for multilingual + multicurrency
⚠️ **Import system** has **AI in Stage 3 only**, Stage 4 translation needs upgrading
🚀 **Next Step**: Implement AI-powered translation flows to match backend architecture
