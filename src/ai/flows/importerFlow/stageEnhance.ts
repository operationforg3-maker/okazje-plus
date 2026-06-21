/**
 * Stage 2.5: ENHANCE - Pobierz szczegółowe dane produktu z AliExpress
 * 
 * Dodatkowe wywołanie API /item dla każdego produktu aby pobrać:
 * - Pełny opis HTML (descriptionHtml)
 * - Specyfikacje techniczne (attributes/specifications)
 * - Dodatkowe zdjęcia (images)
 * - Warianty produktu (variants/SKUs)
 * - Informacje o wysyłce (warehouse, deliveryTime)
 * 
 * Ten etap wykonuje się między Fetch a Dedupe, aby mieć pełne dane
 * przed deduplikacją i dalszym przetwarzaniem.
 */

import { AliExpressProduct, ImportStageConfig } from './types';
import { getAliExpressProductDetailsDirect } from '@/integrations/aliexpress/details';

export interface EnhanceConfig extends ImportStageConfig {
  siteUrl: string;
  skipIfHasDescription?: boolean; // Skip if product already has descriptionHtml
}

const DEFAULT_CONFIG: EnhanceConfig = {
  name: 'enhance',
  batchSize: 10,
  delayBetweenItems: 300, // 300ms between API calls to avoid rate limits
  delayBetweenBatches: 1000,
  maxRetries: 2,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
  skipIfHasDescription: false,
};

interface ProductDetails {
  descriptionHtml: string;
  attributes: any[];
  variants: any[];
  images: string[];
  warehouse: string;
  deliveryTime: string;
  freeShipping: boolean;
  videoUrl?: string;
}

/**
 * Fetch detailed product information from AliExpress in-process
 */
async function fetchProductDetails(productId: string, siteUrl?: string): Promise<ProductDetails | null> {
  try {
    console.log(`[Importer:Enhance] Fetching details in-process for product: ${productId}`);
    
    const { product } = await getAliExpressProductDetailsDirect(productId);

    if (!product) {
      console.warn(`[Importer:Enhance] No product data returned for ${productId}`);
      return null;
    }

    // Extract all relevant details
    const details: ProductDetails = {
      descriptionHtml: product.descriptionHtml || '',
      attributes: product.attributes || [],
      variants: product.variants || [],
      images: product.images || [],
      warehouse: product.shippingInfo?.warehouse || '',
      deliveryTime: product.shippingInfo?.deliveryTime || '',
      freeShipping: product.shippingInfo?.freeShipping || false,
      videoUrl: product.videoUrl,
    };

    console.log(`[Importer:Enhance] ✓ Got details for ${productId}:`);
    console.log(`  - Description: ${details.descriptionHtml.length} chars`);
    console.log(`  - Attributes: ${details.attributes.length} items`);
    console.log(`  - Images: ${details.images.length} items`);
    console.log(`  - Variants: ${details.variants.length} items`);
    console.log(`  - Warehouse: ${details.warehouse || 'N/A'}`);

    return details;
  } catch (e: any) {
    console.error(`[Importer:Enhance] Exception for product ${productId}:`, e.message);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhance products with detailed information from AliExpress
 */
export async function enhanceProductDetails(
  products: AliExpressProduct[],
  config: Partial<EnhanceConfig> = {}
): Promise<AliExpressProduct[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log(`[Importer:Enhance] ===== STAGE 2.5 START =====`);
  console.log(`[Importer:Enhance] Input: ${products.length} products`);
  console.log(`[Importer:Enhance] Config:`, {
    batchSize: finalConfig.batchSize,
    delayBetweenItems: finalConfig.delayBetweenItems,
    skipIfHasDescription: finalConfig.skipIfHasDescription,
  });

  if (products.length === 0) {
    console.log(`[Importer:Enhance] No products to enhance`);
    return products;
  }

  const enhanced: AliExpressProduct[] = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Process in batches
  for (let i = 0; i < products.length; i += finalConfig.batchSize) {
    const batch = products.slice(i, i + finalConfig.batchSize);
    const batchNum = Math.floor(i / finalConfig.batchSize) + 1;
    const totalBatches = Math.ceil(products.length / finalConfig.batchSize);

    console.log(`[Importer:Enhance] === Batch ${batchNum}/${totalBatches} (${batch.length} products) ===`);

    for (let j = 0; j < batch.length; j++) {
      const product = batch[j];
      const productNum = i + j + 1;

      try {
        console.log(`[Importer:Enhance] [${productNum}/${products.length}] ${product.id}: ${product.title.slice(0, 50)}...`);

        // Skip if already has description and config says so
        if (finalConfig.skipIfHasDescription && product.description && product.description.length > 100) {
          console.log(`  → Skipping: already has description (${product.description.length} chars)`);
          enhanced.push(product);
          skipCount++;
          continue;
        }

        // Fetch detailed information
        const details = await fetchProductDetails(product.id, finalConfig.siteUrl);

        if (!details) {
          console.warn(`  ⚠️ No details returned, keeping original data`);
          enhanced.push(product);
          errorCount++;
          await sleep(finalConfig.delayBetweenItems);
          continue;
        }

        // Merge details with original product
        const enhancedProduct: AliExpressProduct = {
          ...product,
          description: details.descriptionHtml || product.description,
          descriptionHtml: details.descriptionHtml,
          attributes: details.attributes,
          specifications: details.attributes, // Alias for compatibility
          variants: details.variants,
          images: details.images.length > 0 ? details.images : product.images,
          warehouse: details.warehouse,
          deliveryTime: details.deliveryTime,
          freeShipping: details.freeShipping,
          videoUrl: details.videoUrl,
          // Flag that this product was enhanced
          _enhanced: true,
          _enhancedAt: new Date().toISOString(),
        };

        console.log(`  ✅ Enhanced with ${details.descriptionHtml.length} chars description, ${details.attributes.length} attributes`);
        enhanced.push(enhancedProduct);
        successCount++;

        // Rate limiting
        await sleep(finalConfig.delayBetweenItems);
      } catch (e: any) {
        console.error(`[Importer:Enhance] [${productNum}/${products.length}] Error:`, e.message);
        enhanced.push(product); // Keep original on error
        errorCount++;
      }
    }

    // Delay between batches
    if (i + finalConfig.batchSize < products.length) {
      console.log(`[Importer:Enhance] Batch delay: ${finalConfig.delayBetweenBatches}ms...`);
      await sleep(finalConfig.delayBetweenBatches);
    }
  }

  console.log(`[Importer:Enhance] ===== RESULTS =====`);
  console.log(`[Importer:Enhance]   ✅ Enhanced: ${successCount}`);
  console.log(`[Importer:Enhance]   ⊘ Skipped: ${skipCount}`);
  console.log(`[Importer:Enhance]   ❌ Errors: ${errorCount}`);
  console.log(`[Importer:Enhance]   Output: ${enhanced.length} products`);
  console.log(`[Importer:Enhance] ===== STAGE 2.5 END =====\n`);

  return enhanced;
}
