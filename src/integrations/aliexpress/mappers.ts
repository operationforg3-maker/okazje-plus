/**
 * AliExpress data mappers
 * 
 * Transform AliExpress API responses to internal Product and Deal types
 */

import { Product, Deal, ProductRatingCard, ProductImageEntry } from '@/lib/types';
import { AliExpressProduct } from './types';
import { logger } from '@/lib/logging';

/**
 * Configuration for mapping
 */
export interface MapperConfig {
  targetMainCategory: string;
  targetSubCategory: string;
  targetSubSubCategory?: string;
  priceMarkup?: number; // Percentage (e.g., 10 = 10% markup)
  defaultStatus?: 'draft' | 'approved';
  importedBy: string; // UID of user importing
}

/**
 * Map AliExpress product to internal Product type
 */
export function mapToProduct(
  aliProduct: AliExpressProduct,
  config: MapperConfig
): Omit<Product, 'id'> {
  const now = new Date().toISOString();
  
  // Calculate price with optional markup
  let price = aliProduct.price.current;
  if (config.priceMarkup && config.priceMarkup > 0) {
    price = price * (1 + config.priceMarkup / 100);
  }
  
  // Calculate discount percentage
  const discountPercent = aliProduct.price.original && aliProduct.price.original > 0
    ? Math.round(((aliProduct.price.original - aliProduct.price.current) / aliProduct.price.original) * 100)
    : undefined;
  
  // Map images
  const gallery: ProductImageEntry[] = aliProduct.image_urls.map((url, index) => ({
    id: `${aliProduct.item_id}-${index}`,
    type: 'url',
    src: url,
    isPrimary: index === 0,
    source: 'aliexpress',
    addedAt: now
  }));
  
  // Initialize rating card from AliExpress rating
  const ratingCard: ProductRatingCard = {
    average: aliProduct.rating?.score || 0,
    count: aliProduct.rating?.count || 0,
    durability: aliProduct.rating?.score || 0,
    easeOfUse: aliProduct.rating?.score || 0,
    valueForMoney: aliProduct.rating?.score || 0,
    versatility: aliProduct.rating?.score || 0
  };
  
  // Truncate title to 200 characters
  const name = aliProduct.title.length > 200 
    ? aliProduct.title.substring(0, 197) + '...'
    : aliProduct.title;
  
  // Create short description (first 300 chars)
  const description = aliProduct.description
    ? aliProduct.description.substring(0, 300)
    : aliProduct.title.substring(0, 300);
  
  const product: Omit<Product, 'id'> = {
    name,
    description,
    longDescription: aliProduct.description || aliProduct.title,
    image: aliProduct.image_urls[0] || '',
    imageHint: name, // TODO M2: Use AI to generate better image hints
    affiliateUrl: aliProduct.product_url,
    ratingCard,
    price: Math.round(price * 100) / 100, // Round to 2 decimals
    originalPrice: aliProduct.price.original,
    discountPercent,
    mainCategorySlug: config.targetMainCategory,
    subCategorySlug: config.targetSubCategory,
    subSubCategorySlug: config.targetSubSubCategory,
    status: config.defaultStatus || 'draft',
    gallery,
    metadata: {
      source: 'aliexpress',
      originalId: aliProduct.item_id,
      importedAt: now,
      importedBy: config.importedBy,
      orders: aliProduct.sales,
      shipping: aliProduct.shipping?.info || (aliProduct.shipping?.free ? 'Darmowa wysyłka' : undefined),
      merchant: aliProduct.merchant?.name
    }
  };
  
  logger.debug('Mapped AliExpress product to internal Product', {
    originalId: aliProduct.item_id,
    title: name
  });
  
  return product;
}

/**
 * Map AliExpress product to Deal (promotional layer)
 * 
 * Deals are created for products with significant discounts or special promotions
 */
