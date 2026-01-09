# Product-Centric Architecture (M6)

Complete migration from "Deal-Blog" model to "Product-Comparison" model (Like Ceneo/PriceRunner).

## Architecture Overview

### Core Entities

#### ProductCore (Immutable)
The root entity - represents a unique product. One per physical product.

```typescript
ProductCore {
  id: string                          // Unique identifier
  identityHash: string               // SHA-256(normalized_title + image_hash)
  title: LocalizedText               // Multi-language: pl, en, de
  shortDescription: LocalizedText    // 1-2 sentences
  fullDescription: LocalizedText     // Detailed (optional)
  specs: Record<string, string>      // Standardized {"RAM": "16GB", ...}
  images: string[]                   // Gallery URLs
  rating: {
    score: number                    // 0-5
    count: number                    // Review count
    provider: string                 // 'aliexpress' | 'amazon' | ...
  }
  bestPrice: {
    amount: number
    currency: 'USD'                  // Always USD for consistency
  }
  linkedDealIds: string[]            // Foreign keys to Deal[]
  searchTags: string[]               // For Typesense/full-text search
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  createdAt: string                  // ISO timestamp
  updatedAt: string
}
```

**Key Points:**
- Identity is immutable (determined at creation)
- Used for deduplication across sources
- Best price is calculated from all linked deals
- Status flows: Draft → Pending Approval → Approved

---

#### Deal (Mutable)
The offer/listing entity - represents a specific price point from a specific seller.

```typescript
Deal {
  id: string                         // Unique identifier
  productId: string                  // Foreign key → ProductCore
  price: {
    amount: number
    currency: string                 // USD, PLN, EUR, GBP
  }
  lowestPriceIn30Days?: number      // Omnibus Directive compliance
  originalPrice?: number             // For discount calculation
  shipping: {
    cost: number
    timeDays: number
    method?: string
    fromCountry?: string
  }
  source: 'aliexpress' | 'amazon' | 'allegro' | ...
  affiliateLink: string              // Generated with tracking
  merchantName?: string
  merchantRating?: number
  priceHistory: Array<{
    date: string                     // YYYY-MM-DD
    price: number
    currency: string
    lowestPrice?: number
  }>
  status: 'draft' | 'approved' | 'rejected'
  voteCount: number
  temperature: number                // Heat algorithm
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order'
  expiryDate?: string
  createdAt: string
}
```

**Key Points:**
- Mutable (price, stock, availability change)
- Always linked to exactly one ProductCore
- Maintains price history for Omnibus compliance
- Multiple deals per product
- Engagement metrics (votes, temperature)

---

### Supporting Entities

#### HarvesterJob
Tracks product import operations from external APIs.

```typescript
HarvesterJob {
  id: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  source: 'aliexpress' | 'amazon' | 'allegro'
  query: string                      // Search term
  maxResults: number
  productsFound: number
  productsCreated: number            // New ProductCores
  dealsCreated: number               // New Deals
  duplicatesSkipped: number          // Already existed
  errors: Array<{message, timestamp}>
  logs: Array<{level, message, timestamp, details}>
  startedAt: string
  completedAt?: string
}
```

#### RefinerJob
Tracks AI enrichment operations.

```typescript
RefinerJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  refinationType: 'specs_cleanup' | 'description_generation' | 'review_summary' | 'full_enrichment'
  productIds: string[]
  productsProcessed: number
  productsSuccessful: number
  productsFailed: number
  logs: Array<{productId, status, message, timestamp}>
}
```

#### IdentityMatch
For efficient product deduplication.

```typescript
IdentityMatch {
  id: string
  titleHash: string
  primaryImageHash: string
  combinedHash: string               // = identityHash
  productId: string                  // → ProductCore
  source: string                     // Where hash came from
  sourceProductId?: string           // ID in source system
  confidence: number                 // 0-1
  createdAt: string
}
```

---

## Workflows

