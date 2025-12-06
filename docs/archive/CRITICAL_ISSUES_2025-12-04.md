# 🔴 CRITICAL ISSUES - Pre-Live Testing (4 Dec 2025)

**STATUS**: System **NOT READY** for production. 5 critical bugs found.

---

## 🔴 CRITICAL BUG #1: Missing AI Function `aiNormalizeTitlePL`

**Location**: `src/ai/flows/importerFlow/stageEnrich.ts:55`

```typescript
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
```

**Problem**:
- Function imported but **file doesn't exist**
- `src/ai/flows/aliexpress/aiNormalizeTitlePL.ts` - NOT FOUND
- Pipeline will crash at Stage 3 immediately
- Error: `Cannot find module`

**Impact**: ALL imports will fail

**Fix Required**:
```bash
# Either:
1. Create the function:
   src/ai/flows/aliexpress/aiNormalizeTitleEN.ts
   
2. Or remove the import and use fallback:
   titleNormalizedEN = product.title; // Use raw AliExpress title
```

---

## 🔴 CRITICAL BUG #2: Missing Genkit-AI Package

**Location**: `src/ai/flows/translation/aiTranslateTitleToPL.ts:7`

```typescript
import { defineFlow, run } from '@genkit-ai/flow';
import { openai } from '@genkit-ai/openai';
```

**Problem**:
- `@genkit-ai/openai` package is **NOT installed** in package.json
- Pipeline Stage 4 will crash when importing this file
- Error: `Cannot find module '@genkit-ai/openai'`

**Impact**: Translation stage completely broken

**Fix Required**:
```bash
npm install @genkit-ai/openai
# AND update package.json dependencies
```

---

## 🔴 CRITICAL BUG #3: Polish Keywords Sent to AliExpress API

**Location**: `src/app/api/admin/import/start/route.ts:183-189`

```typescript
const keywords = [
  batch.categoryName,           // "Elektronika" (PL)
  batch.subcategoryName,        // "Telefony" (PL)
  batch.subsubcategoryName,     // "Smartfony" (PL)
  `${batch.categoryName} ${batch.subcategoryName}`,
  `${batch.subcategoryName} bestseller`,
  `${batch.categoryName} sale`,
];
```

**Problem**:
- `batch.categoryName` is in POLISH (Firestore has PL names)
- AliExpress API expects ENGLISH queries
- Sending "Elektronika Telefony" to API returns 0 results
- No fallback to English keywords

**Impact**: Every import will return 0 products

**Result**: "Dodano: 0" (the exact issue user reported!)

**Fix Required**:
```typescript
// Generate keywords from ENGLISH category names
const keywords = [
  batch.categorySlugEN,  // Use slugs, not names
  // OR translate Polish names to English
  translatePLtoEN(batch.categoryName),
  translatePLtoEN(batch.subcategoryName),
];
```

---

## 🔴 CRITICAL BUG #4: Wrong Site URL - Hardcoded Localhost

**Location**: `src/ai/flows/importerFlow/stageFetch.ts:15`

```typescript
export async function fetchProductsFromAliexpress(
  keywords: string[],
  config: ImportStageConfig,
  siteUrl: string = 'http://localhost:9002'  // ← HARDCODED!
): Promise<AliExpressProduct[]> {
  
  const response = await fetch(`${siteUrl}/api/admin/aliexpress/search`, {
```

**Problem**:
- `http://localhost:9002` works in dev, NOT in production
- In production (Firebase App Hosting), this URL is invalid
- API call will fail with network error
- No fallback mechanism

**Impact**: All API calls fail in production

**Fix Required**:
```typescript
// Get dynamic URL from environment
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

// OR pass from caller
// src/app/api/admin/import/start/route.ts should pass:
const response = await runProductImportPipeline({
  siteUrl: process.env.NEXT_PUBLIC_APP_URL,
  // ...
});
```

---

## 🔴 CRITICAL BUG #5: FieldValue.arrayUnion() Wrong Usage

**Location**: `src/ai/flows/importerFlow/stageSave.ts:151-152`

```typescript
if (created.length > 0) {
  updates.itemsCreated = FieldValue.arrayUnion(...created);
}
```

**Problem**:
- `FieldValue.arrayUnion()` expects individual arguments
- Using spread operator `...created` unpacks array
- If `created = ['id1', 'id2', 'id3']` → `arrayUnion('id1', 'id2', 'id3')`
- Firestore arrayUnion likely has argument limit
- This pattern works but is fragile

**Better Approach**:
```typescript
// Loop and add individually
for (const id of created) {
  updates[`itemsCreated.${id}`] = true;
}

// OR use batch operations
const batch = adminDb.batch();
for (const id of created) {
  batch.update(jobRef, {
    itemsCreated: FieldValue.arrayUnion(id)
  });
}
await batch.commit();
```

---

## 🟡 HIGH PRIORITY ISSUES

### Issue #6: Missing Affiliate Links

**Location**: `src/ai/flows/importerFlow/stageSave.ts:48`

```typescript
const existingId = await findExistingProduct({
  originalId: product.originalId,
  affiliateUrl: product.link,  // ← AliExpress URL, not affiliate!
});
```

**Problem**:
- `product.link` is raw AliExpress URL
- `findExistingProduct` searches for affiliate links
- Won't find duplicates because URL format is different
- Could create duplicate products

**Impact**: Potential duplicate products in database

---

### Issue #7: Categories in Polish, Not English

**Location**: Database structure

**Problem**:
- Current Firestore categories are in Polish
- New importer uses `categorySlugEN` which should be English
- Misalignment between stored PL names and slugs

**Impact**: Products assigned to wrong categories

---

## 📋 Summary Table

| Bug # | Severity | Type | Impact |
|-------|----------|------|--------|
| 1 | 🔴 CRITICAL | Missing function | Stage 3 crashes |
| 2 | 🔴 CRITICAL | Missing package | Stage 4 crashes |
| 3 | 🔴 CRITICAL | Polish keywords | Returns 0 products |
| 4 | 🔴 CRITICAL | Hardcoded URL | Production fails |
| 5 | 🔴 CRITICAL | Firestore API misuse | Potential data loss |
| 6 | 🟡 HIGH | Logic error | Duplicate products |
| 7 | 🟡 HIGH | Data structure | Wrong categories |

---

## ✅ What Works

- ✅ Pipeline structure (5 stages)
- ✅ Type system
- ✅ Rate limiting
- ✅ Error handling structure
- ✅ Logging framework

---

## 🚀 Required Fixes Before Production

**Priority 1 (MUST FIX):**
1. ✅ Fix Polish keywords → use English category slugs or translate
2. ✅ Create or remove `aiNormalizeTitlePL` function
3. ✅ Install `@genkit-ai/openai` or replace with alternative
4. ✅ Fix hardcoded `localhost:9002` → use env var
5. ✅ Fix `FieldValue.arrayUnion()` usage

**Priority 2 (SHOULD FIX):**
6. ✅ Fix affiliate URL lookup
7. ✅ Migrate categories to English names

---

## 🎯 Recommendation

**DO NOT RUN** with live AliExpress credentials until all 5 CRITICAL bugs are fixed.

**Estimated Fix Time**: 2-3 hours max
- Bug 1: 15 min (create stub function)
- Bug 2: 5 min (npm install)
- Bug 3: 20 min (translate keywords or use slugs)
- Bug 4: 10 min (use env var)
- Bug 5: 15 min (fix Firestore call)

Ready to start fixing?
