import { createCategory, createSubcategory, createSubSubcategory, createProduct, findExistingProduct, updateProduct, getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiProductEnrichmentPL } from '@/ai/flows/aliexpress/aiProductEnrichmentPL';
import { aiProductEnrichmentBatchPL } from '@/ai/flows/aliexpress/aiProductEnrichmentBatchPL';
import { cacheDel } from '@/lib/cache';

/**
 * Wyszukuje produkty dla kategorii przez AliExpress API
 */
async function fetchProductsForCategory(categoryName: string, count: number = 5): Promise<any[]> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`;
    console.log(`[fetchProductsForCategory] Fetching from: ${url}`);
    console.log(`[fetchProductsForCategory] Query: "${categoryName}", limit: ${count}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: categoryName, 
        limit: count,
        sort: 'bestMatch'
      })
    });
    
    console.log(`[fetchProductsForCategory] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetchProductsForCategory] API error (${response.status}):`, errorText);
      return [];
    }
    
    const data = await response.json();
    console.log(`[fetchProductsForCategory] Received ${data.products?.length || 0} products for "${categoryName}"`);
    
    if (data.products && data.products.length > 0) {
      console.log(`[fetchProductsForCategory] First product sample:`, {
        title: data.products[0].title,
        price: data.products[0].price,
        hasImage: !!data.products[0].image
      });
    }
    
    return data.products || [];
  } catch (e: any) {
    console.error(`[fetchProductsForCategory] Exception for "${categoryName}":`, e.message);
    return [];
  }
}

/**
 * Pobiera szczegółowe informacje o produkcie (opis, specyfikacje, warianty)
 */
