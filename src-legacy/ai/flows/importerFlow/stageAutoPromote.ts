/**
 * Stage: Auto-Promote Hot Deals
 * 
 * Automatically creates deals for products that qualify as "hot deals":
 * - Discount > 40% AND Rating > 4.5
 * - High sales volume (optional)
 * 
 * Creates a linked deal document and sets product.meta.isHotDeal = true
 */

import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logging';
import { EnrichedProduct } from './types';
import { FieldValue } from 'firebase-admin/firestore';

export interface HotDealCriteria {
  minDiscount: number;      // Default: 40%
  minRating: number;        // Default: 4.5
  minSalesVolume?: number;  // Optional: min orders count
}

const DEFAULT_CRITERIA: HotDealCriteria = {
  minDiscount: 40,
  minRating: 4.5,
  minSalesVolume: 100,
};

/**
 * Analyze products and auto-promote qualifying items as hot deals
 */
export async function autoPromoteHotDeals(
  products: EnrichedProduct[],
  criteria: Partial<HotDealCriteria> = {}
): Promise<{
  promoted: string[]; // Product IDs that were promoted
  skipped: string[];  // Product IDs that didn't qualify
}> {
  const finalCriteria = { ...DEFAULT_CRITERIA, ...criteria };
  
  logger.info('Auto-promoting hot deals', {
    productCount: products.length,
    criteria: finalCriteria,
  });
  
  const promoted: string[] = [];
  const skipped: string[] = [];
  
  for (const product of products) {
    try {
      const isHotDeal = evaluateHotDeal(product, finalCriteria);
      
      if (isHotDeal) {
        // Create deal document
        const dealId = await createHotDeal(product);
        if (dealId) {
          promoted.push(product.originalId);
          logger.info('Hot deal created', {
            productId: product.originalId,
            dealId,
            discount: product.discount,
            rating: product.rating,
          });
        } else {
          skipped.push(product.originalId);
        }
      } else {
        skipped.push(product.originalId);
      }
    } catch (error) {
      logger.error('Failed to process hot deal', {
        productId: product.originalId,
        error,
      });
      skipped.push(product.originalId);
    }
  }
  
  logger.info('Hot deals promotion completed', {
    promoted: promoted.length,
    skipped: skipped.length,
  });
  
  return { promoted, skipped };
}

/**
 * Evaluate if a product qualifies as a hot deal
 */
function evaluateHotDeal(
  product: EnrichedProduct,
  criteria: HotDealCriteria
): boolean {
  // Check discount
  if (!product.discount || product.discount < criteria.minDiscount) {
    return false;
  }
  
  // Check rating
  if (!product.rating || product.rating < criteria.minRating) {
    return false;
  }
  
  // Check sales volume (optional)
  if (criteria.minSalesVolume && (!product.orders || product.orders < criteria.minSalesVolume)) {
    return false;
  }
  
  return true;
}

/**
 * Create a hot deal document in Firestore
 */
async function createHotDeal(product: EnrichedProduct): Promise<string | null> {
  try {
    const dealData = {
      // Basic info
      name: product.titlePL || product.titleNormalizedEN,
      description: product.descriptionPL || product.descriptionEN || '',
      longDescription: product.descriptionPL || product.descriptionEN || '',
      
      // Pricing
      price: product.price,
      originalPrice: product.originalPrice || product.price,
      discountPercent: product.discount || 0,
      currency: 'USD',
      
      // Images
      image: product.image,
      imageHint: `Hot Deal: ${product.discount}% OFF`,
      gallery: product.images?.map((url, idx) => ({
        id: `img-${idx}`,
        type: 'url' as const,
        src: url,
        source: 'aliexpress' as const,
      })) || [],
      
      // Links
      affiliateUrl: product.affiliateUrl || product.link,
      
      // Category
      mainCategorySlug: product.mainCategorySlug,
      subCategorySlug: product.subCategorySlug,
      subSubCategorySlug: product.subSubCategorySlug,
      categoryName: product.categoryName,
      subcategoryName: product.subcategoryName,
      subsubcategoryName: product.subsubcategoryName,
      
      // Rating
      ratingCard: {
        average: product.rating || 0,
        count: product.orders || 0,
        distribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
      },
      
      // Status and metadata
      status: 'approved' as const,
      type: 'hot-deal' as const,
      source: 'auto-promoted',
      
      // AI content (if available)
      ...(product.aiContent && {
        title: {
          pl: product.aiContent.titlePL,
          en: product.aiContent.titleEN,
          de: product.aiContent.titleDE,
        },
        shortDescription: {
          pl: product.aiContent.description.pl,
          en: product.aiContent.description.en,
          de: product.aiContent.description.de,
        },
      }),
      
      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      
      // Hot deal metadata
      meta: {
        isAutoPromoted: true,
        promotedAt: new Date().toISOString(),
        originalProductId: product.originalId,
        discount: product.discount,
        rating: product.rating,
        salesVolume: product.orders,
      },
    };
    
    const dealRef = await adminDb.collection('deals').add(dealData);
    
    logger.info('Hot deal document created', {
      dealId: dealRef.id,
      productId: product.originalId,
    });
    
    return dealRef.id;
  } catch (error) {
    logger.error('Failed to create hot deal document', {
      productId: product.originalId,
      error,
    });
    return null;
  }
}

/**
 * Update product document to mark as hot deal and link to deal
 */
export async function markProductAsHotDeal(
  productId: string,
  dealId: string
): Promise<void> {
  try {
    await adminDb.collection('products').doc(productId).update({
      'meta.isHotDeal': true,
      'meta.hotDealId': dealId,
      'meta.promotedAt': new Date().toISOString(),
      linkedDealIds: FieldValue.arrayUnion(dealId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    logger.info('Product marked as hot deal', { productId, dealId });
  } catch (error) {
    logger.error('Failed to mark product as hot deal', {
      productId,
      dealId,
      error,
    });
  }
}