### 1. Smart Harvester Workflow

```
Input: source, query, maxResults
  ↓
Fetch from API (AliExpress/Amazon/Allegro)
  ↓
For each product:
  Calculate identityHash = SHA256(normalized_title + image_hash)
  Query: Does ProductCore with this hash exist?
  ├─ YES: Create Deal + Link to ProductCore + Update bestPrice
  └─ NO:  Create ProductCore (status=draft) + Create Deal
  ↓
Record IdentityMatch for future lookups
  ↓
Output: HarvesterJob with results
```

**Key Algorithm:**
```typescript
identityHash = SHA256(
  normalizeText(title).lowercase().trim().removeSpecialChars(),
  imageUrl.pathname + imageUrl.search
)
```

**Example:**
- Title: "16GB Laptop Computer RTX 4090 15.6 Inch FHD"
- Image: "https://cdn.aliexpress.com/123/456.jpg"
- → Normalized: "16gb laptop computer rtx 4090 156 inch fhd"
- → identityHash: SHA256(this_hash + image_hash)

---

### 2. AI Refiner Workflow

```
Input: productIds[], refinationType
  ↓
For each product in status='pending_approval':
  │
  ├─ specs_cleanup:
  │  Normalize keys (RAM → RAM, memory → RAM)
  │  Normalize values ("16 GB" → "16GB")
  │  Remove duplicates
  │
  ├─ description_generation:
  │  Call Vertex AI with specs
  │  Generate PL/EN/DE descriptions
  │  Generate SEO titles & meta descriptions
  │
  ├─ review_summary:
  │  Simulate sentiment from rating:
  │    4.5+ stars → "Users praise quality & durability"
  │    4.0+ stars → "Generally positive, some concerns"
  │    3.5+ stars → "Mixed reviews, some limitations"
  │    < 3.0     → "Below average, consider alternatives"
  │
  └─ full_enrichment:
     Run all of above +
     Calculate quality score (0-100)
     Extract search tags
     Set status → 'pending_approval'
  ↓
Update ProductCore in Firestore
  ↓
Output: RefinerJob with results
```

---

### 3. Deduplication Engine

**Problem:** Same product imported multiple times = duplicate ProductCores

**Solution:** Identity matching by normalized title + image hash

```typescript
// Example: iPhone 15 Pro
Sources:
  AliExpress: "Apple iPhone 15 Pro 256GB Black"
  Amazon:     "iPhone 15 Pro Black 256GB Official"
  Allegro:    "iPhone 15 Pro - 256GB - Black"

All normalize to:
  "apple iphone 15 pro 256gb black"

identityHash calculation:
  1. titleHash = SHA256("apple iphone 15 pro 256gb black")
  2. imageHash = SHA256(primary_image_url)
  3. identityHash = SHA256(titleHash + imageHash)

Result: All three sources resolve to same ProductCore
  ↓
Only ONE product exists, THREE deals linked to it
  ↓
Best price = MIN(Deal1.price+shipping, Deal2.price+shipping, Deal3.price+shipping)
```

---

## Admin UI Components

### 1. ProductMatchingTable
- View all ProductCores with linked deal counts
- Visual warnings (missing specs, low quality)
- Merge two duplicates manually
- Delete products
- Quality score bar

### 2. IngestionMonitor
Real-time tracking with two tabs:

**Harvester Tab:**
- Live import progress bars
- Products found vs created vs duplicates
- Error log with message details
- Pause/Resume controls
- Time estimation

**Refiner Tab:**
- Enrichment progress
- Success/failure rates
- Detailed product logs
- Refinement type tracking

### 3. Admin Catalog Page
- Product database browser
- Harvester control panel
- Refiner trigger
- Job monitoring dashboard

---

## User-Facing Components

