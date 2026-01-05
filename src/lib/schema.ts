/**
 * DEEP DATA SCHEMA - Golden Standard for Product Data
 * Built with Zod for runtime validation + TypeScript types
 * 
 * Part 1: Backend Schema Definition
 * - Specifications (structured key-value pairs)
 * - Gallery (images + videos with thumbnails)
 * - Logistics (shipping info)
 * - Seller (marketplace seller data)
 * - Price History (time-series pricing)
 * - Multi-language support (title, description)
 */

import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const MediaTypeEnum = z.enum(['IMAGE', 'VIDEO']);
export type MediaType = z.infer<typeof MediaTypeEnum>;

export const SupportedLocale = z.enum(['pl', 'en', 'de']);
export type Locale = z.infer<typeof SupportedLocale>;

// ============================================================================
// CORE SCHEMAS
// ============================================================================

/**
 * Specification - Key-value pair for product attributes
 * Example: { label: "Material", value: "Cotton" }
 */
export const SpecificationSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  category: z.string().optional(), // e.g., "Technical", "Physical", "Package"
});

/**
 * Gallery Item - Supports both images and videos
 * Videos must have thumbnail for preview
 */
export const GalleryItemSchema = z.object({
  url: z.string().url(),
  type: MediaTypeEnum,
  thumbnail: z.string().url().optional(), // Required for videos
  alt: z.string().optional(),
  order: z.number().int().min(0).optional(),
}).refine(
  (data) => data.type !== 'VIDEO' || !!data.thumbnail,
  { message: "Videos must have a thumbnail" }
);

/**
 * Logistics - Shipping and delivery information
 */
export const LogisticsSchema = z.object({
  deliveryDays: z.number().int().min(0),
  deliveryDaysMax: z.number().int().min(0).optional(), // For ranges like "7-14 days"
  isFreeShipping: z.boolean(),
  shippingCost: z.number().min(0), // In PLN (base currency)
  shippingCostUSD: z.number().min(0).optional(),
  estimatedDeliveryDate: z.string().optional(), // ISO date
  carrier: z.string().optional(), // e.g., "AliExpress Standard Shipping"
});

/**
 * Seller - Marketplace seller information
 */
export const SellerSchema = z.object({
  name: z.string().min(1),
  rating: z.number().min(0).max(5), // Star rating
  ratingCount: z.number().int().min(0).optional(), // Number of ratings
  followers: z.number().int().min(0).optional(),
  storeUrl: z.string().url().optional(),
  storeId: z.string().optional(),
  positiveRatingPercentage: z.number().min(0).max(100).optional(),
  establishedDate: z.string().optional(), // ISO date
  badges: z.array(z.string()).optional(), // e.g., ["Top Brand", "Verified"]
});

/**
 * Price History Entry - Single point in time-series
 */
export const PriceHistoryEntrySchema = z.object({
  date: z.string(), // ISO 8601 timestamp
  price: z.number().min(0), // In PLN
  priceUSD: z.number().min(0).optional(),
  currency: z.string().default('PLN'),
  discount: z.number().min(0).max(100).optional(), // Percentage
});

/**
 * Review Summary - Aggregate review data (optional for now)
 */
export const ReviewSummarySchema = z.object({
  average: z.number().min(0).max(5),
  count: z.number().int().min(0),
  distribution: z.object({
    five: z.number().int().min(0),
    four: z.number().int().min(0),
    three: z.number().int().min(0),
    two: z.number().int().min(0),
    one: z.number().int().min(0),
  }).optional(),
  withPhotos: z.number().int().min(0).optional(),
  withVideos: z.number().int().min(0).optional(),
});

/**
 * Multi-Language Content
 * Keys: 'pl', 'en', 'de'
 */
export const MultiLangTextSchema = z.record(
  SupportedLocale,
  z.string()
);

// ============================================================================
// MAIN PRODUCT SCHEMA
// ============================================================================

/**
 * Product Schema - The Golden Standard
 * 
 * This is the canonical data structure for all products in the system.
 * All ingestion pipelines (AliExpress, Amazon, Allegro) must map to this schema.
 */
export const ProductSchema = z.object({
  // === Identity ===
  id: z.string().optional(), // Firestore document ID
  externalId: z.string().optional(), // Source platform ID
  source: z.enum(['aliexpress', 'amazon', 'allegro', 'manual']),
  sourceUrl: z.string().url(),
  
  // === Core Content (Multi-Language) ===
  title: MultiLangTextSchema,
  description: MultiLangTextSchema,
  
  // === Specifications (NEW) ===
  specifications: z.array(SpecificationSchema).default([]),
  
  // === Media (NEW) ===
  gallery: z.array(GalleryItemSchema).min(1), // At least one image required
  thumbnail: z.string().url().optional(), // Primary thumbnail (first gallery item)
  
  // === Pricing ===
  price: z.object({
    current: z.number().min(0),
    original: z.number().min(0).optional(), // Crossed-out price
    currency: z.string().default('PLN'),
    currencyUSD: z.number().min(0).optional(),
    discount: z.number().min(0).max(100).optional(), // Percentage off
    lowest30d: z.number().min(0).optional(), // Lowest price in last 30 days (Omnibus)
  }),
  
  // === Logistics (NEW) ===
  logistics: LogisticsSchema.optional(),
  
  // === Seller (NEW) ===
  seller: SellerSchema.optional(),
  
  // === Price History (NEW) ===
  priceHistory: z.array(PriceHistoryEntrySchema).default([]),
  
  // === Reviews (Optional) ===
  reviews: ReviewSummarySchema.optional(),
  
  // === Categories ===
  categorySlug: z.string().optional(),
  mainCategorySlug: z.string().optional(),
  subCategorySlug: z.string().optional(),
  subSubCategorySlug: z.string().optional(),
  
  // === Metadata ===
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('pending'),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
  importedAt: z.string().optional(),
  
  // === Search & Discovery ===
  tags: z.array(z.string()).default([]),
  searchTags: z.array(z.string()).default([]),
  
  // === Stats ===
  views: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
});

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type Product = z.infer<typeof ProductSchema>;
export type Specification = z.infer<typeof SpecificationSchema>;
export type GalleryItem = z.infer<typeof GalleryItemSchema>;
export type Logistics = z.infer<typeof LogisticsSchema>;
export type Seller = z.infer<typeof SellerSchema>;
export type PriceHistoryEntry = z.infer<typeof PriceHistoryEntrySchema>;
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
export type MultiLangText = z.infer<typeof MultiLangTextSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse product data with detailed error messages
 */
export function validateProduct(data: unknown): { success: true; data: Product } | { success: false; errors: string[] } {
  const result = ProductSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(
    issue => `${issue.path.join('.')}: ${issue.message}`
  );
  
  return { success: false, errors };
}

/**
 * Partial validation - useful for updates
 */
export const PartialProductSchema = ProductSchema.partial();
export type PartialProduct = z.infer<typeof PartialProductSchema>;
