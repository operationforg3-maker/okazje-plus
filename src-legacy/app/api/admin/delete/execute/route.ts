import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { type, ids, options = {} } = await req.json();

    if (!type || !ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'Missing type or ids array' },
        { status: 400 }
      );
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array cannot be empty' },
        { status: 400 }
      );
    }

    console.log(`[Delete Execute] Type: ${type}, Count: ${ids.length}, Options:`, options);

    const deletedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Delete in batches (Firestore limits to 500 per transaction)
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const batchDelete = adminDb.batch();

      for (const id of batchIds) {
        try {
          const docRef = adminDb.collection(type).doc(id);
          batchDelete.delete(docRef);
          deletedIds.push(id);
        } catch (e: any) {
          errors.push({ id, error: e.message });
        }
      }

      try {
        await batchDelete.commit();
        console.log(`[Delete Execute] Batch ${Math.floor(i / batchSize) + 1}: Deleted ${batchIds.length} documents`);
      } catch (e: any) {
        console.error(`[Delete Execute] Batch commit failed: ${e.message}`);
        errors.push(...batchIds.map(id => ({ id, error: 'Batch commit failed' })));
      }
    }

    // For categories with cascade, also delete child products
    if (type === 'categories') {
      console.log('[Delete Execute] Cascade deleting products from deleted categories...');
      for (const categoryId of deletedIds) {
        try {
          const products = await adminDb.collection('products')
            .where('categoryId', '==', categoryId)
            .limit(1000)
            .get();

          if (products.size > 0) {
            const cascadeBatch = adminDb.batch();
            products.docs.forEach(doc => cascadeBatch.delete(doc.ref));
            await cascadeBatch.commit();
            console.log(`[Delete Execute] Cascade: Deleted ${products.size} products from category ${categoryId}`);
          }
        } catch (e: any) {
          console.warn(`[Delete Execute] Cascade failed for category ${categoryId}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      type,
      deleted: deletedIds.length,
      errors,
      completedAt: new Date().toISOString(),
      message: `Successfully deleted ${deletedIds.length} ${type}. Errors: ${errors.length}`,
    });
  } catch (error: any) {
    console.error('[Delete Execute] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
