import { createProduct, findExistingProduct, updateProduct } from '@/lib/data-admin';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiProductEnrichmentPL } from '@/ai/flows/aliexpress/aiProductEnrichmentPL';
import { aiProductEnrichmentBatchPL } from '@/ai/flows/aliexpress/aiProductEnrichmentBatchPL';

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

// Helper: Translate Polish category names to English for AliExpress API
function translateToEnglish(text: string): string {
  const translations: Record<string, string> = {
    'Elektronika': 'Electronics',
    'Smartfony i telefony': 'Smartphones and phones',
    'Smartfony': 'Smartphones',
    'Telefony klasyczne': 'Classic phones',
    'Akcesoria': 'Accessories',
    'Komputery': 'Computers',
    'Laptopy': 'Laptops',
    'Dom i ogród': 'Home and garden',
    'Moda': 'Fashion',
    'Sport': 'Sports',
    'Uroda': 'Beauty',
    'Zabawki': 'Toys',
    'Motoryzacja': 'Automotive',
    'Zdrowie': 'Health',
    'Książki': 'Books',
    'AGD': 'Home appliances',
    // Add more as needed
  };
  
  let translated = text;
  for (const [pl, en] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(pl, 'gi'), en);
  }
  return translated;
}

// Multi-query wariant: kilka zapytań + deduplikacja + sortowanie po popularności i ocenie
async function fetchMultiQuery(categoryPath: string[], baseLimit: number): Promise<any[]> {
  // Translate Polish categories to English for AliExpress API
  const translatedPath = categoryPath.map(translateToEnglish);
  const base = translatedPath.join(' ');
  
  const queries = [
    base, // neutralne zapytanie
    `${base} best seller`, // bestseller
    `${base} popular`, // popularne
    `${base} sale`, // promocja
  ];
  console.log(`[fetchMultiQuery] Original: "${categoryPath.join(' ')}"`);
  console.log(`[fetchMultiQuery] Translated: "${base}"`);
  console.log(`[fetchMultiQuery] Running ${queries.length} queries`);
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const q of queries) {
    const list = await fetchProductsForCategory(q, baseLimit);
    console.log(`[fetchMultiQuery] Query "${q}" returned ${list.length} products`);
    for (const p of list) {
      const originalId = p.id || p.itemId || p.item_id || p.productId || '';
      const affiliateUrl = p.link || p.productUrl || p.url || '';
      const key = originalId || affiliateUrl;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
    }
  }
  console.log(`[fetchMultiQuery] Total unique products: ${merged.length}`);
  merged.sort((a, b) => {
    const popularityA = (a.orders || 0) * (a.rating || 0);
    const popularityB = (b.orders || 0) * (b.rating || 0);
    return popularityB - popularityA;
  });
  return merged;
}

/**
 * Przetwórz JEDNĄ pod-podkategorię (szybka funkcja do przetwarzania partii)
 * Zwraca liczę dodanych produktów
 */
