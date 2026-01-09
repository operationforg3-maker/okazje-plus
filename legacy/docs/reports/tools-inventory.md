# Tools Inventory
Generated: 2025-12-17T13:06:40.372Z

| Category | Tool | Description | Has UI | Has API | Backend | Tests | Last Modified |
|---|---|---|:---:|:---:|:---:|:---:|---|
| Import | AliExpress Integration | Scrapes products from AliExpress via API... | ✅ | ✅ | ✅ | ✅ | 2025-12-17 |
| Import | Allegro Integration | Fetches deals and products from Allegro ... | ✅ | ✅ | ✅ | ❌ | 2025-12-17 |
| Import | CSV Bulk Import | Accepts CSV uploads with product/deal da... | ✅ | ✅ | ✅ | ❌ | 2025-12-17 |
| Enhancement | Price Monitoring | Tracks price changes over time for deals... | ❌ | ❌ | ❌ | ❌ | - |
| Enhancement | Product Enrichment (AI) | Uses Vertex AI Gemini to enhance product... | ✅ | ✅ | ✅ | ❌ | 2025-12-16 |
| Enhancement | Image Processing | Validates, optimizes, and stores product... | ❌ | ❌ | ❌ | ❌ | - |
| Enhancement | Category Mapping | Maps external marketplace categories to ... | ✅ | ✅ | ✅ | ❌ | 2025-12-15 |
| Translation | Multi-Language UI (next-intl) | i18n framework for Polish/English/German... | ❌ | ✅ | ✅ | ❌ | 2025-12-14 |
| Translation | Product Description Translation | Translates product titles and descriptio... | ✅ | ✅ | ✅ | ❌ | 2025-12-16 |
| Translation | Comment Localization | Optionally translates user comments for ... | ❌ | ✅ | ✅ | ❌ | 2025-12-14 |
| Data Quality | Duplicate Detection | Identifies and merges duplicate products... | ✅ | ❌ | ❌ | ❌ | 2025-11-28 |
| Monitoring | Import Job Status Tracking | Real-time monitoring of background impor... | ✅ | ✅ | ✅ | ❌ | 2025-12-17 |
| Monitoring | Voting & Temperature Algorithm | Heat-based ranking system that surfaces ... | ❌ | ✅ | ❌ | ❌ | 2025-12-11 |

## Tool Details
### AliExpress Integration
**Category:** Import
**Opis:** Scrapes products from AliExpress via API and imports into platform
**Przeznaczenie:** Automates product discovery and import workflow from AliExpress marketplace
**Sposób działania:** Uses AliExpress API to fetch product data, validates schema, enriches with translations, imports to Firestore

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (42) |
| Backend | ✅ |
| Tests | ✅ |
| Last Modified | 2025-12-17 |
| Owner | welldonetg974 |

### Allegro Integration
**Category:** Import
**Opis:** Fetches deals and products from Allegro Polish marketplace
**Przeznaczenie:** Enables automated deal discovery from Allegro via official API
**Sposób działania:** Calls Allegro REST API, parses deal/product listings, applies filters, stores in Firestore

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (35) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-17 |
| Owner | welldonetg974 |

### CSV Bulk Import
**Category:** Import
**Opis:** Accepts CSV uploads with product/deal data for bulk processing
**Przeznaczenie:** Allows partners to batch-upload products via structured CSV format
**Sposób działania:** Validates CSV schema, parses rows, performs duplicate checks, queues import jobs, processes asynchronously

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (34) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-17 |
| Owner | welldonetg974 |

### Price Monitoring
**Category:** Enhancement
**Opis:** Tracks price changes over time for deals and products
**Przeznaczenie:** Detects price drops and triggers notifications to users
**Sposób działania:** Scheduled Cloud Function samples product prices daily, calculates deltas, flags hot deals

| Property | Value |
|---|---|
| UI | ❌ |
| API Routes | ❌ (0) |
| Backend | ❌ |
| Tests | ❌ |
| Last Modified | - |
| Owner | - |