### 1. ProductDetailPage
```
[Hero Section]
  Left:  Gallery carousel (high-res images)
  Right: Best Price Widget
         • Title + star rating
         • BIG GREEN PRICE
         • "Buy at [Store]" CTA
         • Reviews summary

[Price Comparison Table]
  Store | Price | Shipping | Total | Delivery | Rating | Buy
  ─────────────────────────────────────────────────────────
  AliExpress | $299 | FREE | $299 | 7 days | 4.8★ | [→]
  Amazon     | $310 | $5   | $315 | 2 days | 4.9★ | [→]
  Allegro    | $305 | $10  | $315 | 1 day  | 4.7★ | [→]

[Price History Chart]
  30-day price trend (lowest price each day)
  Omnibus compliance visualization
  Min/Max/Avg/Change stats

[Specs Table]
  Zebra-striped table with all standardized specs
  RAM: 16GB
  Storage: 512GB SSD
  Screen: 15.6" OLED
  ...

[Description]
  Short description + Full description (HTML)
```

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────┐
                    │   External Sources              │
                    │  AliExpress / Amazon / Allegro  │
                    └──────────────┬──────────────────┘
                                   │
                                   ↓
                    ┌──────────────────────────────────┐
                    │   Smart Harvester               │
                    │  • Fetch products               │
                    │  • Calculate identityHash       │
                    │  • Check for duplicates         │
                    │  • Create ProductCore + Deal    │
                    └──────────────┬──────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ↓                                      ↓
    ┌─────────────────────────┐    ┌────────────────────────┐
    │   ProductCore           │    │   Deal                 │
    │  • Identity Hash        │    │  • productId (FK)      │
    │  • Specs                │    │  • Price               │
    │  • Rating               │    │  • Source              │
    │  • Status: draft        │    │  • Affiliate Link      │
    │  • Best Price           │    │  • Price History       │
    │  • linkedDealIds[]      │    │  • Status: approved    │
    └──────────────┬──────────┘    └────────────────────────┘
                   │
                   │ (Draft products)
                   ↓
    ┌──────────────────────────────┐
    │   AI Refiner                 │
    │  • Clean specs               │
    │  • Generate descriptions     │
    │  • Create review summaries   │
    │  • Calculate quality score   │
    │  • Set status: approved      │
    └──────────────┬───────────────┘
                   │
                   ↓
    ┌──────────────────────────────┐
    │   ProductCore                │
    │  (approved, enriched)        │
    └──────────────┬───────────────┘
                   │
                   ↓
        ┌──────────────────────┐
        │  Product Detail Page │
        │  (User-facing)       │
        └──────────────────────┘
```

---

## Omnibus Directive Compliance

**Requirement:** Display lowest price in last 30 days

**Implementation:**
```typescript
Deal.priceHistory: Array<{
  date: string              // YYYY-MM-DD
  price: number
  currency: string
  lowestPrice?: number      // Lowest available that day
}>

// PriceHistoryChart
- Shows lowest price each day over 30 days
- Aggregates across all deals
- Displays min/max/avg/trend
- Includes compliance badge
```

---

## Migration from Old Architecture

### Pre-Migration Checklist
- [ ] Backup Firestore
- [ ] Run dry-run migration
- [ ] Verify stats match expectations
- [ ] Check error count < 5%
- [ ] Review duplicate detection
- [ ] Test on staging environment

### Running Migration

**Dry Run (No Changes):**
```typescript
import { migrateToProductCentricArchitecture } from '@/lib/automation/migration';