export async function fillSubSubcategoryProducts(params: {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  subcategoryId: string;
  subcategoryName: string;
  subcategorySlug: string;
  subsubcategoryId: string;
  subsubcategoryName: string;
  subsubcategorySlug: string;
  preferredCurrency?: string;
  maxProducts?: number; // limit produktów dla tej pod-kategorii (default: 20)
  jobId?: string; // Optional: track created items in import job
}) {
  const {
    categoryId, categoryName, categorySlug,
    subcategoryId, subcategoryName, subcategorySlug,
    subsubcategoryId, subsubcategoryName, subsubcategorySlug,
    preferredCurrency = 'USD',
    maxProducts = 20,
    jobId,
  } = params;

  let productsAdded = 0;
  let productsUpdated = 0;
  const createdIds: string[] = [];
  const updatedIds: string[] = [];

  try {
    console.log(`[fillSubSubcategoryProducts] Starting for: ${categoryName}/${subcategoryName}/${subsubcategoryName}`);

    // Cache AI
    const titleNormCache = new Map<string, any>();
    const enrichmentCache = new Map<string, any>();

    // Pobierz produkty z AliExpress
    console.log(`[fillSubSubcategoryProducts] Searching AliExpress for: "${categoryName} ${subcategoryName} ${subsubcategoryName}"`);
    let aliProducts = await fetchMultiQuery([categoryName, subcategoryName, subsubcategoryName], 20);
    console.log(`[fillSubSubcategoryProducts] Found ${aliProducts.length} products (deduped)`);

    if (aliProducts.length === 0) {
      console.warn(`[fillSubSubcategoryProducts] ⚠️ No products found for "${categoryName}/${subcategoryName}/${subsubcategoryName}"`);
      return {
        success: true,
        productsAdded: 0,
        productsUpdated: 0,
        totalProcessed: 0,
        createdIds: [],
        updatedIds: [],
        warning: 'No products found from AliExpress',
      };
    }

    // Jeśli Advanced włączone
    const advanced = process.env.ALIEXPRESS_ENABLE_ADVANCED === '1' || process.env.ALIEXPRESS_ENABLE_ADVANCED === 'true';
    if (advanced) {
      try {
        const base = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/advanced/batch-search`;
        const queries = [
          `${categoryName} ${subcategoryName} ${subsubcategoryName}`,
          `${categoryName} ${subcategoryName} ${subsubcategoryName} promocja`,
          `${categoryName} ${subcategoryName} ${subsubcategoryName} bestseller`,
        ];
        const r = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries, limit: 20 })
        });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data.products) && data.products.length > 0) {
            aliProducts = data.products;
          }
        }
      } catch (_) {}
    }

    // Ogranicza do maxProducts
    aliProducts = aliProducts.slice(0, maxProducts);
    console.log(`[fillSubSubcategoryProducts] Processing ${aliProducts.length} products (limited to ${maxProducts})`);

    // Batch AI enrichment
    const batchInputs = aliProducts.map((aliProduct: any) => {
      const titleRaw = aliProduct.title || aliProduct.name || '';
      return {
        originalTitle: titleRaw,
        rawDescription: aliProduct.description || '',
        categoryPath: [categoryName, subcategoryName, subsubcategoryName] as [string, ...string[]],
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
    } catch (_) {
      batchOutputs = [];
    }

    // Pobierz szczegółowe dane dla produktów (z timeoutem)
    console.log(`[fillSubSubcategoryProducts] Fetching details for ${aliProducts.length} products...`);
    const productDetailsMap = new Map<string, any>();
    let fetchedCount = 0;

    for (let i = 0; i < aliProducts.length; i++) {
      const product = aliProducts[i];
      const productId = product.id || product.itemId || product.item_id || product.productId;
      if (productId) {
        try {
          const details = await fetchProductDetails(String(productId));
          if (details) {
            productDetailsMap.set(String(productId), details);
            fetchedCount++;
            console.log(`[fillSubSubcategoryProducts] [${i + 1}/${aliProducts.length}] ✓ ${productId}`);
          }
        } catch (e: any) {
          console.error(`[fillSubSubcategoryProducts] [${i + 1}/${aliProducts.length}] ✗ ${productId}: ${e.message}`);
        }
        // Rate limit: 200ms
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    console.log(`[fillSubSubcategoryProducts] Fetched details for ${fetchedCount}/${aliProducts.length} products`);

    // Przetwórz każdy produkt
    for (let idx = 0; idx < aliProducts.length; idx++) {
      const aliProduct = aliProducts[idx];
      try {
        const originalId = aliProduct.id || aliProduct.itemId || aliProduct.item_id || aliProduct.productId;
        const affiliateUrl = aliProduct.link || aliProduct.productUrl || aliProduct.url;

        const productDetails = productDetailsMap.get(String(originalId));
        const mergedProduct = productDetails ? {
          ...aliProduct,
          description: productDetails.descriptionHtml || aliProduct.description,
          images: productDetails.images?.length > 0 ? productDetails.images : (aliProduct.images || aliProduct.image_urls || []),
          specifications: productDetails.attributes || aliProduct.specifications,
          variants: productDetails.variants || [],
          videoUrl: productDetails.videoUrl || aliProduct.productVideoUrl,
        } : aliProduct;

        const titleRaw = mergedProduct.title || mergedProduct.name || '';
        let normTitle = titleNormCache.get(titleRaw);
        if (!normTitle) {
          normTitle = await aiNormalizeTitlePL({ rawTitle: titleRaw });
          titleNormCache.set(titleRaw, normTitle);
        }
        const normalizedTitle = normTitle || titleRaw;

        let enrichedName = normalizedTitle;
        let shortDesc = mergedProduct.description || `Produkt z kategorii ${subsubcategoryName}`;
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
                categoryPath: [categoryName, subcategoryName, subsubcategoryName],
                price: typeof aliProduct.price === 'number' ? aliProduct.price : (aliProduct.price?.value || undefined),
                originalPrice: aliProduct.originalPrice || undefined,
                rating: aliProduct.rating || undefined,
                orders: aliProduct.orders || undefined,
                merchant: aliProduct.merchant || aliProduct.storeName || undefined,
              });
            } catch (e: any) {
              console.error(`[fillSubSubcategoryProducts] AI enrichment failed for ${normalizedTitle}:`, e.message);
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

        if (existingId) {
          console.log(`[fillSubSubcategoryProducts] Product already exists: ${originalId || affiliateUrl} - will update`);
        } else {
          console.log(`[fillSubSubcategoryProducts] New product: ${originalId || affiliateUrl} - will create`);
        }

        const originalPrice = mergedProduct.originalPrice || mergedProduct.original_price || undefined;
        const priceValue = mergedProduct.price?.value || mergedProduct.price || 0;
        const discountPercent = (typeof originalPrice === 'number' && originalPrice > 0)
          ? Math.round(100 - (priceValue / originalPrice) * 100)
          : undefined;

        const priceCurrency = (typeof mergedProduct.price === 'object' && mergedProduct.price?.currency)
          || mergedProduct.currency
          || preferredCurrency;

        const stockStatus = mergedProduct.stock_status || mergedProduct.stockStatus ||
          (mergedProduct.volume > 1000 ? 'in_stock' : mergedProduct.volume > 100 ? 'low_stock' : 'unknown');

        const gallery: Array<{ id: string; type: 'url'; src: string; alt?: string; isPrimary?: boolean; source: 'aliexpress' }> = [];
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
          currency: priceCurrency,
          image: mainImage || '',
          imageHint: '',
          gallery: uniqueGallery.length > 0 ? uniqueGallery : undefined,
          affiliateUrl: affiliateUrl || '#',
          mainCategorySlug: categorySlug,
          subCategorySlug: subcategorySlug,
          subSubCategorySlug: subsubcategorySlug,
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
          metaDescription: shortDesc.slice(0, 160),
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
            specifications: mergedProduct.specifications || mergedProduct.attributes || null,
            productVideoUrl: mergedProduct.videoUrl || mergedProduct.productVideoUrl || mergedProduct.product_video_url || null,
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
            variants: mergedProduct.variants || [],
          }
        } as const;

        if (existingId) {
          await updateProduct(existingId, {
            ...baseData,
            ai: {
              titleNormalization: {
                originalTitle: titleRaw,
                normalizedTitle,
                translated: normTitle?.translated || false,
                changes: normTitle?.changes || [],
              },
              enrichment: {
                features,
                keywords,
              }
            }
          } as any);
          productsUpdated++;
          updatedIds.push(existingId);
        } else {
          const newProductId = await createProduct(baseData as any);
          productsAdded++;
          if (newProductId) {
            createdIds.push(newProductId);
          }
        }
      } catch (e: any) {
        console.warn(`[fillSubSubcategoryProducts] Failed to create/update product ${aliProduct.title}:`, e.message);
      }
    }

    console.log(`[fillSubSubcategoryProducts] Completed: ${productsAdded} added, ${productsUpdated} updated`);
    
    // Track created/updated IDs in job if provided
    if (jobId && (createdIds.length > 0 || updatedIds.length > 0)) {
      try {
        const { adminDb, FieldValue } = await import('@/lib/firebase-admin');
        const jobRef = adminDb.collection('import_jobs').doc(jobId);
        await jobRef.update({
          itemsCreated: FieldValue.arrayUnion(...createdIds),
          itemsUpdated: FieldValue.arrayUnion(...updatedIds),
        });
      } catch (e) {
        console.error('[fillSubSubcategoryProducts] Failed to track IDs in job:', e);
      }
    }
    
    return {
      success: true,
      productsAdded,
      productsUpdated,
      totalProcessed: aliProducts.length,
      createdIds,
      updatedIds,
    };
  } catch (e: any) {
    console.error(`[fillSubSubcategoryProducts] Error:`, e.message, e.stack);
    throw e;
  }
}
