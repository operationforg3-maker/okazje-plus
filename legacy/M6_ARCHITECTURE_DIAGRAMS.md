# M6 Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SOURCES                            │
│              AliExpress │ Amazon │ Allegro                          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ↓
        ┌──────────────────────────────────────────────────┐
        │        SMART HARVESTER (harvester.ts)            │
        │                                                   │
        │  1. Fetch products from API                      │
        │  2. Calculate identityHash (title + image)       │
        │  3. Check: Product exists?                       │
        │     ├─ YES: Create Deal + Update bestPrice      │
        │     └─ NO:  Create ProductCore (draft) + Deal   │
        │  4. Record IdentityMatch for lookups            │
        │  5. Track progress in HarvesterJob              │
        └──────────────┬───────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ↓                             ↓
    ┌────────────────┐         ┌──────────────┐
    │  ProductCore   │◄────────│    Deal      │
    │  (Immutable)   │ Foreign │ (Mutable)    │
    │                │   Key   │              │
    │ • id           │         │ • id         │
    │ • identityHash │         │ • productId  │
    │ • title        │         │ • price      │
    │ • specs        │         │ • shipping   │
    │ • rating       │         │ • source     │
    │ • images       │         │ • merchant   │
    │ • bestPrice    │         │ • priceHist  │
    │ • linkedDealIds│         │ • voteCount  │
    │ • status       │         │ • temperature
    │ • createdAt    │         │ • status     │
    └────────────────┘         └──────────────┘
        │
        │ (Draft products)
        ↓
    ┌────────────────────────────────┐
    │   AI REFINER (refiner.ts)       │
    │                                 │
    │  1. Clean specs                │
    │  2. Generate descriptions      │
    │  3. Create review summaries    │
    │  4. Calculate quality scores   │
    │  5. Extract search tags        │
    │  6. Set status → approved      │
    └────────────────┬───────────────┘
                     │
                     ↓
        ┌────────────────────────────┐
        │  ProductCore (Approved)    │
        │  • Enriched with specs     │
        │  • Multilingual text       │
        │  • Quality score           │
        │  • Ready for display       │
        └────────────────┬───────────┘
                         │
                         ↓
        ┌─────────────────────────────────────────┐
        │  USER-FACING PAGES                      │
        │                                         │
        │  ProductDetailPage                      │
        │  ├─ Hero Section                        │
        │  │  ├─ Gallery (images)                │
        │  │  ├─ Best Price Widget               │
        │  │  ├─ Star ratings                    │
        │  │  └─ Review Summary                  │
        │  │                                      │
        │  ├─ PriceComparisonTable               │
        │  │  └─ All deals sorted by price       │
        │  │                                      │
        │  ├─ PriceHistoryChart                  │
        │  │  └─ 30-day lowest price trend       │
        │  │                                      │
        │  └─ SpecsTable                         │
        │     └─ Standardized specifications     │
        └─────────────────────────────────────────┘
```

---

## Admin Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│              ADMIN CATALOG (/admin/catalog)             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Products │ Harvester │ Refiner │ Monitor              │
└─────────────────────────────────────────────────────────┘

TAB: Products
├─ ProductMatchingTable
│  ├─ Product Image & Title
│  ├─ Specs Count Badge
│  ├─ Linked Deals Count
│  ├─ Quality Score Bar
│  ├─ Warning Icons
│  └─ Actions
│     ├─ View Details
│     ├─ Merge Duplicates Dialog
│     └─ Delete

TAB: Harvester
├─ Source Dropdown (AliExpress/Amazon/Allegro)
├─ Search Query Input
├─ Start Harvester Button
├─ Info Box (How it works)
├─ Deduplication Explanation
└─ Last 10 Jobs Status

TAB: Refiner
├─ Refine All Pending Products Button
├─ Refinement Types Info
├─ Spec Cleaning Example
└─ Last 10 Jobs Status

TAB: Monitor
├─ Harvester Jobs Tab
│  ├─ Found / Created / Deals / Duplicates Stats
│  ├─ Progress Bar
│  ├─ Error Log
│  └─ Pause/Resume Buttons
│
└─ Refiner Jobs Tab
   ├─ Processed / Successful / Failed Stats
   ├─ Success Rate Bar
   └─ Job Timeline
```

