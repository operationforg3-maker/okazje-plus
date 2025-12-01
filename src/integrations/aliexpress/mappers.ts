/**
 * AliExpress data mappers
 * 
 * Transform AliExpress API responses to internal Product and Deal types
 */

import { Product, Deal, ProductRatingCard, ProductImageEntry } from '@/lib/types';
import { AliExpressProduct } from './types';
import { logger } from '@/lib/logging';
import { sanitizeDealPayload, sanitizeProductPayload } from '@/lib/sanitizers';

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
  
  const productDraft: Partial<Product> = {
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
      merchant: aliProduct.merchant?.name,
      // Enhanced fields
      specifications: aliProduct.specifications?.map(spec => ({
        name: spec.name,
        value: spec.value,
        unit: spec.unit
      })),
      shippingDetails: aliProduct.shipping ? {
        method: aliProduct.shipping.method,
        deliveryTime: aliProduct.shipping.delivery_time 
          ? `${aliProduct.shipping.delivery_time.min}-${aliProduct.shipping.delivery_time.max} ${aliProduct.shipping.delivery_time.unit}`
          : undefined,
        fromCountry: aliProduct.shipping.from_country,
        toCountry: aliProduct.shipping.to_country,
        cost: aliProduct.shipping.cost,
        free: aliProduct.shipping.free
      } : undefined,
      stock: aliProduct.stock ? {
        available: aliProduct.stock.available,
        total: aliProduct.stock.total,
        availability: aliProduct.availability
      } : undefined,
      warranty: aliProduct.warranty ? {
        type: aliProduct.warranty.type,
        duration: aliProduct.warranty.duration ? `${aliProduct.warranty.duration.value} ${aliProduct.warranty.duration.unit}` : undefined
      } : undefined,
      returnPolicy: aliProduct.return_policy ? {
        allowed: aliProduct.return_policy.allowed,
        days: aliProduct.return_policy.days,
        conditions: Array.isArray(aliProduct.return_policy.conditions) 
          ? aliProduct.return_policy.conditions.join(', ')
          : aliProduct.return_policy.conditions
      } : undefined,
      certifications: aliProduct.certifications,
      packageInfo: aliProduct.package_info ? {
        weight: aliProduct.package_info.weight ? `${aliProduct.package_info.weight.value}${aliProduct.package_info.weight.unit}` : undefined,
        dimensions: aliProduct.package_info.dimensions 
          ? `${aliProduct.package_info.dimensions.length}x${aliProduct.package_info.dimensions.width}x${aliProduct.package_info.dimensions.height}${aliProduct.package_info.dimensions.unit}`
          : undefined
      } : undefined,
      tags: aliProduct.tags,
      merchantDetails: aliProduct.merchant ? {
        name: aliProduct.merchant.name,
        rating: aliProduct.merchant.rating,
        followers: aliProduct.merchant.followers,
        positiveFeedback: aliProduct.merchant.positive_feedback
      } : undefined,
      videoUrl: aliProduct.video_url,
      appSalePrice: aliProduct.price.app_sale
    }
  };
  
  logger.debug('Mapped AliExpress product to internal Product', {
    originalId: aliProduct.item_id,
    title: name
  });
  
  return sanitizeProductPayload(productDraft);
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
  
  const dealDraft: Partial<Deal> = {
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
    createdBy: config.importedBy,
    metadata: {
      source: 'aliexpress',
      originalId: aliProduct.item_id,
      importedAt: now,
      orders: aliProduct.sales,
      // Enhanced deal fields
      flashSale: aliProduct.price.app_sale ? {
        active: true,
        appSalePrice: aliProduct.price.app_sale,
        originalPrice: aliProduct.price.current
      } : undefined,
      stockAlert: aliProduct.stock?.available && aliProduct.stock.available < 50 ? {
        lowStock: true,
        available: aliProduct.stock.available,
        total: aliProduct.stock.total
      } : undefined,
      dealTags: [
        ...(aliProduct.tags || []),
        ...(aliProduct.shipping?.free ? ['Darmowa wysyłka'] : []),
        ...(aliProduct.discount_percent && aliProduct.discount_percent >= 50 ? ['Super promocja'] : []),
        ...(aliProduct.availability === 'low_stock' || aliProduct.availability === 'out_of_stock' ? ['Limitowana dostępność'] : [])
      ].filter(Boolean),
      shippingDetails: aliProduct.shipping ? {
        method: aliProduct.shipping.method,
        deliveryTime: aliProduct.shipping.delivery_time 
          ? `${aliProduct.shipping.delivery_time.min}-${aliProduct.shipping.delivery_time.max} ${aliProduct.shipping.delivery_time.unit}`
          : undefined,
        fromCountry: aliProduct.shipping.from_country,
        free: aliProduct.shipping.free,
        cost: aliProduct.shipping.cost
      } : undefined,
      merchantRating: aliProduct.merchant?.rating,
      certifications: aliProduct.certifications,
      videoUrl: aliProduct.video_url
    }
  };
  
  logger.debug('Mapped AliExpress product to Deal', {
    originalId: aliProduct.item_id,
    discount: aliProduct.discount_percent
  });
  
  return sanitizeDealPayload(dealDraft);
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
    requireStock?: boolean;
    minMerchantRating?: number;
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
    
    if (filters.requireStock && (!product.stock?.available || product.availability === 'out_of_stock')) {
      return { valid: false, reason: 'Out of stock' };
    }
    
    if (filters.minMerchantRating && product.merchant?.rating && product.merchant.rating < filters.minMerchantRating) {
      return { valid: false, reason: `Merchant rating below minimum (${filters.minMerchantRating})` };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate deal quality score for prioritization
 * Higher score = better deal to import
 */
export function calculateDealScore(product: AliExpressProduct): number {
  let score = 0;
  
  // Discount weight (40 points max)
  if (product.discount_percent) {
    score += Math.min(product.discount_percent * 0.8, 40);
  }
  
  // Flash sale bonus (15 points)
  if (product.price.app_sale && product.price.app_sale < product.price.current) {
    score += 15;
  }
  
  // Rating weight (20 points max)
  if (product.rating?.score) {
    score += (product.rating.score / 5) * 20;
  }
  
  // Sales volume weight (15 points max)
  if (product.sales) {
    score += Math.min(Math.log10(product.sales) * 3, 15);
  }
  
  // Free shipping bonus (10 points)
  if (product.shipping?.free) {
    score += 10;
  }
  
  // Limited stock urgency (5 points)
  if (product.stock?.available && product.stock.available < 50) {
    score += 5;
  }
  
  // Merchant reputation (10 points max)
  if (product.merchant?.rating) {
    score += (product.merchant.rating / 5) * 10;
  }
  
  return Math.round(score);
}

/**
 * Sort products by deal quality score (descending)
 * Use this to prioritize best deals for import
 */
export function sortByDealQuality(products: AliExpressProduct[]): AliExpressProduct[] {
  return products
    .map(product => ({
      product,
      score: calculateDealScore(product)
    }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
}
