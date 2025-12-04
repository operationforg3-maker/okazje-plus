/**
 * Stage 1: FETCH - pobierz produkty z AliExpress API
 * 
 * Zwraca surowe produkty z AliExpress API z prawidłowymi cenami i walutami
 */

import { AliExpressProduct, ImportStageConfig } from './types';

/**
 * Pobiera produkty z AliExpress API dla danego kategoria
 * Zwraca surowe dane z AliExpress
 */
export async function fetchProductsFromAliexpress(
  keywords: string[], // English keywords: ['Electronics', 'Smartphones', etc]
  config: ImportStageConfig,
  siteUrl: string = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:9002'
): Promise<AliExpressProduct[]> {
  console.log(`[Importer:Fetch] Starting fetch stage for keywords: ${keywords.join(' -> ')}`);
  
  const allProducts: AliExpressProduct[] = [];
  const seenIds = new Set<string>();
  let batchCount = 0;
  
  for (const keyword of keywords) {
    try {
      console.log(`[Importer:Fetch] Fetching batch ${++batchCount}/${keywords.length}: "${keyword}"`);
      
      const response = await fetch(`${siteUrl}/api/admin/aliexpress/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: keyword,
          limit: config.batchSize,
          sort: 'bestMatch'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Importer:Fetch] API error ${response.status}: ${errorText.slice(0, 200)}`);
        
        // If 503 (not configured) - skip but continue
        if (response.status === 503) {
          console.warn(`[Importer:Fetch] AliExpress API not configured - check env vars`);
          await sleep(config.delayBetweenBatches);
          continue;
        }
        
        throw new Error(`AliExpress API error: ${response.status}`);
      }
      
      const data = await response.json();
      const products = data.products || [];
      
      console.log(`[Importer:Fetch] Got ${products.length} products for "${keyword}"`);
      
      // Normalize AliExpress response to our schema
      for (const p of products) {
        const productId = String(p.id || p.itemId || p.item_id || p.productId);
        
        if (!productId || seenIds.has(productId)) {
          continue;
        }
        
        seenIds.add(productId);
        
        // Extract price - AliExpress can return multiple formats
        const priceRaw = p.price || p.salePrice || p.sale_price || 0;
        let price = 0;
        if (typeof priceRaw === 'number') {
          price = priceRaw;
        } else if (typeof priceRaw === 'string') {
          price = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));
        }
        
        // Original price if available (for discount calculation)
        const originalPriceRaw = p.originalPrice || p.original_price || p.marketPrice;
        let originalPrice = price;
        if (originalPriceRaw) {
          if (typeof originalPriceRaw === 'number') {
            originalPrice = originalPriceRaw;
          } else if (typeof originalPriceRaw === 'string') {
            originalPrice = parseFloat(originalPriceRaw.replace(/[^0-9.]/g, ''));
          }
        }
        
        // Calculate discount %
        const discount = originalPrice > 0 
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;
        
        const normalized: AliExpressProduct = {
          id: productId,
          title: p.title || p.name || 'Untitled',
          image: p.image || p.productImage || p.product_main_image_url || '',
          price,
          originalPrice: originalPrice > price ? originalPrice : undefined,
          discount: discount > 0 ? discount : undefined,
          rating: parseFloat(p.rating || p.shopRating || '0'),
          orders: parseInt(p.orders || p.volume || '0', 10),
          merchant: p.merchant || p.storeName || p.shop || 'AliExpress',
          link: p.link || p.productUrl || p.url || '#',
          currency: p.currency || 'USD', // Default USD from AliExpress
          
          // Additional fields for context
          description: p.description || '',
          images: p.images || (p.image ? [p.image] : []),
          
          // Raw data for advanced cases
          ...p
        };
        
        allProducts.push(normalized);
      }
      
      // Delay between batches to avoid rate limiting
      await sleep(config.delayBetweenBatches);
      
    } catch (error: any) {
      console.error(`[Importer:Fetch] Error fetching "${keyword}":`, error.message);
      // Continue with next keyword
    }
  }
  
  console.log(`[Importer:Fetch] Completed: ${allProducts.length} unique products from ${keywords.length} queries`);
  return allProducts;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate keywords in English for a category path
 * E.g., ['Electronics', 'Smartphones', 'Android'] → multiple queries
 */
export function generateSearchKeywords(categoryPath: string[]): string[] {
  const queries: string[] = [];
  
  // Full path
  queries.push(categoryPath.join(' '));
  
  // Variations
  queries.push(`${categoryPath.join(' ')} bestseller`);
  queries.push(`${categoryPath.join(' ')} popular`);
  queries.push(`${categoryPath.join(' ')} sale`);
  
  // Without deepest level (if 3+ levels)
  if (categoryPath.length > 2) {
    queries.push(categoryPath.slice(0, 2).join(' '));
    queries.push(`${categoryPath.slice(0, 2).join(' ')} popular`);
  }
  
  return queries;
}
