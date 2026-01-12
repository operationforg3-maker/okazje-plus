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

import { ProductCoreDeepData, ProductCoreDeepDataSchema, GalleryItem, Specification, Logistics, Seller, PriceHistoryEntry } from '@/lib/schema';
import { ProductCore } from '@/lib/types';
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
 * Returns structured specs array for ProductCore.specificationsStructured
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
    
    // Categorize specification (only valid categories)
    let category: 'Appearance' | 'Physical' | 'Material' | 'Technical' | undefined;
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
 * Returns GalleryItem[] for ProductCore.gallery field
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
 * Map AliExpress API response to ProductCore Deep Data fields
 * 
 * Returns partial ProductCore object with Deep Data extensions populated.
 * This should be merged with existing ProductCore data or used to create new product.
 * 
 * @param apiProduct - Raw AliExpress API response
 * @param options - Mapping options (locale, category)
 * @returns Success with partial ProductCore data, or failure with errors
 */
export async function mapAliExpressToProductCoreDeepData(
  apiProduct: AliExpressProductDetail,
  options?: {
    locale?: 'pl' | 'en' | 'de';
    categorySlug?: string;
  }
): Promise<{ success: true; data: Partial<ProductCore> } | { success: false; errors: string[] }> {
  const locale = options?.locale || 'pl';
  
  try {
    // Extract Deep Data components
    const specificationsStructured = extractSpecifications(apiProduct.attributeList);
    const gallery = extractGallery(
      apiProduct.productMainImageUrl,
      apiProduct.productSmallImageUrls,
      apiProduct.productVideoUrl
    );
    const logistics = extractLogistics(apiProduct);
    const seller = extractSeller(apiProduct);
    
    // Build Deep Data object
    const normalizedSpecs: Specification[] = specificationsStructured
      .map((spec, idx): Specification => ({
        label: spec.label ?? spec.value ?? `Spec ${idx + 1}`,
        value: spec.value ?? '',
        category: spec.category,
        unit: spec.unit,
        order: spec.order,
      }))
      .filter((spec) => !!spec.label && !!spec.value);

    const deepData: ProductCoreDeepData = {
      specificationsStructured: normalizedSpecs,
      gallery,
      logistics,
      seller,
    };
    
    // Validate Deep Data with Zod
    const validationResult = ProductCoreDeepDataSchema.safeParse(deepData);
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        issue => `${issue.path.join('.')}: ${issue.message}`
      );
      
      logger.error('Deep Data validation failed', {
        productId: apiProduct.productId,
        errors,
      });
      
      return { success: false, errors };
    }
    
    const { logistics: parsedLogistics, seller: parsedSeller } = validationResult.data;

    const resolvedSpecs = normalizedSpecs as NonNullable<ProductCore["specificationsStructured"]>;
    const resolvedGallery = (validationResult.data.gallery ?? gallery ?? []) as NonNullable<ProductCore["gallery"]>;
    const resolvedLogistics = (parsedLogistics ?? logistics) as NonNullable<ProductCore["logistics"]> | undefined;
    const resolvedSeller = (parsedSeller ?? seller) as NonNullable<ProductCore["seller"]> | undefined;

    // Build partial ProductCore with Deep Data + existing fields
    const productCorePartial: Partial<ProductCore> = {
      // Deep Data extensions
      specificationsStructured: resolvedSpecs,
      gallery: resolvedGallery,
      logistics: resolvedLogistics,
      seller: resolvedSeller,
      
      // Map to existing ProductCore fields for backward compatibility
      images: resolvedGallery.filter(g => g.type === 'IMAGE').map(g => g.url),
      videoUrl: resolvedGallery.find(g => g.type === 'VIDEO')?.url,
      
      // Convert structured specs to flat map for legacy specs field
      specs: resolvedSpecs.reduce((acc, spec) => {
        acc[spec.label] = spec.value;
        return acc;
      }, {} as Record<string, string>),
      
      // Metadata
      metadata: {
        source: 'aliexpress',
        originalId: apiProduct.productId,
        importedAt: new Date().toISOString(),
      },
    };
    
    logger.info('Successfully mapped AliExpress product to ProductCore Deep Data', {
      productId: apiProduct.productId,
      specsCount: specificationsStructured.length,
      galleryCount: gallery.length,
      hasVideo: !!apiProduct.productVideoUrl,
      hasLogistics: !!logistics,
      hasSeller: !!seller,
    });
    
    return { success: true, data: productCorePartial };
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
): Promise<Array<{ success: true; data: Partial<ProductCore> } | { success: false; errors: string[]; productId?: string }>> {
  const results = await Promise.all(
    apiProducts.map(async (apiProduct) => {
      const result = await mapAliExpressToProductCoreDeepData(apiProduct, options);
      
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
