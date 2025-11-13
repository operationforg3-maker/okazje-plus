/**
 * Allegro Product Mappers
 * 
 * Transforms Allegro API data to platform types
 */

import { Product, ProductRatingCard, ProductImageEntry } from '@/lib/types';
import { AllegroProduct, AllegroOfferListingItem } from './types';

/**
 * Map Allegro product to platform Product
 */
export function mapAllegroProductToProduct(
  allegroProduct: AllegroProduct,
  targetCategory: { mainSlug: string; subSlug: string; subSubSlug?: string }
): Omit<Product, 'id'> {
  const price = allegroProduct.sellingMode.price.amount;
  
  // Extract specifications from parameters
  const specifications = allegroProduct.parameters
    ?.map(param => `- ${param.name}: ${param.values.join(', ')}${param.unit ? ` ${param.unit}` : ''}`)
    .join('\n');

  const ratingCard: ProductRatingCard = {
    average: 0,
    count: 0,
    durability: 0,
    easeOfUse: 0,
    valueForMoney: 0,
    versatility: 0,
  };

  const gallery: ProductImageEntry[] = allegroProduct.images.map((image, index) => ({
    id: `${allegroProduct.id}_img_${index}`,
    type: 'url' as const,
    src: image.url,
    alt: allegroProduct.name,
    isPrimary: index === 0,
    source: 'manual' as const,
    addedAt: new Date().toISOString(),
  }));

  // Build shipping info
  const shippingInfo = allegroProduct.delivery?.shippingRates
    ? `\n\n**Dostawa:**\n${allegroProduct.delivery.shippingRates
        .map(rate => `- ${rate.name}: ${rate.price.amount} ${rate.price.currency}`)
        .join('\n')}`
    : '';

  const product: Omit<Product, 'id'> = {
    name: allegroProduct.name,
    description: allegroProduct.description || '',
    longDescription: [
      allegroProduct.description || '',
      specifications ? `\n\n**Specyfikacja:**\n${specifications}` : '',
      shippingInfo,
    ]
      .filter(Boolean)
      .join('\n'),
    image: gallery[0]?.src || '',
    imageHint: allegroProduct.name,
    affiliateUrl: `https://allegro.pl/oferta/${allegroProduct.id}`,
    ratingCard,
    price,
    mainCategorySlug: targetCategory.mainSlug,
    subCategorySlug: targetCategory.subSlug,
    subSubCategorySlug: targetCategory.subSubSlug,
    status: 'draft',
    gallery,
    metadata: {
      source: 'manual' as const,
      originalId: allegroProduct.id,
      importedAt: new Date().toISOString(),
      merchant: allegroProduct.seller.login,
      rawDataStored: false,
    },
  };

  return product;
}

/**
 * Map Allegro listing item to platform Product (lightweight version for search results)
 */
export function mapAllegroListingItemToProduct(
  item: AllegroOfferListingItem,
  targetCategory: { mainSlug: string; subSlug: string; subSubSlug?: string }
): Omit<Product, 'id'> {
  const price = item.sellingMode.price.amount;
  
  const ratingCard: ProductRatingCard = {
    average: 0,
    count: 0,
    durability: 0,
    easeOfUse: 0,
    valueForMoney: 0,
    versatility: 0,
  };

  const gallery: ProductImageEntry[] = item.primaryImage ? [{
    id: `${item.id}_img_0`,
    type: 'url' as const,
    src: item.primaryImage.url,
    alt: item.name,
    isPrimary: true,
    source: 'manual' as const,
    addedAt: new Date().toISOString(),
  }] : [];

  const shippingInfo = item.delivery.availableForFree
    ? 'Darmowa dostawa'
    : item.delivery.lowestPrice
    ? `Dostawa od ${item.delivery.lowestPrice.amount} ${item.delivery.lowestPrice.currency}`
    : '';

  const product: Omit<Product, 'id'> = {
    name: item.name,
    description: shippingInfo,
    longDescription: shippingInfo,
    image: gallery[0]?.src || '',
    imageHint: item.name,
    affiliateUrl: `https://allegro.pl/oferta/${item.id}`,
    ratingCard,
    price,
    mainCategorySlug: targetCategory.mainSlug,
    subCategorySlug: targetCategory.subSlug,
    subSubCategorySlug: targetCategory.subSubSlug,
    status: 'draft',
    gallery,
    metadata: {
      source: 'manual' as const,
      originalId: item.id,
      importedAt: new Date().toISOString(),
      rawDataStored: false,
    },
  };

  return product;
}

/**
 * Extract category suggestions from Allegro product
 */
export function extractCategorySuggestions(allegroProduct: AllegroProduct): string[] {
  return [allegroProduct.category.name];
}

/**
 * Normalize Allegro product name for deduplication
 */
export function normalizeAllegroProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate confidence score for Allegro product
 */
export function calculateAllegroProductConfidence(allegroProduct: AllegroProduct): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on available data
  if (allegroProduct.description && allegroProduct.description.length > 100) confidence += 0.1;
  if (allegroProduct.images.length > 1) confidence += 0.1;
  if (allegroProduct.parameters && allegroProduct.parameters.length > 0) confidence += 0.15;
  if (allegroProduct.stock && allegroProduct.stock.available > 0) confidence += 0.1;
  if (allegroProduct.publication?.status === 'ACTIVE') confidence += 0.05;

  return Math.min(confidence, 1.0);
}
