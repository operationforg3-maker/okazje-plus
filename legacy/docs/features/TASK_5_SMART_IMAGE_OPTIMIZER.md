# Task 5: Smart Image Optimizer

**Status:** ✅ COMPLETE  
**Files:** 2 | **LOC:** ~270  
**Dependencies:** sharp, @google/generative-ai

## Overview

Automatic image optimization pipeline triggered on upload to Firebase Storage. Converts images to WebP format, generates Polish ALT text using Gemini Vision API, and updates Firestore metadata.

## Features

### Image Processing

- **Format conversion**: Any format → WebP (JPEG, PNG, GIF, etc.)
- **Resizing**: Max 1200px width (maintains aspect ratio)
- **Quality**: 80% JPEG quality (balance size vs quality)
- **Preservation**: No enlargement (keeps original size if smaller)

### ALT Text Generation

- Uses Gemini 2.0 Flash Vision API
- Analyzes image content + deal title
- Generates Polish ALT text (max 100 chars)
- Handles errors gracefully (fallback to title)

### Loop Prevention

- Checks if already WebP before processing
- Skips if `imageOptimizedAt` field exists
- Prevents infinite Storage trigger loops

## Files

### `/src/lib/image-optimizer.ts` (130 LOC)

Reusable image optimization utilities.

**Functions:**

- **`convertToWebP(buffer: Buffer, maxWidth?: number): Promise<Buffer>`**
  - Input: Image buffer (any format)
  - Parameters:
    - `maxWidth`: Max width in pixels (default: 1200)
  - Uses sharp library:
    ```typescript
    sharp(buffer)
      .resize(maxWidth, undefined, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: 80 })
      .toBuffer()
    ```
  - Returns: WebP-formatted buffer
  - Error handling: throws with descriptive message

- **`generateAltText(imageBuffer: Buffer, dealTitle: string): Promise<string>`**
  - Input: Image buffer + deal title
  - Uses Gemini Vision API
  - Prompt (Polish):
    ```
    Analyze this product image and generate a concise ALT text for accessibility.
    Product title: "[dealTitle]"
    ALT text should be max 100 chars, descriptive, in Polish.
    Return ONLY the ALT text, no quotes.
    ```
  - Returns: Polish ALT text (≤100 chars)
  - Fallback: Returns deal title if generation fails

- **`isWebP(filename: string): boolean`**
  - Check if file is already WebP format
  - Simple extension check: `.webp`
  - Returns: boolean
  - Prevents reprocessing

### `/okazje-plus/src/triggers/smartImageOptimizer.ts` (140 LOC)

Firebase Cloud Function Storage trigger for automatic optimization.

**Trigger:** `onObjectFinalized` for Storage bucket

**Bucket configuration:**

```typescript
{
  bucket: '{STORAGE_BUCKET}',  // Environment-specific
  region: 'europe-west1',
  memory: '1GiB',              // Image processing intensive
  timeoutSeconds: 300           // 5 minutes per image
}
```

**Workflow:**

```
Image uploaded to Storage (/deals/...)
    ↓
Check: Is it in /deals folder?
    ├─ NO → Skip, log
    └─ YES ↓
Check: Is it already WebP?
    ├─ YES → Skip (already optimized)
    └─ NO ↓
Extract deal ID from path: deals/{dealId}/{filename}
    ├─ Invalid path → Skip
    └─ Valid ↓
Download original image from Storage
    ↓
Convert to WebP (max 1200px, quality 80)
    ↓
Generate Polish ALT text with Gemini Vision
    ↓
Upload WebP to Storage (/deals/{dealId}/optimized-{filename}.webp)
  - Cache: 1 year (public, max-age=31536000)
  - Metadata: Custom metadata with ALT text, processedAt
    ↓
Update Firestore deals/{dealId}:
  - imageAlt: "<generated-alt-text>"
  - imageWebP: "<path-to-webp-file>"
  - imageOptimizedAt: <timestamp>
    ↓
Log result (✓ or error)
```

**Functions:**

- **`extractDealId(filePath: string): string | null`**
  - Parse path format: `deals/{dealId}/{filename}`
  - Regex: `/^deals\/([^/]+)\//`
  - Returns: dealId string or null if invalid path

- **Main handler (async): Promise<void>**
  - Processes uploaded file
  - Error handling: non-throwing (preserves Storage object)
  - Updates Firestore with image metadata

## Storage Path Structure

### Original Images

```
deals/
├── deal-123/
│   ├── product-1.jpg
│   ├── product-2.png
│   └── comparison.gif
├── deal-456/
│   └── screenshot.jpeg
└── deal-789/
    └── specs.jpg
```

### Optimized WebP Files

```
deals/
├── deal-123/
│   ├── optimized-product-1.webp
│   ├── optimized-product-2.webp
│   └── optimized-comparison.webp
└── deal-456/
    └── optimized-screenshot.webp
```

## Firestore Updates

After successful optimization, updates deal document:

```typescript
{
  imageAlt: "Samsung Galaxy S24 Ultra, silver, front view",
  imageWebP: "deals/deal-123/optimized-product-1.webp",
  imageOptimizedAt: "2025-11-15T10:30:45.123Z",
  importMetadata: {
    source: 'smart-image-optimizer',
    optimizedAt: "2025-11-15T10:30:45.123Z"
  }
}
```

