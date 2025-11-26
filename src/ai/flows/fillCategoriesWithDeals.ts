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
      
      // Szukaj produktów z dużą zniżką (>50%) przez AliExpress API
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: category.query,
          limit: 10, // Po 10 deali na kategorię
          sort: 'orders', // Sortuj po popularności
          minDiscount: 50 // Minimum 50% zniżki - to są prawdziwe okazje!
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
          const apiDiscountRaw = product.discount;
          const apiDiscount = typeof apiDiscountRaw === 'string' ? parseInt(apiDiscountRaw) : (apiDiscountRaw || 0);
          const computedDiscount = (product.originalPrice && product.price && product.originalPrice > 0)
            ? Math.round((1 - product.price / product.originalPrice) * 100)
            : 0;
          const discount = apiDiscount || computedDiscount;
            
          // Tylko produkty z realną zniżką >= 50%
          if (discount < 50) {
            console.log(`[fillCategoriesWithDeals] Skipping product with discount ${discount}%`);
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
            freeShipping: product.shippingInfo?.freeShipping || false,
            shippingCost: product.shippingInfo?.shippingCost || null,
            deliveryTime: product.shippingInfo?.deliveryTime || '',
            warehouse: product.shippingInfo?.warehouse || '',
            ...(tags?.length ? { tags } : {}),
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
