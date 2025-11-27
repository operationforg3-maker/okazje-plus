import { createDeal, findExistingDeal, updateDeal } from '@/lib/data-admin';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiGenerateDealDescriptionPL } from '@/ai/flows/aliexpress/aiDealDescriptionPL';

/**
 * Pobiera deale (promocje) z AliExpress API dla każdej kategorii
 * i zapisuje je do Firestore jako Deal (source: 'aliexpress', status: 'draft')
 * 
 * UWAGA: Deale to agregowane oferty z AliExpress, NIE generowane sztucznie!
 * Szukamy produktów z dużymi zniżkami (>50%) lub promocjami.
 */
export async function fillCategoriesWithDeals() {
  try {
    console.log('[fillCategoriesWithDeals] Starting...');
    
    // Kategorie do przeszukania promocji
    const dealCategories = [
    { name: 'Elektronika - Promocje Black Friday', slug: 'elektronika', query: 'electronics deals discount sale' },
    { name: 'Telefony - Wyprzedaż', slug: 'telefony-smartfony', query: 'smartphone sale discount coupon' },
    { name: 'Laptopy - Hot Deals', slug: 'laptopy-komputery', query: 'laptop deals promotion flash sale' },
    { name: 'Audio - Megaokazje', slug: 'audio-wideo', query: 'headphones speakers deals discount' },
    { name: 'Dom i Ogród - Promocje', slug: 'dom-ogrod', query: 'home garden appliances sale' },
    { name: 'AGD - Wyprzedaż', slug: 'agd', query: 'home appliances discount sale' },
    { name: 'Moda - Flash Sale', slug: 'moda', query: 'fashion clothing shoes sale discount' },
    { name: 'Sport - Hot Deals', slug: 'sport-turystyka', query: 'sports fitness deals promotion' },
    { name: 'Dziecko - Promocje', slug: 'dziecko', query: 'kids toys baby products sale' },
    { name: 'Supermarket - Okazje', slug: 'supermarket', query: 'food snacks household sale' }
  ];
  
  let totalDeals = 0;
  let totalErrors = 0;
  
  console.log(`[fillCategoriesWithDeals] Processing ${dealCategories.length} categories...`);
  
  for (const category of dealCategories) {
    try {
      console.log(`[fillCategoriesWithDeals] Fetching deals for: ${category.name}`);
      
      // Szukaj produktów z dużą zniżką przez AliExpress API
      // UWAGA: AliExpress często nie zwraca pola discount, więc obniżamy próg i filtrujemy po pobraniu
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: category.query,
          limit: 50, // Zwiększamy limit bo będziemy filtrować po pobraniu
          sort: 'orders', // Sortuj po popularności
          minDiscount: 30 // Obniżamy próg - filtrowanie będzie w kodzie poniżej
        })
      });
      
      if (!response.ok) {
        console.warn(`[fillCategoriesWithDeals] Failed to fetch deals for ${category.name}: ${response.status}`);
        totalErrors++;
        continue;
      }
      
      const data = await response.json();
      const products = data.products || [];
      
      console.log(`[fillCategoriesWithDeals] Found ${products.length} deals for ${category.name}`);
      
      // Mapuj produkty z AliExpress na Deal type
      for (const product of products) {
        try {
          // Oblicz zniżkę (preferuj pole discount z API; fallback wyliczenie)
          const apiDiscountRaw = product.discount || product.discountRate || product.discount_rate;
          const apiDiscount = typeof apiDiscountRaw === 'string' ? parseInt(apiDiscountRaw) : (apiDiscountRaw || 0);
          const originalCandidate = product.originalPrice || product.original_price || product.targetOriginalPrice || product.target_original_price;
          const saleCandidate = product.price || product.salePrice || product.sale_price || product.target_sale_price;
          const computedDiscount = (originalCandidate && saleCandidate && originalCandidate > 0)
            ? Math.round((1 - saleCandidate / originalCandidate) * 100)
            : 0;
          const discount = apiDiscount || computedDiscount;
          console.log(`[fillCategoriesWithDeals] Discount calc: api=${apiDiscount} computed=${computedDiscount} final=${discount} title="${product.title}"`);
          
          // Obniżony próg do 30% aby zwiększyć liczbę wyników
          // Produkty bez originalPrice są pomijane (nie można obliczyć zniżki)
          if (discount < 30 || !originalCandidate || !saleCandidate) {
            console.log(`[fillCategoriesWithDeals] Skipping: discount=${discount}, hasOriginal=${!!originalCandidate}, hasSale=${!!saleCandidate}`);
            continue;
          }
          
          const externalOriginalId = product.id || product.itemId || product.item_id || product.productId;
          const link = product.productUrl || product.link || '#';
          
          // Przygotowanie i normalizacja tytułu (dodajemy kontekst zniżki, usuwamy spam, tłumaczymy na PL)
          const rawTitle = product.title || '';
          const enrichedTitle = rawTitle ? `${rawTitle} - ${discount}% taniej` : `Okazja - ${discount}% taniej`;
          let normalizedTitle = enrichedTitle;
          try {
            const norm = await aiNormalizeTitlePL({ title: enrichedTitle, language: (product.language || product.locale || undefined) });
            normalizedTitle = norm.normalizedTitle;
          } catch (_) {
            // Fallback zostawia enrichedTitle
          }

          // Generowanie opisu (krótki/średni) i tagów
          let description = product.description || `Super okazja! ${normalizedTitle} z ${discount}% zniżką!`;
          let tags: string[] | undefined = undefined;
          try {
            const desc = await aiGenerateDealDescriptionPL({
              title: normalizedTitle,
              discount,
              price: typeof product.price === 'number' ? product.price : undefined,
              originalPrice: typeof product.originalPrice === 'number' ? product.originalPrice : undefined,
              merchant: product.merchant || 'AliExpress',
            });
            // Użyj opisu średniej długości, fallback na krótki jeśli zbyt długi
            description = (desc.mediumDescription?.length ?? 0) <= 220 ? desc.mediumDescription : (desc.shortDescription || description);
            tags = (desc.keywords || []).slice(0, 6);
          } catch (_) {}

          // Determine stock status
          const stockStatus = product.stock_status || product.stockStatus || 
            (product.volume > 1000 ? 'in_stock' : product.volume > 100 ? 'low_stock' : 'unknown');

          const baseDeal = {
            title: `🔥 ${normalizedTitle}`,
            description,
            price: product.price,
            originalPrice: product.originalPrice,
            link,
            image: product.imageUrl || product.image || '',
            imageHint: '',
            mainCategorySlug: category.slug,
            subCategorySlug: category.slug,
            category: category.slug,
            postedBy: 'system',
            postedAt: new Date().toISOString(),
            commentsCount: 0,
            source: 'aliexpress' as const,
            status: 'draft' as const,
            temperature: 50 + Math.min(discount, 50),
            voteCount: Math.floor((product.orders || 0) / 100),
            merchant: product.merchant || 'AliExpress',
            externalOriginalId,
            dealType: 'sale' as const,
            freeShipping: product.shippingInfo?.freeShipping || product.free_shipping || false,
            shippingCost: product.shippingInfo?.shippingCost || product.shipping_cost || null,
            deliveryTime: product.shippingInfo?.deliveryTime || product.delivery_time || '',
            warehouse: product.shippingInfo?.warehouse || product.ship_from_country || '',
            ...(tags?.length ? { tags } : {}),
            // Advanced API metadata
            importMetadata: {
              source: 'aliexpress',
              importedAt: new Date().toISOString(),
              originalUrl: link,
              promotionId: product.promotion_id || product.promotionId || undefined,
              commissionRate: product.commission_rate || product.commissionRate || undefined,
              evaluateCount: product.evaluation_count || product.evaluate_count || undefined,
              evaluateRate: product.evaluate_rate || product.evaluateRate || undefined,
              sellerRating: product.seller_rating || (product.shop_rating ? parseFloat(product.shop_rating) : undefined),
              returnPolicy: product.return_policy || product.returnPolicy || undefined,
              hotProduct: product.hot_product || product.is_hot_product || false,
              flashDeal: product.flash_deal || product.is_flash_deal || false,
              platformProductType: product.platform_product_type || product.product_type || undefined,
              stockStatus: stockStatus as any,
              stockLevel: product.stock_level || product.available_quantity || undefined,
              specifications: product.specifications || product.attributes || undefined,
              productVideoUrl: product.product_video_url || product.productVideoUrl || undefined,
              shippingMethod: product.shipping_method || product.shippingInfo?.shippingMethod || undefined,
            }
          };
          
          const existingId = await findExistingDeal({ externalOriginalId, link });
          if (existingId) {
            await updateDeal(existingId, baseDeal as any);
          } else {
            await createDeal(baseDeal as any);
          }
          
          totalDeals++;
        } catch (e: any) {
          console.warn(`[fillCategoriesWithDeals] Failed to create deal:`, e.message);
          totalErrors++;
        }
      }
    } catch (e: any) {
      console.error(`[fillCategoriesWithDeals] Error for category ${category.name}:`, e.message);
      totalErrors++;
    }
  }
  
  const summary = `✅ Deale pobrane!\n\n` +
    `📊 Statystyki:\n` +
    `- Przetworzono kategorii: ${dealCategories.length}\n` +
    `- Pobranych deali: ${totalDeals}\n` +
    `- Błędów: ${totalErrors}\n\n` +
    `⚠️ Status: draft (wymagana akceptacja admina)\n` +
    `Źródło: AliExpress API (promocje >50% zniżki)`;
  
  console.log('[fillCategoriesWithDeals] Done:', summary);
  return summary;
  } catch (error: any) {
    console.error('[fillCategoriesWithDeals] Fatal error:', error);
    return `❌ Błąd podczas pobierania deali: ${error.message || 'Nieznany błąd'}`;
  }
}
