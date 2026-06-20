/**
 * Stage 2: DEDUPE - usuń duplikaty i niechciane produkty
 * 
 * Deduplikuje po ID i URL, filtruje po cenie/ratingu
 */

import { AliExpressProduct, ImportStageConfig } from './types';

export interface DedupeConfig extends ImportStageConfig {
  minPrice?: number; // Filter out suspiciously cheap items
  maxPrice?: number;
  minRating?: number; // 0-5
  minOrders?: number; // Popularity threshold
}

export async function deduplicateProducts(
  products: AliExpressProduct[],
  config: DedupeConfig = {
    name: 'dedupe',
    batchSize: 50,
    delayBetweenItems: 0,
    delayBetweenBatches: 100,
    maxRetries: 1,
    // RELAXED DEFAULTS: Accept products with ANY rating/orders
    minRating: 0,  // Accept even unrated products (0 = no filter)
    minOrders: 0,  // Accept even products with 0 orders (0 = no filter)
  }
): Promise<AliExpressProduct[]> {
  console.log(`[Importer:Dedupe] ===== STAGE 2 START =====`);
  console.log(`[Importer:Dedupe] Input: ${products.length} products`);
  if (products.length === 0) {
    console.error(`[Importer:Dedupe] ❌ CRITICAL: Zero input! Stage 1 (Fetch) returned 0 products.`);
    return [];
  }
  
  const seenIds = new Set<string>();
  const seenLinks = new Set<string>();
  const filtered: AliExpressProduct[] = [];
  
  let filtered_price = 0;
  let filtered_rating = 0;
  let filtered_orders = 0;
  let filtered_duplicate = 0;
  
  for (const product of products) {
    // Check for duplicate ID or link
    if (seenIds.has(product.id) || seenLinks.has(product.link)) {
      filtered_duplicate++;
      continue;
    }
    
    // Price, Rating, and Orders filtering disabled to save all products as requested.
    
    // All checks passed
    seenIds.add(product.id);
    seenLinks.add(product.link);
    filtered.push(product);
  }
  
  console.log(`[Importer:Dedupe] Filter Breakdown:`);
  console.log(`  - Kept: ${filtered.length}`);
  console.log(`  - Filtered (duplicate): ${filtered_duplicate}`);
  console.log(`  - Filtered (price): ${filtered_price}`);
  console.log(`  - Filtered (rating): ${filtered_rating}`);
  console.log(`  - Filtered (orders): ${filtered_orders}`);
  
  if (filtered.length === 0) {
    console.error(`[Importer:Dedupe] ❌ CRITICAL: Output is ZERO! Filters were too aggressive.`);
    console.error(`[Importer:Dedupe] Filtering breakdown: duplicate=${filtered_duplicate}, price=${filtered_price}, rating=${filtered_rating}, orders=${filtered_orders}`);
    console.error(`[Importer:Dedupe] Config used: minPrice=${config.minPrice}, maxPrice=${config.maxPrice}, minRating=${config.minRating}, minOrders=${config.minOrders}`);
  } else {
    console.log(`[Importer:Dedupe] ✅ STAGE 2 END: Passing ${filtered.length} products to Stage 3 (Enrich)`);
  }
  
  return filtered;
}

/**
 * Remove obviously broken/spam products
 */
export function sanitizeProducts(products: AliExpressProduct[]): AliExpressProduct[] {
  return products.filter(p => {
    // Must have title and link
    if (!p.title || !p.link || p.link === '#') return false;
    
    // Relax: allow products without images (enrich can add placeholder)
    // if (!p.image) return false;
    
    // Relax: allow wider price range (0.01 to 50000 PLN)
    if (p.price <= 0.01 || p.price > 50000) return false;
    
    // Relax: only filter obvious malicious spam
    const spam_keywords = ['click here', 'download now', 'virus', 'hack'];
    const titleLower = p.title.toLowerCase();
    if (spam_keywords.some(keyword => titleLower.includes(keyword))) {
      return false;
    }
    
    return true;
  });
}
