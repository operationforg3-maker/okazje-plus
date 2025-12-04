import { createDeal, findExistingDeal, updateDeal } from '@/lib/data-admin';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiGenerateDealDescriptionPL } from '@/ai/flows/aliexpress/aiDealDescriptionPL';
import { adminDb, FieldValue } from '@/lib/firebase-admin';

/**
 * Wyszukuje deale (promocje) dla kategorii przez AliExpress API
 */
async function fetchDealsForCategory(categoryName: string, count: number = 5): Promise<any[]> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`;
    console.log(`[fetchDealsForCategory] Fetching from: ${url}`);
    console.log(`[fetchDealsForCategory] Query: "${categoryName}", limit: ${count}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: `${categoryName} deals discount sale promotion`, 
        limit: count,
        sort: 'orders', // Popular deals
        minDiscount: 30, // Minimum 30% discount for deals
      })
    });
    
    console.log(`[fetchDealsForCategory] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetchDealsForCategory] API error (${response.status}):`, errorText);
      return [];
    }
    
    const data = await response.json();
    console.log(`[fetchDealsForCategory] Received ${data.products?.length || 0} deals for "${categoryName}"`);
    
    if (data.products && data.products.length > 0) {
      console.log(`[fetchDealsForCategory] First deal sample:`, {
        title: data.products[0].title,
        price: data.products[0].price,
        originalPrice: data.products[0].originalPrice,
        discount: data.products[0].discount,
        hasImage: !!data.products[0].image
      });
    }
    
    return data.products || [];
  } catch (e: any) {
    console.error(`[fetchDealsForCategory] Exception for "${categoryName}":`, e.message);
    return [];
  }
}

/**
 * Pobiera szczegółowe informacje o dealu (opis, specyfikacje, warianty)
 */
