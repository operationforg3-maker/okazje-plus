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
        if (!discardedDoc.exists()) {
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
          // Create ProductCore from discarded data
          const productData = {
            title: discardedData.title || 'Restored Product',
            imageUrl: discardedData.imageUrl || '',
            description: discardedData.description || {},
            specs: discardedData.specs || {},
            status: targetStatus,
            createdAt: discardedData.createdAt || now,
            updatedAt: now,
            source: discardedData.source || 'manual',
            sourceLinks: discardedData.sourceUrl ? { [discardedData.source || 'other']: discardedData.sourceUrl } : {},
            qualityScore: 50, // Manual restore gets neutral score
            ratings: { score: 0, count: 0 },
            bestPrice: { amount: discardedData.price || 0, currency: 'PLN' },
            searchTags: [],
          };

          const productRef = await adminDb.collection('product_cores').add(productData);
          cacheInvalidations.push(productRef.id);

          perItemResults.push({
            id: restoreItem.id,
            success: true,
          });
          processedCount++;
        } else if (restoreItem.type === 'deal') {
          // Create Deal from discarded data
          const dealData = {
            title: discardedData.title || 'Restored Deal',
            description: discardedData.description || '',
            imageUrl: discardedData.imageUrl || '',
            price: discardedData.price || 0,
            originalPrice: discardedData.originalPrice,
            currency: discardedData.currency || 'PLN',
            shippingCost: discardedData.shippingCost || 0,
            totalPrice: (discardedData.price || 0) + (discardedData.shippingCost || 0),
            source: discardedData.source || 'manual',
            sourceId: discardedData.sourceProductId || '',
            sourceUrl: discardedData.sourceUrl || '',
            merchantName: discardedData.merchantName || 'Unknown',
            merchantRating: discardedData.merchantRating || 0,
            inStock: true,
            status: targetStatus,
            votes: 0,
            temperature: 0,
            comments: 0,
            createdAt: discardedData.createdAt || now,
            updatedAt: now,
            priceHistory: [
              {
                price: discardedData.price || 0,
                date: now,
                source: 'import',
              },
            ],
          };

          await adminDb.collection('deals').add(dealData);

          perItemResults.push({
            id: restoreItem.id,
            success: true,
          });
          processedCount++;
        }

        // Mark as restored in discarded (for audit trail)
        await adminDb.collection('import_discarded').doc(restoreItem.id).update({
          restoredAt: now,
          restoredBy: decoded.uid,
          restoredStatus: 'success',
        });
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
