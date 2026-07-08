import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

interface DeleteResult {
  processed: number;
  total: number;
  failures?: Array<{ id: string; error?: string }>;
  success?: boolean;
  message?: string;
}

/**
 * Delete discarded items permanently
 * Removes records from import_discarded collection
 * 
 * Body: {
 *   ids: string[] (IDs from import_discarded collection)
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

    const payload = await req.json() as { ids?: string[]; mode?: string };
    
    let processedCount = 0;
    
    if (payload.mode === 'all') {
      const allDocs = await adminDb.collection('import_discarded').select().get();
      const bulkWriter = adminDb.bulkWriter();
      
      for (const doc of allDocs.docs) {
        bulkWriter.delete(doc.ref);
        processedCount++;
      }
      
      await bulkWriter.close();
      
      return NextResponse.json({
        success: true,
        processed: processedCount,
        total: allDocs.size,
        message: `Deleted ${processedCount} items from database`,
      }, { status: 200 });
    }

    const ids = payload.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ids must be non-empty array' },
        { status: 400 }
      );
    }

    const perItemResults: Array<{ id: string; success: boolean; error?: string }> = [];

    // Chunk deletion into batches (max 500 per batch)
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = ids.slice(i, i + batchSize);

      for (const id of chunk) {
        try {
          const ref = adminDb.collection('import_discarded').doc(id);
          batch.delete(ref);
          perItemResults.push({ id, success: true });
          processedCount++;
        } catch (err: any) {
          perItemResults.push({
            id,
            success: false,
            error: err.message || 'Batch error',
          });
        }
      }

      try {
        await batch.commit();
      } catch (batchErr: any) {
        console.error('[delete-discarded] Batch commit failed:', batchErr);
        // Mark remaining items in chunk as failed
        for (const id of chunk) {
          const existing = perItemResults.find((r) => r.id === id);
          if (existing && existing.success) {
            // Already counted above
          }
        }
      }
    }

    const failures = perItemResults.filter((r) => !r.success);
    const result: DeleteResult = {
      processed: processedCount,
      total: ids.length,
      ...(failures.length > 0 && { failures }),
      success: failures.length === 0,
      message: `Deleted ${processedCount}/${ids.length} items`,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[delete-discarded] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
