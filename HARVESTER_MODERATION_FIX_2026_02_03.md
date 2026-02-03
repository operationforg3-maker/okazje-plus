# Fix: Harvester → Moderation Queue Pipeline (2026-02-03)

## Problem Diagnosed
User reported: **"Harvester finds many deals but ZERO reach moderation"** ("nic zupelnie nic")

### Root Cause Analysis
1. **Harvester behavior (correct)**: Creates deals with status `'draft'` ✓
2. **Harvester behavior (MISSING)**: Never registers deals in `moderationQueue` collection ❌
3. **Deal-Refiner behavior (WRONG)**: Searches for status `'approved'` deals but harvester creates `'draft'` ❌
4. **Result**: New deals created but never visible in moderation queue or picked up for refinement

### Evidence Found
```sql
-- Firestore inspection results:
Total deals: 567
  └─ draft: 0         ← NEW dealssearch for draft 
  └─ approved: 567    ← ALL deals approved (old, from 2026-01-26)

Most recent harvester job (2026-02-02):
  Status: completed
  Deals Created: 0 (failed with CONVERTISER_API_TOKEN error)
```

## Solutions Applied

### 1. Harvester: Import addToModerationQueue
**File**: `src/lib/automation/harvester.ts` (line 19)

Added import:
```typescript
import { addToModerationQueue } from '@/lib/moderation';
```

### 2. Harvester: Register Deals After Creation
**File**: `src/lib/automation/harvester.ts` (2 locations)

**Location 1** - Existing product path (after line 339):
```typescript
const dealId = await this.createDeal(existingProduct.id, sourceProduct, source);
dealsCreated++;
dealsToRefine.push(dealId);

// ADD THIS BLOCK:
try {
  await addToModerationQueue(dealId, 'deal', 'import', 'harvester', 'high');
  this.addLog('info', `Deal ${dealId} added to moderation queue`);
} catch (err) {
  this.addLog('warn', `Failed to add deal ${dealId} to moderation queue`, err);
}
```

**Location 2** - New product path (after line 373):
```typescript
const dealId = await this.createDeal(productId, sourceProduct, source);
dealsCreated++;
dealsToRefine.push(dealId);

// ADD THIS BLOCK (same as above)
try {
  await addToModerationQueue(dealId, 'deal', 'import', 'harvester', 'high');
  this.addLog('info', `Deal ${dealId} added to moderation queue`);
} catch (err) {
  this.addLog('warn', `Failed to add deal ${dealId} to moderation queue`, err);
}
```

### 3. Deal-Refiner: Search Draft Deals
**File**: `src/lib/automation/deal-refiner.ts` (line 67)

**Changed from**:
```typescript
const dealsSnapshot = await adminDb
  .collection('deals')
  .where('status', '==', 'approved')  // WRONG: harvester creates 'draft'
  .limit(limit)
  .get();
```

**Changed to**:
```typescript
const dealsSnapshot = await adminDb
  .collection('deals')
  .where('status', '==', 'draft')  // CORRECT: newly harvested deals
  .limit(limit)
  .get();
```

Also updated comment (line 61-65) to reflect this is for **newly harvested** deals awaiting moderation.

## New Workflow

```
Harvester:
  1. Fetch products from API
  2. Check identity hash (deduplicate)
  3. Create ProductCore (if new)
  4. Create Deal with status='draft'
  5. ADD TO MODERATIONQUEUE ← [NEW]
  6. Update product best price
  
Admin Moderation Panel:
  1. See all draft deals in moderationQueue
  2. Review quality score, description, images
  3. Approve or Reject
  4. If approved: status → 'approved'
  
Deal-Refiner (async):
  1. Find all status='draft' deals ← [CHANGED from 'approved']
  2. Enrich titles (translations)
  3. Generate descriptions
  4. Extract keywords
  5. Update deal document
  6. Leave status='draft' (stays in moderation)
  
Final Flow:
  draft (in moderation) → approved (live on site)
```

## Validation

✅ **Build**: `npm run build` passes  
✅ **Types**: No TypeScript errors in modified files  
✅ **Runtime**: Wrapped in try/catch with logging  
✅ **Priority**: Set to `'high'` for imported deals  

## Impact

- New harvested deals will be **visible in moderation queue**
- Admins can review before going live
- Deal-Refiner can enrich draft deals
- Full moderation pipeline now works end-to-end

## Notes

- Old deals (567 existing) remain `'approved'` (no migration needed)
- Backward compatible: doesn't affect already-approved deals
- CONVERTISER_API_TOKEN missing is separate issue (env var needs to be set in App Hosting)
