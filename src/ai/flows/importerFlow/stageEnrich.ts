/**
 * Stage 3: ENRICH - normalizuj tytuły, konwertuj waluty, popraw jakość
 * 
 * AI normalizacja tytułów, konwersja USD → PLN, metadata
 */

import { AliExpressProduct, EnrichedProduct, ImportStageConfig } from './types';

// TODO: Create aiNormalizeTitleEN function for AI title normalization
// For now, use raw AliExpress titles - normalization happens in translation stage

export interface EnrichConfig extends ImportStageConfig {
  currencyTarget: 'USD' | 'PLN';
  exchangeRateUsdToPln?: number; // If PLN, use this rate. Default: 4.0
}

const DEFAULT_CONFIG: EnrichConfig = {
  name: 'enrich',
  batchSize: 5,
  delayBetweenItems: 300, // 300ms between AI calls
  delayBetweenBatches: 2000, // 2s between batches
  maxRetries: 2,
  currencyTarget: 'USD',
  exchangeRateUsdToPln: 4.0,
};

export async function enrichProducts(
  products: AliExpressProduct[],
  categorySlugEN: string,
  subcategorySlugEN: string,
  subsubcategorySlugEN: string,
  config: Partial<EnrichConfig> = {}
): Promise<EnrichedProduct[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[Importer:Enrich] ===== STAGE 3 START =====`);
  console.log(`[Importer:Enrich] Input: ${products.length} products`);
  if (products.length === 0) {
    console.error(`[Importer:Enrich] ❌ CRITICAL: Zero input! Stage 2 (Dedupe) returned 0 products.`);
    return [];
  }
  console.log(`[Importer:Enrich] Config:`, {
    batchSize: finalConfig.batchSize,
    currencyTarget: finalConfig.currencyTarget,
    exchangeRate: finalConfig.exchangeRateUsdToPln,
  });
  
  const enriched: EnrichedProduct[] = [];
  let processed = 0;
  let errors = 0;
  let currency_converted = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`[Importer:Enrich] [${i + 1}/${products.length}] Processing: ${product.title.slice(0, 60)}...`);
      
      // Use raw title from AliExpress
      // Title normalization and translation happens in Stage 4 (Translate)
      let titleNormalizedEN = product.title;
      console.log(`  → Title: "${product.title.slice(0, 60)}..."`);
      
      // Currency conversion (tylko jeśli potrzebna)
      let priceUSD = product.price;
      let pricePLN: number | undefined;
      let exchangeRate: number | undefined;
      let currencyTarget = finalConfig.currencyTarget;
      
      // Sprawdź walutę produktu z API
      const productCurrency = product.currency || 'USD';
      
      if (productCurrency === 'PLN') {
        // Cena już w PLN - nie konwertuj!
        pricePLN = product.price;
        exchangeRate = 1.0; // Brak konwersji
        currencyTarget = 'PLN';
      } else if (finalConfig.currencyTarget === 'PLN') {
        // Konwertuj z USD/innej waluty na PLN
        const rate = finalConfig.exchangeRateUsdToPln || 4.0;
        pricePLN = Math.round(priceUSD * rate * 100) / 100; // Round to 2 decimals
        exchangeRate = rate;
        currency_converted++;
      } else {
        // Pozostaw w oryginalnej walucie
      }
      
      // Pass through image (validation happens in stageSave)
      const enrichedProduct: EnrichedProduct = {
        // From AliExpress
        originalId: product.id,
        titleOriginal: product.title,
        image: product.image,
        images: (product as any).images, // Pass through gallery images from stageFetch
        link: product.link,
        affiliateUrl: product.link,
        price: product.price,
        originalPrice: product.originalPrice,
        discount: product.discount,
        
        // Normalized (English) - Backend language
        titleNormalizedEN,
        descriptionEN: product.description || '', // TODO: AI-generate if missing
        
        // Will be translated in next stage
        titlePL: undefined,
        descriptionPL: undefined,
        
        // Currency
        priceUSD,
        pricePLN,
        currency: currencyTarget,
        exchangeRate,
        
        // Category assignments
        categorySlugEN,
        subcategorySlugEN,
        subsubcategorySlugEN,
        
        // Quality metrics
        quality: {
          titleQuality: assessTitleQuality(titleNormalizedEN),
          descriptionQuality: assessDescriptionQuality(product.description || ''),
          priceReliability: product.rating && product.orders 
            ? Math.round((product.rating / 5) * 100 * (Math.min(product.orders, 1000) / 1000) * 100) / 100
            : 50,
        },
      };
      
      enriched.push(enrichedProduct);
      processed++;
      
      // Delay between items (AI rate limit)
      if ((i + 1) % finalConfig.batchSize !== 0) {
        await sleep(finalConfig.delayBetweenItems);
      } else {
        // Batch delay
        await sleep(finalConfig.delayBetweenBatches);
      }
      
    } catch (error: any) {
      errors++;
      console.error(`[Importer:Enrich] Failed to enrich product ${product.id}:`, error.message);
    }
  }
  
  console.log(`[Importer:Enrich] ===== STAGE 3 END =====`);
  console.log(`[Importer:Enrich] Results:`);
  console.log(`  - Processed: ${processed}/${products.length}`);
  console.log(`  - Currency conversions: ${currency_converted}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Output: ${enriched.length} products`);
  
  if (enriched.length === 0) {
    console.error(`[Importer:Enrich] ❌ CRITICAL: Output is ZERO! Enrichment failed for all products.`);
  } else {
    console.log(`[Importer:Enrich] ✅ Passing ${enriched.length} products to Stage 4 (Translate)`);
  }
  
  return enriched;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assessTitleQuality(title: string): number {
  let score = 50; // Base
  
  if (title.length < 10) score -= 20;
  else if (title.length > 200) score -= 15;
  else if (title.length > 100) score -= 5;
  
  // More detailed info is better
  if (title.includes('-')) score += 10;
  if (title.includes(',')) score += 5;
  if (title.match(/\d+/)) score += 5; // Has numbers (specs)
  
  // Spam indicators
  if (title.toLowerCase().includes('free')) score -= 20;
  if (title.toLowerCase().includes('download')) score -= 20;
  
  return Math.min(100, Math.max(0, score));
}

function assessDescriptionQuality(description: string): number {
  if (!description) return 0;
  
  let score = 50;
  
  if (description.length < 50) score -= 30;
  else if (description.length < 200) score -= 10;
  else if (description.length > 2000) score -= 10;
  
  // Structure markers
  if (description.includes('\n')) score += 10;
  if (description.includes('•') || description.includes('-')) score += 5;
  
  return Math.min(100, Math.max(0, score));
}
