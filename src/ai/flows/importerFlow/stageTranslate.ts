/**
 * Stage 4: TRANSLATE - Tłumacz tytuły i opisy na polski
 * 
 * AI translation EN → PL (batch processing)
 */

import { EnrichedProduct, ImportStageConfig } from './types';

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
  
  console.log(`[Importer:Translate] Starting translation for ${products.length} products to ${finalConfig.targetLanguage}`);
  
  // For now, we'll use a simple translation mapping
  // In production, you'd integrate with Translation API or AI
  
  const translated: EnrichedProduct[] = [];
  let processed = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`[Importer:Translate] [${i + 1}/${products.length}] Translating: ${product.titleNormalizedEN.slice(0, 60)}...`);
      
      if (finalConfig.targetLanguage === 'pl') {
        // Simple translation for Polish
        product.titlePL = translateTitleToPolish(product.titleNormalizedEN);
        product.descriptionPL = translateDescriptionToPolish(product.descriptionEN);
        
        console.log(`  ✓ Title PL: "${product.titlePL.slice(0, 60)}..."`);
      }
      // Add more languages as needed
      
      translated.push(product);
      processed++;
      
      // Delay between items
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
    }
  }
  
  console.log(`[Importer:Translate] Completed: ${translated.length} products translated`);
  return translated;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simple English → Polish title translation
 * For production, integrate with proper translation service
 */
function translateTitleToPolish(titleEN: string): string {
  // Build a translation dictionary for common tech terms
  const dict: Record<string, string> = {
    // Electronics
    'smartphone': 'smartfon',
    'mobile phone': 'telefon komórkowy',
    'laptop': 'laptop',
    'tablet': 'tablet',
    'smartwatch': 'smartwatch',
    'headphones': 'słuchawki',
    'earphones': 'słuchawki douszne',
    'charger': 'ładowarka',
    'cable': 'kabel',
    'screen protector': 'folia na ekran',
    'case': 'etui',
    'wireless': 'bezprzewodowy',
    'fast charging': 'szybkie ładowanie',
    'waterproof': 'wodoodporny',
    
    // Quantities/Specs
    'inch': 'cala',
    'gb': 'gb',
    'mp': 'mp',
    'ghz': 'ghz',
    'mah': 'mah',
    
    // Common adjectives
    'new': 'nowy',
    'original': 'oryginalny',
    'genuine': 'autentyczny',
    'professional': 'profesjonalny',
    'portable': 'przenośny',
    'compact': 'kompaktowy',
    'universal': 'uniwersalny',
    'dual': 'podwójny',
  };
  
  // Simple word-by-word replacement (would be improved with actual NLP)
  let translated = titleEN;
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedEntries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  
  for (const [en, pl] of sortedEntries) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    translated = translated.replace(regex, pl);
  }
  
  // Capitalize first letter
  translated = translated.charAt(0).toUpperCase() + translated.slice(1);
  
  return translated;
}

/**
 * Simple English → Polish description translation
 */
function translateDescriptionToPolish(descEN: string): string {
  if (!descEN) return '';
  
  // For descriptions, just do basic replacements
  let translated = descEN;
  
  const phrases: Record<string, string> = {
    'high quality': 'wysoka jakość',
    'fast delivery': 'szybka dostawa',
    'free shipping': 'darmowa dostawa',
    'best price': 'najlepsza cena',
    'limited stock': 'ograniczony zapas',
    'in stock': 'w magazynie',
    'out of stock': 'brak w magazynie',
    'warranty': 'gwarancja',
  };
  
  for (const [en, pl] of Object.entries(phrases)) {
    const regex = new RegExp(en, 'gi');
    translated = translated.replace(regex, pl);
  }
  
  return translated;
}
