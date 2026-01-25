import { EnrichedProduct, ImportStageConfig } from './types';
import { createProduct, updateProduct, findExistingProduct } from '@/lib/data-admin';
import { LocalizedText } from '@/lib/types';

export interface SaveConfig extends ImportStageConfig {
  skipExisting?: boolean;
  jobId?: string;
  categoryNamePL?: string;
  subcategoryNamePL?: string;
  subsubcategoryNamePL?: string;
}

const DEFAULT_CONFIG: SaveConfig = {
  name: 'save',
  batchSize: 10,
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
  
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  console.log(`[Importer:Save] Saving ${products.length} refined products...`);

  for (const product of products) {
    try {
      const existingId = await findExistingProduct({
        originalId: product.originalId,
        affiliateUrl: product.link,
      });

      if (existingId && finalConfig.skipExisting) {
        skipped.push(existingId);
        continue;
      }

      // Construct Payload using new Clean Structure
      const payload: any = {
        // Core Content (Localized)
        title: product.title,
        description: product.description,
        specifications: product.specs, // Save Clean HTLM specs
        
        // SEO (Flatten or store as object depending on Firestore schema, storing as obj here)
        seo: product.seo,

        // Pricing (Strictly Raw)
        price: product.price,
        originalPrice: product.originalPriceValue,
        discountPercent: product.discountValue,

        // Categorization
        mainCategorySlug: product.categorySlugEN,
        subCategorySlug: product.subcategorySlugEN,
        subSubCategorySlug: product.subsubcategorySlugEN,

        // Media
        image: product.image,
        gallery: product.gallery.map((src, i) => ({ type: 'url', src, isPrimary: i === 0 })),

        // Metadata
        metadata: {
          source: 'aliexpress',
          originalId: product.originalId,
          qualityScore: product.qualityScore,
          importedAt: new Date().toISOString(),
          importJobId: finalConfig.jobId
        },
        
        status: 'approved' // Auto-approve refined items
      };

      // Legacy fields fallback (Optional, can be removed if strictly M6)
      payload.name = product.title.pl || product.title.en;

      if (existingId) {
        await updateProduct(existingId, payload);
        updated.push(existingId);
      } else {
        const newId = await createProduct(payload);
        created.push(newId);
      }
    } catch (e) {
      console.error(`  ✗ Save failed for ${product.originalId}:`, e);
    }
  }

  return { created, updated, skipped };
}
