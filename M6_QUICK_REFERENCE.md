# 🎯 M6 Quick Reference Card

## Core Concepts (30 seconds)

**ProductCore** = Unique product (one per physical product)
- Immutable identity (hash-based)
- Specs, rating, multilingual description
- Linked to multiple Deals

**Deal** = Specific offer from specific seller
- Mutable (price, shipping change daily)
- Always linked to one ProductCore
- Price history for compliance

## Main Workflows

### 1. Import Products (Harvester)
```typescript
const job = await startHarvesterJob('aliexpress', 'laptop', 50);
// Creates new ProductCore + Deal, or just Deal if product exists
```

### 2. Enrich Products (Refiner)
```typescript
const job = await refinePendingProducts();
// Cleans specs, generates descriptions, calculates scores
```

### 3. Show Product Page
```typescript
<ProductDetailPage productId="prod_123" />
// Shows: Gallery + Best Price + All Deals + Price History + Specs
```

## Admin UI Access Points

| Task | URL | Button |
|------|-----|--------|
| View Products | `/admin/catalog` → Products | Filter by status |
| Start Harvester | `/admin/catalog` → Harvester | "Start Harvester" |
| Run Refiner | `/admin/catalog` → Refiner | "Refine All Pending Products" |
| Monitor Jobs | `/admin/catalog` → Monitor | See real-time progress |

## Key Files

| What | Where |
|------|-------|
| Types | `src/lib/types.ts` (lines 2400+) |
| Harvester | `src/lib/automation/harvester.ts` |
| Refiner | `src/lib/automation/refiner.ts` |
| Dedup | `src/lib/automation/identity-matcher.ts` |
| Data Layer | `src/lib/data.ts` (getProductCore, etc.) |
| Admin Page | `src/app/admin/catalog/page.tsx` |
| Product Page | `src/components/product-detail-page.tsx` |
| API | `src/app/api/admin/jobs/route.ts` |

## Firestore Collections

```
product_cores/          → ProductCore documents
deals/                  → Deal documents  
harvester_jobs/         → Import job tracking
refiner_jobs/          → Enrichment job tracking
identity_matches/       → Deduplication index
```

## API Endpoints

```bash
# Start harvest
curl -X POST /api/admin/harvester/start \
  -H "Content-Type: application/json" \
  -d '{"source":"aliexpress", "query":"laptop", "maxResults":50}'

# Start refiner
curl -X POST /api/admin/refiner/start \
  -H "Content-Type: application/json" \
  -d '{"productIds":["p1","p2"], "refinationType":"full_enrichment"}'

# Refine pending
curl -X POST /api/admin/refiner/pending
```

## Deduplication Algorithm

```
Product A from AliExpress:
  Title: "16GB Laptop Computer RTX 4090 15.6 Inch"
  Image: "https://cdn.aliexpress.com/products/123.jpg"

Product B from Amazon:
  Title: "Laptop RTX 4090 16GB 15.6\""
  Image: "https://cdn.amazon.com/products/456.jpg"

Normalize both titles:
  "16gb laptop computer rtx 4090 156 inch"

If same: Create one ProductCore with multiple Deals
If different: Create separate ProductCores
```

## Quality Checklist

- [ ] Harvester creates products without duplicates?
- [ ] Deals linked to correct products?
- [ ] Refiner generates descriptions in PL/EN/DE?
- [ ] Spec keys normalized (RAM, Storage, Screen)?
- [ ] Price history shows 30-day trend?
- [ ] Best price calculation correct?
- [ ] Affiliate links generated?
- [ ] Admin progress bars updating?
- [ ] Mobile responsive?
- [ ] No console errors?

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Duplicate products created | Check identityHash calculation; ensure title normalization works |
| Deal not showing on product | Check `productId` foreign key matches ProductCore.id |
| Refiner stuck | Check logs in RefinerJob; verify AI function called |
| Price not updating | Call `updateProductBestPrice(productId)` manually |
| UI not loading | Check Firestore rules allow read access |

## Commands

```bash
# Dev server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint --fix

# Build
npm run build

# View Genkit flows
npm run genkit:dev
```

## Learn More

- **Full docs:** `docs/milestones/M6_PRODUCT_CENTRIC_ARCHITECTURE.md`
- **Execution summary:** `M6_EXECUTION_SUMMARY.md`
- **Type definitions:** `src/lib/types.ts` (ProductCore, Deal, etc.)
- **Admin code:** `src/app/admin/catalog/page.tsx`

---

**Status:** ✅ Production Ready  
**Last Updated:** Dec 20, 2025
