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
  categoryNamePL?: string; // Polish category name for Firestore
  subcategoryNamePL?: string; // Polish subcategory name for Firestore
  subsubcategoryNamePL?: string; // Polish sub-subcategory name for Firestore
}

const DEFAULT_CONFIG: SaveConfig = {
  name: 'save',
  batchSize: 5,
  delayBetweenItems: 100,
  delayBetweenBatches: 500,
  maxRetries: 1,
  skipExisting: false,
};

export async function saveProductsToFirestore(
  products: EnrichedProduct[],
  config: Partial<SaveConfig> = {}
): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[Importer:Save] ===== STAGE 5 START =====`);
  console.log(`[Importer:Save] Input: ${products.length} products`);
  if (products.length === 0) {
    console.error(`[Importer:Save] ❌ CRITICAL: Zero input! Stage 4 (Translate) returned 0 products.`);
    return { created: [], updated: [], skipped: [] };
  }
  console.log(`[Importer:Save] Config:`, { skipExisting: finalConfig.skipExisting, jobId: finalConfig.jobId });
  
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  let errors = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`[Importer:Save] [${i + 1}/${products.length}] Processing: ${product.titleNormalizedEN.slice(0, 60)}...`);
      console.log(`  ↳ IDs: originalId=${product.originalId}, affiliateUrl=${product.link?.slice(0, 100)}`);
      console.log(`  ↳ Prices: pricePLN=${product.pricePLN}, priceUSD=${product.priceUSD}, original=${product.price}, currency=${product.currency}`);
      console.log(`  ↳ Image: ${product.image?.slice(0, 120)}`);
      
      // Check if product exists
      const existingId = await findExistingProduct({
        originalId: product.originalId,
        affiliateUrl: product.link,
      });
      console.log(`  ↳ Existence check result: ${existingId ? `FOUND ${existingId}` : 'NOT FOUND'}`);
      
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
      
      // Build SmartPrice z właściwą walutą
      // Priority: pricePLN > priceUSD > price (original from API)
      const finalPrice = product.pricePLN || product.priceUSD || product.price;
      const productCurrency = product.pricePLN ? 'PLN' : (product.currency || 'PLN');
      
      // Validate price before saving
      if (!finalPrice || finalPrice <= 0 || isNaN(finalPrice)) {
        console.error(`  ❌ SKIP-PRICE: Invalid price for ${product.originalId}`);
        console.error(`     finalPrice: ${finalPrice}, pricePLN: ${product.pricePLN}, priceUSD: ${product.priceUSD}, original: ${product.price}`);
        console.error(`     Context: currency=${productCurrency}`);
        skipped.push(product.originalId);
        continue;
      }
      
      // Validate image - use from images array if available, fallback to product.image
      let finalImage = product.image;
      
      // If no valid image, try to use first image from gallery
      if ((!finalImage || !finalImage.startsWith('http')) && product.images && product.images.length > 0) {
        finalImage = product.images[0];
        console.log(`[Importer:Save] ℹ️  Using first image from gallery: ${finalImage.substring(0, 80)}...`);
      }
      
      // Skip product if still no valid image
      if (!finalImage || !finalImage.startsWith('http')) {
        console.error(`[Importer:Save] ❌ SKIP: No valid image for ${product.originalId} - "${finalImage}"`);
        console.error(`     Product images array:`, product.images);
        skipped.push(product.originalId);
        continue;
      }
      
      console.log(`[Importer:Save] ✓ Final image: ${finalImage.slice(0, 80)}...`);
      const smartPrice: SmartPrice = {
        amount: finalPrice,
        currency: productCurrency,
        shippingCost: 0, // TODO: Calculate based on AliExpress shipping info
        totalPrice: finalPrice,
        originalPrice: product.originalPrice,
        discountPercent: product.discount,
        freeShipping: false, // TODO: Extract from product data
        lastUpdated: new Date().toISOString(),
      };
      
      console.log(`  💰 Price: ${finalPrice} ${productCurrency}${smartPrice.originalPrice ? ` (was ${smartPrice.originalPrice})` : ''}`);
      
      if (existingId) {
        if (finalConfig.skipExisting) {
          console.log(`  ⊘ Skipped: already exists as ${existingId}`);
          skipped.push(existingId);
          continue;
        }
        
        // Update existing
        console.log(`  → Updating existing product ${existingId}`);
        
        // Build gallery from images array
        const gallery = product.images && product.images.length > 0
          ? product.images.slice(0, 10).map((imgUrl, idx) => ({
              id: `${product.originalId}_img_${idx}`,
              type: 'url' as const,
              src: imgUrl,
              alt: product.titlePL || product.titleNormalizedEN,
              isPrimary: idx === 0,
              source: 'aliexpress' as const,
              addedAt: new Date().toISOString(),
            }))
          : undefined;
        
        if (gallery) {
          console.log(`  🖼️  Gallery: ${gallery.length} images`);
        }
        
        await updateProduct(existingId, {
          name: product.titlePL || product.titleNormalizedEN, // Legacy
          title: titleLocalized,
          description: product.descriptionPL || product.descriptionEN, // Legacy
          shortDescription: descriptionLocalized,
          longDescription: product.descriptionPL || product.descriptionEN, // Legacy
          fullDescription: descriptionLocalized,
          price: smartPrice,
          image: finalImage,
          ...(gallery && { gallery }),
          mainCategorySlug: product.categorySlugEN,
          subCategorySlug: product.subcategorySlugEN,
          subSubCategorySlug: product.subsubcategorySlugEN,
          categoryName: finalConfig.categoryNamePL,
          subcategoryName: finalConfig.subcategoryNamePL,
          subsubcategoryName: finalConfig.subsubcategoryNamePL,
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
        console.log(`  → Creating new product`);
        
        // Build gallery from images array
        const gallery = product.images && product.images.length > 0
          ? product.images.slice(0, 10).map((imgUrl, idx) => ({
              id: `${product.originalId}_img_${idx}`,
              type: 'url' as const,
              src: imgUrl,
              alt: product.titlePL || product.titleNormalizedEN,
              isPrimary: idx === 0,
              source: 'aliexpress' as const,
              addedAt: new Date().toISOString(),
            }))
          : [{
              id: `${product.originalId}_img_0`,
              type: 'url' as const,
              src: finalImage,
              alt: product.titlePL || product.titleNormalizedEN,
              isPrimary: true,
              source: 'aliexpress' as const,
              addedAt: new Date().toISOString(),
            }];
        
        console.log(`  🖼️  Gallery: ${gallery.length} images`);
        
        const productData = {
          name: product.titlePL || product.titleNormalizedEN,
          title: titleLocalized,
          description: product.descriptionPL || product.descriptionEN,
          shortDescription: descriptionLocalized,
          longDescription: product.descriptionPL || product.descriptionEN,
          fullDescription: descriptionLocalized,
          price: smartPrice,
          image: finalImage,
          gallery,
          imageHint: product.titleNormalizedEN,
          affiliateUrl: product.link,
          mainCategorySlug: product.categorySlugEN,
          subCategorySlug: product.subcategorySlugEN,
          subSubCategorySlug: product.subsubcategorySlugEN,
          categoryName: finalConfig.categoryNamePL,
          subcategoryName: finalConfig.subcategoryNamePL,
          subsubcategoryName: finalConfig.subsubcategoryNamePL,
          originalPrice: product.originalPrice,
          discountPercent: product.discount,
          currency: 'PLN',
          importJobId: finalConfig.jobId,
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
          status: 'approved' as const,
          ratingCard: {
            score: 0,
            count: 0,
          },
        };
        console.log(`  → Payload preview: title.pl='${productData.title.pl?.slice(0, 60)}', category='${productData.mainCategorySlug}/${productData.subCategorySlug}/${productData.subSubCategorySlug}', price=${productData.price.amount} ${productData.price.currency}`);
        const newId = await createProduct(productData as any);
        
        console.log(`  ✓ Created: ${newId} (status: approved, title: ${productData.title.pl.slice(0, 40)}...)`);
        created.push(newId);
      }
      
      // Track in job if jobId provided
      if (finalConfig.jobId && (created.length > 0 || updated.length > 0)) {
        try {
          const jobRef = adminDb.collection('import_jobs').doc(finalConfig.jobId);
          
          // Add items individually to avoid Firestore batch operation limits
          for (const id of created) {
            await jobRef.update({
              itemsCreated: FieldValue.arrayUnion(id)
            });
          }
          for (const id of updated) {
            await jobRef.update({
              itemsUpdated: FieldValue.arrayUnion(id)
            });
          }
          console.log(`  ↳ Job tracking updated for jobId=${finalConfig.jobId} (created=${created.length}, updated=${updated.length})`);
        } catch (e: any) {
          console.warn(`[Importer:Save] Failed to update job tracking:`, e.message);
          if (e.code) console.warn(`  ↳ code=${e.code}`);
        }
      }
      
      // Delay between items
      if ((i + 1) % finalConfig.batchSize !== 0) {
        await sleep(finalConfig.delayBetweenItems);
      } else {
        await sleep(finalConfig.delayBetweenBatches);
      }
      
    } catch (error: any) {
      errors++;
      console.error(`[Importer:Save] [${i + 1}/${products.length}] ❌ FAILED to save product ${product.originalId}:`);
      console.error(`  Error message: ${error.message}`);
      console.error(`  Error code: ${error.code}`);
      if (error.stack) console.error(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      try {
        console.error(`  ↳ Context snapshot:`, {
          id: product.originalId,
          titleEN: product.titleNormalizedEN?.slice(0, 80),
          pricePLN: product.pricePLN,
          priceUSD: product.priceUSD,
          image: product.image?.slice(0, 100),
          link: product.link?.slice(0, 120),
          category: `${product.categorySlugEN}/${product.subcategorySlugEN}/${product.subsubcategorySlugEN}`,
        });
      } catch {}
      skipped.push(product.originalId);
    }
  }
  
  console.log(`[Importer:Save] ===== STAGE 5 END =====`);
  console.log(`[Importer:Save] Results:`);
  console.log(`  - Created: ${created.length}`);
  console.log(`  - Updated: ${updated.length}`);
  console.log(`  - Skipped: ${skipped.length}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Total processed: ${created.length + updated.length + skipped.length + errors}/${products.length}`);
  
  if (created.length === 0 && updated.length === 0) {
    console.error(`[Importer:Save] ❌ CRITICAL: No products created or updated! All were skipped or errored.`);
  } else {
    console.log(`[Importer:Save] ✅ SUCCESS: Saved ${created.length + updated.length} products to Firestore`);
  }
  
  return { created, updated, skipped };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
