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

    const { type, filters = {} } = await req.json();

    if (!type || !['products', 'deals', 'categories', 'users', 'orphaned'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type: ' + type },
        { status: 400 }
      );
    }

    console.log(`[Delete Preview] Type: ${type}, Filters:`, filters);

    let count = 0;
    let items: any[] = [];
    const warnings: string[] = [];

    try {
      // Count matching documents
      const snapshot = await adminDb.collection(type).limit(100).get();
      count = snapshot.size;
      items = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().title || doc.data().name || doc.id,
        status: doc.data().status || 'unknown',
        createdAt: doc.data().createdAt || new Date().toISOString(),
      })).slice(0, 10); // Show first 10

      console.log(`[Delete Preview] Found ${count} ${type} to delete`);
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
