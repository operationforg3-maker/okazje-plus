import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveUnifiedAffiliateUrl, extractAliExpressProductId } from '@/lib/affiliate-links';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      url,
      title,
      description,
      price,
      originalPrice,
      image,
      merchant,
      shippingCost = 0,
      promoCode,
      targetStatus = 'approved',
      autoRefine = true,
      categorySlug,
    } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Brak adresu URL oferty' }, { status: 400 });
    }

    const cleanTitle = (title || '').trim();
    const numPrice = typeof price === 'number' ? price : parseFloat(String(price || '0').replace(/[^0-9.,]/g, '').replace(',', '.'));
    const numOriginal = originalPrice ? parseFloat(String(originalPrice).replace(/[^0-9.,]/g, '').replace(',', '.')) : undefined;

    if (!cleanTitle || numPrice <= 0) {
      return NextResponse.json({
        error: 'Tytuł i cena (> 0 PLN) są wymagane do zapisania okazji.',
      }, { status: 400 });
    }

    const rawUrl = url.trim();
    const aliExpressId = extractAliExpressProductId(rawUrl);
    const isAli = Boolean(aliExpressId) || rawUrl.includes('aliexpress');

    // Auto-generate proper affiliate link
    const affiliateUrl = resolveUnifiedAffiliateUrl(rawUrl, 'Okazje_Admin_Import');

    // Category matching
    let mainCategorySlug = categorySlug || 'elektronika';
    let subCategorySlug: string | undefined = undefined;
    let subSubCategorySlug: string | undefined = undefined;

    const { matchCategoryByText } = await import('@/lib/category-mapper');
    try {
      const match = await matchCategoryByText([cleanTitle, description || '', merchant || '']);
      if (match) {
        mainCategorySlug = match.mainCategorySlug || mainCategorySlug;
        subCategorySlug = match.subCategorySlug;
        subSubCategorySlug = match.subSubCategorySlug;
      }
    } catch (_) {}

    const now = new Date().toISOString();
    const dealId = aliExpressId
      ? `ali_url_${aliExpressId}`
      : `deal_url_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check duplicate deal
    const dealRef = adminDb.collection('deals').doc(dealId);
    const existingSnap = await dealRef.get();
    if (existingSnap.exists) {
      return NextResponse.json({
        error: 'Ta okazja została już wcześniej zaimportowana do bazy.',
        dealId,
      }, { status: 409 });
    }

    const discountPercent = numOriginal && numOriginal > numPrice
      ? Math.round(((numOriginal - numPrice) / numOriginal) * 100)
      : 0;

    const primaryImage = image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147';

    // 1. Create ProductCore for consistency
    const productRef = adminDb.collection('product_cores').doc();
    const productCoreData = {
      id: productRef.id,
      title: { pl: cleanTitle, en: cleanTitle },
      description: { pl: description || cleanTitle, en: description || cleanTitle },
      imageUrl: primaryImage,
      images: [primaryImage],
      mainCategorySlug,
      subCategorySlug,
      subSubCategorySlug,
      bestPrice: numPrice,
      bestTotalPrice: numPrice + (Number(shippingCost) || 0),
      rating: 4.8,
      status: targetStatus,
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: isAli ? 'aliexpress' : (merchant || 'url_import'),
        originalId: aliExpressId,
        importedVia: 'admin_url_import',
      },
    };

    // 2. Create Deal
    const dealData: Record<string, any> = {
      id: dealId,
      productId: productRef.id,
      productCoreId: productRef.id,
      linkedProductIds: [productRef.id],
      title: { pl: cleanTitle, en: cleanTitle },
      description: { pl: description || '', en: description || '' },
      source: isAli ? 'aliexpress' : 'manual',
      affiliateLink: affiliateUrl,
      affiliateUrl: affiliateUrl,
      dealUrl: affiliateUrl,
      sourceUrl: rawUrl,
      sourceProductId: aliExpressId,
      price: {
        amount: numPrice,
        currency: 'PLN',
        originalAmount: numOriginal && numOriginal > numPrice ? numOriginal : undefined,
      },
      originalPrice: numOriginal && numOriginal > numPrice ? numOriginal : undefined,
      discount: discountPercent > 0 ? {
        amount: (numOriginal || numPrice) - numPrice,
        percentage: discountPercent,
      } : undefined,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      shipping: {
        cost: Number(shippingCost) || 0,
        timeDays: isAli ? 7 : 3,
        method: 'Standard',
      },
      totalPrice: numPrice + (Number(shippingCost) || 0),
      image: primaryImage,
      images: [primaryImage],
      gallery: [primaryImage],
      status: targetStatus,
      temperature: 100,
      mainCategorySlug,
      subCategorySlug,
      subSubCategorySlug,
      categorySlug: mainCategorySlug,
      votes: { up: 1, down: 0 },
      voteCount: 1,
      createdAt: now,
      updatedAt: now,
      merchantName: merchant || (isAli ? 'AliExpress' : 'Sklep internetowy'),
      dealType: discountPercent > 0 ? 'sale' : 'regular',
      freeShipping: Number(shippingCost) === 0,
      stockStatus: 'in_stock',
      isActive: true,
      metadata: {
        importedVia: 'admin_url_import',
        aliExpressId,
        rawUrl,
      },
    };

    if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
      dealData.promoCode = promoCode.trim();
    }

    const batch = adminDb.batch();
    batch.set(productRef, productCoreData);
    batch.set(dealRef, dealData);
    await batch.commit();

    if (autoRefine) {
      import('@/lib/automation/deal-refiner').then(({ DealRefiner }) => {
        const refiner = new DealRefiner(`url-auto-${Date.now()}`);
        refiner.refineDeals([dealId]).catch(err => {
          console.error('[URL Import AutoRefine Error]', err);
        });
      });
    }

    return NextResponse.json({
      success: true,
      dealId,
      message: `Pomyślnie zaimportowano okazję "${cleanTitle}" (${numPrice} PLN).`,
    });
  } catch (error: any) {
    console.error('[Admin URL Import Error]', error);
    return NextResponse.json({ error: error.message || 'Błąd importu okazji z URL' }, { status: 500 });
  }
}
