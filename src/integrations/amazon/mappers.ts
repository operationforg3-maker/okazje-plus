/**
 * Amazon Product Mappers
 * 
 * Transforms Amazon API data to platform types
 */

import { Product, ProductRatingCard, ProductImageEntry } from '@/lib/types';
import { AmazonProduct } from './types';

/**
 * Map Amazon product to platform Product
 */
export function mapAmazonProductToProduct(
  amazonProduct: AmazonProduct,
  targetCategory: { mainSlug: string; subSlug: string; subSubSlug?: string }
): Omit<Product, 'id'> {
  const discountPercent = amazonProduct.price.original
    ? Math.round(
        ((amazonProduct.price.original - amazonProduct.price.current) / amazonProduct.price.original) * 100
      )
    : undefined;

  const ratingCard: ProductRatingCard = {
    average: amazonProduct.rating?.score || 0,
    count: amazonProduct.rating?.count || 0,
    durability: amazonProduct.rating?.score || 0,
    easeOfUse: amazonProduct.rating?.score || 0,
    valueForMoney: amazonProduct.rating?.score || 0,
    versatility: amazonProduct.rating?.score || 0,
  };

  const gallery: ProductImageEntry[] = amazonProduct.imageUrls.map((url, index) => ({
    id: `${amazonProduct.asin}_img_${index}`,
    type: 'url' as const,
    src: url,
    alt: amazonProduct.title,
    isPrimary: index === 0,
    source: 'manual' as const,
    addedAt: new Date().toISOString(),
  }));

  const product: Omit<Product, 'id'> = {
    name: amazonProduct.title,
    description: amazonProduct.description || amazonProduct.features?.join('\n') || '',
    longDescription: [
      amazonProduct.description || '',
      amazonProduct.features ? `\n\n**Cechy:**\n${amazonProduct.features.join('\n')}` : '',
      amazonProduct.specifications
        ? `\n\n**Specyfikacja:**\n${Object.entries(amazonProduct.specifications)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    image: amazonProduct.imageUrls[0] || '',
    imageHint: amazonProduct.title,
    affiliateUrl: amazonProduct.productUrl,
    ratingCard,
    price: amazonProduct.price.current,
    originalPrice: amazonProduct.price.original,
    discountPercent,
    mainCategorySlug: targetCategory.mainSlug,
    subCategorySlug: targetCategory.subSlug,
    subSubCategorySlug: targetCategory.subSubSlug,
    status: 'draft',
    gallery,
    metadata: {
      source: 'manual' as const,
      originalId: amazonProduct.asin,
      importedAt: new Date().toISOString(),
      merchant: amazonProduct.brand || amazonProduct.manufacturer,
      rawDataStored: false,
    },
  };

  return product;
}

/**
 * Extract category suggestions from Amazon product
 */
export function extractCategorySuggestions(amazonProduct: AmazonProduct): string[] {
  return amazonProduct.categoryPath || [];
}

/**
 * Normalize Amazon product name for deduplication
 */
export function normalizeAmazonProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate confidence score for Amazon product
 */
export function calculateAmazonProductConfidence(amazonProduct: AmazonProduct): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on available data
  if (amazonProduct.description) confidence += 0.1;
  if (amazonProduct.imageUrls.length > 1) confidence += 0.1;
  if (amazonProduct.rating && amazonProduct.rating.count > 10) confidence += 0.1;
  if (amazonProduct.brand) confidence += 0.1;
  if (amazonProduct.specifications) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
