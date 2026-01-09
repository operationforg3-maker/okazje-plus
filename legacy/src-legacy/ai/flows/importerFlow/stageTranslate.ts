/**
 * Stage 4: TRANSLATE - Tłumacz tytuły i opisy na polski
 * 
 * AI-powered translation EN → PL using enhanced translation service
 * Category-aware for better technical terminology
 */

import { EnrichedProduct, ImportStageConfig } from './types';
import { translateText } from '@/lib/translation-service';
import type { TranslationInput } from '@/lib/translation-service';
import { convertToPLN } from '@/lib/currency-exchange';

export interface TranslateConfig extends ImportStageConfig {
  targetLanguage: 'pl' | 'de' | 'fr';
}

const DEFAULT_CONFIG: TranslateConfig = {
  name: 'translate',
  batchSize: 10,
  delayBetweenItems: 200,
  delayBetweenBatches: 1000,
  maxRetries: 2,
  targetLanguage: 'pl',
};

// Simple in-memory cache for translations within same import session
const translationCache = new Map<string, string>();

function getCacheKey(text: string, from: string, to: string, context: string): string {
  return `${from}:${to}:${context}:${text.substring(0, 100)}`;
}

export async function translateProducts(
  products: EnrichedProduct[],
  config: Partial<TranslateConfig> = {}
): Promise<EnrichedProduct[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[Importer:Translate] ===== STAGE 4 START =====`);
  console.log(`[Importer:Translate] Input: ${products.length} products`);
  if (products.length === 0) {
    console.error(`[Importer:Translate] ❌ CRITICAL: Zero input! Stage 3 (Enrich) returned 0 products.`);
    return [];
  }
  console.log(`[Importer:Translate] Target language: ${finalConfig.targetLanguage}`);
  console.log(`[Importer:Translate] Translation cache size: ${translationCache.size}`);
  
  const translated: EnrichedProduct[] = [];
  let processed = 0;
  let aiErrors = 0;
  let titles_translated = 0;
  let descriptions_translated = 0;
  let low_confidence = 0;
  let prices_converted = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`[Importer:Translate] [${i + 1}/${products.length}] Processing: ${product.titleNormalizedEN.slice(0, 60)}...`);
      
      // CURRENCY CONVERSION - Convert to PLN ONLY if pricePLN is missing
      if (!product.pricePLN || product.pricePLN <= 0) {
        if (product.currency === 'PLN') {
          // Product already in PLN, just copy
          product.pricePLN = product.price;
          console.log(`  ✓ Price already in PLN: ${product.price}`);
        } else if (product.price > 0 && product.currency) {
          // Convert from foreign currency to PLN using NBP
          try {
            const pricePLN = await convertToPLN(product.price, product.currency);
            product.pricePLN = pricePLN;
            
            if (product.originalPrice && product.originalPrice > 0) {
              const originalPricePLN = await convertToPLN(product.originalPrice, product.currency);
              product.originalPrice = originalPricePLN;
            }
            
            prices_converted++;
            console.log(`  💱 Converted: ${product.price} ${product.currency} → ${pricePLN} PLN (NBP)`);
          } catch (e: any) {
            console.error(`  ✗ NBP conversion failed:`, e.message);
            // Fallback: use original price as PLN (better than nothing)
            product.pricePLN = product.price;
            console.warn(`  ⚠️ Using original price as fallback: ${product.price}`);
          }
        } else {
          console.warn(`  ⚠️ No valid price to convert: ${product.price} ${product.currency}`);
        }
      } else {
        console.log(`  ✓ Product already has PLN price: ${product.pricePLN}`);
      }
      
      if (finalConfig.targetLanguage === 'pl') {
        // AI Translation with category context using enhanced translation service
        try {
          // Check cache first
          const cacheKey = getCacheKey(product.titleNormalizedEN, 'en', 'pl', 'product_title');
          const cached = translationCache.get(cacheKey);
          
          if (cached) {
            product.titlePL = cached;
            console.log(`  ✓ Title (cached)`);
          } else {
            const titleInput: TranslationInput = {
              text: product.titleNormalizedEN,
              from: 'en',
              to: 'pl',
              context: 'product_title',
              category: product.categorySlugEN,
              subcategory: product.subcategorySlugEN,
            };
            
            const titleResult = await translateText(titleInput);
            
            product.titlePL = titleResult.translatedText;
            translationCache.set(cacheKey, titleResult.translatedText);
            titles_translated++;
            
            if (titleResult.confidence < 70) {
              low_confidence++;
            }
          }
        } catch (e: any) {
          console.error(`  ✗ Title translation failed:`, e.message);
          product.titlePL = product.titleNormalizedEN; // Fallback to English
          aiErrors++;
        }
        
        // Translate description if available
        if (product.descriptionEN && product.descriptionEN.length > 0) {
          try {
            // Check cache first
            const descCacheKey = getCacheKey(product.descriptionEN, 'en', 'pl', 'product_description');
            const cachedDesc = translationCache.get(descCacheKey);
            
            if (cachedDesc) {
              product.descriptionPL = cachedDesc;
              console.log(`  ✓ Description (cached)`);
            } else {
              const descInput: TranslationInput = {
                text: product.descriptionEN,
                from: 'en',
                to: 'pl',
                context: 'product_description',
                category: product.categorySlugEN,
                subcategory: product.subcategorySlugEN,
              };
              
              const descResult = await translateText(descInput);
              
              product.descriptionPL = descResult.translatedText;
              translationCache.set(descCacheKey, descResult.translatedText);
              descriptions_translated++;
              
              if (descResult.confidence < 70) {
                low_confidence++;
              }
            }
          } catch (e: any) {
            console.error(`  ✗ Description translation failed:`, e.message);
            product.descriptionPL = product.descriptionEN; // Fallback to English
            aiErrors++;
          }
        }
      }
      // Add more languages as needed (de, fr, etc.)
      
      translated.push(product);
      processed++;
      
      // Delay between items (AI rate limiting - longer than other stages)
      if ((i + 1) % finalConfig.batchSize !== 0) {
        await sleep(finalConfig.delayBetweenItems);
      } else {
        await sleep(finalConfig.delayBetweenBatches);
      }
      
    } catch (error: any) {
      console.error(`[Importer:Translate] Failed to translate product ${product.originalId}:`, error.message);
      // Fallback to English
      product.titlePL = product.titleNormalizedEN;
      product.descriptionPL = product.descriptionEN;
      translated.push(product);
      aiErrors++;
    }
  }
  
  console.log(`[Importer:Translate] ===== STAGE 4 END =====`);
  console.log(`[Importer:Translate] Results:`);
  console.log(`  - Processed: ${processed}/${products.length}`);
  console.log(`  - Prices converted to PLN: ${prices_converted}`);
  console.log(`  - Titles translated: ${titles_translated}`);
  console.log(`  - Descriptions translated: ${descriptions_translated}`);
  console.log(`  - Low confidence items: ${low_confidence}`);
  console.log(`  - AI errors: ${aiErrors}`);
  console.log(`  - Output: ${translated.length} products`);
  
  if (translated.length === 0) {
    console.error(`[Importer:Translate] ❌ CRITICAL: Output is ZERO! Translation failed for all products.`);
  } else {
    console.log(`[Importer:Translate] ✅ Passing ${translated.length} products to Stage 5 (Save)`);
  }
  
  return translated;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