async function fetchDealDetails(productId: string): Promise<any | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/item?id=${productId}`;
    console.log(`[fetchDealDetails] Fetching details for deal: ${productId}`);
    
    const response = await fetch(url, {
      method: 'GET',
    });
    
    if (!response.ok) {
      console.error(`[fetchDealDetails] API error (${response.status}) for deal ${productId}`);
      return null;
    }
    
    const data = await response.json();
    return data.product || null;
  } catch (e: any) {
    console.error(`[fetchDealDetails] Exception for deal ${productId}:`, e.message);
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
  };
  
  let translated = text;
  for (const [pl, en] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(pl, 'gi'), en);
  }
  return translated;
}

/**
 * Helper: Fetch deals with multiple query variations to maximize coverage
 */
async function fetchMultiQuery(categoryPath: string[], baseLimit: number): Promise<any[]> {
  const translatedPath = categoryPath.map(translateToEnglish);
  const base = translatedPath.join(' ');
  
  console.log(`[fetchMultiQuery] Original path: ${categoryPath.join(' / ')}`);
  console.log(`[fetchMultiQuery] Translated path: ${translatedPath.join(' / ')}`);
  
  const queries = [
    `${base}`,
    `${base} best deals`,
    `${base} hot sale`,
    `${base} discount promotion`,
  ];

  const allDeals: any[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`[fetchMultiQuery] Query ${i + 1}/${queries.length}: "${q}"`);
    const deals = await fetchDealsForCategory(q, baseLimit);
    console.log(`[fetchMultiQuery] Query ${i + 1} returned ${deals.length} deals`);
    
    for (const deal of deals) {
      const id = deal.productId || deal.id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        allDeals.push(deal);
      }
    }
  }

  // Sort by discount percentage (highest first)
  allDeals.sort((a, b) => {
    const discountA = parseFloat(a.discount || '0');
    const discountB = parseFloat(b.discount || '0');
    return discountB - discountA;
  });

  console.log(`[fetchMultiQuery] Total unique deals after deduplication: ${allDeals.length}`);
  return allDeals;
}

/**
 * Wypełnia pojedynczą pod-podkategorię dealami z AliExpress
 * Przetwarza max 10 dealów (configurable), 200ms delay między fetches
 * 
 * @returns { dealsAdded, dealsUpdated, createdIds, updatedIds }
 */
export async function fillSubSubcategoryDeals(params: {
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
  maxDeals?: number;
  jobId?: string; // Optional: for tracking in import_jobs
}) {
  const {
    categoryId,
    categoryName,
    categorySlug,
    subcategoryId,
    subcategoryName,
    subcategorySlug,
    subsubcategoryId,
    subsubcategoryName,
    subsubcategorySlug,
    preferredCurrency = 'USD',
    maxDeals = 10,
    jobId,
  } = params;

  try {
    console.log(`[fillSubSubcategoryDeals] Starting for: ${categoryName}/${subcategoryName}/${subsubcategoryName}`);

    // Fetch deals z kilku queries (zwiększa coverage)
    const aliDeals = await fetchMultiQuery([categoryName, subcategoryName, subsubcategoryName], 20);
    
    console.log(`[fillSubSubcategoryDeals] Searching AliExpress for: "${categoryName} ${subcategoryName} ${subsubcategoryName}"`);
    console.log(`[fillSubSubcategoryDeals] Found ${aliDeals.length} deals (deduped, sorted by discount)`);

    if (aliDeals.length === 0) {
      console.warn(`[fillSubSubcategoryDeals] ⚠️ No deals found for "${categoryName}/${subcategoryName}/${subsubcategoryName}"`);
      return { 
        dealsAdded: 0, 
        dealsUpdated: 0,
        createdIds: [],
        updatedIds: [],
      };
    }

    // Sort by discount and limit
    const topDeals = aliDeals
      .filter(d => {
        const discount = parseFloat(d.discount || '0');
        return discount >= 30; // Minimum 30% discount
      })
      .slice(0, maxDeals);

    if (topDeals.length === 0) {
      console.warn(`[fillSubSubcategoryDeals] ⚠️ No deals with >=30% discount for "${categoryName}/${subcategoryName}/${subsubcategoryName}"`);
      return { 
        dealsAdded: 0, 
        dealsUpdated: 0,
        createdIds: [],
        updatedIds: [],
      };
    }

    console.log(`[fillSubSubcategoryDeals] Processing ${topDeals.length} deals (max ${maxDeals})`);

    // Batch fetch details (200ms delay between calls)
    console.log(`[fillSubSubcategoryDeals] Fetching details for ${topDeals.length} deals...`);
    let fetchedCount = 0;
    for (let i = 0; i < topDeals.length; i++) {
      const deal = topDeals[i];
      const dealId = deal.productId || deal.id;
      if (dealId) {
        try {
          const details = await fetchDealDetails(dealId);
          if (details) {
            // Merge details into deal object
            Object.assign(deal, details);
            fetchedCount++;
            console.log(`[fillSubSubcategoryDeals] [${i + 1}/${topDeals.length}] ✓ ${dealId}`);
          }
        } catch (e: any) {
          console.error(`[fillSubSubcategoryDeals] [${i + 1}/${topDeals.length}] ✗ ${dealId}: ${e.message}`);
        }
        // Rate limit: 200ms between fetches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[fillSubSubcategoryDeals] Fetched details for ${fetchedCount}/${topDeals.length} deals`);

    // Process each deal
    let dealsAdded = 0;
    let dealsUpdated = 0;
    const createdIds: string[] = [];
    const updatedIds: string[] = [];

    for (const aliDeal of topDeals) {
      try {
        const title = aliDeal.title || 'Untitled Deal';
        const externalOriginalId = aliDeal.productId || aliDeal.id;
        const link = aliDeal.affiliateUrl || aliDeal.url || '';
        const discount = parseFloat(aliDeal.discount || '0');
        
        if (!externalOriginalId && !link) {
          console.warn(`[fillSubSubcategoryDeals] Skipping deal without ID or URL: ${title}`);
          continue;
        }

        // AI normalizacja tytułu
        let normalizedTitle = title;
        try {
          normalizedTitle = await aiNormalizeTitlePL({ rawTitle: title });
        } catch (e: any) {
          console.warn(`[fillSubSubcategoryDeals] AI normalization failed for ${title}:`, e.message);
        }

        // Add emoji for hot deals
        const enrichedTitle = discount >= 50 ? `🔥 ${normalizedTitle}` : normalizedTitle;

        // AI generowanie opisu dla dealu
        let generatedDescription = '';
        let tags: string[] | undefined = undefined;
        try {
          const descResult = await aiGenerateDealDescriptionPL({
            title: enrichedTitle,
            discount,
            price: aliDeal.price || 0,
            originalPrice: aliDeal.originalPrice || 0,
            merchant: aliDeal.merchant || 'AliExpress',
          });
          generatedDescription = (descResult.mediumDescription?.length ?? 0) <= 220 
            ? descResult.mediumDescription 
            : (descResult.shortDescription || '');
          tags = (descResult.keywords || []).slice(0, 6);
        } catch (e: any) {
          console.error(`[fillSubSubcategoryDeals] AI description generation failed for ${enrichedTitle}:`, e.message);
        }

        // Check if deal exists
        const existingId = await findExistingDeal({ externalOriginalId, link });

        if (existingId) {
          console.log(`[fillSubSubcategoryDeals] Deal already exists: ${externalOriginalId || link} - will update`);
        } else {
          console.log(`[fillSubSubcategoryDeals] New deal: ${externalOriginalId || link} - will create`);
        }

        // Stock status
        const stockStatus = aliDeal.stock_status || aliDeal.stockStatus || 
          ((aliDeal.volume || 0) > 1000 ? 'in_stock' : (aliDeal.volume || 0) > 100 ? 'low_stock' : 'unknown');

        // Prepare deal data
        const dealData: any = {
          title: enrichedTitle,
          description: generatedDescription || `Super okazja! ${enrichedTitle} z ${discount}% zniżką!`,
          
          // Price
          price: parseFloat(aliDeal.price || '0'),
          originalPrice: parseFloat(aliDeal.originalPrice || aliDeal.price || '0'),
          currency: preferredCurrency,
          
          // Category
          mainCategorySlug: categorySlug,
          subCategorySlug: subcategorySlug,
          subSubCategorySlug: subsubcategorySlug || '',
          category: categorySlug, // backward compatibility
          
          // Media
          image: aliDeal.image || aliDeal.imageUrl || '',
          imageHint: '',
          
          // Links
          link: link || '',
          externalOriginalId: externalOriginalId || null,
          
          // Source & Metadata
          source: 'aliexpress' as const,
          status: 'draft' as const, // Admin musi zatwierdzić
          postedBy: 'system',
          postedAt: new Date().toISOString(),
          commentsCount: 0,
          
          // Temperature & Votes
          temperature: 50 + Math.min(discount, 50),
          voteCount: Math.floor((aliDeal.orders || 0) / 100),
          
          // Deal specifics
          dealType: 'sale' as const,
          merchant: aliDeal.merchant || 'AliExpress',
          freeShipping: aliDeal.shippingInfo?.freeShipping || aliDeal.free_shipping || false,
          shippingCost: aliDeal.shippingInfo?.shippingCost || aliDeal.shipping_cost || null,
          deliveryTime: aliDeal.shippingInfo?.deliveryTime || aliDeal.delivery_time || '',
          warehouse: aliDeal.shippingInfo?.warehouse || aliDeal.ship_from_country || '',
          
          ...(tags?.length ? { tags } : {}),
          
          // Import metadata
          importMetadata: {
            source: 'aliexpress',
            importedAt: new Date().toISOString(),
            originalUrl: link,
            promotionId: aliDeal.promotion_id || aliDeal.promotionId || undefined,
            commissionRate: aliDeal.commission_rate || aliDeal.commissionRate || undefined,
            evaluateCount: aliDeal.evaluation_count || aliDeal.evaluate_count || undefined,
            evaluateRate: aliDeal.evaluate_rate || aliDeal.evaluateRate || undefined,
            sellerRating: aliDeal.seller_rating || (aliDeal.shop_rating ? parseFloat(aliDeal.shop_rating) : undefined),
            returnPolicy: aliDeal.return_policy || aliDeal.returnPolicy || undefined,
            hotProduct: aliDeal.hot_product || aliDeal.is_hot_product || false,
            flashDeal: aliDeal.flash_deal || aliDeal.is_flash_deal || false,
            platformProductType: aliDeal.platform_product_type || aliDeal.product_type || undefined,
            stockStatus: stockStatus as any,
            stockLevel: aliDeal.stock_level || aliDeal.available_quantity || undefined,
            specifications: aliDeal.specifications || aliDeal.attributes || undefined,
            productVideoUrl: aliDeal.product_video_url || aliDeal.productVideoUrl || undefined,
            shippingMethod: aliDeal.shipping_method || aliDeal.shippingInfo?.shippingMethod || undefined,
          },
        };

        // Create or update
        if (existingId) {
          await updateDeal(existingId, dealData);
          dealsUpdated++;
          updatedIds.push(existingId);
        } else {
          const newDealId = await createDeal(dealData);
          dealsAdded++;
          createdIds.push(newDealId);
        }
      } catch (e: any) {
        console.warn(`[fillSubSubcategoryDeals] Failed to create/update deal ${aliDeal.title}:`, e.message);
        continue;
      }
    }

    console.log(`[fillSubSubcategoryDeals] Completed: ${dealsAdded} added, ${dealsUpdated} updated`);

    // Track IDs in job document if jobId provided
    if (jobId && (createdIds.length > 0 || updatedIds.length > 0)) {
      try {
        const jobRef = adminDb.collection('import_jobs').doc(jobId);
        const updates: any = {};
        
        if (createdIds.length > 0) {
          updates.itemsCreated = FieldValue.arrayUnion(...createdIds);
        }
        if (updatedIds.length > 0) {
          updates.itemsUpdated = FieldValue.arrayUnion(...updatedIds);
        }
        
        await jobRef.update(updates);
      } catch (e: any) {
        console.error('[fillSubSubcategoryDeals] Failed to track IDs in job:', e);
      }
    }

    return { 
      dealsAdded, 
      dealsUpdated,
      createdIds,
      updatedIds,
    };
  } catch (e: any) {
    console.error(`[fillSubSubcategoryDeals] Error:`, e.message, e.stack);
    throw e;
  }
}