export function mapToDeal(
  aliProduct: AliExpressProduct,
  config: MapperConfig,
  postedBy: string
): Omit<Deal, 'id'> | null {
  // Only create deal if there's a meaningful discount
  const hasDiscount = aliProduct.discount_percent && aliProduct.discount_percent >= 20;
  const hasOriginalPrice = aliProduct.price.original && aliProduct.price.original > aliProduct.price.current;
  
  if (!hasDiscount && !hasOriginalPrice) {
    logger.debug('Skipping deal creation - no significant discount', {
      originalId: aliProduct.item_id
    });
    return null;
  }
  
  const now = new Date().toISOString();
  
  // Calculate price with optional markup
  let price = aliProduct.price.current;
  let originalPrice = aliProduct.price.original;
  
  if (config.priceMarkup && config.priceMarkup > 0) {
    const markup = 1 + config.priceMarkup / 100;
    price = price * markup;
    if (originalPrice) {
      originalPrice = originalPrice * markup;
    }
  }
  
  // Create deal title
  const discountText = aliProduct.discount_percent 
    ? `-${aliProduct.discount_percent}%` 
    : '';
  const title = `${aliProduct.title.substring(0, 150)} ${discountText}`.trim();
  
  // Create description
  const description = aliProduct.description
    ? aliProduct.description.substring(0, 500)
    : `${aliProduct.title}\n\n${aliProduct.shipping?.free ? '✓ Darmowa wysyłka' : ''}`;
  
  const deal: Omit<Deal, 'id'> = {
    title,
    description,
    price: Math.round(price * 100) / 100,
    originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : undefined,
    link: aliProduct.product_url,
    image: aliProduct.image_urls[0] || '',
    imageHint: title,
    postedBy,
    postedAt: now,
    voteCount: 0,
    temperature: 0, // Will be calculated by system
    commentsCount: 0,
    category: config.targetMainCategory, // Legacy field
    mainCategorySlug: config.targetMainCategory,
    subCategorySlug: config.targetSubCategory,
    subSubCategorySlug: config.targetSubSubCategory,
    merchant: aliProduct.merchant?.name,
    shippingCost: aliProduct.shipping?.free ? 0 : aliProduct.shipping?.cost,
    status: config.defaultStatus || 'draft',
    createdBy: config.importedBy
  };
  
  logger.debug('Mapped AliExpress product to Deal', {
    originalId: aliProduct.item_id,
    discount: aliProduct.discount_percent
  });
  
  return deal;
}

/**
 * Validate if an AliExpress product meets import criteria
 */
export function validateProduct(
  product: AliExpressProduct,
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minOrders?: number;
    minDiscount?: number;
  }
): { valid: boolean; reason?: string } {
  if (!product.title || product.title.trim().length === 0) {
    return { valid: false, reason: 'Missing title' };
  }
  
  if (!product.image_urls || product.image_urls.length === 0) {
    return { valid: false, reason: 'No images' };
  }
  
  if (!product.product_url) {
    return { valid: false, reason: 'Missing product URL' };
  }
  
  if (filters) {
    if (filters.minPrice && product.price.current < filters.minPrice) {
      return { valid: false, reason: `Price below minimum (${filters.minPrice})` };
    }
    
    if (filters.maxPrice && product.price.current > filters.maxPrice) {
      return { valid: false, reason: `Price above maximum (${filters.maxPrice})` };
    }
    
    if (filters.minRating && product.rating && product.rating.score < filters.minRating) {
      return { valid: false, reason: `Rating below minimum (${filters.minRating})` };
    }
    
    if (filters.minOrders && product.sales && product.sales < filters.minOrders) {
      return { valid: false, reason: `Orders below minimum (${filters.minOrders})` };
    }
    
    if (filters.minDiscount && product.discount_percent && product.discount_percent < filters.minDiscount) {
      return { valid: false, reason: `Discount below minimum (${filters.minDiscount}%)` };
    }
  }
  
  return { valid: true };
}
