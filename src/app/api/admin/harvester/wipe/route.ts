import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/admin/harvester/wipe
 * 
 * Wipes entire database (deals, product_cores, identity_matches, harvester_jobs,
 * refiner_jobs, import_jobs)
 * DANGEROUS - requires double confirmation
 */
export async function POST() {
  try {
    await requireAdmin();

    // Wipe all collections in batches
    const collections = [
      'deals',
      'product_cores',
      'identity_matches',
      'harvester_jobs',
      'refiner_jobs',   // previously orphaned on every wipe
      'import_jobs',    // previously orphaned on every wipe
    ];
    const results: Record<string, number> = {};
    
    for (const collectionName of collections) {
      let deleted = 0;
      const collectionRef = adminDb.collection(collectionName);
      
      // Delete in batches (max 100 per batch)
      let hasMore = true;
      while (hasMore) {
        const snapshot = await collectionRef.limit(100).get();
        if (snapshot.empty) {
          hasMore = false;
          break;
        }
        
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        deleted += snapshot.docs.length;
      }
      
      results[collectionName] = deleted;
    }

    const total = Object.values(results).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: true,
      deleted: results,
      total,
      message: `Wyczyszczono ${total} dokumentów z ${collections.length} kolekcji`,
    });
  } catch (err: any) {
    console.error('[WIPE] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Wipe failed' },
      { status: 500 }
    );
  }
}
