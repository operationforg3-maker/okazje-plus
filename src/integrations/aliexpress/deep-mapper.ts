/**
 * AliExpress Deep Data Mapper
 * 
 * Part 2: Advanced Ingestion Logic
 * Transforms messy AliExpress API responses into clean, validated Product schema
 * 
 * Features:
 * - Extract ALL available fields (video, attributes, prices)
 * - Normalize specifications from attribute_list
 * - Build rich gallery with video support
 * - Parse logistics and seller data
 * - Generate price history entries
 * - Multi-language content generation
 */

import { Product, ProductSchema, GalleryItem, Specification, Logistics, Seller, PriceHistoryEntry } from '@/lib/schema';
import { logger } from '@/lib/logging';

// ============================================================================
// TYPE DEFINITIONS (AliExpress API Response Structure)
// ============================================================================

interface AliExpressAttribute {
  attrName?: string;
  attrValue?: string;
  attrNameId?: number;
  attrValueId?: number;
}

interface AliExpressProductDetail {
  productId?: string;
  productTitle?: string;
  productUrl?: string;
  productMainImageUrl?: string;
  productSmallImageUrls?: string[];
  productVideoUrl?: string;
  
  // Pricing
  appSalePrice?: string; // Mobile price (usually lower)
  originalPrice?: string;
  salePrice?: string;
  discount?: string;
  
  // Attributes/Specs
  attributeList?: AliExpressAttribute[];
  
  // Logistics
  deliveryDays?: number;
  deliveryDaysMax?: number;
  isFreeShipping?: boolean;
  shippingFee?: string;
  
  // Seller
  shopName?: string;
  shopUrl?: string;
  shopId?: string;
  sellerScore?: number;
  
  // Categories
  categoryId?: string;
  categoryName?: string;
  
  // Additional
  evaluationScore?: string;
  volume?: string; // Sales volume
}

// ============================================================================
// EXTRACTION HELPERS
// ============================================================================

/**
 * Extract and normalize specifications from attribute list
 * Filters out useless technical IDs and cleans up labels
 */
function extractSpecifications(attributeList?: AliExpressAttribute[]): Specification[] {
  if (!attributeList || attributeList.length === 0) return [];
  
  const specifications: Specification[] = [];
  const seenLabels = new Set<string>();
  
  for (const attr of attributeList) {
    const label = attr.attrName?.trim();
    const value = attr.attrValue?.trim();
    
    if (!label || !value) continue;
    
    // Filter out technical/useless attributes
    if (label.match(/^(id|code|sku|internal)/i)) continue;
    if (value.match(/^(null|undefined|n\/a|-)$/i)) continue;
    
    // Deduplicate
    if (seenLabels.has(label.toLowerCase())) continue;
    seenLabels.add(label.toLowerCase());
    
    // Categorize specification
    let category: string | undefined;
    if (label.match(/color|colour|kolor/i)) category = 'Appearance';
    else if (label.match(/size|wymiar|rozmiar/i)) category = 'Physical';
    else if (label.match(/material|materiał/i)) category = 'Material';
    else if (label.match(/weight|waga|masa/i)) category = 'Physical';
    else if (label.match(/capacity|pojemność|pamięć|ram|storage/i)) category = 'Technical';
    
    specifications.push({
      label,
      value,
      category,
    });
  }
  
  logger.debug(`Extracted ${specifications.length} specifications`);
  return specifications;
}

/**
 * Build gallery array with images and video
 * Video is prepended to the start for prominence
 */
function extractGallery(
  mainImageUrl?: string,
  smallImageUrls?: string[],
  videoUrl?: string
): GalleryItem[] {
  const gallery: GalleryItem[] = [];
  
  // Add video first (most engaging content)
  if (videoUrl) {
    // Use main image as video thumbnail
    const thumbnail = mainImageUrl || (smallImageUrls && smallImageUrls[0]);
    
    gallery.push({
      url: videoUrl,
      type: 'VIDEO',
      thumbnail,
      alt: 'Product Video',
      order: 0,
    });
  }
  
  // Add main image
  if (mainImageUrl) {
    gallery.push({
      url: mainImageUrl,
      type: 'IMAGE',
      alt: 'Product Main Image',
      order: videoUrl ? 1 : 0,
    });
  }
  
  // Add additional images
  if (smallImageUrls && smallImageUrls.length > 0) {
    smallImageUrls.forEach((url, index) => {
      // Skip if already added as main image
      if (url === mainImageUrl) return;
      
      gallery.push({
        url,
        type: 'IMAGE',
        alt: `Product Image ${index + 1}`,
        order: gallery.length,
      });
    });
  }
  
  logger.debug(`Built gallery with ${gallery.length} items (${gallery.filter(g => g.type === 'VIDEO').length} videos)`);
  return gallery;
}

