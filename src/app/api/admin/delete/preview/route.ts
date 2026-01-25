import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

const COLLECTION_MAP: Record<string, string> = {
  products: 'product_cores',
  deals: 'deals',
  categories: 'categories',
  users: 'users',
  orphaned: 'orphaned_logs', // Example placeholder
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

    const { type, filters = {} } = await req.json();

    if (!type || !['products', 'deals', 'categories', 'users', 'orphaned'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type: ' + type },
        { status: 400 }
      );
    }
    
    // Map abstract type to actual Firestore collection name
    const collectionName = COLLECTION_MAP[type] || type;

    console.log(`[Delete Preview] Type: ${type} -> Collection: ${collectionName}, Filters:`, filters);

    let count = 0;
    let items: any[] = [];
    const warnings: string[] = [];

    try {
      // Build query based on filters
      let query: FirebaseFirestore.Query = adminDb.collection(collectionName);
      
      // Apply filters (Product/Deal specific)
      if (['products', 'deals'].includes(type) && filters) {
        // 0. ID Filter
        if (filters.id) {
           query = query.where(FieldPath.documentId(), '==', filters.id);
        }

        // 1. Status Filter
        if (filters.status && filters.status !== 'all') {
          query = query.where('status', '==', filters.status);
        }
        
        // 2. Category Filter
        if (filters.category && type === 'products') {
           query = query.where('mainCategorySlug', '==', filters.category);
        }
      }

      // Fetch all to apply memory filters (needed for accurate count)
      // Note: limit(500) was previously here, but if we filter in memory we need to fetch more to find matches
      // However, for preview performance we might cap at 1000 and warn if more.
      const snapshot = await query.limit(2000).get();
      let docs = snapshot.docs;

      // 3. In-Memory Filtering
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
                      return created < cutoffTime;
                  });
              }
          }

          // Filter by Price
          if (filters.minPrice || filters.maxPrice) {
              const min = filters.minPrice ? parseFloat(filters.minPrice) : 0;
              const max = filters.maxPrice ? parseFloat(filters.maxPrice) : Infinity;
              
              docs = docs.filter(doc => {
                  const data = doc.data();
                  const price = type === 'products' ? (data.bestPrice || 0) : (data.price || data.totalPrice || 0);
                  return price >= min && price <= max;
              });
          }
      }

      count = docs.length;
      // if (snapshot.size === 2000) count = 2000; // Indicate potential truncation logic handled by UI if needed


      
      // Get sample items
      items = docs.map(doc => ({
        id: doc.id,
        name: (doc.data().title?.pl || doc.data().title) || (doc.data().name) || doc.id,
        status: doc.data().status || 'unknown',
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date().toISOString(),
      })).slice(0, 10); // Show first 10

      console.log(`[Delete Preview] Found ${count} items in ${collectionName}`);
    } catch (e: any) {
      console.warn(`[Delete Preview] Collection query failed: ${e.message}`);
      count = 0;
    }

    // Generate warnings based on type
    if (type === 'categories' && count > 0) {
      warnings.push('⚠️ Usunięcie kategorii spowoduje kaskaadowe usunięcie wszystkich produktów i okazji w niej!');
    }
    if (type === 'users' && count > 0) {
      warnings.push('⚠️ Usunięcie użytkowników może naruszać GDPR. Rozważ opcję anonimizacji.');
    }
    if (type === 'products' && count > 0) {
      warnings.push(`ℹ️ Usuniesz ${count} produktów - to nie może być cofnięte!`);
    }

    return NextResponse.json({
      success: true,
      type,
      count,
      items,
      estimatedSize: `${(count * 0.5).toFixed(1)} MB`,
      warnings,
    });
  } catch (error: any) {
    console.error('[Delete Preview] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