const stats = await migrateToProductCentricArchitecture(dryRun = true);
console.log(stats);
// {
//   totalOldProducts: 1000,
//   newProductCoresCreated: 850,
//   duplicatesFound: 150,
//   dealsLinked: 2500,
//   errors: []
// }
```

**Apply Migration:**
```typescript
const stats = await migrateToProductCentricArchitecture(dryRun = false);
// ✨ Migration completed successfully!
```

**Rollback (If Needed):**
```typescript
import { rollbackMigration } from '@/lib/automation/migration';
await rollbackMigration();
// ✓ Rollback completed
```

---

## Firestore Collection Structure

```
firestore/
├── product_cores/
│   └── {productId}
│       • title, specs, rating, bestPrice, linkedDealIds...
│
├── deals/
│   └── {dealId}
│       • productId (FK), price, shipping, priceHistory...
│
├── harvester_jobs/
│   └── {jobId}
│       • status, productsFound, dealsCreated, logs...
│
├── refiner_jobs/
│   └── {jobId}
│       • status, productIds, refinementType, logs...
│
├── identity_matches/
│   └── {matchId}
│       • identityHash, productId, source, confidence...
│
└── [legacy collections]
    ├── products/        (old, can be archived)
    └── deals/          (being migrated)
```

---

## API Endpoints

### Start Harvester Job
```
POST /api/admin/harvester/start
Content-Type: application/json

{
  "source": "aliexpress",
  "query": "laptop",
  "maxResults": 50
}

Response:
{
  "success": true,
  "job": {
    "id": "job_1234567_abc123",
    "status": "running",
    "source": "aliexpress",
    "query": "laptop",
    "productsFound": 0,
    ...
  }
}
```

### Start Refiner Job
```
POST /api/admin/refiner/start
{
  "productIds": ["prod_1", "prod_2"],
  "refinationType": "full_enrichment"
}
```

### Refine Pending Products
```
POST /api/admin/refiner/pending
(No body required)
```

---

## Development Workflow

```bash
# 1. Run dev server
npm run dev                    # :9002

# 2. Access admin panel
http://localhost:9002/admin/catalog

# 3. Start a harvester job
# Fill form: source=aliexpress, query="laptop"
# Click "Start Harvester"

# 4. Watch real-time progress
# Switch to Monitor tab → Harvester tab

# 5. View created products
# Switch to Products tab → Filter by "Draft"

# 6. Run AI refiner
# Click "Refine All Pending Products"

# 7. View enriched products
# Switch to Products tab → Filter by "Approved"

# 8. Test user-facing pages
# Visit /products/[productId]
```

---

## Performance Optimizations

### 1. Deduplication Caching
- IdentityMatch collection indexed by hash
- Quick lookup before creating new ProductCore
- Prevents N² comparisons

### 2. Best Price Calculation
- Cached on ProductCore
- Updated when deals change
- Sortable in UI

### 3. Pagination
- 50-100 documents per query
- Cursor-based pagination for large result sets
- Firestore indexes for category+price queries

### 4. Search
- Typesense integration for full-text search (if available)
- Fallback: Firestore substring search on `searchTags`
- Pre-computed tags from title + specs

---

## Testing Checklist

- [ ] Test harvester with small query (5-10 results)
- [ ] Verify no duplicate ProductCores created
- [ ] Check Deal linking works correctly
- [ ] Test refiner enrichment on draft products
- [ ] Verify multilingual descriptions generated
- [ ] Test price history chart rendering
- [ ] Test merge products functionality
- [ ] Verify Omnibus compliance (30-day lowest price)
- [ ] Test affiliate link generation
- [ ] Load test with 1000+ products
- [ ] Test migration rollback

---

## Future Enhancements

- [ ] Gemini 2.0 integration for spec extraction from images
- [ ] Real-time price alerts (WebSocket)
- [ ] Product recommendations based on view history
- [ ] User reviews & ratings on ProductCore
- [ ] Compare multiple products side-by-side
- [ ] Price tracker email notifications
- [ ] Integration with more marketplaces (eBay, Etsy, etc.)
- [ ] Machine learning for category auto-mapping
- [ ] Automated supplier management

---

## Questions & Support

For questions about the Product-Centric Architecture:
1. Check this doc first
2. Review the code comments in `src/lib/automation/`
3. Look at test cases in `src/lib/automation/*.test.ts`
4. Check admin UI for real-time monitoring
