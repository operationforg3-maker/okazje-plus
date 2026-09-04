import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

interface AliExpressCsvRow {
  language?: string;
  categoryName?: string;
  categoryId?: string;
  productName: string;
  productImageUrl?: string;
  productUrl?: string;
  originalPrice?: number;
  salePrice: number;
  directCommissionRate?: number;
  incentiveCommissionRate?: number;
  discountPercent?: number;
  clickUrl?: string;
  orders?: number;
  isHot?: boolean;
  startTime?: string;
  endTime?: string;
  promoCode?: string;
  codeStartTime?: string;
  codeEndTime?: string;
  codeMinSpend?: string;
  codeDiscount?: string;
  codePromotionUrl?: string;
  specialOffer?: boolean;
}

function parseCsvValue(val: string): string {
  if (!val) return '';
  let trimmed = val.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed.trim();
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(parseCsvValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(parseCsvValue(current));
  return result;
}

function extractAliExpressId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/item\/(\d+)\.html/) || url.match(/\/(\d+)\.html/) || url.match(/id=(\d+)/);
  return match ? match[1] : null;
}

function parsePriceNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { csvText, autoRefine = true, targetStatus = 'approved' } = body;

    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'Missing csvText string' }, { status: 400 });
    }

    const { matchCategoryByText, matchCategoryByExternalIds } = await import('@/lib/category-mapper');

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or missing headers' }, { status: 400 });
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Find header column indices
    const getIndex = (possibleNames: string[]): number => {
      return headers.findIndex(h => possibleNames.some(name => h.includes(name.toLowerCase())));
    };

    const idxName = getIndex(['product name', 'title']);
    const idxImage = getIndex(['product image url', 'image url', 'image']);
    const idxUrl = getIndex(['product url', 'url']);
    const idxClickUrl = getIndex(['click url', 'affiliate url']);
    const idxOriginalPrice = getIndex(['originalprice', 'original price']);
    const idxSalePrice = getIndex(['saleprice', 'sale price', 'price']);
    const idxDiscount = getIndex(['discount(%)', 'discount']);
    const idxDirectCommission = getIndex(['direct linking commission rate', 'commission rate']);
    const idxIncentiveCommission = getIndex(['limited-time incentive commission rate', 'incentive commission']);
    const idxOrders = getIndex(['orders']);
    const idxIsHot = getIndex(['is hot', 'ishot']);
    const idxSpecialOffer = getIndex(['special offer', 'specialoffer']);
    const idxPromoCode = getIndex(['promocode', 'promo code', 'code']);
    const idxCodeMinSpend = getIndex(['code minimum spend', 'minimum spend']);
    const idxCodeDiscount = getIndex(['code discount']);
    const idxCodeStart = getIndex(['code available time start', 'start time']);
    const idxCodeEnd = getIndex(['code available time end', 'end time']);
    const idxCategory = getIndex(['category name', 'category']);
    const idxCategoryId = getIndex(['categoryid', 'category id']);

    if (idxName === -1 || idxSalePrice === -1) {
      return NextResponse.json({
        error: 'Required CSV columns missing. Header must include "Product Name" and "SalePrice".',
        detectedHeaders: headers,
      }, { status: 400 });
    }

    const rows: AliExpressCsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 2) continue;

      const name = cols[idxName] || '';
      if (!name) continue;

      const salePrice = parsePriceNumber(cols[idxSalePrice]);
      const originalPrice = idxOriginalPrice !== -1 ? parsePriceNumber(cols[idxOriginalPrice]) : salePrice;
      const directCommission = idxDirectCommission !== -1 ? parsePriceNumber(cols[idxDirectCommission]) : 0;
      const incentiveCommission = idxIncentiveCommission !== -1 ? parsePriceNumber(cols[idxIncentiveCommission]) : 0;

      rows.push({
        productName: name,
        productImageUrl: idxImage !== -1 ? cols[idxImage] : undefined,
        productUrl: idxUrl !== -1 ? cols[idxUrl] : undefined,
        clickUrl: idxClickUrl !== -1 ? cols[idxClickUrl] : (idxUrl !== -1 ? cols[idxUrl] : undefined),
        originalPrice: originalPrice > salePrice ? originalPrice : undefined,
        salePrice,
        discountPercent: idxDiscount !== -1 ? parsePriceNumber(cols[idxDiscount]) : undefined,
        directCommissionRate: directCommission,
        incentiveCommissionRate: incentiveCommission,
        orders: idxOrders !== -1 ? parseInt(cols[idxOrders], 10) || 0 : 0,
        isHot: idxIsHot !== -1 && /true|1|yes/i.test(cols[idxIsHot]),
        specialOffer: idxSpecialOffer !== -1 && /true|1|yes/i.test(cols[idxSpecialOffer]),
        promoCode: idxPromoCode !== -1 ? cols[idxPromoCode] : undefined,
        codeMinSpend: idxCodeMinSpend !== -1 ? cols[idxCodeMinSpend] : undefined,
        codeDiscount: idxCodeDiscount !== -1 ? cols[idxCodeDiscount] : undefined,
        codeStartTime: idxCodeStart !== -1 ? cols[idxCodeStart] : undefined,
        codeEndTime: idxCodeEnd !== -1 ? cols[idxCodeEnd] : undefined,
        categoryName: idxCategory !== -1 ? cols[idxCategory] : undefined,
        categoryId: idxCategoryId !== -1 ? cols[idxCategoryId] : undefined,
      });
    }

    let createdCount = 0;
    let promoCodesCount = 0;
    let batch = adminDb.batch();
    let batchCount = 0;
    const createdIds: string[] = [];

    const now = new Date().toISOString();

    for (const row of rows) {
      const aliExpressId = extractAliExpressId(row.productUrl) || extractAliExpressId(row.clickUrl);
      const dealId = aliExpressId ? `ali_csv_${aliExpressId}` : `ali_csv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const dealRef = adminDb.collection('deals').doc(dealId);
      const docSnap = await dealRef.get();
      if (docSnap.exists) {
        continue; // Skip existing duplicate
      }

      const totalCommission = (row.directCommissionRate || 0) + (row.incentiveCommissionRate || 0);

      // Smart Category Matching
      let mainCategorySlug = 'elektronika';
      let subCategorySlug: string | undefined = undefined;
      let subSubCategorySlug: string | undefined = undefined;

      // 1. Try external category ID
      if (row.categoryId) {
        try {
          const idMatch = await matchCategoryByExternalIds({ aliexpressCategoryId: row.categoryId });
          if (idMatch) {
            mainCategorySlug = idMatch.mainCategorySlug;
            subCategorySlug = idMatch.subCategorySlug;
            subSubCategorySlug = idMatch.subSubCategorySlug;
          }
        } catch (_) {}
      }

      // 2. Try text matching (category name + product title)
      if (!subSubCategorySlug && (row.categoryName || row.productName)) {
        try {
          const textMatch = await matchCategoryByText([row.categoryName || '', row.productName || '']);
          if (textMatch) {
            mainCategorySlug = textMatch.mainCategorySlug || mainCategorySlug;
            subCategorySlug = textMatch.subCategorySlug || subCategorySlug;
            subSubCategorySlug = textMatch.subSubCategorySlug || subSubCategorySlug;
          }
        } catch (_) {}
      }

      // 3. Heuristic fallbacks for automotive / tools / garden / fashion
      const combinedText = `${row.productName} ${row.categoryName || ''}`.toLowerCase();
      if (
        combinedText.includes('motoryz') ||
        combinedText.includes('samochod') ||
        combinedText.includes('ev ') ||
        combinedText.includes('ładowark') ||
        combinedText.includes('lifepo4') ||
        combinedText.includes('akumulator') ||
        combinedText.includes('wallbox') ||
        combinedText.includes('type2') ||
        combinedText.includes('type 2')
      ) {
        mainCategorySlug = 'motoryzacja';
        if (
          combinedText.includes('ładowark') ||
          combinedText.includes('kabel') ||
          combinedText.includes('wallbox') ||
          combinedText.includes('evse') ||
          combinedText.includes('type2') ||
          combinedText.includes('type 2')
        ) {
          subCategorySlug = 'akcesoria-samochodowe';
          subSubCategorySlug = 'ladowarki-samochodowe';
        } else if (
          combinedText.includes('akumulator') ||
          combinedText.includes('lifepo4') ||
          combinedText.includes('bms')
        ) {
          subCategorySlug = 'czesci-samochodowe';
          subSubCategorySlug = 'akumulatory';
        }
      } else if (combinedText.includes('home') || combinedText.includes('ogród') || combinedText.includes('dom')) {
        mainCategorySlug = 'dom-ogrod';
      } else if (combinedText.includes('apparel') || combinedText.includes('wear') || combinedText.includes('moda')) {
        mainCategorySlug = 'moda';
      }

      const discountPercent = row.discountPercent || (row.originalPrice && row.originalPrice > row.salePrice ? Math.round(((row.originalPrice - row.salePrice) / row.originalPrice) * 100) : 0);
      const primaryImage = row.productImageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147';

      // Create ProductCore for M6 architecture
      const productRef = adminDb.collection('product_cores').doc();
      const productCoreData = {
        id: productRef.id,
        title: { pl: row.productName, en: row.productName },
        description: { pl: row.productName, en: row.productName },
        imageUrl: primaryImage,
        images: [primaryImage],
        mainCategorySlug,
        subCategorySlug,
        subSubCategorySlug,
        bestPrice: row.salePrice,
        bestTotalPrice: row.salePrice,
        rating: 4.8,
        status: targetStatus,
        createdAt: now,
        updatedAt: now,
        metadata: {
          source: 'aliexpress',
          originalId: aliExpressId,
          importedVia: 'aliexpress_csv',
        },
      };
      batch.set(productRef, productCoreData);

      const dealData: Record<string, any> = {
        id: dealId,
        productId: productRef.id,
        productCoreId: productRef.id,
        linkedProductIds: [productRef.id],
        title: { pl: row.productName, en: row.productName },
        source: 'aliexpress',
        affiliateLink: row.clickUrl || row.productUrl || '',
        affiliateUrl: row.clickUrl || row.productUrl || '',
        dealUrl: row.clickUrl || row.productUrl || '',
        sourceUrl: row.productUrl || '',
        sourceProductId: aliExpressId,
        price: {
          amount: row.salePrice,
          currency: 'PLN',
          originalAmount: row.originalPrice,
        },
        originalPrice: row.originalPrice && row.originalPrice > row.salePrice ? row.originalPrice : undefined,
        discount: discountPercent > 0 ? {
          amount: (row.originalPrice || row.salePrice) - row.salePrice,
          percentage: discountPercent,
        } : undefined,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
        shipping: {
          cost: 0,
          timeDays: 7,
          method: 'Standard',
          fromCountry: 'CN',
        },
        totalPrice: row.salePrice,
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
        merchantName: 'AliExpress',
        dealType: discountPercent > 0 ? 'sale' : 'regular',
        freeShipping: true,
        stockStatus: 'in_stock',
        isActive: true,
        commissionRate: totalCommission > 0 ? totalCommission : undefined,
        incentiveCommissionRate: row.incentiveCommissionRate || undefined,
        popularity: row.orders || 0,
        isHot: row.isHot || row.specialOffer || false,
        metadata: {
          importedVia: 'aliexpress_csv',
          originalCategory: row.categoryName,
          aliExpressId,
          ordersCount: row.orders || 0,
        },
      };

      // Add promotion / promo code details if present
      if (row.promoCode) {
        dealData.promoCode = row.promoCode;
        promoCodesCount++;
        dealData.promoDetails = {
          code: row.promoCode,
          minSpend: row.codeMinSpend,
          discount: row.codeDiscount,
          startTime: row.codeStartTime,
          endTime: row.codeEndTime,
        };
      }

      batch.set(dealRef, dealData);
      createdCount++;
      batchCount += 2; // deal + product_core
      createdIds.push(dealId);

      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    if (autoRefine && createdIds.length > 0) {
      import('@/lib/automation/deal-refiner').then(({ DealRefiner }) => {
        const refiner = new DealRefiner(`csv-auto-${Date.now()}`);
        refiner.refineDeals(createdIds).catch(err => {
          console.error('[CSV Import AutoRefine Error]', err);
        });
      });
    }

    return NextResponse.json({
      success: true,
      totalRowsProcessed: rows.length,
      createdCount,
      promoCodesCount,
      message: `Pomyślnie zaimportowano ${createdCount} okazji z pliku CSV AliExpress (w tym ${promoCodesCount} kodów rabatowych). Uruchomiono automatyczny AI Refiner w tle.`,
      createdIds: createdIds.slice(0, 50),
    });
  } catch (error: any) {
    console.error('[AliExpress CSV Import Error]', error);
    return NextResponse.json({ error: error.message || 'CSV Import failed' }, { status: 500 });
  }
}
