import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/admin/import/rollback
 * Body: { jobId: string }
 * Usuwa wszystkie produkty/okazje utworzone przez ten job
 */
export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    console.log(`[Import Rollback] Starting rollback for job ${jobId}`);

    const jobRef = adminDb.collection('import_jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();
    const itemsCreated = jobData?.itemsCreated || [];
    const itemsUpdated = jobData?.itemsUpdated || [];
    const type = jobData?.type;

    if (!type) {
      return NextResponse.json({ error: 'Job type not found' }, { status: 400 });
    }

    const collectionName = type === 'products' ? 'products' : 'deals';
    console.log(`[Import Rollback] Deleting ${itemsCreated.length} items from ${collectionName}`);

    // Delete created items
    const batch = adminDb.batch();
    let deleteCount = 0;

    for (const itemId of itemsCreated) {
      const docRef = adminDb.collection(collectionName).doc(itemId);
      batch.delete(docRef);
      deleteCount++;

      // Commit every 500 (Firestore batch limit)
      if (deleteCount % 500 === 0) {
        await batch.commit();
        console.log(`[Import Rollback] Deleted ${deleteCount}/${itemsCreated.length} items`);
      }
    }

    // Commit remaining
    if (deleteCount % 500 !== 0) {
      await batch.commit();
    }

    console.log(`[Import Rollback] Rollback complete: deleted ${deleteCount} items`);

    // Mark job as rolled back
    await jobRef.update({
      status: 'rolled_back',
      rolledBackAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rollbackInfo: {
        itemsDeleted: deleteCount,
        itemsRestored: itemsUpdated.length, // TODO: implement restore old versions
      },
    });

    return NextResponse.json({
      success: true,
      message: `Rollback completed: deleted ${deleteCount} items`,
      itemsDeleted: deleteCount,
    });
  } catch (error: any) {
    console.error('[Import Rollback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
