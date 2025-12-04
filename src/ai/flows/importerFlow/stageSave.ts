/**
 * Stage 5: SAVE - Zapisz produkty do Firestore
 * 
 * Batch create/update z deduplication po ID
 * Mapy EnrichedProduct → Product ze wsparcie LocalizedText i SmartPrice
 */

import { EnrichedProduct, ImportStageConfig } from './types';
import { createProduct, updateProduct, findExistingProduct } from '@/lib/data-admin';
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { LocalizedText, SmartPrice } from '@/lib/types';

export interface SaveConfig extends ImportStageConfig {
  skipExisting: boolean;
  jobId?: string; // For tracking in import_jobs
}

const DEFAULT_CONFIG: SaveConfig = {
  name: 'save',
  batchSize: 5,
  delayBetweenItems: 100,
  delayBetweenBatches: 500,
  maxRetries: 1,
  skipExisting: true,
};

export async function saveProductsToFirestore(
  products: EnrichedProduct[],
  config: Partial<SaveConfig> = {}
): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[Importer:Save] Starting save for ${products.length} products`);
  console.log(`[Importer:Save] Config:`, { skipExisting: finalConfig.skipExisting, jobId: finalConfig.jobId });
  
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`[Importer:Save] [${i + 1}/${products.length}] Processing: ${product.titleNormalizedEN.slice(0, 60)}...`);
      
      // Check if product exists
      const existingId = await findExistingProduct({
        originalId: product.originalId,
        affiliateUrl: product.link,
      });
      
      // Build LocalizedText for title
      const titleLocalized: LocalizedText = {
        pl: product.titlePL || product.titleNormalizedEN,
        en: product.titleNormalizedEN,
      };
      
      // Build LocalizedText for description
      const descriptionLocalized: LocalizedText = {
        pl: product.descriptionPL || product.descriptionEN,
        en: product.descriptionEN,
      };
      
      // Build SmartPrice
      const smartPrice: SmartPrice = {
        amount: product.pricePLN || product.priceUSD,
        currency: 'PLN',
        shippingCost: 0, // TODO: Calculate based on AliExpress shipping info
        totalPrice: product.pricePLN || product.priceUSD,
        originalPrice: product.originalPrice,
        discountPercent: product.discount,
        freeShipping: false, // TODO: Extract from product data
      };
      
      if (existingId) {
        if (finalConfig.skipExisting) {
          console.log(`  ⊘ Skipped: already exists as ${existingId}`);
          skipped.push(existingId);
          continue;
        }
        
        // Update existing
        await updateProduct(existingId, {
          name: product.titlePL || product.titleNormalizedEN, // Legacy
          title: titleLocalized,
          description: product.descriptionPL || product.descriptionEN, // Legacy
          shortDescription: descriptionLocalized,
          longDescription: product.descriptionPL || product.descriptionEN, // Legacy
          fullDescription: descriptionLocalized,
          price: smartPrice,
          image: product.image,
          mainCategorySlug: product.categorySlugEN,
          subCategorySlug: product.subcategorySlugEN,
          subSubCategorySlug: product.subsubcategorySlugEN,
          originalPrice: product.originalPrice, // Legacy
          discountPercent: product.discount, // Legacy
          currency: 'PLN', // Legacy
          metadata: {
            source: 'aliexpress',
            originalId: product.originalId,
            currencyRate: product.exchangeRate,
            qualityScore: Math.round((
              product.quality.titleQuality + 
              product.quality.descriptionQuality + 
              product.quality.priceReliability
            ) / 3),
          },
        });
        
        console.log(`  ✓ Updated: ${existingId}`);
        updated.push(existingId);
        
      } else {
        // Create new
        const productData = {
          name: product.titlePL || product.titleNormalizedEN,
          title: titleLocalized,
          description: product.descriptionPL || product.descriptionEN,
          shortDescription: descriptionLocalized,
          longDescription: product.descriptionPL || product.descriptionEN,
          fullDescription: descriptionLocalized,
          price: smartPrice,
          image: product.image,
          imageHint: product.titleNormalizedEN,
          affiliateUrl: product.link,
          mainCategorySlug: product.categorySlugEN,
          subCategorySlug: product.subcategorySlugEN,
          subSubCategorySlug: product.subsubcategorySlugEN,
          originalPrice: product.originalPrice,
          discountPercent: product.discount,
          currency: 'PLN',
          metadata: {
            source: 'aliexpress' as const,
            originalId: product.originalId,
            currencyRate: product.exchangeRate,
            qualityScore: Math.round((
              product.quality.titleQuality + 
              product.quality.descriptionQuality + 
              product.quality.priceReliability
            ) / 3),
          },
          status: 'draft' as const,
          ratingCard: {
            score: 0,
            count: 0,
          },
        };
        
        const newId = await createProduct(productData as any);
        
        console.log(`  ✓ Created: ${newId}`);
        created.push(newId);
      }
      
      // Track in job if jobId provided
      if (finalConfig.jobId && (created.length > 0 || updated.length > 0)) {
        try {
          const jobRef = adminDb.collection('import_jobs').doc(finalConfig.jobId);
          const updates: any = {};
          
          if (created.length > 0) {
            updates.itemsCreated = FieldValue.arrayUnion(...created);
          }
          if (updated.length > 0) {
            updates.itemsUpdated = FieldValue.arrayUnion(...updated);
          }
          
          if (Object.keys(updates).length > 0) {
            await jobRef.update(updates);
          }
        } catch (e: any) {
          console.warn(`[Importer:Save] Failed to update job tracking:`, e.message);
        }
      }
      
      // Delay between items
      if ((i + 1) % finalConfig.batchSize !== 0) {
        await sleep(finalConfig.delayBetweenItems);
      } else {
        await sleep(finalConfig.delayBetweenBatches);
      }
      
    } catch (error: any) {
      console.error(`[Importer:Save] Failed to save product ${product.originalId}:`, error.message);
    }
  }
  
  console.log(`[Importer:Save] Completed:`, {
    created: created.length,
    updated: updated.length,
    skipped: skipped.length,
  });
  
  return { created, updated, skipped };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
