/**
 * Deep Data Schema (Zod Validation)
 * 
 * Part 1: Backend Schema Definition
 * Runtime validation schemas for ProductCore Deep Data extensions
 * 
 * This schema extends the existing ProductCore interface with structured
 * data for rich product presentation (gallery, logistics, seller, specs).
 * 
 * Compatible with M6 ProductCore architecture.
 */

import { z } from 'zod';

// ============================================================================
// SPECIFICATION SCHEMA
// ============================================================================

export const SpecificationSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.string().min(1, 'Value is required'),
  category: z.enum(['Appearance', 'Physical', 'Material', 'Technical']).optional(),
  unit: z.string().optional(), // e.g., 'GB', 'inches', 'kg'
  order: z.number().int().min(0).optional(),
});

export type Specification = z.infer<typeof SpecificationSchema>;

// ============================================================================
// GALLERY SCHEMA
// ============================================================================

export const GalleryItemSchema = z.object({
  url: z.string().url('Invalid image/video URL'),
  type: z.enum(['IMAGE', 'VIDEO']),
  thumbnail: z.string().url().optional(), // For video thumbnails
  alt: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

export type GalleryItem = z.infer<typeof GalleryItemSchema>;

// ============================================================================
// LOGISTICS SCHEMA
// ============================================================================

export const LogisticsSchema = z.object({
  deliveryDays: z.number().int().positive('Delivery days must be positive'),
  deliveryDaysMax: z.number().int().positive().optional(),
  isFreeShipping: z.boolean(),
  shippingCost: z.number().min(0, 'Shipping cost cannot be negative'),
  shippingCostUSD: z.number().min(0).optional(), // Original USD amount
});

export type Logistics = z.infer<typeof LogisticsSchema>;

// ============================================================================
// SELLER SCHEMA
// ============================================================================

export const SellerSchema = z.object({
  name: z.string().min(1, 'Seller name is required'),
  rating: z.number().min(0).max(5, 'Rating must be between 0 and 5').optional(), // M6+: Made optional for safety
  score: z.number().min(0).max(5).optional(), // M6+: Alternative field name
  positiveRate: z.string().optional(), // M6+: "98.5%" format for trust badge
  followers: z.number().int().min(0).optional(),
  storeUrl: z.string().url().optional(),
  storeId: z.string().optional(),
});

export type Seller = z.infer<typeof SellerSchema>;

// ============================================================================
// PRICE HISTORY SCHEMA (for DealM6.priceHistory validation)
// ============================================================================

export const PriceHistoryEntrySchema = z.object({
  date: z.string().datetime('Invalid date format'), // ISO 8601
  price: z.number().positive('Price must be positive'),
  currency: z.string().min(3).max(3).optional().default('PLN'), // ISO currency code
  lowestPrice: z.number().positive().optional(), // Omnibus compliance
  discount: z.number().int().min(0).max(100).optional(), // Discount percentage
});

export type PriceHistoryEntry = z.infer<typeof PriceHistoryEntrySchema>;

// ============================================================================
// PRODUCT CORE DEEP DATA EXTENSIONS (Partial Schema)
// ============================================================================

/**
 * Validation schema for ProductCore Deep Data fields only
 * Use this to validate incoming data before saving to Firestore
 */
export const ProductCoreDeepDataSchema = z.object({
  specificationsStructured: z.array(SpecificationSchema).optional(),
  gallery: z.array(GalleryItemSchema).optional(),
  logistics: LogisticsSchema.optional(),
  seller: SellerSchema.optional(),
});

export type ProductCoreDeepData = z.infer<typeof ProductCoreDeepDataSchema>;

// ============================================================================
// LEGACY SCHEMAS (kept for backward compatibility with old code)
// ============================================================================

/**
 * @deprecated Use ProductCoreDeepDataSchema for new code
 * Legacy full Product schema from initial implementation
 */
export const ProductSchema = z.object({
  id: z.string().optional(),
  externalId: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  
  title: z.record(z.string()).optional(), // Multi-language
  description: z.record(z.string()).optional(), // Multi-language
  
  // M6+ Enhanced: Video support
  videoUrl: z.string().url().optional(), // Direct .mp4 link for product video
  
  // M6+ Enhanced: Dual spec format (legacy + structured)
  specifications: z.array(SpecificationSchema).optional(),
  attributes: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).default([]), // M6+: Technical attributes (alternative to specifications)
  
  gallery: z.array(GalleryItemSchema).optional(),
  thumbnail: z.string().url().optional(),
  
  price: z.object({
    current: z.number().positive(),
    original: z.number().positive().optional(),
    currency: z.string().default('PLN'),
    currencyUSD: z.number().optional(),
    discount: z.number().int().min(0).max(100).optional(),
    lowest30d: z.number().positive().optional(),
  }).optional(),
  
  logistics: LogisticsSchema.optional(),
  seller: SellerSchema.optional(),
  warehouses: z.array(z.string()).default([]), // M6+: ['PL', 'CZ', 'CN'] - warehouse locations
  priceHistory: z.array(PriceHistoryEntrySchema).optional(),
  
  categorySlug: z.string().optional(),
  
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  importedAt: z.string().datetime().optional(),
  
  tags: z.array(z.string()).optional(),
  searchTags: z.array(z.string()).optional(),
  
  marketing: z.object({
    ordersCount: z.number().int().default(0),
  }).optional(),
  
  views: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
});

/**
 * @deprecated Use ProductCoreDeepData for new code
 */
export type Product = z.infer<typeof ProductSchema>;