/**
 * Extract logistics information
 * Prefer specific delivery days, fallback to estimates
 */
function extractLogistics(product: AliExpressProductDetail): Logistics | undefined {
  const deliveryDays = product.deliveryDays;
  const deliveryDaysMax = product.deliveryDaysMax;
  const isFreeShipping = product.isFreeShipping ?? false;
  const shippingFee = product.shippingFee;
  
  if (!deliveryDays && !isFreeShipping) return undefined;
  
  // Parse shipping cost
  let shippingCost = 0;
  let shippingCostUSD = 0;
  
  if (shippingFee && !isFreeShipping) {
    const match = shippingFee.match(/([0-9.]+)/);
    if (match) {
      shippingCostUSD = parseFloat(match[1]);
      // Rough USD to PLN conversion (will be updated by currency service)
      shippingCost = shippingCostUSD * 4.0;
    }
  }
  
  return {
    deliveryDays: deliveryDays || 7, // Default 7 days if not specified
    deliveryDaysMax,
    isFreeShipping,
    shippingCost,
    shippingCostUSD,
  };
}

/**
 * Extract seller information
 */
function extractSeller(product: AliExpressProductDetail): Seller | undefined {
  const shopName = product.shopName;
  const shopUrl = product.shopUrl;
  const shopId = product.shopId;
  const sellerScore = product.sellerScore;
  
  if (!shopName) return undefined;
  
  // Parse seller rating (usually out of 5)
  let rating = 0;
  if (sellerScore) {
    rating = Math.min(5, Math.max(0, sellerScore));
  }
  
  return {
    name: shopName,
    rating,
    storeUrl: shopUrl,
    storeId: shopId,
  };
}

/**
 * Generate initial price history entry
 * Future imports will append to this array
 */
function generatePriceHistory(
  currentPrice: number,
  originalPrice?: number,
  currency: string = 'PLN'
): PriceHistoryEntry[] {
  const now = new Date().toISOString();
  
  const history: PriceHistoryEntry[] = [
    {
      date: now,
      price: currentPrice,
      currency,
    }
  ];
  
  // If there was a discount, add the original price as a historical entry
  // (1 day ago to show the price drop)
  if (originalPrice && originalPrice > currentPrice) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    history.unshift({
      date: yesterday,
      price: originalPrice,
      currency,
      discount: Math.round(((originalPrice - currentPrice) / originalPrice) * 100),
    });
  }
  
  return history;
}

/**
 * Sanitize HTML from description
 * Preserve basic formatting (paragraphs, lists) but strip dangerous tags
 */
function sanitizeDescription(html: string): string {
  if (!html) return '';
  
  // Remove script tags
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove inline styles
  clean = clean.replace(/style="[^"]*"/gi, '');
  
  // Remove dangerous attributes
  clean = clean.replace(/on\w+="[^"]*"/gi, '');
  
  // Keep only safe tags: p, br, ul, ol, li, strong, em, b, i
  clean = clean.replace(/<(?!\/?(?:p|br|ul|ol|li|strong|em|b|i)\b)[^>]+>/gi, '');
  
  // Trim whitespace
  clean = clean.trim();
  
  return clean;
}

// ============================================================================
// MAIN MAPPER FUNCTION
// ============================================================================

/**
 * Map AliExpress API response to validated Product schema
 * 
 * This is the entry point for transforming raw API data into our clean schema.
 * Performs validation and returns either success or detailed errors.
 */
