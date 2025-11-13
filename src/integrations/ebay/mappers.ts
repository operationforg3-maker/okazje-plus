/**
 * eBay Product Mappers
 * 
 * Transforms eBay API data to platform types
 */

import { Product, ProductRatingCard, ProductImageEntry } from '@/lib/types';
import { EbayProduct, EbayItemSummary } from './types';

/**
 * Map eBay product to platform Product
 */
export function mapEbayProductToProduct(
  ebayProduct: EbayProduct,
  targetCategory: { mainSlug: string; subSlug: string; subSubSlug?: string }
): Omit<Product, 'id'> {
  const price = parseFloat(ebayProduct.price.value);
  const originalPrice = ebayProduct.originalPrice
    ? parseFloat(ebayProduct.originalPrice.value)
    : undefined;
  
  const discountPercent = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : undefined;

  // Build rating card based on seller feedback
  const sellerRating = ebayProduct.seller.feedbackPercentage
    ? parseFloat(ebayProduct.seller.feedbackPercentage) / 100 * 5
    : 0;

  const ratingCard: ProductRatingCard = {
    average: sellerRating,
    count: ebayProduct.seller.feedbackScore || 0,
    durability: sellerRating,
    easeOfUse: sellerRating,
    valueForMoney: sellerRating,
    versatility: sellerRating,
  };

  // Build gallery from images
  const gallery: ProductImageEntry[] = [
    {
      id: `${ebayProduct.itemId}_img_0`,
      type: 'url' as const,
      src: ebayProduct.image.imageUrl,
      alt: ebayProduct.title,
      isPrimary: true,
      source: 'manual' as const,
      addedAt: new Date().toISOString(),
    },
    ...(ebayProduct.additionalImages || []).map((img, index) => ({
      id: `${ebayProduct.itemId}_img_${index + 1}`,
      type: 'url' as const,
      src: img.imageUrl,
      alt: ebayProduct.title,
      isPrimary: false,
      source: 'manual' as const,
      addedAt: new Date().toISOString(),
    })),
  ];

  // Build shipping info
  const shippingInfo = ebayProduct.shippingOptions
    ?.map(opt => {
      const cost = opt.shippingCost
        ? `${opt.shippingCost.value} ${opt.shippingCost.currency}`
        : 'Darmowa';
      const delivery = opt.minEstimatedDeliveryDate
        ? ` (dostawa: ${opt.minEstimatedDeliveryDate}${opt.maxEstimatedDeliveryDate ? ` - ${opt.maxEstimatedDeliveryDate}` : ''})`
        : '';
      return `- ${opt.shippingCostType}: ${cost}${delivery}`;
    })
    .join('\n');

  const longDescription = [
    ebayProduct.description || ebayProduct.shortDescription || '',
    ebayProduct.condition ? `\n\n**Stan:** ${ebayProduct.condition}` : '',
    shippingInfo ? `\n\n**Dostawa:**\n${shippingInfo}` : '',
    ebayProduct.itemLocation
      ? `\n\n**Lokalizacja:** ${ebayProduct.itemLocation.country}${ebayProduct.itemLocation.postalCode ? `, ${ebayProduct.itemLocation.postalCode}` : ''}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const product: Omit<Product, 'id'> = {
    name: ebayProduct.title,
    description: ebayProduct.shortDescription || ebayProduct.description || '',
    longDescription,
    image: gallery[0].src,
    imageHint: ebayProduct.title,
    affiliateUrl: ebayProduct.itemAffiliateWebUrl || ebayProduct.itemWebUrl,
    ratingCard,
    price,
    originalPrice,
    discountPercent,
    mainCategorySlug: targetCategory.mainSlug,
    subCategorySlug: targetCategory.subSlug,
    subSubCategorySlug: targetCategory.subSubSlug,
    status: 'draft',
    gallery,
    metadata: {
      source: 'manual' as const,
      originalId: ebayProduct.itemId,
      importedAt: new Date().toISOString(),
      merchant: ebayProduct.seller.username,
      rawDataStored: false,
    },
  };

  return product;
}

/**
 * Map eBay item summary to platform Product (lightweight version for search results)
 */
export function mapEbayItemSummaryToProduct(
  item: EbayItemSummary,
  targetCategory: { mainSlug: string; subSlug: string; subSubSlug?: string }
): Omit<Product, 'id'> {
  const price = parseFloat(item.price.value);
  
  const sellerRating = item.seller.feedbackPercentage
    ? parseFloat(item.seller.feedbackPercentage) / 100 * 5
    : 0;

  const ratingCard: ProductRatingCard = {
    average: sellerRating,
    count: 0,
    durability: sellerRating,
    easeOfUse: sellerRating,
    valueForMoney: sellerRating,
    versatility: sellerRating,
  };

  const gallery: ProductImageEntry[] = item.image ? [{
    id: `${item.itemId}_img_0`,
    type: 'url' as const,
    src: item.image.imageUrl,
    alt: item.title,
    isPrimary: true,
    source: 'manual' as const,
    addedAt: new Date().toISOString(),
  }] : [];

  const shippingInfo = item.shippingOptions?.[0]
    ? item.shippingOptions[0].shippingCost
      ? `Dostawa: ${item.shippingOptions[0].shippingCost.value} ${item.shippingOptions[0].shippingCost.currency}`
      : 'Darmowa dostawa'
    : '';

  const description = [
    item.condition ? `Stan: ${item.condition}` : '',
    shippingInfo,
  ]
    .filter(Boolean)
    .join(' | ');

  const product: Omit<Product, 'id'> = {
    name: item.title,
    description,
    longDescription: description,
    image: gallery[0]?.src || '',
    imageHint: item.title,
    affiliateUrl: item.itemWebUrl,
    ratingCard,
    price,
    mainCategorySlug: targetCategory.mainSlug,
    subCategorySlug: targetCategory.subSlug,
    subSubCategorySlug: targetCategory.subSubSlug,
    status: 'draft',
    gallery,
    metadata: {
      source: 'manual' as const,
      originalId: item.itemId,
      importedAt: new Date().toISOString(),
      merchant: item.seller.username,
      rawDataStored: false,
    },
  };

  return product;
}

/**
 * Extract category suggestions from eBay product
 */
export function extractCategorySuggestions(ebayProduct: EbayProduct): string[] {
  return ebayProduct.categoryPath ? [ebayProduct.categoryPath] : [];
}

/**
 * Normalize eBay product name for deduplication
 */
export function normalizeEbayProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate confidence score for eBay product
 */
export function calculateEbayProductConfidence(ebayProduct: EbayProduct): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on available data
  if (ebayProduct.description && ebayProduct.description.length > 100) confidence += 0.1;
  if (ebayProduct.additionalImages && ebayProduct.additionalImages.length > 0) confidence += 0.1;
  if (ebayProduct.seller.feedbackScore && ebayProduct.seller.feedbackScore > 100) confidence += 0.1;
  if (ebayProduct.seller.feedbackPercentage && parseFloat(ebayProduct.seller.feedbackPercentage) > 95) confidence += 0.1;
  if (ebayProduct.condition) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
