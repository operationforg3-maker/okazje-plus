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
  console.log(`[Importer:Fetch:HotProducts] Category IDs: ${categoryIds.join(', ')}`);
  
  const allProducts: AliExpressProduct[] = [];
  const seenIds = new Set<string>();
  
  try {
    // Use direct AliExpress client to fetch hot products
    console.log(`[Importer:Fetch:HotProducts] Attempting direct AliExpress client...`);
    try {
        // NEW: Add timeout to prevent hanging on AliExpress client load
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AliExpress client loading timeout (20s)')), 20000)
        );
        const clientModulePromise = import('@/integrations/aliexpress/client');
        const clientModule = await Promise.race([clientModulePromise, timeoutPromise]) as any;
        const { createAliExpressClient } = clientModule;
      const client = createAliExpressClient();
      console.log(`[Importer:Fetch:HotProducts] ✅ AliExpress client loaded`);
      
      // getHotProducts returns already parsed array of products
      const products = await client.getHotProducts(
        categoryIds && categoryIds.length ? categoryIds : undefined,
        'PLN',
        config.maxItemsPerSubcategory || 50
      );
      
      console.log(`[Importer:Fetch:HotProducts] Direct: Got ${products.length} hot products from API`);
      
      // Debug: show first product structure
      if (products.length > 0) {
        console.log(`[Importer:Fetch:HotProducts] 📦 Sample product structure:`, JSON.stringify(products[0], null, 2));
      }
      
      // Normalize to our schema - products from getHotProducts are already parsed
      for (const p of products) {
        const productId = String(p.product_id || p.item_id || '');
        
        if (!productId || productId === 'undefined' || seenIds.has(productId)) {
          console.log(`[Importer:Fetch:HotProducts] ⚠️ Skipping - invalid/duplicate ID:`, productId);
          continue;
        }
        
        seenIds.add(productId);
        
        // Parse price - affiliate API returns strings like "25.99"
        const priceStr = p.target_sale_price || p.sale_price || '0';
        const price = parseFloat(String(priceStr));
        
        // Parse original price
        const originalPriceStr = p.target_original_price || p.original_price || '0';
        const originalPrice = parseFloat(String(originalPriceStr));
        
        // Validate price
        if (!price || price <= 0 || isNaN(price)) {
          console.log(`[Importer:Fetch:HotProducts] ⚠️ Skipping ${productId} - invalid price: "${priceStr}" => ${price}`);
          console.log(`[Importer:Fetch:HotProducts]   Full product data:`, JSON.stringify(p, null, 2));
          continue;
        }
        
        // Extract other fields
        const title = p.product_title || p.title || '';
        // Extract image from image_urls array (per AliExpress API spec) or fallback to legacy field names
        const image = (Array.isArray(p.image_urls) && p.image_urls.length > 0 && p.image_urls[0]) 
          ? p.image_urls[0] 
          : (p.product_main_image_url || p.image_url || '');
        const link = p.promotion_link || p.product_detail_url || '';
        
        // Validate essential fields
        if (!title || !link || !image) {
          console.log(`[Importer:Fetch:HotProducts] ⚠️ Skipping ${productId} - missing data:`, {
            hasTitle: !!title,
            hasLink: !!link, 
            hasImage: !!image
          });
          continue;
        }
        
        const discount = originalPrice > price 
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;
        
        const normalizedProduct = {
          id: productId,
          title,
          image,
          price,
          originalPrice: originalPrice > price ? originalPrice : undefined,
          discount: discount > 0 ? discount : undefined,
          rating: p.evaluate_rate ? parseFloat(String(p.evaluate_rate)) : 0,
          orders: parseInt(String(p.sale_count || p.volume || '0'), 10),
          merchant: p.shop_title || 'AliExpress',
          link,
          currency: p.target_sale_price_currency || 'PLN',
          description: p.product_description || title,
          images: Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls : (Array.isArray(p.product_small_image_urls) ? p.product_small_image_urls : [image]),
          // Keep raw data for debugging
          _raw: p
        };
        
        console.log(`[Importer:Fetch:HotProducts] ✅ OK: ${productId} | ${title.substring(0, 50)}... | ${price} ${normalizedProduct.currency}`);
        allProducts.push(normalizedProduct);
      }
      
      if (allProducts.length > 0) {
        console.log(`[Importer:Fetch:HotProducts] ✅ Direct call SUCCESS: ${allProducts.length} products with complete data`);
        console.log(`[Importer:Fetch:HotProducts] Sample product:`, JSON.stringify(allProducts[0], null, 2));
        console.log(`[Importer:Fetch:HotProducts] ===== STAGE 1 END =====\n`);
        return allProducts;
      }
    } catch (error: any) {
      console.warn(`[Importer:Fetch:HotProducts] Direct client failed:`, error.message);
    }
    
    console.error(`[Importer:Fetch:HotProducts] ❌ CRITICAL: No products fetched! Check:`);
    console.error(`[Importer:Fetch:HotProducts]   - AliExpress API credentials configured?`);
    console.error(`[Importer:Fetch:HotProducts]   - Category IDs valid?`);
    console.error(`[Importer:Fetch:HotProducts]   - API rate limit hit?`);
  } catch (error: any) {
    console.error(`[Importer:Fetch:HotProducts] Error:`, error.message);
  }
  
  console.log(`[Importer:Fetch:HotProducts] ===== RESULTS =====`);
  console.log(`[Importer:Fetch:HotProducts]   Output: ${allProducts.length} hot products`);
  console.log(`[Importer:Fetch:HotProducts] ===== STAGE 1 END =====\n`);
  
  return allProducts;
}