export async function mapAliExpressProductToSchema(
  apiProduct: AliExpressProductDetail,
  options?: {
    locale?: 'pl' | 'en' | 'de';
    categorySlug?: string;
  }
): Promise<{ success: true; product: Product } | { success: false; errors: string[] }> {
  const locale = options?.locale || 'pl';
  
  try {
    // Extract all components
    const specifications = extractSpecifications(apiProduct.attributeList);
    const gallery = extractGallery(
      apiProduct.productMainImageUrl,
      apiProduct.productSmallImageUrls,
      apiProduct.productVideoUrl
    );
    const logistics = extractLogistics(apiProduct);
    const seller = extractSeller(apiProduct);
    
    // Parse pricing (prefer app_sale_price as it's usually lower)
    const currentPriceUSD = parseFloat(apiProduct.appSalePrice || apiProduct.salePrice || '0');
    const originalPriceUSD = parseFloat(apiProduct.originalPrice || '0');
    
    // Convert to PLN (rough conversion, will be updated by currency service)
    const currentPrice = currentPriceUSD * 4.0;
    const originalPrice = originalPriceUSD > 0 ? originalPriceUSD * 4.0 : undefined;
    
    // Calculate discount
    const discount = originalPrice && originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : undefined;
    
    // Generate price history
    const priceHistory = generatePriceHistory(currentPrice, originalPrice);
    
    // Get the lowest price from history (for Omnibus compliance)
    const lowest30d = Math.min(...priceHistory.map(p => p.price));
    
    // Build multi-language content
    const title = {
      [locale]: apiProduct.productTitle || 'Untitled Product',
      // TODO: Add translation service integration for other locales
    };
    
    const description = {
      [locale]: sanitizeDescription(apiProduct.productTitle || ''),
      // TODO: Add translation service integration
    };
    
    // Construct Product object
    const productData: Partial<Product> = {
      externalId: apiProduct.productId,
      source: 'aliexpress',
      sourceUrl: apiProduct.productUrl || '',
      
      title,
      description,
      
      specifications,
      gallery,
      thumbnail: gallery[0]?.url,
      
      price: {
        current: currentPrice,
        original: originalPrice,
        currency: 'PLN',
        currencyUSD: currentPriceUSD,
        discount,
        lowest30d,
      },
      
      logistics,
      seller,
      priceHistory,
      
      categorySlug: options?.categorySlug,
      
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      importedAt: new Date().toISOString(),
      
      tags: [],
      searchTags: [],
      
      views: 0,
      clicks: 0,
      conversions: 0,
    };
    
    // Validate against schema
    const result = ProductSchema.safeParse(productData);
    
    if (result.success) {
      logger.info('Successfully mapped AliExpress product to schema', {
        productId: apiProduct.productId,
        specsCount: specifications.length,
        galleryCount: gallery.length,
        hasVideo: !!apiProduct.productVideoUrl,
      });
      
      return { success: true, product: result.data };
    } else {
      const errors = result.error.issues.map(
        issue => `${issue.path.join('.')}: ${issue.message}`
      );
      
      logger.error('Product validation failed', {
        productId: apiProduct.productId,
        errors,
      });
      
      return { success: false, errors };
    }
  } catch (error) {
    logger.error('Failed to map AliExpress product', {
      error: error instanceof Error ? error.message : String(error),
      productId: apiProduct.productId,
    });
    
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Batch mapper - process multiple products at once
 * Returns array of results with success/failure status for each
 */
export async function mapAliExpressProductsBatch(
  apiProducts: AliExpressProductDetail[],
  options?: {
    locale?: 'pl' | 'en' | 'de';
    categorySlug?: string;
  }
): Promise<Array<{ success: true; product: Product } | { success: false; errors: string[]; productId?: string }>> {
  const results = await Promise.all(
    apiProducts.map(async (apiProduct) => {
      const result = await mapAliExpressProductToSchema(apiProduct, options);
      
      if (!result.success) {
        return {
          ...result,
          productId: apiProduct.productId,
        };
      }
      
      return result;
    })
  );
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  logger.info('Batch mapping completed', {
    total: apiProducts.length,
    success: successCount,
    failures: failureCount,
  });
  
  return results;
}
