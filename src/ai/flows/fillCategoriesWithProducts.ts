import { createCategory, createSubcategory, createSubSubcategory, createProduct, findExistingProduct, updateProduct } from '@/lib/data-admin';
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

// Multi-query wariant: kilka zapytań + deduplikacja
async function fetchMultiQuery(categoryPath: string[], baseLimit: number): Promise<any[]> {
  const base = categoryPath.join(' ');
  const queries = [
    base,
    `${base} promocja`,
    `${base} bestseller`,
    `${base} top`,
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
    
    // Rozbudowana struktura kategorii
    const categories = [
    { name: 'Elektronika', slug: 'elektronika', subs: [
      { name: 'Telefony i smartfony', slug: 'telefony-smartfony', subs: [
        { name: 'Smartfony', slug: 'smartfony' },
        { name: 'Telefony klasyczne', slug: 'telefony-klasyczne' },
        { name: 'Akcesoria do telefonów', slug: 'akcesoria-telefonow' },
        { name: 'Smartwatche', slug: 'smartwatche' },
        { name: 'Powerbanki', slug: 'powerbanki' }
      ] },
      { name: 'Laptopy i komputery', slug: 'laptopy-komputery', subs: [
        { name: 'Laptopy', slug: 'laptopy' },
        { name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne' },
        { name: 'Monitory', slug: 'monitory' },
        { name: 'Akcesoria komputerowe', slug: 'akcesoria-komputerowe' },
        { name: 'Drukarki i skanery', slug: 'drukarki-skanery' }
      ] },
      { name: 'Audio i wideo', slug: 'audio-wideo', subs: [
        { name: 'Słuchawki', slug: 'sluchawki' },
        { name: 'Głośniki', slug: 'glosniki' },
        { name: 'Telewizory', slug: 'telewizory' },
        { name: 'Soundbary', slug: 'soundbary' },
        { name: 'Projektory', slug: 'projektory' }
      ] },
      { name: 'Foto i kamery', slug: 'foto-kamery', subs: [
        { name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe' },
        { name: 'Kamery sportowe', slug: 'kamery-sportowe' },
        { name: 'Akcesoria foto', slug: 'akcesoria-foto' }
      ] }
    ] },
    { name: 'Dom i ogród', slug: 'dom-ogrod', subs: [
      { name: 'AGD', slug: 'agd', subs: [
        { name: 'Odkurzacze', slug: 'odkurzacze' },
        { name: 'Ekspresy do kawy', slug: 'ekspresy' },
        { name: 'Miksery i blendery', slug: 'miksery-blendery' },
        { name: 'Lodówki', slug: 'lodowki' },
        { name: 'Pralki', slug: 'pralki' }
      ] },
      { name: 'Wyposażenie wnętrz', slug: 'wyposazenie-wnetrz', subs: [
        { name: 'Meble', slug: 'meble' },
        { name: 'Oświetlenie', slug: 'oswietlenie' },
        { name: 'Dekoracje', slug: 'dekoracje' }
      ] },
      { name: 'Ogród', slug: 'ogrod', subs: [
        { name: 'Narzędzia ogrodowe', slug: 'narzedzia-ogrodowe' },
        { name: 'Grille', slug: 'grille' },
        { name: 'Rośliny', slug: 'rosliny' }
      ] }
    ] },
    { name: 'Moda', slug: 'moda', subs: [
      { name: 'Odzież damska', slug: 'odziez-damska', subs: [
        { name: 'Sukienki', slug: 'sukienki' },
        { name: 'Bluzki', slug: 'bluzki' },
        { name: 'Spodnie', slug: 'spodnie-damskie' }
      ] },
      { name: 'Odzież męska', slug: 'odziez-meska', subs: [
        { name: 'Koszule', slug: 'koszule' },
        { name: 'Spodnie', slug: 'spodnie-meskie' },
        { name: 'Marynarki', slug: 'marynarki' }
      ] },
      { name: 'Obuwie', slug: 'obuwie', subs: [
        { name: 'Buty sportowe', slug: 'buty-sportowe' },
        { name: 'Buty eleganckie', slug: 'buty-eleganckie' },
        { name: 'Sandały', slug: 'sandaly' }
      ] },
      { name: 'Akcesoria', slug: 'akcesoria-moda', subs: [
        { name: 'Torebki', slug: 'torebki' },
        { name: 'Paski', slug: 'paski' },
        { name: 'Czapki', slug: 'czapki' }
      ] }
    ] },
    { name: 'Dziecko', slug: 'dziecko', subs: [
      { name: 'Zabawki', slug: 'zabawki', subs: [
        { name: 'Klocki', slug: 'klocki' },
        { name: 'Lalki', slug: 'lalki' },
        { name: 'Puzzle', slug: 'puzzle' }
      ] },
      { name: 'Wózki i foteliki', slug: 'wozki-foteliki', subs: [
        { name: 'Wózki dziecięce', slug: 'wozki-dzieciece' },
        { name: 'Foteliki samochodowe', slug: 'foteliki-samochodowe' }
      ] }
    ] },
    { name: 'Sport i turystyka', slug: 'sport-turystyka', subs: [
      { name: 'Rowery', slug: 'rowery', subs: [
        { name: 'Górskie', slug: 'rowery-gorskie' },
        { name: 'Miejskie', slug: 'rowery-miejskie' }
      ] },
      { name: 'Fitness', slug: 'fitness', subs: [
        { name: 'Bieżnie', slug: 'bieznie' },
        { name: 'Hantle', slug: 'hantle' }
      ] },
      { name: 'Turystyka', slug: 'turystyka', subs: [
        { name: 'Namioty', slug: 'namioty' },
        { name: 'Śpiwory', slug: 'spiwory' }
      ] }
    ] },
    { name: 'Supermarket', slug: 'supermarket', subs: [
      { name: 'Artykuły spożywcze', slug: 'artykuly-spozywcze', subs: [
        { name: 'Słodycze', slug: 'slodycze' },
        { name: 'Napoje', slug: 'napoje' },
        { name: 'Przekąski', slug: 'przekaski' }
      ] },
      { name: 'Chemia domowa', slug: 'chemia-domowa', subs: [
        { name: 'Środki czystości', slug: 'srodki-czystosci' },
        { name: 'Kosmetyki', slug: 'kosmetyki' }
      ] }
    ] }
  ];

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
      console.log(`[fillCategoriesWithProducts] Creating category: ${cat.name}`);
      const catId = await createCategory(cat);
      console.log(`[fillCategoriesWithProducts] Created category ${cat.name} with ID: ${catId}`);
      totalCategories++;
      
      for (const sub of cat.subs) {
        try {
          console.log(`[fillCategoriesWithProducts] Creating subcategory: ${sub.name}`);
          const subId = await createSubcategory(catId, sub);
          console.log(`[fillCategoriesWithProducts] Created subcategory ${sub.name} with ID: ${subId}`);
          totalSubcategories++;
          
          // Jeśli subcategoria ma pod-podkategorie, utwórz je
          if (sub.subs && sub.subs.length > 0) {
            for (const subsub of sub.subs) {
              try {
                console.log(`[fillCategoriesWithProducts] Creating sub-subcategory: ${subsub.name}`);
                const subsubId = await createSubSubcategory(catId, subId, subsub);
                console.log(`[fillCategoriesWithProducts] Created sub-subcategory ${subsub.name} with ID: ${subsubId}`);
                totalSubSubcategories++;
                
                // Pobierz produkty z AliExpress dla tej kategorii
                console.log(`[fillCategoriesWithProducts] Fetching (multi-query) products for: ${cat.name} ${sub.name} ${subsub.name}`);
                let aliProducts = await fetchMultiQuery([cat.name, sub.name, subsub.name], 8);
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
                      body: JSON.stringify({ queries, limit: 8 })
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
                console.error(`[fillCategoriesWithProducts] Failed to create sub-subcategory ${subsub.name}:`, e.message);
              }
            }
          } else {
            // Jeśli nie ma pod-podkategorii, pobierz produkty bezpośrednio dla subcategory
            console.log(`[fillCategoriesWithProducts] Fetching (multi-query) products for: ${cat.name} ${sub.name} (no sub-subcategories)`);
            let aliProducts = await fetchMultiQuery([cat.name, sub.name], 8);
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
                  body: JSON.stringify({ queries, limit: 8 })
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
                const baseData = {
                  name: enrichedName,
                  description: shortDesc,
                  longDescription: longDesc,
                  price: priceValue,
                  originalPrice,
                  discountPercent,
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