/**
 * Validate that a product has all essential fields
 * Returns validation result with reason if invalid
 * 
 * RELAXED VALIDATION: Only reject products with critical missing data
 * - Accepts products with low ratings, few orders, no reviews
 * - Accepts very short titles
 * - Focus: Must have ID, title, price > 0, image, and link
 */
function validateProduct(product: any, source: string = 'unknown'): { valid: boolean; reason?: string } {
  // CRITICAL: Must have ID
  if (!product.id || String(product.id).trim() === '' || product.id === 'undefined') {
    return { valid: false, reason: 'Missing/invalid ID' };
  }
  
  // CRITICAL: Must have title (even very short ones OK - removed length check)
  if (!product.title || product.title.trim().length === 0) {
    return { valid: false, reason: 'Missing title' };
  }
  
  // CRITICAL: Must have valid price > 0
  if (!product.price || product.price <= 0 || isNaN(product.price)) {
    return { valid: false, reason: `Invalid price: ${product.price}` };
  }
  
  // CRITICAL: Must have image URL
  if (!product.image || !product.image.startsWith('http')) {
    return { valid: false, reason: 'Missing/invalid image URL' };
  }
  
  // CRITICAL: Must have link
  if (!product.link || !product.link.startsWith('http')) {
    return { valid: false, reason: 'Missing/invalid link' };
  }
  
  // ✅ PASSED all critical checks - accept product
  // No checks for ratings, orders, or reviews - let dedupe stage handle quality
  return { valid: true };
}

