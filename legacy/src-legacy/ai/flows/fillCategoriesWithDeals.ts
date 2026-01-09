import { createDeal, findExistingDeal, updateDeal, getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiGenerateDealDescriptionPL } from '@/ai/flows/aliexpress/aiDealDescriptionPL';
export async function fillCategoriesWithDeals() {
  try {
    console.log('[fillCategoriesWithDeals] Starting...');
    const categories = await getAllCategories();
    let totalDeals = 0;
    let totalErrors = 0;

    console.log(`[fillCategoriesWithDeals] Processing ${categories.length} main categories...`);

    for (const cat of categories) {
      try {
        const subs = await getSubcategories(cat.id);
        for (const sub of subs) {
          const subsubs = await getSubSubcategories(cat.id, sub.id);
          
          // Pomiń subcategories bez sub-subcategories - nie ma sensu importować bez pełnej ścieżki
          if (subsubs.length === 0) {
            console.log(`[fillCategoriesWithDeals] Pomijam ${cat.slug}/${sub.slug} - brak sub-subcategories`);
            continue;
          }
          
          const targets = subsubs.map(ss => ({ main: cat, sub, subSub: ss }));

          for (const target of targets) {
            const { main, sub: s, subSub } = target as any;
            const keywords = [subSub.slug, s.slug, `${subSub.slug} popular`].filter(Boolean).join(' ');

            const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: keywords, limit: 50, sort: 'orders' })
            });

            if (!response.ok) {
              console.warn(`[fillCategoriesWithDeals] Failed to fetch deals for ${main.slug}/${s.slug}/${subSub.slug}: ${response.status}`);
              totalErrors++;
              continue;
            }

            const data = await response.json();
            const products = data.products || [];

            for (const product of products) {
              try {
                const apiDiscountRaw = product.discount || product.discountRate || product.discount_rate;
                const apiDiscount = typeof apiDiscountRaw === 'string' ? parseInt(apiDiscountRaw) : (apiDiscountRaw || 0);
                const originalCandidate = product.originalPrice || product.original_price || product.targetOriginalPrice || product.target_original_price;
                const saleCandidate = product.price || product.salePrice || product.sale_price || product.target_sale_price;
                const computedDiscount = (originalCandidate && saleCandidate && originalCandidate > 0)
                  ? Math.round((1 - saleCandidate / originalCandidate) * 100)
                  : 0;
                const discount = apiDiscount || computedDiscount;

                const externalOriginalId = product.id || product.itemId || product.item_id || product.productId;
                const link = product.productUrl || product.link || '#';

                const rawTitle = product.title || '';
                const enrichedTitle = rawTitle ? `${rawTitle} - ${discount}% taniej` : `Okazja - ${discount}% taniej`;
                let normalizedTitle = enrichedTitle;
                try {
                  const norm = await aiNormalizeTitlePL({ rawTitle: enrichedTitle });
                  normalizedTitle = norm;
                } catch (_) {}

                let description = product.description || `Super okazja! ${normalizedTitle} z ${discount}% zniżką!`;
                try {
                  const desc = await aiGenerateDealDescriptionPL({
                    title: normalizedTitle,
                    rawSpecifications: product.attributes ? JSON.stringify(product.attributes) : undefined,
                  });
                  description = desc.shortDescription || description;
                } catch (_) {}

                const stockStatus = product.stock_status || product.stockStatus || (product.volume > 1000 ? 'in_stock' : product.volume > 100 ? 'low_stock' : 'unknown');

                const baseDeal = {
                  title: `🔥 ${normalizedTitle}`,
                  description,
                  price: product.price,
                  originalPrice: product.originalPrice,
                  link,
                  image: product.imageUrl || product.image || '',
                  imageHint: '',
                  mainCategorySlug: main.slug,
                  subCategorySlug: s.slug,
                  subSubCategorySlug: subSub.slug,
                  category: `${main.slug}/${s.slug}/${subSub.slug}`,
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
          }
        }
      } catch (e: any) {
        console.error(`[fillCategoriesWithDeals] Error for main category ${cat.slug}:`, e.message);
        totalErrors++;
      }
    }

    const summary = `✅ Deale pobrane!\n\n` +
      `📊 Statystyki:\n` +
      `- Przetworzono kategorii: ${categories.length}\n` +
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
