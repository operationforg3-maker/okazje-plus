/**
 * Stage 4: TRANSLATE - Tłumacz tytuły i opisy na polski
 * 
 * AI-powered translation EN → PL using Genkit flows
 * Category-aware for better technical terminology
 */

import { EnrichedProduct, ImportStageConfig } from './types';
import { aiTranslateTitleToPL } from '@/ai/flows/translation/aiTranslateTitleToPL';
import { aiTranslateDescriptionToPL } from '@/ai/flows/translation/aiTranslateDescriptionToPL';

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

export async function translateProducts(
  products: EnrichedProduct[],
  config: Partial<TranslateConfig> = {}
): Promise<EnrichedProduct[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[Importer:Translate] Starting AI translation for ${products.length} products to ${finalConfig.targetLanguage}`);
  
  const translated: EnrichedProduct[] = [];
  let processed = 0;
  let aiErrors = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`[Importer:Translate] [${i + 1}/${products.length}] AI translating: ${product.titleNormalizedEN.slice(0, 60)}...`);
      
      if (finalConfig.targetLanguage === 'pl') {
        // AI Translation with category context
        try {
          const titleResult = await aiTranslateTitleToPL({
            titleEN: product.titleNormalizedEN,
            categoryEN: product.categorySlugEN,
            subcategoryEN: product.subcategorySlugEN,
            context: 'product_title',
          });
          
          product.titlePL = titleResult.titlePL;
          console.log(`  ✓ Title PL (${titleResult.confidence}% confidence): "${titleResult.titlePL.slice(0, 60)}..."`);
          
          if (titleResult.hasManualReview) {
            console.warn(`  ⚠️ Low confidence - flagged for manual review`);
          }
        } catch (e: any) {
          console.error(`  ✗ Title translation failed:`, e.message);
          product.titlePL = product.titleNormalizedEN; // Fallback to English
          aiErrors++;
        }
        
        // Translate description if available
        if (product.descriptionEN && product.descriptionEN.length > 0) {
          try {
            const descResult = await aiTranslateDescriptionToPL({
              descriptionEN: product.descriptionEN,
              categoryEN: product.categorySlugEN,
              subcategoryEN: product.subcategorySlugEN,
              context: 'product_description',
            });
            
            product.descriptionPL = descResult.descriptionPL;
            console.log(`  ✓ Description PL (${descResult.confidence}% confidence)`);
            
            if (descResult.hasManualReview) {
              console.warn(`  ⚠️ Low confidence description - flagged for review`);
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
  
  console.log(`[Importer:Translate] Completed: ${translated.length} products translated (${aiErrors} errors)`);
  return translated;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