async function fetchProductDetails(productId: string): Promise<any | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/item?id=${productId}`;
    console.log(`[fetchProductDetails] Fetching details for product: ${productId}`);
    
    const response = await fetch(url, {
      method: 'GET',
    });
    
    if (!response.ok) {
      console.error(`[fetchProductDetails] API error (${response.status}) for product ${productId}`);
      return null;
    }
    
    const data = await response.json();
    return data.product || null;
  } catch (e: any) {
    console.error(`[fetchProductDetails] Exception for product ${productId}:`, e.message);
    return null;
  }
}

// Multi-query wariant: kilka zapytań + deduplikacja + sortowanie po popularności i ocenie
async function fetchMultiQuery(categoryPath: string[], baseLimit: number): Promise<any[]> {
  const base = categoryPath.join(' ');
  const queries = [
    `${base} bestseller`, // priorytet: bestsellery
    `${base} wysokie oceny`, // wysokie oceny
    base, // neutralne
    `${base} promocja`, // dodatkowo promocje
  ];
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const q of queries) {
    const list = await fetchProductsForCategory(q, baseLimit);
    for (const p of list) {
      const originalId = p.id || p.itemId || p.item_id || p.productId || '';
      const affiliateUrl = p.link || p.productUrl || p.url || '';
      const key = originalId || affiliateUrl;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
    }
  }
  // Sortuj po popularności (orders) i ocenie (rating)
  merged.sort((a, b) => {
    const popularityA = (a.orders || 0) * (a.rating || 0);
    const popularityB = (b.orders || 0) * (b.rating || 0);
    return popularityB - popularityA;
  });
  return merged;
}

/**
 * Automatycznie wypełnia katalog kategoriami, podkategoriami, pod-podkategoriami
 * i przypisuje do nich produkty pobrane z AliExpress API
 * Struktura zbliżona do Pepper.pl, zoptymalizowana pod wygodę klienta.
 */
export async function fillCategoriesWithProducts() {
  try {
    console.log('[fillCategoriesWithProducts] ===== STARTING FLOW =====');
    console.log('[fillCategoriesWithProducts] Process:', process.pid);
    console.log('[fillCategoriesWithProducts] Environment:', process.env.NODE_ENV);
    
    // Pobierz preferencję waluty z Firestore config
    let preferredCurrency = 'USD';
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const currencyDoc = await adminDb.collection('config').doc('currencyPreference').get();
      if (currencyDoc.exists) {
        preferredCurrency = currencyDoc.data()?.currency || 'USD';
      }
      console.log(`[fillCategoriesWithProducts] Using preferred currency: ${preferredCurrency}`);
    } catch (e) {
      console.warn('[fillCategoriesWithProducts] Failed to load currency preference, using USD', e);
    }
    
    // Przeczytaj istniejące kategorie z Firestore (utworzone wcześniej przez createCategoryStructure)
    const categories = await getAllCategories();
    console.log(`[fillCategoriesWithProducts] Found ${categories.length} categories in Firestore`);
    
    if (categories.length === 0) {
      throw new Error('No categories found in Firestore. Please run "Utwórz kategorie" first!');
    }

  let totalProducts = 0;
  let totalCategories = 0;
  let totalSubcategories = 0;
  let totalSubSubcategories = 0;
  // Cache AI aby ograniczyć liczbę wywołań przy multi-query
  const titleNormCache = new Map<string, any>();
  const enrichmentCache = new Map<string, any>();
  
  console.log(`[fillCategoriesWithProducts] Processing ${categories.length} main categories...`);
  
  for (const cat of categories) {
    try {
      console.log(`[fillCategoriesWithProducts] Processing category: ${cat.name} (ID: ${cat.id})`);
      totalCategories++;
      
      // Pobierz subcategories z Firestore
      const subcategories = await getSubcategories(cat.id);
      console.log(`[fillCategoriesWithProducts] Found ${subcategories.length} subcategories for ${cat.name}`);
      
      for (const sub of subcategories) {
        try {
          console.log(`[fillCategoriesWithProducts] Processing subcategory: ${sub.name} (ID: ${sub.id})`);
          totalSubcategories++;
          
          // Pobierz sub-subcategories z Firestore
          const subsubcategories = await getSubSubcategories(cat.id, sub.id);
          console.log(`[fillCategoriesWithProducts] Found ${subsubcategories.length} sub-subcategories for ${sub.name}`);
          
          // Jeśli subcategoria ma pod-podkategorie, przetwórz je
          if (subsubcategories.length > 0) {
            for (const subsub of subsubcategories) {
              try {
                console.log(`[fillCategoriesWithProducts] Processing sub-subcategory: ${subsub.name} (ID: ${subsub.id})`);
                totalSubSubcategories++;
                
                // Pobierz produkty z AliExpress dla tej kategorii (zwiększony limit: 40 → ~160 produktów po 4 queries)
                console.log(`[fillCategoriesWithProducts] Fetching (multi-query) products for: ${cat.name} ${sub.name} ${subsub.name}`);
                let aliProducts = await fetchMultiQuery([cat.name, sub.name, subsub.name], 40);
                // Jeśli Advanced włączone – spróbuj użyć batch-search endpointu aby ograniczyć liczbę wywołań
                const advanced = process.env.ALIEXPRESS_ENABLE_ADVANCED === '1' || process.env.ALIEXPRESS_ENABLE_ADVANCED === 'true';
                if (advanced) {
                  try {
                    const base = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/advanced/batch-search`;
                    const queries = [
                      `${cat.name} ${sub.name} ${subsub.name}`,
                      `${cat.name} ${sub.name} ${subsub.name} promocja`,
                      `${cat.name} ${sub.name} ${subsub.name} bestseller`,
                      `${cat.name} ${sub.name} ${subsub.name} top`,
                    ];
                    const r = await fetch(base, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ queries, limit: 40 })
                    });
                    if (r.ok) {
                      const data = await r.json();
                      if (Array.isArray(data.products) && data.products.length > 0) {
                        aliProducts = data.products;
                      }
                    }
                  } catch (_) {}
                }
                console.log(`[fillCategoriesWithProducts] Found ${aliProducts.length} multi-query products (deduped)`);
                
                // Batch AI enrichment na paczki
                const batchInputs = aliProducts.map((aliProduct: any) => {
                  const titleRaw = aliProduct.title || aliProduct.name || '';
                  return {
                    originalTitle: titleRaw,
                    rawDescription: aliProduct.description || '',
                    categoryPath: [cat.name, sub.name, subsub.name] as [string, ...string[]],
                    price: typeof aliProduct.price === 'number' ? aliProduct.price : (aliProduct.price?.value || undefined),
                    originalPrice: aliProduct.originalPrice || undefined,
                    rating: aliProduct.rating || undefined,
                    orders: aliProduct.orders || undefined,
                    merchant: aliProduct.merchant || aliProduct.storeName || undefined,
                  };
                });
                let batchOutputs: any[] = [];
                try {
                  batchOutputs = await aiProductEnrichmentBatchPL(batchInputs);
                } catch (_) { batchOutputs = []; }

                // Pobierz szczegółowe dane (opis, specyfikacje) dla TOP 15 produktów
                console.log(`[fillCategoriesWithProducts] Fetching detailed info for top 15 products...`);
                const topProducts = aliProducts.slice(0, 15);
                const productDetailsMap = new Map<string, any>();
                
                for (const product of topProducts) {
                  const productId = product.id || product.itemId || product.item_id || product.productId;
                  if (productId) {
                    const details = await fetchProductDetails(String(productId));
                    if (details) {
                      productDetailsMap.set(String(productId), details);
                      console.log(`[fillCategoriesWithProducts] Fetched details for ${productId}: ${details.title?.slice(0, 50)}...`);
                    }
                    // Rate limit: czekaj 100ms między requestami
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                }
                console.log(`[fillCategoriesWithProducts] Fetched details for ${productDetailsMap.size}/${topProducts.length} top products`);

                for (let idx = 0; idx < aliProducts.length; idx++) {
                  const aliProduct = aliProducts[idx];
                  try {
                    const originalId = aliProduct.id || aliProduct.itemId || aliProduct.item_id || aliProduct.productId;
                    const affiliateUrl = aliProduct.link || aliProduct.productUrl || aliProduct.url;
                    
                    // Pobierz szczegółowe dane jeśli dostępne
                    const productDetails = productDetailsMap.get(String(originalId));
                    
                    // Merguj dane - szczegóły mają priorytet
                    const mergedProduct = productDetails ? {
                      ...aliProduct,
                      description: productDetails.descriptionHtml || aliProduct.description,
                      images: productDetails.images?.length > 0 ? productDetails.images : (aliProduct.images || aliProduct.image_urls || []),
                      specifications: productDetails.attributes || aliProduct.specifications,
                      variants: productDetails.variants || [],
                      videoUrl: productDetails.videoUrl || aliProduct.productVideoUrl,
                    } : aliProduct;
                  
                    // AI normalize title to Polish
                    const titleRaw = mergedProduct.title || mergedProduct.name || '';
                    let norm = titleNormCache.get(titleRaw);
                    if (!norm) {
                      norm = await aiNormalizeTitlePL({ title: titleRaw, language: mergedProduct.language || undefined });
                      titleNormCache.set(titleRaw, norm);
                    }
                    const normalizedTitle = norm.normalizedTitle || titleRaw;

                    // AI enrichment (opis, cechy, keywords) - używamy description z szczegółów
                    let enrichedName = normalizedTitle;
                    let shortDesc = mergedProduct.description || `Produkt z kategorii ${subsub.name}`;
                    let longDesc = shortDesc;
                    let features: string[] = [];
                    let keywords: string[] = [];
                    const cacheKey = originalId || normalizedTitle;
                    let enrichment = enrichmentCache.get(cacheKey);
                    if (!enrichment) {
                      enrichment = batchOutputs[idx];
                      if (!enrichment) {
                        try {
                          console.log(`[fillCategoriesWithProducts] Batch enrichment missing for ${normalizedTitle}, calling individual AI`);
                          enrichment = await aiProductEnrichmentPL({
                            originalTitle: normalizedTitle,
                            rawDescription: aliProduct.description || '',
                            categoryPath: [cat.name, sub.name, subsub.name],
                            price: typeof aliProduct.price === 'number' ? aliProduct.price : (aliProduct.price?.value || undefined),
                            originalPrice: aliProduct.originalPrice || undefined,
                            rating: aliProduct.rating || undefined,
                            orders: aliProduct.orders || undefined,
                            merchant: aliProduct.merchant || aliProduct.storeName || undefined,
                          });
                          console.log(`[fillCategoriesWithProducts] Individual AI enrichment succeeded for ${normalizedTitle}`);
                        } catch (e: any) {
                          console.error(`[fillCategoriesWithProducts] AI enrichment failed for ${normalizedTitle}:`, e.message);
                        }
                      }
                      if (enrichment) enrichmentCache.set(cacheKey, enrichment);
                    }
                    if (enrichment) {
                      enrichedName = enrichment.normalizedName || enrichedName;
                      shortDesc = enrichment.shortDescription || shortDesc;
                      longDesc = enrichment.longDescription || longDesc;
                      features = enrichment.features || [];
                      keywords = enrichment.keywords || [];
                    }

                    // Dedupe by originalId / affiliateUrl
                    const existingId = await findExistingProduct({ originalId, affiliateUrl });

                    const originalPrice = mergedProduct.originalPrice || mergedProduct.original_price || undefined;
                    const priceValue = mergedProduct.price?.value || mergedProduct.price || 0;
                    const discountPercent = (typeof originalPrice === 'number' && originalPrice > 0)
                      ? Math.round(100 - (priceValue / originalPrice) * 100)
                      : undefined;
                    
                    // Currency detection (używa preferencji użytkownika jako fallback)
                    const priceCurrency = (typeof mergedProduct.price === 'object' && mergedProduct.price?.currency) 
                      || mergedProduct.currency 
                      || preferredCurrency; // Użyj zapisanej preferencji
                    
                    // Determine stock status
                    const stockStatus = mergedProduct.stock_status || mergedProduct.stockStatus || 
                      (mergedProduct.volume > 1000 ? 'in_stock' : mergedProduct.volume > 100 ? 'low_stock' : 'unknown');

                    // Przygotuj galerię zdjęć (wszystkie dostępne obrazy z AliExpress)
                    const gallery: Array<{ id: string; type: 'url'; src: string; alt?: string; isPrimary?: boolean; source: 'aliexpress' }> = [];
                    
                    // Główne zdjęcie
                    const mainImage = mergedProduct.image || mergedProduct.imageUrl || mergedProduct.product_main_image_url || mergedProduct.mainImage;
                    if (mainImage) {
                      gallery.push({
                        id: `img-0`,
                        type: 'url',
                        src: mainImage,
                        alt: enrichedName,
                        isPrimary: true,
                        source: 'aliexpress',
                      });
                    }
                    
                    // Dodatkowe zdjęcia z galerii (API zwraca jako 'images' array)
                    const imagesList = mergedProduct.images || mergedProduct.image_urls || [];
                    if (Array.isArray(imagesList)) {
                      imagesList.forEach((url: string, idx: number) => {
                        if (url && url !== mainImage) {
                          gallery.push({
                            id: `img-${idx + 1}`,
                            type: 'url',
                            src: url,
                            alt: enrichedName,
                            isPrimary: false,
                            source: 'aliexpress',
                          });
                        }
                      });
                    }
                    
                    // Deduplikacja obrazów po URL
                    const uniqueGallery = gallery.filter((img, index, self) => 
                      index === self.findIndex((t) => t.src === img.src)
                    );
                    
                    const baseData = {
                      name: enrichedName,
                      description: shortDesc,
                      longDescription: longDesc,
                      price: priceValue,
                      originalPrice,
                      discountPercent,
                      currency: priceCurrency, // USD/PLN/EUR dla multi-currency support
                      image: mainImage || '',
                      imageHint: '',
                      gallery: uniqueGallery.length > 0 ? uniqueGallery : undefined,
                      affiliateUrl: affiliateUrl || '#',
                      mainCategorySlug: cat.slug,
                      subCategorySlug: sub.slug,
                      subSubCategorySlug: subsub.slug,
                      status: 'approved',
                      ratingCard: {
                        average: mergedProduct.rating || 4.5,
                        count: mergedProduct.orders || 0,
                        durability: 4.5,
                        easeOfUse: 4.5,
                        valueForMoney: 4.5,
                        versatility: 4.5,
                      },
                      seoKeywords: keywords,
                      metaDescription: shortDesc.slice(0,160),
                      metadata: {
                        source: 'aliexpress',
                        originalId: originalId || '',
                        importedAt: new Date().toISOString(),
                        orders: mergedProduct.orders || 0,
                        merchant: mergedProduct.merchant || mergedProduct.storeName || mergedProduct.shop_title,
                        merchantId: mergedProduct.merchantId || mergedProduct.shop_id,
                        shipping: mergedProduct.shippingInfo || mergedProduct.shipping,
                        warehouse: mergedProduct.shippingInfo?.warehouse || mergedProduct.ship_from_country || mergedProduct.warehouse_location || '',
                        deliveryTime: mergedProduct.shippingInfo?.deliveryTime || mergedProduct.delivery_time || mergedProduct.estimated_delivery_time || '',
                        freeShipping: mergedProduct.shippingInfo?.freeShipping || mergedProduct.free_shipping || mergedProduct.is_free_shipping || false,
                        shippingCost: mergedProduct.shippingInfo?.shippingCost || mergedProduct.shipping_cost || mergedProduct.shipping_price || null,
                        shippingMethod: mergedProduct.shippingInfo?.shippingMethod || mergedProduct.shipping_method || null,
                        specifications: mergedProduct.specifications || mergedProduct.attributes || null, // Teraz z /item endpoint
                        productVideoUrl: mergedProduct.videoUrl || mergedProduct.productVideoUrl || mergedProduct.product_video_url || null,
                        // Advanced API fields
                        promotionId: mergedProduct.promotion_id || mergedProduct.promotionId || null,
                        commissionRate: mergedProduct.commission_rate || mergedProduct.commissionRate || null,
                        evaluateCount: mergedProduct.evaluation_count || mergedProduct.evaluate_count || mergedProduct.evaluateCount || null,
                        evaluateRate: mergedProduct.evaluate_rate || mergedProduct.evaluateRate || null,
                        sellerRating: mergedProduct.seller_rating || mergedProduct.sellerRating || (mergedProduct.shop_rating ? parseFloat(mergedProduct.shop_rating) : null),
                        returnPolicy: mergedProduct.return_policy || mergedProduct.returnPolicy || null,
                        hotProduct: mergedProduct.hot_product || mergedProduct.hotProduct || mergedProduct.is_hot_product || false,
                        flashDeal: mergedProduct.flash_deal || mergedProduct.flashDeal || mergedProduct.is_flash_deal || false,
                        platformProductType: mergedProduct.platform_product_type || mergedProduct.platformProductType || mergedProduct.product_type || null,
                        stockStatus: stockStatus as any,
                        stockLevel: mergedProduct.stock_level || mergedProduct.stockLevel || mergedProduct.available_quantity || null,
                        variants: mergedProduct.variants || [], // Warianty/SKU z /item endpoint
                      }
                    } as const;

                    if (existingId) {
                      await updateProduct(existingId, {
                        ...baseData,
                        ai: {
                          titleNormalization: {
                            originalTitle: titleRaw,
                            normalizedTitle,
                            translated: norm.translated,
                            changes: norm.changes,
                          },
                          enrichment: {
                            features,
                            keywords,
                          }
                        }
                      } as any);
                      console.log(`[fillCategoriesWithProducts] Updated existing product ${existingId}`);
                    } else {
                      await createProduct(baseData as any);
                      totalProducts++;
                    }
                  } catch (e: any) {
                    console.warn(`[fillCategoriesWithProducts] Failed to create product ${aliProduct.title}:`, e.message);
                  }
                }
              } catch (e: any) {
                console.error(`[fillCategoriesWithProducts] Failed to process sub-subcategory ${subsub.name}:`, e.message);
              }
            }
          } else {
            // Jeśli nie ma pod-podkategorii, pobierz produkty bezpośrednio dla subcategory
            console.log(`[fillCategoriesWithProducts] No sub-subcategories, fetching products for: ${cat.name} ${sub.name}`);
            let aliProducts = await fetchMultiQuery([cat.name, sub.name], 40);
            const advanced = process.env.ALIEXPRESS_ENABLE_ADVANCED === '1' || process.env.ALIEXPRESS_ENABLE_ADVANCED === 'true';
            if (advanced) {
              try {
                const base = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/advanced/batch-search`;
                const queries = [
                  `${cat.name} ${sub.name}`,
                  `${cat.name} ${sub.name} promocja`,
                  `${cat.name} ${sub.name} bestseller`,
                  `${cat.name} ${sub.name} top`,
                ];
                const r = await fetch(base, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ queries, limit: 40 })
                });
                if (r.ok) {
                  const data = await r.json();
                  if (Array.isArray(data.products) && data.products.length > 0) {
                    aliProducts = data.products;
                  }
                }
              } catch (_) {}
            }
            console.log(`[fillCategoriesWithProducts] Found ${aliProducts.length} multi-query products (deduped)`);
            
            const batchInputs = aliProducts.map((aliProduct: any) => {
              const titleRaw = aliProduct.title || aliProduct.name || '';
              return {
                originalTitle: titleRaw,
                rawDescription: aliProduct.description || '',
                categoryPath: [cat.name, sub.name] as [string, ...string[]],
                price: typeof aliProduct.price === 'number' ? aliProduct.price : (aliProduct.price?.value || undefined),
                originalPrice: aliProduct.originalPrice || undefined,
                rating: aliProduct.rating || undefined,
                orders: aliProduct.orders || undefined,
                merchant: aliProduct.merchant || aliProduct.storeName || undefined,
              };
            });
            let batchOutputs: any[] = [];
            try { batchOutputs = await aiProductEnrichmentBatchPL(batchInputs); } catch (_) { batchOutputs = []; }

            // Pobierz szczegółowe dane (opis, specyfikacje) dla TOP 15 produktów
            console.log(`[fillCategoriesWithProducts] Fetching detailed info for top 15 products...`);
            const topProducts = aliProducts.slice(0, 15);
            const productDetailsMap = new Map<string, any>();
            
            for (const product of topProducts) {
              const productId = product.id || product.itemId || product.item_id || product.productId;
              if (productId) {
                const details = await fetchProductDetails(String(productId));
                if (details) {
                  productDetailsMap.set(String(productId), details);
                  console.log(`[fillCategoriesWithProducts] Fetched details for ${productId}: ${details.title?.slice(0, 50)}...`);
                }
                // Rate limit: czekaj 100ms między requestami
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
            console.log(`[fillCategoriesWithProducts] Fetched details for ${productDetailsMap.size}/${topProducts.length} top products`);

            for (let idx = 0; idx < aliProducts.length; idx++) {
              const aliProduct = aliProducts[idx];
              try {
                const originalId = aliProduct.id || aliProduct.itemId || aliProduct.item_id || aliProduct.productId;
                const affiliateUrl = aliProduct.link || aliProduct.productUrl || aliProduct.url;
                
                // Pobierz szczegółowe dane jeśli dostępne
                const productDetails = productDetailsMap.get(String(originalId));
                
                // Merguj dane - szczegóły mają priorytet
                const mergedProduct = productDetails ? {
                  ...aliProduct,
                  description: productDetails.descriptionHtml || aliProduct.description,
                  images: productDetails.images?.length > 0 ? productDetails.images : (aliProduct.images || aliProduct.image_urls || []),
                  specifications: productDetails.attributes || aliProduct.specifications,
                  variants: productDetails.variants || [],
                  videoUrl: productDetails.videoUrl || aliProduct.productVideoUrl,
                } : aliProduct;

                // AI normalize title to Polish
                const titleRaw = mergedProduct.title || mergedProduct.name || '';
                let norm = titleNormCache.get(titleRaw);
                if (!norm) {
                  norm = await aiNormalizeTitlePL({ title: titleRaw, language: mergedProduct.language || undefined });
                  titleNormCache.set(titleRaw, norm);
                }
                const normalizedTitle = norm.normalizedTitle || titleRaw;

                // AI enrichment (opis, cechy, keywords) - używa description z szczegółów
                let enrichedName = normalizedTitle;
                let shortDesc = mergedProduct.description || `Produkt z kategorii ${sub.name}`;
                let longDesc = shortDesc;
                let features: string[] = [];
                let keywords: string[] = [];
                const cacheKey = originalId || normalizedTitle;
                let enrichment = enrichmentCache.get(cacheKey);
                if (!enrichment) {
                  enrichment = batchOutputs[idx];
                  if (!enrichment) {
                    try {
                      console.log(`[fillCategoriesWithProducts] Batch enrichment missing for ${normalizedTitle}, calling individual AI`);
                      enrichment = await aiProductEnrichmentPL({
                        originalTitle: normalizedTitle,
                        rawDescription: aliProduct.description || '',
                        categoryPath: [cat.name, sub.name],
                        price: typeof aliProduct.price === 'number' ? aliProduct.price : (aliProduct.price?.value || undefined),
                        originalPrice: aliProduct.originalPrice || undefined,
                        rating: aliProduct.rating || undefined,
                        orders: aliProduct.orders || undefined,
                        merchant: aliProduct.merchant || aliProduct.storeName || undefined,
                      });
                      console.log(`[fillCategoriesWithProducts] Individual AI enrichment succeeded for ${normalizedTitle}`);
                    } catch (e: any) {
                      console.error(`[fillCategoriesWithProducts] AI enrichment failed for ${normalizedTitle}:`, e.message);
                    }
                  }
                  if (enrichment) enrichmentCache.set(cacheKey, enrichment);
                }
                if (enrichment) {
                  enrichedName = enrichment.normalizedName || enrichedName;
                  shortDesc = enrichment.shortDescription || shortDesc;
                  longDesc = enrichment.longDescription || longDesc;
                  features = enrichment.features || [];
                  keywords = enrichment.keywords || [];
                }

                const existingId = await findExistingProduct({ originalId, affiliateUrl });

                const originalPrice = mergedProduct.originalPrice || mergedProduct.original_price || undefined;
                const priceValue = mergedProduct.price?.value || mergedProduct.price || 0;
                const discountPercent = (typeof originalPrice === 'number' && originalPrice > 0)
                  ? Math.round(100 - (priceValue / originalPrice) * 100)
                  : undefined;
                
                // Currency detection (używa preferencji użytkownika jako fallback)
                const priceCurrency = (typeof mergedProduct.price === 'object' && mergedProduct.price?.currency) 
                  || mergedProduct.currency 
                  || preferredCurrency; // Użyj zapisanej preferencji
                
                // Przygotuj galerię zdjęć (wszystkie dostępne obrazy z AliExpress)
                const gallery: Array<{ id: string; type: 'url'; src: string; alt?: string; isPrimary?: boolean; source: 'aliexpress' }> = [];
                
                // Główne zdjęcie
                const mainImage = mergedProduct.image || mergedProduct.imageUrl || mergedProduct.product_main_image_url || mergedProduct.mainImage;
                if (mainImage) {
                  gallery.push({
                    id: `img-0`,
                    type: 'url',
                    src: mainImage,
                    alt: enrichedName,
                    isPrimary: true,
                    source: 'aliexpress',
                  });
                }
                
                // Dodatkowe zdjęcia z galerii (API zwraca jako 'images' array)
                const imagesList = mergedProduct.images || mergedProduct.image_urls || [];
                if (Array.isArray(imagesList)) {
                  imagesList.forEach((url: string, idx: number) => {
                    if (url && url !== mainImage) {
                      gallery.push({
                        id: `img-${idx + 1}`,
                        type: 'url',
                        src: url,
                        alt: enrichedName,
                        isPrimary: false,
                        source: 'aliexpress',
                      });
                    }
                  });
                }
                
                // Deduplikacja obrazów po URL
                const uniqueGallery = gallery.filter((img, index, self) => 
                  index === self.findIndex((t) => t.src === img.src)
                );
                
                const baseData = {
                  name: enrichedName,
                  description: shortDesc,
                  longDescription: longDesc,
                  price: priceValue,
                  originalPrice,
                  discountPercent,
                  currency: priceCurrency, // USD/PLN/EUR dla multi-currency support
                  image: mainImage || '',
                  imageHint: '',
                  gallery: uniqueGallery.length > 0 ? uniqueGallery : undefined,
                  affiliateUrl: affiliateUrl || '#',
                  mainCategorySlug: cat.slug,
                  subCategorySlug: sub.slug,
                  subSubCategorySlug: undefined,
                  status: 'approved',
                  ratingCard: {
                    average: mergedProduct.rating || 4.5,
                    count: mergedProduct.orders || 0,
                    durability: 4.5,
                    easeOfUse: 4.5,
                    valueForMoney: 4.5,
                    versatility: 4.5,
                  },
                  seoKeywords: keywords,
                  metaDescription: shortDesc.slice(0,160),
                  metadata: {
                    source: 'aliexpress',
                    originalId: originalId || '',
                    importedAt: new Date().toISOString(),
                    orders: mergedProduct.orders || 0,
                    merchant: mergedProduct.merchant || mergedProduct.storeName,
                    shipping: mergedProduct.shippingInfo || mergedProduct.shipping,
                    warehouse: mergedProduct.shippingInfo?.warehouse || '',
                    deliveryTime: mergedProduct.shippingInfo?.deliveryTime || '',
                    freeShipping: mergedProduct.shippingInfo?.freeShipping || false,
                    shippingCost: mergedProduct.shippingInfo?.shippingCost || null,
                    specifications: mergedProduct.specifications || mergedProduct.attributes || null, // Teraz z /item endpoint
                    productVideoUrl: mergedProduct.videoUrl || mergedProduct.productVideoUrl || null,
                    variants: mergedProduct.variants || [], // Warianty/SKU z /item endpoint
                  }
                } as const;

                if (existingId) {
                  await updateProduct(existingId, {
                    ...baseData,
                    ai: {
                      titleNormalization: {
                        originalTitle: titleRaw,
                        normalizedTitle,
                        translated: norm.translated,
                        changes: norm.changes,
                      },
                      enrichment: {
                        features,
                        keywords,
                      }
                    }
                  } as any);
                  console.log(`[fillCategoriesWithProducts] Updated existing product ${existingId}`);
                } else {
                  await createProduct(baseData as any);
                  totalProducts++;
                }
              } catch (e: any) {
                console.warn(`[fillCategoriesWithProducts] Failed to create product ${aliProduct.title}:`, e.message);
              }
            }
          }
        } catch (e: any) {
          console.error(`[fillCategoriesWithProducts] Failed to create subcategory ${sub.name}:`, e.message);
        }
      }
    } catch (e: any) {
      console.error(`[fillCategoriesWithProducts] Failed to create category ${cat.name}:`, e.message);
    }
  }
  
  // Invalidate cached categories to odświeżyć mega-menu na serwerze/SSR
  try { await cacheDel('categories:all'); } catch (_) {}

  const summary = `✅ Katalog wypełniony!\n\n` +
    `📊 Statystyki:\n` +
    `- Kategorii głównych: ${totalCategories}/${categories.length}\n` +
    `- Podkategorii: ${totalSubcategories}\n` +
    `- Pod-podkategorii: ${totalSubSubcategories}\n` +
    `- Produktów: ${totalProducts}\n\n` +
    `Źródło: AliExpress API`;
  
  console.log('[fillCategoriesWithProducts] Done:', summary);
  return summary;
  } catch (error: any) {
    console.error('[fillCategoriesWithProducts] Fatal error:', error);
    return `❌ Błąd podczas wypełniania katalogu: ${error.message || 'Nieznany błąd'}`;
  }
}
