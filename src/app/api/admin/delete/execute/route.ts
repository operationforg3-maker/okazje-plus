import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

const COLLECTION_MAP: Record<string, string> = {
  products: 'product_cores',
  deals: 'deals',
  categories: 'categories',
  users: 'users',
  orphaned: 'orphaned_logs',
};

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

    const { type, ids, filters, deleteAll, options = {} } = await req.json();

    if (!type) {
      return NextResponse.json({ error: 'Missing type' }, { status: 400 });
    }

    const collectionName = COLLECTION_MAP[type] || type;
    let targetIds: string[] = [];

    // Strategy 1: Explicit IDs provided (legacy or specific selection)
    if (ids && Array.isArray(ids) && ids.length > 0 && !deleteAll) {
      targetIds = ids;
    } 
    // Strategy 2: Delete All matching filters
    else if (deleteAll) {
      console.log(`[Delete Execute] Fetching IDs for ALL items in ${collectionName} with filters:`, filters);
      
      let query: FirebaseFirestore.Query = adminDb.collection(collectionName);
      
      // Apply filters (Must match preview logic)
      if (['products', 'deals'].includes(type) && filters) {
        // 0. ID Filter (Exact Match)
        if (filters.id) {
            // If ID is provided, query directly for it (or use where, but IDs are unique)
            // Using where for consistency with query builder, or just Filter in memory if that's easier given complex query checks.
            // Since we want to COMBINE with other filters (e.g. ID + Status), keeping it as a 'where' clause is safest if field exists...
            // BUT, 'id' is document ID, typically queried via .doc(id).
            // Firestore queries can use FieldPath.documentId(), but combining with other indexes is tricky.
            // Simplest Strategy: If ID is present, just fetch that ONE doc and check other filters in memory.
             query = query.where(FieldPath.documentId(), '==', filters.id);
        }

        // 1. Status Filter (Equality)
        if (filters.status && filters.status !== 'all') {
            query = query.where('status', '==', filters.status);
        }

        // 2. Category Filter (Equality) - checks mainCategorySlug or categoryId
        if (filters.category) {
           if (type === 'products') {
               query = query.where('mainCategorySlug', '==', filters.category);
           } else if (type === 'deals') {
               // Deals might not have category directly, they rely on product. 
               // For now assuming deals might not be filterable by category efficiently without join.
               // Or if deal has categoryId denormalized.
               // Let's skip category for deals if not sure, or try query.
           }
        }
      }
      
      // Fetch candidates
      const snapshot = await query.get();
      let docs = snapshot.docs;

      // 3. In-Memory Filtering for Range Fields (Date, Price) to avoid index explosion
      if (['products', 'deals'].includes(type) && filters) {
          const now = new Date();
          
          // Filter by Age
          if (filters.maxAgeDays) {
              const days = parseInt(filters.maxAgeDays);
              if (!isNaN(days)) {
                  const cutoffTime = now.getTime() - (days * 24 * 60 * 60 * 1000);
                  docs = docs.filter(doc => {
                      const data = doc.data();
                      const created = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
                      return created < cutoffTime; // Older than cutoff
                  });
              }
          }

          // Filter by Price
          if (filters.minPrice || filters.maxPrice) {
              const min = filters.minPrice ? parseFloat(filters.minPrice) : 0;
              const max = filters.maxPrice ? parseFloat(filters.maxPrice) : Infinity;
              
              docs = docs.filter(doc => {
                  const data = doc.data();
                  // Handle inconsistent pricing fields
                  const price = type === 'products' ? (data.bestPrice || 0) : (data.price || data.totalPrice || 0);
                  return price >= min && price <= max;
              });
          }
      }

      targetIds = docs.map(doc => doc.id);
      console.log(`[Delete Execute] Found ${targetIds.length} items to delete after full filtering.`);
    }

    if (targetIds.length === 0) {
      return NextResponse.json(
        { message: 'No items found to delete', deleted: 0 },
        { status: 200 }
      );
    }

    console.log(`[Delete Execute] Type: ${type} (${collectionName}), Count: ${targetIds.length}, Options:`, options);

    const deletedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Delete in batches (Firestore limits to 500 per transaction)
    const batchSize = 500;
    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batchIds = targetIds.slice(i, i + batchSize);
      const batchDelete = adminDb.batch();

      for (const id of batchIds) {
        // Use correct collectionName when creating doc ref
        const docRef = adminDb.collection(collectionName).doc(id);
        batchDelete.delete(docRef);
        deletedIds.push(id);
      }

      try {
        await batchDelete.commit();
        console.log(`[Delete Execute] Batch ${Math.floor(i / batchSize) + 1}: Deleted ${batchIds.length} documents`);
      } catch (e: any) {
        console.error(`[Delete Execute] Batch commit failed: ${e.message}`);
        errors.push(...batchIds.map(id => ({ id, error: 'Batch commit failed' })));
      }
    }

    // For categories with cascade, also delete child products (using correct collection)
    if (type === 'categories') {
      console.log('[Delete Execute] Cascade deleting products from deleted categories...');
      
      const productCollection = COLLECTION_MAP['products']; // 'product_cores'
      
      for (const categoryId of deletedIds) {
        try {
          // Delete products where mainCategorySlug matches
          const products = await adminDb.collection(productCollection)
            .where('mainCategorySlug', '==', categoryId)
            .limit(100) 
            .get();

          if (products.size > 0) {
            const cascadeBatch = adminDb.batch();
            products.docs.forEach(doc => cascadeBatch.delete(doc.ref));
            await cascadeBatch.commit();
            console.log(`[Delete Execute] Cascade: Deleted ${products.size} products for category ${categoryId}`);
          }
        } catch(e) {
             console.error(`[Cascade Error] Failed for category ${categoryId}`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[Delete Execute] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