### Product Enrichment (AI)
**Category:** Enhancement
**Opis:** Uses Vertex AI Gemini to enhance product descriptions and categories
**Przeznaczenie:** Improves product data quality and searchability via AI-generated enhancements
**Sposób działania:** Genkit flow calls Gemini with product schema, generates better title/description/tags

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (15) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-16 |
| Owner | welldonetg974 |

### Image Processing
**Category:** Enhancement
**Opis:** Validates, optimizes, and stores product images in Firebase Storage
**Przeznaczenie:** Ensures image quality, handles multiple formats, generates thumbnails
**Sposób działania:** Downloads from source URLs, validates dimensions/format, resizes for web, uploads to Firebase with CDN

| Property | Value |
|---|---|
| UI | ❌ |
| API Routes | ❌ (0) |
| Backend | ❌ |
| Tests | ❌ |
| Last Modified | - |
| Owner | - |

### Category Mapping
**Category:** Enhancement
**Opis:** Maps external marketplace categories to platform 3-level hierarchy
**Przeznaczenie:** Normalizes diverse marketplace categories into consistent platform taxonomy
**Sposób działania:** Genkit flow analyzes category names, matches against predefined mappings, suggests categories

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (1) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-15 |
| Owner | welldonetg974 |

### Multi-Language UI (next-intl)
**Category:** Translation
**Opis:** i18n framework for Polish/English/German UI translation
**Przeznaczenie:** Provides route-based locale switching and translated UI components
**Sposób działania:** next-intl middleware intercepts by locale segment, loads JSON catalogs, provides hooks

| Property | Value |
|---|---|
| UI | ❌ |
| API Routes | ✅ (1) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-14 |
| Owner | welldonetg974 |

### Product Description Translation
**Category:** Translation
**Opis:** Translates product titles and descriptions to multiple languages via Genkit
**Przeznaczenie:** Makes products discoverable in German/English markets
**Sposób działania:** Genkit flow detects Polish text, calls Gemini to translate, validates quality, stores translations

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (16) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-16 |
| Owner | welldonetg974 |

### Comment Localization
**Category:** Translation
**Opis:** Optionally translates user comments for cross-language visibility
**Przeznaczenie:** Enables cross-language community engagement
**Sposób działania:** On comment creation, detects language, triggers translation flow, stores original + translations

| Property | Value |
|---|---|
| UI | ❌ |
| API Routes | ✅ (2) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-14 |
| Owner | welldonetg974 |

### Duplicate Detection
**Category:** Data Quality
**Opis:** Identifies and merges duplicate products from multiple import sources
**Przeznaczenie:** Prevents duplicate listings and improves catalog cleanliness
**Sposób działania:** Compares product title/URL/SKU against catalog, calculates similarity score, flags/merges duplicates

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ❌ (0) |
| Backend | ❌ |
| Tests | ❌ |
| Last Modified | 2025-11-28 |
| Owner | copilot-swe-agent[bot] |

### Import Job Status Tracking
**Category:** Monitoring
**Opis:** Real-time monitoring of background import jobs and processing status
**Przeznaczenie:** Provides admins with visibility into import queue, completion rates, error logs
**Sposób działania:** Cloud Function stores job state in Firestore, UI polls endpoint, displays progress and errors

| Property | Value |
|---|---|
| UI | ✅ |
| API Routes | ✅ (34) |
| Backend | ✅ |
| Tests | ❌ |
| Last Modified | 2025-12-17 |
| Owner | welldonetg974 |

### Voting & Temperature Algorithm
**Category:** Monitoring
**Opis:** Heat-based ranking system that surfaces trending deals/products
**Przeznaczenie:** Dynamically ranks content based on user engagement without raw vote counts
**Sposób działania:** Calculates temperature from votes + time decay, periodically recalculates hot deals, caches in Redis

| Property | Value |
|---|---|
| UI | ❌ |
| API Routes | ✅ (1) |
| Backend | ❌ |
| Tests | ❌ |
| Last Modified | 2025-12-11 |
| Owner | welldonetg974 |
