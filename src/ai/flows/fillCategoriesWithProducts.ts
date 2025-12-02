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

                for (let idx = 0; idx < aliProducts.length; idx++) {
                  const aliProduct = aliProducts[idx];
                  try {
                    const originalId = aliProduct.id || aliProduct.itemId || aliProduct.item_id || aliProduct.productId;
                    const affiliateUrl = aliProduct.link || aliProduct.productUrl || aliProduct.url;
                  
                    // AI normalize title to Polish
                    const titleRaw = aliProduct.title || aliProduct.name || '';
                    let norm = titleNormCache.get(titleRaw);
                    if (!norm) {
                      norm = await aiNormalizeTitlePL({ title: titleRaw, language: aliProduct.language || undefined });
                      titleNormCache.set(titleRaw, norm);
                    }
                    const normalizedTitle = norm.normalizedTitle || titleRaw;

                    // AI enrichment (opis, cechy, keywords)
                    let enrichedName = normalizedTitle;
                    let shortDesc = aliProduct.description || `Produkt z kategorii ${subsub.name}`;
                    let longDesc = shortDesc;
                    let features: string[] = [];
                    let keywords: string[] = [];
                    const cacheKey = originalId || normalizedTitle;
                    let enrichment = enrichmentCache.get(cacheKey);
                    if (!enrichment) {
                      enrichment = batchOutputs[idx];
                      if (!enrichment) {
                        try {
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
                        } catch (_) {}
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

                    const originalPrice = aliProduct.originalPrice || aliProduct.original_price || undefined;
                    const priceValue = aliProduct.price?.value || aliProduct.price || 0;
                    const discountPercent = (typeof originalPrice === 'number' && originalPrice > 0)
                      ? Math.round(100 - (priceValue / originalPrice) * 100)
                      : undefined;
                    
                    // Currency detection (AliExpress zwykle zwraca USD)
                    const priceCurrency = (typeof aliProduct.price === 'object' && aliProduct.price?.currency) 
                      || aliProduct.currency 
                      || 'USD'; // Default to USD for AliExpress
                    
                    // Determine stock status
                    const stockStatus = aliProduct.stock_status || aliProduct.stockStatus || 
                      (aliProduct.volume > 1000 ? 'in_stock' : aliProduct.volume > 100 ? 'low_stock' : 'unknown');

                    const baseData = {
                      name: enrichedName,
                      description: shortDesc,
                      longDescription: longDesc,
                      price: priceValue,
                      originalPrice,
                      discountPercent,
                      currency: priceCurrency, // USD/PLN/EUR dla multi-currency support
                      image: aliProduct.image || aliProduct.imageUrl || '',
                      imageHint: '',
                      affiliateUrl: affiliateUrl || '#',
                      mainCategorySlug: cat.slug,
                      subCategorySlug: sub.slug,
                      subSubCategorySlug: subsub.slug,
                      status: 'approved',
                      ratingCard: {
                        average: aliProduct.rating || 4.5,
                        count: aliProduct.orders || 0,
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
                        orders: aliProduct.orders || 0,
                        merchant: aliProduct.merchant || aliProduct.storeName || aliProduct.shop_title,
                        merchantId: aliProduct.merchantId || aliProduct.shop_id,
                        shipping: aliProduct.shippingInfo || aliProduct.shipping,
                        warehouse: aliProduct.shippingInfo?.warehouse || aliProduct.ship_from_country || aliProduct.warehouse_location || '',
                        deliveryTime: aliProduct.shippingInfo?.deliveryTime || aliProduct.delivery_time || aliProduct.estimated_delivery_time || '',
                        freeShipping: aliProduct.shippingInfo?.freeShipping || aliProduct.free_shipping || aliProduct.is_free_shipping || false,
                        shippingCost: aliProduct.shippingInfo?.shippingCost || aliProduct.shipping_cost || aliProduct.shipping_price || null,
                        shippingMethod: aliProduct.shippingInfo?.shippingMethod || aliProduct.shipping_method || null,
                        specifications: aliProduct.specifications || aliProduct.attributes || null,
                        productVideoUrl: aliProduct.productVideoUrl || aliProduct.product_video_url || null,
                        // Advanced API fields
                        promotionId: aliProduct.promotion_id || aliProduct.promotionId || null,
                        commissionRate: aliProduct.commission_rate || aliProduct.commissionRate || null,
                        evaluateCount: aliProduct.evaluation_count || aliProduct.evaluate_count || aliProduct.evaluateCount || null,
                        evaluateRate: aliProduct.evaluate_rate || aliProduct.evaluateRate || null,
                        sellerRating: aliProduct.seller_rating || aliProduct.sellerRating || (aliProduct.shop_rating ? parseFloat(aliProduct.shop_rating) : null),
                        returnPolicy: aliProduct.return_policy || aliProduct.returnPolicy || null,
                        hotProduct: aliProduct.hot_product || aliProduct.hotProduct || aliProduct.is_hot_product || false,
                        flashDeal: aliProduct.flash_deal || aliProduct.flashDeal || aliProduct.is_flash_deal || false,
                        platformProductType: aliProduct.platform_product_type || aliProduct.platformProductType || aliProduct.product_type || null,
                        stockStatus: stockStatus as any,
                        stockLevel: aliProduct.stock_level || aliProduct.stockLevel || aliProduct.available_quantity || null,
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

            for (let idx = 0; idx < aliProducts.length; idx++) {
              const aliProduct = aliProducts[idx];
              try {
                const originalId = aliProduct.id || aliProduct.itemId || aliProduct.item_id || aliProduct.productId;
                const affiliateUrl = aliProduct.link || aliProduct.productUrl || aliProduct.url;

                // AI normalize title to Polish
                const titleRaw = aliProduct.title || aliProduct.name || '';
                let norm = titleNormCache.get(titleRaw);
                if (!norm) {
                  norm = await aiNormalizeTitlePL({ title: titleRaw, language: aliProduct.language || undefined });
                  titleNormCache.set(titleRaw, norm);
                }
                const normalizedTitle = norm.normalizedTitle || titleRaw;

                // AI enrichment (opis, cechy, keywords)
                let enrichedName = normalizedTitle;
                let shortDesc = aliProduct.description || `Produkt z kategorii ${sub.name}`;
                let longDesc = shortDesc;
                let features: string[] = [];
                let keywords: string[] = [];
                const cacheKey = originalId || normalizedTitle;
                let enrichment = enrichmentCache.get(cacheKey);
                if (!enrichment) {
                  enrichment = batchOutputs[idx];
                  if (!enrichment) {
                    try {
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
                    } catch (_) {}
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

                const originalPrice = aliProduct.originalPrice || aliProduct.original_price || undefined;
                const priceValue = aliProduct.price?.value || aliProduct.price || 0;
                const discountPercent = (typeof originalPrice === 'number' && originalPrice > 0)
                  ? Math.round(100 - (priceValue / originalPrice) * 100)
                  : undefined;
                
                // Currency detection (AliExpress zwykle zwraca USD)
                const priceCurrency = (typeof aliProduct.price === 'object' && aliProduct.price?.currency) 
                  || aliProduct.currency 
                  || 'USD'; // Default to USD for AliExpress
                
                const baseData = {
                  name: enrichedName,
                  description: shortDesc,
                  longDescription: longDesc,
                  price: priceValue,
                  originalPrice,
                  discountPercent,
                  currency: priceCurrency, // USD/PLN/EUR dla multi-currency support
                  image: aliProduct.image || aliProduct.imageUrl || '',
                  imageHint: '',
                  affiliateUrl: affiliateUrl || '#',
                  mainCategorySlug: cat.slug,
                  subCategorySlug: sub.slug,
                  subSubCategorySlug: undefined,
                  status: 'approved',
                  ratingCard: {
                    average: aliProduct.rating || 4.5,
                    count: aliProduct.orders || 0,
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
                    orders: aliProduct.orders || 0,
                    merchant: aliProduct.merchant || aliProduct.storeName,
                    shipping: aliProduct.shippingInfo || aliProduct.shipping,
                    warehouse: aliProduct.shippingInfo?.warehouse || '',
                    deliveryTime: aliProduct.shippingInfo?.deliveryTime || '',
                    freeShipping: aliProduct.shippingInfo?.freeShipping || false,
                    shippingCost: aliProduct.shippingInfo?.shippingCost || null,
                    specifications: aliProduct.specifications || null,
                    productVideoUrl: aliProduct.productVideoUrl || null,
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