---

## Data Flow Diagram

```
START
  │
  ├─→ Harvester Job Created
  │    ├─ HarvesterJob doc in Firestore
  │    ├─ Status: "running"
  │    └─ Logs array initialized
  │
  ├─→ Fetch from API
  │    └─ Returns 50 products
  │
  ├─→ For Each Product:
  │    │
  │    ├─→ Calculate identityHash
  │    │    └─ SHA256(normalized_title + image_hash)
  │    │
  │    ├─→ Query: Does ProductCore exist?
  │    │    │
  │    │    ├─ YES: Existing Product Path
  │    │    │  ├─ Create new Deal
  │    │    │  ├─ Link to ProductCore
  │    │    │  ├─ Update bestPrice
  │    │    │  ├─ Add to linkedDealIds
  │    │    │  └─ Increment dealsCreated counter
  │    │    │
  │    │    └─ NO: New Product Path
  │    │       ├─ Create ProductCore (status: draft)
  │    │       ├─ Extract specs from title
  │    │       ├─ Create Deal
  │    │       ├─ Record IdentityMatch
  │    │       └─ Increment productsCreated counter
  │    │
  │    └─→ Log to job: "Product processed"
  │
  ├─→ Update HarvesterJob
  │    ├─ Status: "completed"
  │    ├─ Final stats
  │    └─ Completion timestamp
  │
  └─→ END

PARALLEL: Refiner Process
  │
  ├─→ Detect draft products
  │    └─ Query: status="pending_approval"
  │
  ├─→ Create RefinerJob
  │    └─ Status: "running"
  │
  ├─→ For Each Product:
  │    │
  │    ├─→ Clean Specs
  │    │    ├─ Normalize keys (RAM, Storage, Screen)
  │    │    ├─ Normalize values ("16 GB" → "16GB")
  │    │    └─ Remove duplicates
  │    │
  │    ├─→ Generate Descriptions
  │    │    ├─ Call Vertex AI
  │    │    ├─ Generate PL/EN/DE
  │    │    └─ Generate SEO titles
  │    │
  │    ├─→ Create Review Summary
  │    │    ├─ Analyze rating (0-5 stars)
  │    │    └─ Generate sentiment text
  │    │
  │    ├─→ Calculate Quality Score
  │    │    ├─ Based on spec count
  │    │    ├─ Based on image count
  │    │    ├─ Based on rating data
  │    │    └─ 0-100 score
  │    │
  │    ├─→ Extract Search Tags
  │    │    └─ For Typesense indexing
  │    │
  │    └─→ Update ProductCore
  │         ├─ Set all new fields
  │         ├─ Set status: "approved"
  │         └─ Set updatedAt timestamp
  │
  └─→ Update RefinerJob
       ├─ Status: "completed"
       ├─ productsSuccessful count
       └─ Completion timestamp
```

---

## Identity Hashing Example

