/**
 * AliExpress Price Refresh
 *
 * Pobiera aktualne ceny dla istniejących produktów z AliExpress Affiliate API
 * i aktualizuje je w Firestore (produkt + powiązane oferty).
 *
 * Wywoływane na początku każdego cyklu autopilota aby ceny były świeże.
 */

import { adminDb } from './firebase-admin';
import { getAliExpressClient } from './integrations/aliexpress-client';
import { convertPrice } from './fx';
import { logger } from './logger';

export interface PriceRefreshStats {
  checked: number;
  updated: number;
  unchanged: number;
  errors: number;
  apiCallsMade: number;
}

/**
 * Odświeża ceny dla najdawniej aktualizowanych produktów z AliExpress.
 * Pobiera maks. `maxProducts` produktów (posortowanych: najstarszy refresh pierwszy).
 *
 * @param maxProducts - ile produktów odświeżyć w jednym wywołaniu (domyślnie 50)
 */
export async function refreshProductPrices(
  maxProducts: number = 50,
): Promise<PriceRefreshStats> {
  const stats: PriceRefreshStats = {
    checked: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    apiCallsMade: 0,
  };

  try {
    // Pobierz zatwierdzone produkty (max 200 by nie przeładować Firestore)
    const snap = await adminDb
      .collection('products')
      .where('status', '==', 'approved')
      .limit(200)
      .get();

    // Filtruj: tylko aliexpress, posortuj: najdawniej odświeżony na początku
    const candidates = snap.docs
      .filter(
        (d) =>
          d.get('metadata.source') === 'aliexpress' &&
          d.get('metadata.originalId'),
      )
      .sort((a, b) => {
        const at = (a.get('metadata.lastPriceRefreshAt') as string) ?? '';
        const bt = (b.get('metadata.lastPriceRefreshAt') as string) ?? '';
        return at < bt ? -1 : at > bt ? 1 : 0;
      })
      .slice(0, maxProducts);

    if (candidates.length === 0) {
      logger.info('Price refresh: brak kandydatów do odświeżenia');
      return stats;
    }

    logger.info('Price refresh: start', { count: candidates.length });

    const client = getAliExpressClient();
    const BATCH_SIZE = 50; // limit API aliexpress.affiliate.productdetail.get

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      // Mapa: aliexpressId -> Firestore doc
      const idMap = new Map<string, (typeof candidates)[0]>();
      for (const doc of batch) {
        const originalId = doc.get('metadata.originalId') as string;
        if (originalId) idMap.set(originalId, doc);
      }

      // Wywołaj API
      stats.apiCallsMade++;
      let response: any;
      try {
        response = await client.getAffiliateProductDetails([...idMap.keys()]);
      } catch (e) {
        logger.warn('Price refresh: błąd API', {
          error: e,
          batchSize: idMap.size,
        });
        stats.errors += batch.length;
        continue;
      }

      // Parsuj odpowiedź API (aliexpress.affiliate.productdetail.get)
      const detailResult =
        response?.aliexpress_affiliate_productdetail_get_response?.result ??
        response?.result;
      const rawProducts: any[] = Array.isArray(detailResult?.products?.product)
        ? detailResult.products.product
        : Array.isArray(detailResult?.products)
          ? detailResult.products
          : [];

      const returnedIds = new Set(
        rawProducts.map((r: any) => String(r.product_id ?? '')),
      );

      const now = new Date().toISOString();

      // Przetwórz każdy produkt zwrócony przez API
      for (const raw of rawProducts) {
        const pid = String(raw.product_id ?? '').trim();
        const docSnap = idMap.get(pid);
        if (!docSnap) continue;

        stats.checked++;

        const currentPrice = (docSnap.get('price') as number) ?? 0;
        const currency = (raw.target_sale_price_currency as string) || 'USD';
        const rawPriceNum = Number(raw.target_sale_price ?? raw.sale_price ?? 0);

        if (!rawPriceNum || rawPriceNum <= 0) {
          // Brak ceny w odpowiedzi - tylko odśwież timestamp
          await docSnap.ref.update({ 'metadata.lastPriceRefreshAt': now });
          stats.unchanged++;
          continue;
        }

        let newPricePLN: number;
        try {
          newPricePLN = await convertPrice(rawPriceNum, currency, 'PLN');
        } catch (e) {
          logger.warn('Price refresh: błąd konwersji waluty', {
            pid,
            currency,
            error: e,
          });
          stats.errors++;
          continue;
        }

        // Ignoruj zmiany < 1% (szum zmiennoprzecinkowy / mikro-wahania kursów)
        const pctChange =
          currentPrice > 0
            ? Math.abs(newPricePLN - currentPrice) / currentPrice
            : 1;

        if (pctChange < 0.01) {
          await docSnap.ref.update({ 'metadata.lastPriceRefreshAt': now });
          stats.unchanged++;
          continue;
        }

        // Cena zmieniła się — aktualizuj produkt i powiązane oferty
        const historyEntry = {
          price: newPricePLN,
          currency: 'PLN',
          timestamp: now,
          source: 'refresh',
        };

        const existingHistory: any[] =
          (docSnap.get('metadata.priceHistory') as any[]) ?? [];

        const productUpdate: Record<string, any> = {
          price: newPricePLN,
          'metadata.lastPriceRefreshAt': now,
          'metadata.priceHistory': [...existingHistory, historyEntry].slice(
            -90,
          ),
          updatedAt: now,
        };

        // Jeśli API zwróciło nowy link afiliacyjny - zaktualizuj
        const newPromoLink: string =
          (raw.promotion_link as string) ?? '';
        if (newPromoLink) {
          productUpdate['affiliateUrl'] = newPromoLink;
        }

        try {
          await docSnap.ref.update(productUpdate);

          // Aktualizuj powiązane oferty (te same z source=aliexpress)
          const dealsSnap = await adminDb
            .collection('deals')
            .where('productId', '==', docSnap.id)
            .where('source', '==', 'aliexpress')
            .get();

          if (dealsSnap.size > 0) {
            const dealBatch = adminDb.batch();
            for (const dealDoc of dealsSnap.docs) {
              const existingDealHistory: any[] =
                (dealDoc.get('priceHistory') as any[]) ?? [];
              const dealPriceEntry = {
                date: now.split('T')[0],
                price: newPricePLN,
                currency: 'PLN',
              };

              const dealUpdate: Record<string, any> = {
                'price.amount': newPricePLN,
                priceHistory: [...existingDealHistory, dealPriceEntry].slice(
                  -90,
                ),
                updatedAt: now,
              };
              if (newPromoLink) {
                dealUpdate['affiliateLink'] = newPromoLink;
                dealUpdate['link'] = newPromoLink;
                dealUpdate['affiliateUrl'] = newPromoLink;
              }

              dealBatch.update(dealDoc.ref, dealUpdate);
            }
            await dealBatch.commit();
          }

          stats.updated++;
          logger.info('Price refresh: zaktualizowano cenę', {
            productId: docSnap.id,
            aliexpressId: pid,
            oldPrice: currentPrice,
            newPrice: newPricePLN,
            pctChange: `${(pctChange * 100).toFixed(1)}%`,
            dealsUpdated: dealsSnap.size,
          });
        } catch (e) {
          logger.warn('Price refresh: błąd zapisu do Firestore', {
            productId: docSnap.id,
            error: e,
          });
          stats.errors++;
        }
      }

      // Produkty nieudzwornione przez API — tylko odśwież timestamp
      for (const [aliId, docSnap] of idMap) {
        if (!returnedIds.has(aliId)) {
          stats.checked++;
          stats.unchanged++;
          await docSnap.ref
            .update({ 'metadata.lastPriceRefreshAt': now })
            .catch(() => {/* non-critical */});
        }
      }
    }

    logger.info('Price refresh: zakończono', stats);
  } catch (e) {
    logger.error('Price refresh: krytyczny błąd', { error: e });
    stats.errors++;
  }

  return stats;
}
