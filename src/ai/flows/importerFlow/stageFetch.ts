/**
 * Stage 1: FETCH - pobierz produkty z AliExpress API
 * 
 * Zwraca surowe produkty z AliExpress API z prawidłowymi cenami i walutami
 */

import { AliExpressProduct, ImportStageConfig } from './types';

/**
 * NEW: Fetch hot products directly by category IDs (no keywords needed!)
 * Uses aliexpress.affiliate.hotproduct.query method
 */
export async function fetchHotProductsByCategory(
  categoryIds: string[],
  config: ImportStageConfig,
  siteUrl: string = resolveSiteUrl()
): Promise<AliExpressProduct[]> {
  console.log(`[Importer:Fetch:HotProducts] ===== STAGE 1 START (HOT PRODUCTS) =====`);
  console.log(`[Importer:Fetch:HotProducts] Site URL: ${siteUrl}`);
  console.log(`[Importer:Fetch:HotProducts] Category IDs: ${categoryIds.join(', ')}`);
  
  const allProducts: AliExpressProduct[] = [];
  const seenIds = new Set<string>();
  
  try {
    // Call our backend endpoint that uses AliExpressClient.getHotProducts()
    const response = await fetch(`${siteUrl}/api/admin/import/bestsellers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryIds: categoryIds,
        limit: config.batchSize,
        currency: 'PLN'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Importer:Fetch:HotProducts] API error ${response.status}: ${errorText.slice(0, 200)}`);
      
      if (response.status === 503) {
        console.error(`[Importer:Fetch:HotProducts] ❌ CRITICAL: AliExpress API not configured!`);
        throw new Error(`AliExpress API not configured (status 503)`);
      }
      
      throw new Error(`Hot products API error: ${response.status}`);
    }
    
    const data = await response.json();
    const products = data.products || [];
    
    console.log(`[Importer:Fetch:HotProducts] Got ${products.length} hot products`);
    
    // Normalize to our schema
    for (const p of products) {
      const productId = String(p.id || p.itemId || p.item_id || p.productId);
      
      if (!productId || seenIds.has(productId)) {
        continue;
      }
      
      seenIds.add(productId);
      
      const priceRaw = p.price || p.salePrice || p.sale_price || 0;
      let price = 0;
      if (typeof priceRaw === 'number') {
        price = priceRaw;
      } else if (typeof priceRaw === 'string') {
        price = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));
      }
      
      const originalPriceRaw = p.originalPrice || p.original_price || p.marketPrice;
      let originalPrice = price;
      if (originalPriceRaw) {
        if (typeof originalPriceRaw === 'number') {
          originalPrice = originalPriceRaw;
        } else if (typeof originalPriceRaw === 'string') {
          originalPrice = parseFloat(originalPriceRaw.replace(/[^0-9.]/g, ''));
        }
      }
      
      const discount = originalPrice > 0 
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;
      
      allProducts.push({
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
        currency: p.currency || 'PLN',
        description: p.description || '',
        images: p.images || (p.image ? [p.image] : []),
        ...p
      });
    }
  } catch (error: any) {
    console.error(`[Importer:Fetch:HotProducts] Error:`, error.message);
  }
  
  console.log(`[Importer:Fetch:HotProducts] ===== RESULTS =====`);
  console.log(`[Importer:Fetch:HotProducts]   Output: ${allProducts.length} hot products`);
  console.log(`[Importer:Fetch:HotProducts] ===== STAGE 1 END =====\n`);
  
  return allProducts;
}

/**
 * Pobiera produkty z AliExpress API dla danego kategoria
 * Zwraca surowe dane z AliExpress
 */
export async function fetchProductsFromAliexpress(
  keywords: string[], // English keywords: ['Electronics', 'Smartphones', etc]
  config: ImportStageConfig,
  siteUrl: string = resolveSiteUrl()
): Promise<AliExpressProduct[]> {
  // NEW: Switch based on importerType
  const importerType = config.importerType || 'keyword-search';
  
  console.log(`[Importer:Fetch] ===== STAGE 1 START =====`);
  console.log(`[Importer:Fetch] Importer Type: ${importerType.toUpperCase()}`);
  console.log(`[Importer:Fetch] Site URL: ${siteUrl}`);
  
  // NEW: If hot-products mode, use category-based fetch instead
  if (importerType === 'hot-products' && keywords.length > 0) {
    // Keywords are treated as category IDs in hot-products mode
    return fetchHotProductsByCategory(keywords, config, siteUrl);
  }
  
  console.log(`[Importer:Fetch] Keywords (${keywords.length}): ${keywords.join(' | ')}`);
  
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
        const errorMsg = `API error ${response.status}: ${errorText.slice(0, 200)}`;
        console.error(`[Importer:Fetch] ${errorMsg}`);
        
        // If 503 (not configured) - critical issue, must fail loudly
        if (response.status === 503) {
          console.error(`[Importer:Fetch] ❌ CRITICAL: AliExpress API not configured!`);
          console.error(`[Importer:Fetch] Missing env vars: ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET`);
          console.error(`[Importer:Fetch] This is why products are not being fetched!`);
          throw new Error(`AliExpress API not configured (status 503) - check .env.local for ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET`);
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
          currency: p.currency || 'PLN', // ← API zwraca PLN, zapisujemy walutę
          
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
  
  console.log(`[Importer:Fetch] ===== RESULTS =====`);
  console.log(`[Importer:Fetch]   Output: ${allProducts.length} unique products from ${keywords.length} keyword queries`);
  if (allProducts.length === 0) {
    console.error(`[Importer:Fetch] ❌ CRITICAL: 0 products fetched! Check:`);
    console.error(`     - Site URL: ${siteUrl}`);
    console.error(`     - Keywords: ${keywords.join(', ')}`);
    console.error(`     - /api/admin/aliexpress/search endpoint reachable?`);
    console.error(`     - ALIEXPRESS_APP_KEY/SECRET configured?`);
  }
  console.log(`[Importer:Fetch] ===== STAGE 1 END =====\n`);
  return allProducts;
}

/**
 * Resolve base site URL for internal API calls (works locally and in hosting).
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    'https://okazje-plus.web.app',
  ].filter(Boolean) as string[];

  const raw = candidates[0] || 'http://localhost:9002';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
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