```
SCENARIO: Same laptop imported from 3 sources

Source 1: AliExpress
  Title: "16GB Laptop Computer RTX 4090 15.6 Inch FHD"
  Image: "https://cdn.aliexpress.com/products/123/456.jpg"

Source 2: Amazon
  Title: "Laptop 16GB RTX 4090 15.6\""
  Image: "https://cdn.amazon.com/images/789.jpg"

Source 3: Allegro
  Title: "RTX 4090 Laptop 16 GB FHD 15.6"
  Image: "https://img.allegro.pl/s1000/products/999.jpg"

STEP 1: Normalize Titles
  Source 1 → "16gb laptop computer rtx 4090 156 inch fhd"
  Source 2 → "laptop 16gb rtx 4090 156"
  Source 3 → "rtx 4090 laptop 16 gb fhd 156"

  Similarity: All similar enough for deduplication

STEP 2: Calculate Hashes
  titleHash_1 = SHA256("16gb laptop computer rtx 4090 156 inch fhd")
               = "a1b2c3d4e5f6..."
  
  titleHash_2 = SHA256("laptop 16gb rtx 4090 156")
               = "x9y8z7w6v5u4..."
  
  titleHash_3 = SHA256("rtx 4090 laptop 16 gb fhd 156")
               = "p8q7r6s5t4u3..."

  Note: Different title normalizations = different hashes
  So we also check image similarity...

STEP 3: Image Hash (Primary for dedup)
  imageHash = SHA256(imageUrl_normalized)
  
  All three images are different → Different imageHash
  
STEP 4: Combined Identity Hash
  identityHash = SHA256(titleHash + imageHash)
  
  Source 1: SHA256("a1b2c3..." + "img1Hash")
            = "final123..."
  
  Source 2: SHA256("x9y8z7..." + "img2Hash")
            = "final456..."
  
  Source 3: SHA256("p8q7r6..." + "img3Hash")
            = "final789..."

RESULT: All three create different ProductCores
  But each creates a Deal
  Best price = MIN(all_deal_prices)

ALTERNATIVE: If images were same...
  identityHash_1 = identityHash_2 = identityHash_3
  
  First product creates ProductCore
  Second product: Sees existing ProductCore
    → Creates Deal only (links to existing)
  Third product: Sees existing ProductCore
    → Creates Deal only (links to existing)
  
  RESULT: 1 ProductCore + 3 Deals
```

---

## Omnibus Directive Compliance

```
Requirement: Show lowest price from last 30 days

Implementation:
  
Deal.priceHistory = [
  { date: "2025-12-01", price: 299, lowestPrice: 299 },
  { date: "2025-12-02", price: 299, lowestPrice: 299 },
  { date: "2025-12-03", price: 289, lowestPrice: 289 },  ← Price dropped
  { date: "2025-12-04", price: 289, lowestPrice: 289 },
  { date: "2025-12-05", price: 329, lowestPrice: 289 },  ← Price raised, but
  ...                                                      ← Still show lowest
  { date: "2025-12-20", price: 319, lowestPrice: 289 },
]

PriceHistoryChart:
  ├─ Aggregates across all deals
  ├─ Shows lowest price per day
  ├─ X-axis: Dates (last 30 days)
  ├─ Y-axis: Price in USD
  ├─ Stats:
  │  ├─ Lowest: $289
  │  ├─ Highest: $329
  │  ├─ Average: $306
  │  └─ Trend: ↓ 5% (down from start)
  │
  └─ Compliance Badge:
     "✓ Shows lowest price available
      in the last 30 days (Omnibus Directive)"
```

---

## Component Hierarchy

```
ProductDetailPage
├─ Hero Section
│  ├─ Image Gallery
│  │  ├─ Main Image
│  │  └─ Thumbnails (carousel)
│  │
│  └─ Best Price Widget
│     ├─ Title + Star Rating
│     ├─ BIG GREEN PRICE
│     ├─ Price Breakdown
│     │  ├─ Product: $299
│     │  ├─ Shipping: FREE
│     │  └─ Total: $299
│     ├─ Delivery Time
│     ├─ "Buy Now" Button
│     ├─ "Add to Favorites" Button
│     └─ Share Button
│
├─ PriceComparisonTable
│  ├─ Table Header (Store, Price, Shipping, Total, Delivery, Rating)
│  ├─ Table Rows (one per deal)
│  │  └─ "Best Price" highlight on best deal
│  └─ Summary (X stores available)
│
├─ ProductPriceHistoryChart
│  ├─ Stats Grid (Low, High, Avg, Change %)
│  └─ Area Chart (30-day trend)
│
├─ SpecsTable
│  └─ Rows: Key (spec) | Value
│
└─ Descriptions
   ├─ Short Description
   └─ Full Description (HTML)
```

---

**Last Updated:** December 20, 2025  
**Status:** Production Ready
