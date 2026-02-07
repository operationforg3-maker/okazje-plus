import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { startRefinerJob } from '@/lib/automation/refiner';
import { startDealRefinerJob } from '@/lib/automation/deal-refiner';

/**
 * Bulk moderation endpoint
 * Body: { 
 *   items: Array<{ id: string; type: 'deal' | 'product' }>, 
 *   action: 'approve' | 'reject' | 'delete' | 'change-status',
 *   status?: string (dla action='change-status')
 * }
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

    // Dziel na batche po max 500 (Firestore limit)
    const BATCH_SIZE = 500;
    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    // Dla delete używamy osobnych operacji (batch.delete)
    if (action === 'delete') {
      let processed = 0;
      for (const batchItems of batches) {
        const batch = adminDb.batch();
        for (const item of batchItems) {
          if (!item?.id || !['deal', 'product'].includes(item.type)) continue;
          // M6: product -> product_cores
          const col = item.type === 'deal' ? 'deals' : 'product_cores';
          const docRef = adminDb.collection(col).doc(item.id);
          batch.delete(docRef);
          processed++;
        }
        await batch.commit();
      }
      return NextResponse.json({ 
        success: true, 
        message: `Usunięto ${processed} elementów w ${batches.length} batch${batches.length > 1 ? 'ach' : 'u'}`,
        processed,
        total: items.length
      });
    }

    // Dla approve/reject/change-status używamy update
    let newStatus: string;

    if (action === 'change-status') {
      newStatus = targetStatus;
    } else {
      newStatus = action === 'approve' ? 'approved' : 'rejected';
    }

    // Jeśli zatwierdzamy, uruchom AI Refiner dla produktów/ofert (tylko nowe importy)
    if (newStatus === 'approved') {
      const productIds = items.filter((item: any) => item?.type === 'product').map((item: any) => item.id);
      const dealIds = items.filter((item: any) => item?.type === 'deal').map((item: any) => item.id);

      if (productIds.length > 0) {
        try {
          await startRefinerJob(productIds, 'full_enrichment');
        } catch (err) {
          console.error('[bulk moderation] Product Refiner failed', err);
        }
      }
      if (dealIds.length > 0) {
        try {
          await startDealRefinerJob(dealIds);
        } catch (err) {
          console.error('[bulk moderation] Deal Refiner failed', err);
        }
      }
    }

    let processed = 0;
    for (const batchItems of batches) {
      const batch = adminDb.batch();
      for (const item of batchItems) {
        if (!item?.id || !['deal', 'product'].includes(item.type)) continue;
        // M6: product -> product_cores
        const col = item.type === 'deal' ? 'deals' : 'product_cores';
        const docRef = adminDb.collection(col).doc(item.id);
        batch.update(docRef, { status: newStatus, updatedAt: ts });
        processed++;
      }
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Zmieniono status ${processed} elementów na ${newStatus} (${batches.length} batch${batches.length > 1 ? 'y' : ''})`,
      processed,
      total: items.length,
      status: newStatus
    });
  } catch (e: any) {
    console.error('[bulk moderation] error', e);
    return NextResponse.json({ success: false, message: 'Błąd przetwarzania' }, { status: 500 });
  }
}
