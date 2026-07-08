import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { invalidateHotDealsCache, invalidateProductCache } from '@/lib/cache-invalidation';

interface RestoreItem {
  id: string; // ID z import_discarded
  type: 'product' | 'deal';
}

interface RestoreResult {
  processed: number;
  total: number;
  failures?: Array<{ id: string; error?: string }>;
  success?: boolean;
  message?: string;
}

/**
 * Restore discarded items back to pending/draft status
 * Overrides the filtering decision and re-imports the product/deal
 * 
 * Body: {
 *   items: Array<{ id: string; type: 'product' | 'deal' }>,
 *   targetStatus: 'pending' | 'draft' (default: 'pending')
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Brak authorization' }, { status: 401 });
    }

    const idToken = authHeader.substring('Bearer '.length).trim();
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const user = await getAuth().getUser(decoded.uid);
    const isAdmin = user.customClaims?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: 'Tylko admini' }, { status: 403 });
    }

    const { items, targetStatus = 'pending' } = await req.json() as {
      items: RestoreItem[];
      targetStatus?: 'pending' | 'draft';
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'items must be non-empty array' },
        { status: 400 }
      );
    }

    const perItemResults: Array<{ id: string; success: boolean; error?: string }> = [];
    const cacheInvalidations: string[] = [];
    let processedCount = 0;

    // Process each item
    for (const restoreItem of items) {
      try {
        if (!restoreItem.id || !restoreItem.type) {
          perItemResults.push({
            id: restoreItem.id || 'unknown',
            success: false,
            error: 'Missing id or type',
          });
          continue;
        }

        // Fetch discarded item to get original data
        const discardedDoc = await adminDb.collection('import_discarded').doc(restoreItem.id).get();
        if (!discardedDoc.exists) {
          perItemResults.push({
            id: restoreItem.id,
            success: false,
            error: 'Not found in discarded',
          });
          continue;
        }

        const discardedData = discardedDoc.data();
        const now = new Date().toISOString();

        if (restoreItem.type === 'product') {
          // Parse category slugs from the category path
          const catParts = String(discardedData.categoryPath || discardedData.query || '')
            .split('/')
            .map((p) => p.trim())
            .filter(Boolean);
          
          const mainCategorySlug = catParts[0] || 'uncategorized';
          const subCategorySlug = catParts[1] || 'uncategorized';
          const subSubCategorySlug = catParts[2] || undefined;

          // Localize title and description (M6 schema requirement)
          const localizedTitle = {
            pl: discardedData.title || 'Przywrócony produkt',
            en: discardedData.title || 'Restored Product',
            de: discardedData.title || 'Restored Product',
          };
          const localizedDesc = {
            pl: discardedData.description || '',
            en: discardedData.description || '',
            de: discardedData.description || '',
          };

          const priceAmount = Number(discardedData.price || 0);

          // 1. Create a ProductCore
          const productRef = adminDb.collection('product_cores').doc();
          const productId = productRef.id;

          const productData = {
            id: productId,
            identityHash: discardedData.identityHash || `restored_${restoreItem.id}_${Date.now()}`,
            title: localizedTitle,
            shortDescription: localizedTitle,
            fullDescription: localizedDesc,
            specs: discardedData.specs || {},
            coreSpecs: discardedData.specs || {},
            rawSpecs: discardedData.specs || {},
            mainCategorySlug,
            subCategorySlug,
            subSubCategorySlug,
            imageUrl: discardedData.imageUrl || '',
            images: discardedData.imageUrl ? [discardedData.imageUrl] : [],
            reviewsSummary: {
              pl: 'Brak podsumowania opinii (ręcznie przywrócony)',
              en: 'No reviews summary (manually restored)',
              de: 'Keine Bewertung (manuell wiederhergestellt)',
            },
            rating: {
              score: 4.5,
              count: 1,
              provider: discardedData.source === 'aliexpress' ? 'aliexpress' : 'mixed',
            },
            bestPrice: {
              amount: priceAmount,
              currency: discardedData.currency || 'PLN',
            },
            bestDealId: '', // Will link to the deal below
            bestTotalPrice: priceAmount,
            linkedDealIds: [] as string[],
            searchTags: Array.from(new Set(
              `${discardedData.title || ''} ${mainCategorySlug} ${subCategorySlug}`
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 15)
            )),
            status: targetStatus === 'pending' ? 'pending_approval' : targetStatus,
            createdAt: discardedData.createdAt || now,
            updatedAt: now,
            metadata: {
              source: discardedData.source || 'manual',
              originalId: discardedData.sourceProductId || null,
              restoredFromDiscarded: true,
              restoredAt: now,
            }
          };

          await productRef.set(productData);

          // 2. Create the associated Deal (Offer) document
          const dealRef = adminDb.collection('deals').doc();
          const dealId = dealRef.id;

          const dealData = {
            id: dealId,
            productId: productId,
            productCoreId: productId,
            mainCategorySlug,
            subCategorySlug,
            subSubCategorySlug,
            image: discardedData.imageUrl || '',
            images: discardedData.imageUrl ? [discardedData.imageUrl] : [],
            price: {
              amount: priceAmount,
              currency: discardedData.currency || 'PLN',
            },
            originalPrice: discardedData.originalPrice || undefined,
            shipping: {
              cost: 0,
              timeDays: 7,
              method: 'Standard',
            },
            totalPrice: priceAmount,
            source: discardedData.source || 'aliexpress',
            affiliateLink: discardedData.sourceUrl || '',
            affiliateUrl: discardedData.sourceUrl || '',
            dealUrl: discardedData.sourceUrl || '',
            merchantName: discardedData.merchantName || 'AliExpress',
            merchantRating: 4.5,
            title: localizedTitle,
            description: localizedDesc,
            stockStatus: 'in_stock',
            isActive: true,
            status: targetStatus === 'pending' ? 'poczekalnia' : targetStatus,
            voteCount: 0,
            temperature: 0,
            commentsCount: 0,
            priceHistory: [
              {
                date: now.substring(0, 10),
                price: priceAmount,
                currency: discardedData.currency || 'PLN',
              }
            ],
            createdAt: now,
            updatedAt: now,
          };

          await dealRef.set(dealData);

          // 3. Link the deal back to the product core
          await productRef.update({
            linkedDealIds: [dealId],
            bestDealId: dealId,
          });

          cacheInvalidations.push(productId);

          perItemResults.push({
            id: restoreItem.id,
            success: true,
          });
          processedCount++;
        } else if (restoreItem.type === 'deal') {
          // Create Deal from discarded data
          const localizedTitle = {
            pl: discardedData.title || 'Przywrócona oferta',
            en: discardedData.title || 'Restored Deal',
            de: discardedData.title || 'Restored Deal',
          };
          const localizedDesc = {
            pl: discardedData.description || '',
            en: discardedData.description || '',
            de: discardedData.description || '',
          };

          const priceAmount = Number(discardedData.price || 0);

          const dealRef = adminDb.collection('deals').doc();
          const dealId = dealRef.id;

          const dealData = {
            id: dealId,
            productId: discardedData.productId || 'restored_orphan_deal',
            productCoreId: discardedData.productId || 'restored_orphan_deal',
            image: discardedData.imageUrl || '',
            images: discardedData.imageUrl ? [discardedData.imageUrl] : [],
            price: {
              amount: priceAmount,
              currency: discardedData.currency || 'PLN',
            },
            originalPrice: discardedData.originalPrice,
            shipping: {
              cost: Number(discardedData.shippingCost || 0),
              timeDays: 7,
            },
            totalPrice: priceAmount + Number(discardedData.shippingCost || 0),
            source: discardedData.source || 'manual',
            affiliateLink: discardedData.sourceUrl || '',
            affiliateUrl: discardedData.sourceUrl || '',
            dealUrl: discardedData.sourceUrl || '',
            merchantName: discardedData.merchantName || 'Unknown',
            merchantRating: discardedData.merchantRating || 0,
            inStock: true,
            status: targetStatus === 'pending' ? 'poczekalnia' : targetStatus,
            title: localizedTitle,
            description: localizedDesc,
            voteCount: 0,
            temperature: 0,
            commentsCount: 0,
            isActive: true,
            createdAt: discardedData.createdAt || now,
            updatedAt: now,
            priceHistory: [
              {
                price: priceAmount,
                date: now.substring(0, 10),
                currency: discardedData.currency || 'PLN',
              },
            ],
          };

          await dealRef.set(dealData);

          perItemResults.push({
            id: restoreItem.id,
            success: true,
          });
          processedCount++;
        }

        // Remove from discarded queue since it is now restored
        await adminDb.collection('import_discarded').doc(restoreItem.id).delete();
      } catch (itemError: any) {
        perItemResults.push({
          id: restoreItem.id,
          success: false,
          error: itemError.message || 'Unknown error',
        });
      }
    }

    // Invalidate caches
    try {
      for (const productId of cacheInvalidations) {
        await invalidateProductCache(productId);
      }
      await invalidateHotDealsCache();
    } catch (cacheErr) {
      console.warn('[restore-discarded] Cache invalidation failed:', cacheErr);
    }

    const failures = perItemResults.filter((r) => !r.success);
    const result: RestoreResult = {
      processed: processedCount,
      total: items.length,
      ...(failures.length > 0 && { failures }),
      success: failures.length === 0,
      message: `Restored ${processedCount}/${items.length} items`,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[restore-discarded] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