/**
 * Fetch products from AliExpress API
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
  
  // TRY DIRECT CLIENT CALL FIRST (for Cloud Functions compatibility)
  console.log(`[Importer:Fetch] Attempting direct AliExpress client...`);
  try {
    const { getAliExpressClient } = await import('@/lib/integrations/aliexpress-client');
    const client = getAliExpressClient();
    console.log(`[Importer:Fetch] ✅ AliExpress client loaded`);
    
    const allProducts: AliExpressProduct[] = [];
    const seenIds = new Set<string>();
    
    for (const keyword of keywords) {
      try {
        console.log(`[Importer:Fetch] Direct: Searching "${keyword}"...`);
        const results = await client.smartMatch(keyword);
        const products = results?.products?.items || [];
        
        console.log(`[Importer:Fetch] Direct: Got ${products.length} products for "${keyword}"`);
        
        // DEBUG: Log first product raw structure
        if (products.length > 0) {
          console.log(`[Importer:Fetch] 🔍 RAW PRODUCT SAMPLE (first product):`, JSON.stringify(products[0]).slice(0, 1000));
          console.log(`[Importer:Fetch] 🔍 Image fields check:`, {
            product_main_image_url: products[0].product_main_image_url,
            product_image: products[0].product_image,
            image_url: products[0].image_url,
            item_main_image: products[0].item_main_image,
            all_keys: Object.keys(products[0]),
          });
        }
        
        for (const p of products) {
          const productId = String(p.product_id || p.id);
          if (!productId || seenIds.has(productId)) continue;
          
          seenIds.add(productId);
          
          // Extract image from image_urls array (per AliExpress API spec)
          const mainImage = Array.isArray(p.image_urls) && p.image_urls.length > 0 && p.image_urls[0] 
            ? p.image_urls[0] 
            : (p.product_main_image_url || p.product_image || '');
          
          const product: AliExpressProduct = {
            id: productId,
            title: p.product_title || 'Untitled',
            image: mainImage,
            price: parseFloat(p.sale_price || p.price || '0'),
            originalPrice: parseFloat(p.original_price || p.list_price || '0') || undefined,
            discount: p.discount || undefined,
            rating: parseFloat(p.evaluation_rate || '0'),
            orders: parseInt(p.total_transaction_seller || '0', 10),
            merchant: p.shop_name || 'AliExpress',
            link: p.product_detail_url || '#',
            currency: 'USD',
            description: p.product_description || '',
            images: Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls : (p.product_images || (mainImage ? [mainImage] : [])),
            ...p
          };
          
          // Validate product
          const validation = validateProduct(product, 'keyword-search');
          if (!validation.valid) {
            console.log(`[Importer:Fetch] ⚠️ Skipping ${productId}: ${validation.reason}`);
            continue;
          }
          
          allProducts.push(product);
          
          await sleep(config.delayBetweenItems || 50);
        }
      } catch (error: any) {
        console.warn(`[Importer:Fetch] Direct search failed for "${keyword}":`, error.message);
      }
    }
    
    if (allProducts.length > 0) {
      console.log(`[Importer:Fetch] ✅ Direct call SUCCESS: ${allProducts.length} products`);
      console.log(`[Importer:Fetch] ===== STAGE 1 END =====\n`);
      return allProducts;
    }
    
    console.warn(`[Importer:Fetch] Direct call returned 0 products, falling back to HTTP API...`);
  } catch (error: any) {
    console.warn(`[Importer:Fetch] Direct client failed:`, error.message);
    console.log(`[Importer:Fetch] Falling back to HTTP API call...`);
  }
  
  // FALLBACK: Use HTTP API call (works from localhost)
  const allProducts: AliExpressProduct[] = [];
  const seenIds = new Set<string>();
  let batchCount = 0;
  
  for (const keyword of keywords) {
    try {
      console.log(`[Importer:Fetch] HTTP: Fetching batch ${++batchCount}/${keywords.length}: "${keyword}"`);
      console.log(`[Importer:Fetch] HTTP: Calling ${siteUrl}/api/admin/aliexpress/search`);
      
      const response = await fetch(`${siteUrl}/api/admin/aliexpress/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: keyword,
          limit: config.batchSize,
          sort: 'bestMatch'
        })
      });
      
      console.log(`[Importer:Fetch] HTTP: Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error ${response.status}: ${errorText.slice(0, 200)}`;
        console.error(`[Importer:Fetch] ${errorMsg}`);
        
        // If 503 (not configured) - critical issue, must fail loudly
        if (response.status === 503) {
          console.error(`[Importer:Fetch] ❌ CRITICAL: AliExpress API not configured!`);
          console.error(`[Importer:Fetch] Missing env vars: ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_API_BASE`);
          console.error(`[Importer:Fetch] This is why products are not being fetched!`);
          console.error(`[Importer:Fetch] Fix: Add these variables to .env.local or Firebase secrets`);
          console.error(`[Importer:Fetch] See: docs/troubleshooting/IMPORT_SYSTEM_GUIDE.md for setup instructions`);
          throw new Error(`AliExpress API not configured (status 503) - Missing environment variables. Check server logs for details.`);
        }
        
        // Other errors
        console.error(`[Importer:Fetch] ❌ HTTP API call failed for keyword "${keyword}"`);
        console.error(`[Importer:Fetch] Status: ${response.status}, Error: ${errorText.slice(0, 500)}`);
        throw new Error(`AliExpress API error: ${response.status}`);
      }
      
      const data = await response.json();
      const products = data.products || [];
      
      console.log(`[Importer:Fetch] HTTP: Got ${products.length} products for "${keyword}"`);
      
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
  console.log(`[Importer:Fetch] ===== STAGE 1 END =====`);
  console.log(`[Importer:Fetch] Total products fetched: ${allProducts.length}`);
  
  if (allProducts.length === 0) {
    console.error(`[Importer:Fetch] ❌ CRITICAL: No products fetched!`);
    console.error(`[Importer:Fetch] Troubleshooting:`);
    console.error(`   1. Check API configuration (run: node test-import-simple.mjs)`);
    console.error(`   2. Verify keywords are in English: ${keywords.join(', ')}`);
    console.error(`   3. Check network connectivity to marketplace APIs`);
    console.error(`   4. Review server logs for API errors`);
    console.error(`   5. See: docs/troubleshooting/IMPORT_SYSTEM_GUIDE.md`);
  } else {
    console.log(`[Importer:Fetch] ✅ Successfully fetched ${allProducts.length} products`);
  }
  console.log('');
  
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
 * Fetch products from Convertiser by keywords
 * Uses /api/admin/convertiser/search endpoint
 */
