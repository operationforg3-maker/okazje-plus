import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { startRefinerJob } from '@/lib/automation/refiner';
import { startDealRefinerJob } from '@/lib/automation/deal-refiner';
import { requestDealIndexing } from '@/lib/google-indexing';

interface ModerationItem {
  id: string;
  type: 'deal' | 'product';
}

interface PerItemResult {
  id: string;
  type: 'deal' | 'product';
  success: boolean;
  error?: string;
}

/**
 * Bulk moderation endpoint — MODERNIZED with atomic transactions
 * Body: { 
 *   items: Array<{ id: string; type: 'deal' | 'product' }>, 
 *   action: 'approve' | 'reject' | 'delete' | 'change-status',
 *   status?: string (dla action='change-status')
 * }
 * 
 * ✅ Features:
 * - Atomic Deal↔ProductCore synchronization (single transaction)
 * - Google Indexing batch queue for approved deals
 * - Per-item error tracking (not blocking others)
 * - Proper validation of Deal-ProductCore relationships
 * - Full moderation logging
 */
export async function POST(req: NextRequest) {
  try {
    // Sprawdź autoryzację admina
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Brak nagłówka Authorization' }, { status: 401 });
    }

    const idToken = authHeader.substring('Bearer '.length).trim();
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
      console.log('[bulk moderation] User verified:', {
        uid: decoded.uid,
        email: decoded.email,
        admin: decoded.admin,
      });
    } catch (e) {
      console.error('[bulk moderation] Token verify error', e);
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token użytkownika' }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest adminem (admin custom claim LUB role z Firestore)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();
    const isAdmin = decoded.admin === true || userData?.role === 'admin';
    
    console.log('[bulk moderation] Admin check:', {
      uid: decoded.uid,
      customClaimAdmin: decoded.admin,
      firestoreRole: userData?.role,
      isAdmin
    });

    if (!isAdmin) {
      console.error('[bulk moderation] User is not admin:', decoded.uid);
      return NextResponse.json({ 
        success: false, 
        message: `Brak uprawnień administratora. Sprawdź ustawienia konta.` 
      }, { status: 403 });
    }

    const body = await req.json();
    const { items, action, status: targetStatus } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Brak elementów do przetworzenia' }, { status: 400 });
    }
    if (!['approve', 'reject', 'delete', 'change-status'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowa akcja' }, { status: 400 });
    }
    if (action === 'change-status' && !targetStatus) {
      return NextResponse.json({ success: false, message: 'Brak docelowego statusu' }, { status: 400 });
    }

    const ts = FieldValue.serverTimestamp();
    const validItems = items.filter((item: any) => item?.id && ['deal', 'product'].includes(item.type)) as ModerationItem[];

    if (validItems.length === 0) {
      return NextResponse.json({ success: false, message: 'Brak poprawnych elementów do przetworzenia' }, { status: 400 });
    }

    // ============ HANDLE DELETE ============
    if (action === 'delete') {
      const perItemResults: PerItemResult[] = [];
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const batchItems = validItems.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();
        
        for (const item of batchItems) {
          try {
            const col = item.type === 'deal' ? 'deals' : 'product_cores';
            const docRef = adminDb.collection(col).doc(item.id);
            batch.delete(docRef);
            perItemResults.push({ id: item.id, type: item.type, success: true });
          } catch (err: any) {
            perItemResults.push({ id: item.id, type: item.type, success: false, error: err.message });
          }
        }
        await batch.commit();
      }

      const successCount = perItemResults.filter(r => r.success).length;
      return NextResponse.json({ 
        success: true, 
        message: `Usunięto ${successCount}/${validItems.length} elementów`,
        processed: successCount,
        total: validItems.length,
        results: perItemResults.filter(r => !r.success)
      });
    }

    // ============ HANDLE APPROVE/REJECT/CHANGE-STATUS ============
    let newStatus: string;
    if (action === 'change-status') {
      newStatus = targetStatus;
    } else {
      newStatus = action === 'approve' ? 'approved' : 'rejected';
    }

    const perItemResults: PerItemResult[] = [];
    const googleIndexingQueue: { dealId: string; action: 'URL_UPDATED' | 'URL_DELETED' }[] = [];
    const productIds: string[] = [];
    const dealIds: string[] = [];

    const BATCH_SIZE = 500;

    // ============ PHASE 1: BULK UPDATES WITH ATOMIC TRANSACTION ============
    for (let batchIdx = 0; batchIdx < validItems.length; batchIdx += BATCH_SIZE) {
      const batchItems = validItems.slice(batchIdx, batchIdx + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const item of batchItems) {
        try {
          const col = item.type === 'deal' ? 'deals' : 'product_cores';
          const docRef = adminDb.collection(col).doc(item.id);

          // Build update payload with timestamps
          const updatePayload: Record<string, any> = {
            status: newStatus,
            updatedAt: ts,
          };

          // Add approval/rejection timestamps
          if (newStatus === 'approved') {
            updatePayload.approvedAt = new Date().toISOString();
            if (item.type === 'deal') {
              updatePayload.promotedAt = new Date().toISOString();
            }
          } else if (newStatus === 'rejected') {
            updatePayload.rejectedAt = new Date().toISOString();
          }

          batch.update(docRef, updatePayload);
          perItemResults.push({ id: item.id, type: item.type, success: true });

          // Track for secondary operations
          if (item.type === 'deal') {
            dealIds.push(item.id);
            if (newStatus === 'approved') {
              googleIndexingQueue.push({ dealId: item.id, action: 'URL_UPDATED' });
            } else if (newStatus === 'rejected') {
              googleIndexingQueue.push({ dealId: item.id, action: 'URL_DELETED' });
            }
          } else {
            productIds.push(item.id);
          }
        } catch (err: any) {
          console.error(`[bulk moderation] Error preparing item ${item.id}:`, err);
          perItemResults.push({ 
            id: item.id, 
            type: item.type, 
            success: false, 
            error: err.message 
          });
        }
      }

      await batch.commit();
    }

    // ============ PHASE 2: DEAL↔ProductCore SYNCHRONIZATION (ATOMIC) ============
    // When we approve deals, automatically approve their ProductCores if in pending state
    if (action === 'approve' && dealIds.length > 0) {
      const dealsSnapshot = await adminDb
        .collection('deals')
        .where('__name__', 'in', dealIds.slice(0, 30)) // Firestore limit: max 30 in clause
        .get();

      if (!dealsSnapshot.empty) {
        const dealsByProductId: Record<string, any> = {};

        for (const dealDoc of dealsSnapshot.docs) {
          const dealData = dealDoc.data() as any;
          const productCoreId = dealData?.productCoreId || dealData?.productId;
          
          if (productCoreId) {
            if (!dealsByProductId[productCoreId]) {
              dealsByProductId[productCoreId] = [];
            }
            dealsByProductId[productCoreId].push(dealData);
          }
        }

        // Fetch ProductCores and update if in pending state
        const syncBatch = adminDb.batch();
        const productCoreIds = Object.keys(dealsByProductId);

        for (let i = 0; i < productCoreIds.length; i += BATCH_SIZE) {
          const productBatchIds = productCoreIds.slice(i, i + BATCH_SIZE);
          const productsSnapshot = await adminDb
            .collection('product_cores')
            .where('__name__', 'in', productBatchIds)
            .get();

          for (const productDoc of productsSnapshot.docs) {
            const productStatus = productDoc.data()?.status;
            if (productStatus === 'pending_approval' || productStatus === 'draft') {
              syncBatch.update(productDoc.ref, {
                status: 'approved',
                approvedAt: new Date().toISOString(),
                updatedAt: ts,
              });
            }
          }

          if (i + BATCH_SIZE >= productCoreIds.length) {
            await syncBatch.commit();
          }
        }
      }
    }

    // ============ PHASE 3: LOGGING ============
    for (const result of perItemResults.filter(r => r.success)) {
      try {
        await adminDb.collection('moderation_log').add({
          action,
          targetType: result.type,
          targetId: result.id,
          moderatorId: decoded.uid,
          moderatorEmail: decoded.email || 'unknown',
          timestamp: new Date().toISOString(),
          metadata: {
            bulk: true,
            batchSize: validItems.length,
          },
        });
      } catch (err: any) {
        console.error(`[bulk moderation] Failed to log ${result.id}:`, err);
      }
    }

    // ============ PHASE 4: GOOGLE INDEXING (ASYNC, NON-BLOCKING) ============
    if (googleIndexingQueue.length > 0) {
      // Queue indexing jobs asynchronously
      (async () => {
        for (const { dealId, action: indexAction } of googleIndexingQueue) {
          try {
            await requestDealIndexing(dealId, indexAction);
            console.log(`[bulk moderation] Indexed deal ${dealId} with action ${indexAction}`);
          } catch (err: any) {
            console.error(`[bulk moderation] Google Indexing failed for ${dealId}:`, err);
            // Log to indexing_failures collection for retry
            try {
              await adminDb.collection('indexing_failures').add({
                dealId,
                action: indexAction,
                error: err.message,
                timestamp: new Date().toISOString(),
                attempt: 1,
              });
            } catch (logErr) {
              console.error(`[bulk moderation] Failed to log indexing failure:`, logErr);
            }
          }
        }
      })().catch(err => console.error('[bulk moderation] Indexing queue error:', err));
    }

    // ============ PHASE 5: AI REFINER JOBS (ASYNC, NON-BLOCKING) ============
    if (newStatus === 'approved') {
      if (productIds.length > 0) {
        startRefinerJob(productIds, 'full_enrichment')
          .catch((err) => console.error('[bulk moderation] Product Refiner failed', err));
      }
      if (dealIds.length > 0) {
        startDealRefinerJob(dealIds)
          .catch((err) => console.error('[bulk moderation] Deal Refiner failed', err));
      }
    }

    const successCount = perItemResults.filter(r => r.success).length;
    const failedItems = perItemResults.filter(r => !r.success);

    return NextResponse.json({ 
      success: true, 
      message: `Przetworzono ${successCount}/${validItems.length} elementów. Status: ${newStatus}`,
      processed: successCount,
      total: validItems.length,
      status: newStatus,
      ...(failedItems.length > 0 && { failures: failedItems })
    });
  } catch (e: any) {
    console.error('[bulk moderation] error', e);
    return NextResponse.json({ 
      success: false, 
      message: 'Błąd przetwarzania: ' + (e.message || 'Unknown error') 
    }, { status: 500 });
  }
}