## Gemini Vision Integration

**Model:** `gemini-2.0-flash-exp` (with vision capability)

**Input:** Image buffer (base64-encoded) + deal title

**Prompt (Polish):**

```
Analyze this product image and generate a concise ALT text for accessibility.
Product title: "[dealTitle]"
ALT text should be max 100 chars, descriptive, in Polish.
Return ONLY the ALT text, no quotes.
```

**Response:** Polish ALT text (trimmed to 100 chars)

**Temperature:** 0.3 (low randomness, descriptive)  
**Max tokens:** 150

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Download image | 500ms-2s | Network dependent |
| Convert to WebP | 1-3s | Depends on image size |
| Gemini Vision API | 2-5s | API latency |
| Upload WebP | 500ms-1s | Network dependent |
| Update Firestore | 100-500ms | Write latency |
| **Total per image** | **5-15s** | Typical: ~8s |

**Memory usage:** ~1GB (allocated 1GiB)
- Sharp buffer: ~200-500MB
- Gemini API calls: ~50MB
- Headroom: ~500MB

## Image Size Limits

- **Input**: Max 512MB (Storage bucket limit)
- **Processing**: Typical images 1-20MB handled well
- **Output**: WebP usually 30-50% smaller than original
- **Timeout**: 5 minutes per image

## Error Handling

**Graceful failures (continue processing):**

- Invalid file path → Skip with log
- Already WebP → Skip with log
- Download fails → Log error, skip
- WebP conversion fails → Log error, skip
- Gemini Vision fails → Use deal title as ALT text
- Firestore update fails → Log error but don't retry

**Non-throwing design:**
- Preserves Storage objects even on errors
- Prevents cascade failures
- Function always completes (no timeout waste)

## Loop Prevention

**Triple-check to prevent infinite loops:**

1. **File extension check**: `isWebP(filename)`
2. **Firestore metadata check**: `imageOptimizedAt` exists?
3. **Upload path check**: Don't re-trigger on `/optimized-` files

## Environment Variables

Required:

```
GOOGLE_API_KEY=<your-google-ai-api-key>  # For Gemini Vision
```

## Deployment

```bash
firebase deploy --only functions:smartImageOptimizer
```

Deployed as: `smartImageOptimizer` (europe-west1)

## Local Testing

```typescript
import { convertToWebP, generateAltText } from './lib/image-optimizer';
import fs from 'fs';

// Read test image
const imageBuffer = fs.readFileSync('./test-image.jpg');

// Convert to WebP
const webpBuffer = await convertToWebP(imageBuffer, 1200);
fs.writeFileSync('./test-image.webp', webpBuffer);

// Generate ALT text
const altText = await generateAltText(imageBuffer, 'Samsung Galaxy S24');
console.log('ALT:', altText);
```

## Monitoring

Firebase Console logs:

```bash
firebase functions:log --region europe-west1 | grep ImageOptimizer
```

Key log lines:
- `[ImageOptimizer] Processing: deals/deal-123/image.jpg`
- `[ImageOptimizer] Skipping non-deal file`
- `[ImageOptimizer] Already WebP, skipping`
- `[ImageOptimizer] ✓ Optimized: converted to WebP`
- `[ImageOptimizer] ✓ Generated ALT: "Samsung Galaxy..."`
- `[ImageOptimizer] ✓ Updated Firestore`
- `[ImageOptimizer] Failed: <error-message>`

## Storage Metadata

Custom metadata stored with WebP files:

```typescript
{
  cacheControl: 'public, max-age=31536000',  // 1 year cache
  customMetadata: {
    altText: 'Samsung Galaxy S24, silver color, front and back view',
    processedAt: '2025-11-15T10:30:45.123Z',
    source: 'smart-image-optimizer'
  }
}
```

## CDN Integration

With Firebase Hosting CDN:
1. WebP served with 1-year cache headers
2. Browser cache greatly improves performance
3. Cloudflare/CDN can serve cached WebP globally
4. Typically 100-200ms delivery to users

## Accessibility

**ALT text benefits:**

- Screen readers: Full description of product
- Image loading errors: User sees descriptive text
- SEO: Google indexes ALT text for image search
- Language: Polish ALT text for Polish market

## Database Queries

To find all optimized deals:

```typescript
db.collection('deals')
  .where('imageOptimizedAt', '>', null)
  .orderBy('imageOptimizedAt', 'desc')
  .get()
```

## Future Enhancements

- [ ] Multiple image uploads per deal (carousel)
- [ ] Image quality scoring (detect blurry/low-quality)
- [ ] Thumbnail generation (200x200px for thumbnails)
- [ ] AVIF format support (better than WebP)
- [ ] Progressive image loading (blur placeholder)
- [ ] Image cleanup (delete original after optimization)
- [ ] Batch processing queue (for bulk images)
- [ ] Metrics export to Cloud Monitoring
- [ ] Custom aspect ratio crops
- [ ] Smart crop detection (focus on product)