export async function fetchProductsFromConvertiser(
  keywords: string[],
  config: ImportStageConfig,
  siteUrl: string = resolveSiteUrl()
): Promise<AliExpressProduct[]> {
  console.log(`[Importer:Fetch:Convertiser] ===== STAGE 1 START =====`);
  console.log(`[Importer:Fetch:Convertiser] Keywords (${keywords.length}): ${keywords.join(' | ')}`);
  console.log(`[Importer:Fetch:Convertiser] Site URL: ${siteUrl}`);
  
  // TRY DIRECT CLIENT CALL FIRST (for Cloud Functions compatibility)
  console.log(`[Importer:Fetch:Convertiser] Attempting direct Convertiser client...`);
  try {
    const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
    const client = getConvertiserClient();
    console.log(`[Importer:Fetch:Convertiser] ✅ Convertiser client loaded`);
    
    const allProducts: AliExpressProduct[] = [];
    const seenIds = new Set<string>();
    
    for (const keyword of keywords) {
      try {
        console.log(`[Importer:Fetch:Convertiser] Direct: Searching "${keyword}"...`);
        const results = await client.searchProductsV2(keyword, { page: 1, page_size: config.batchSize || 50 });
        const products = results?.results || [];
        
        console.log(`[Importer:Fetch:Convertiser] Direct: Got ${products.length} products for "${keyword}"`);
        
        for (const p of products) {
          const productId = String(p.id || p.productId);
          if (!productId || seenIds.has(productId)) continue;
          
          seenIds.add(productId);
          
          const price = parseFloat(p.price || p.salePrice || '0');
          const originalPrice = parseFloat(p.originalPrice || p.listPrice || '0');
          const discount = originalPrice > price 
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;
          
          allProducts.push({
            id: productId,
            title: p.name || p.title || 'Untitled',
            image: p.image || p.photo || '',
            price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            discount: discount > 0 ? discount : undefined,
            rating: parseFloat(p.rating || p.stars || '0'),
            orders: parseInt(p.reviews || p.soldCount || '0', 10),
            merchant: p.advertiser || p.seller || 'Convertiser',
            link: p.url || p.link || '#',
            currency: p.currency || 'PLN',
            description: p.description || '',
            images: p.images || (p.image ? [p.image] : []),
            ...p
          });
          
          await sleep(config.delayBetweenItems || 100);
        }
      } catch (error: any) {
        console.warn(`[Importer:Fetch:Convertiser] Direct search failed for "${keyword}":`, error.message);
      }
    }
    
    if (allProducts.length > 0) {
      console.log(`[Importer:Fetch:Convertiser] ✅ Direct call SUCCESS: ${allProducts.length} products`);
      console.log(`[Importer:Fetch:Convertiser] ===== STAGE 1 END =====\n`);
      return allProducts;
    }
    
    console.warn(`[Importer:Fetch:Convertiser] Direct call returned 0 products, falling back to HTTP API...`);
  } catch (error: any) {
    console.warn(`[Importer:Fetch:Convertiser] Direct client failed:`, error.message);
    console.log(`[Importer:Fetch:Convertiser] Falling back to HTTP API call...`);
  }
  
  // FALLBACK: Use HTTP API call (works from localhost)
  const allProducts: AliExpressProduct[] = [];
  const seenIds = new Set<string>();
  let batchCount = 0;
  
  for (const keyword of keywords) {
    try {
      console.log(`[Importer:Fetch:Convertiser] HTTP: Fetching batch ${++batchCount}/${keywords.length}: "${keyword}"`);
      
      const response = await fetch(`${siteUrl}/api/admin/convertiser/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: keyword,
          pageSize: config.batchSize || 50,
          page: 1
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Importer:Fetch:Convertiser] API error ${response.status} for "${keyword}": ${errorText.slice(0, 200)}`);
        continue;
      }
      
      const data = await response.json();
      const products = data.results || [];
      
      console.log(`[Importer:Fetch:Convertiser] HTTP: Got ${products.length} products for "${keyword}"`);
      
      // Normalize to our schema
      for (const p of products) {
        const productId = String(p.id || p.productId || p.item_id);
        
        if (!productId || seenIds.has(productId)) {
          continue;
        }
        
        seenIds.add(productId);
        
        const price = parseFloat(p.price || p.salePrice || '0');
        const originalPrice = parseFloat(p.originalPrice || p.listPrice || p.price || '0');
        const discount = originalPrice > price 
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;
        
        allProducts.push({
          id: productId,
          title: p.name || p.title || 'Untitled',
          image: p.image || p.photo || '',
          price,
          originalPrice: originalPrice > price ? originalPrice : undefined,
          discount: discount > 0 ? discount : undefined,
          rating: parseFloat(p.rating || p.stars || '0'),
          orders: parseInt(p.reviews || p.soldCount || '0', 10),
          merchant: p.advertiser || p.seller || 'Convertiser',
          link: p.url || p.link || '#',
          currency: p.currency || 'PLN',
          description: p.description || '',
          images: p.images || (p.image ? [p.image] : []),
          ...p
        });
        
        // Respect rate limiting
        await sleep(100);
      }
      
      // Delay between keywords
      await sleep(config.fetchDelay || 100);
    } catch (error: any) {
      console.error(`[Importer:Fetch:Convertiser] Error fetching "${keyword}":`, error.message);
    }
  }
  
  console.log(`[Importer:Fetch:Convertiser] ===== RESULTS =====`);
  console.log(`[Importer:Fetch:Convertiser]   Output: ${allProducts.length} products`);
  
  if (allProducts.length === 0) {
    console.error(`[Importer:Fetch:Convertiser] ❌ CRITICAL: No products fetched!`);
    console.error(`[Importer:Fetch:Convertiser] Troubleshooting:`);
    console.error(`   1. Check Convertiser API token (run: node test-import-simple.mjs)`);
    console.error(`   2. Verify keywords are appropriate: ${keywords.join(', ')}`);
    console.error(`   3. Check /api/admin/convertiser/search endpoint`);
    console.error(`   4. Review server logs for API errors`);
    console.error(`   5. See: docs/troubleshooting/IMPORT_SYSTEM_GUIDE.md`);
  } else {
    console.log(`[Importer:Fetch:Convertiser] ✅ Successfully fetched ${allProducts.length} products`);
  }
  
  console.log(`[Importer:Fetch:Convertiser] ===== STAGE 1 END =====\n`);
  
  return allProducts;
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
