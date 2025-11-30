import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { purgeEmptyDeals, purgeEmptyProducts } from '@/lib/data-admin';

type CollectionTarget = 'deals' | 'products';

async function assertAdmin(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    throw new Error('UNAUTHENTICATED');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const decoded = await adminAuth.verifyIdToken(token).catch(() => {
    throw new Error('UNAUTHENTICATED');
  });

  if ((decoded as any)?.admin) {
    return decoded.uid;
  }

  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  const role = userDoc.data()?.role;
  if (role === 'admin') {
    return decoded.uid;
  }

  throw new Error('FORBIDDEN');
}

export async function POST(request: NextRequest) {
  try {
    const adminUid = await assertAdmin(request);
    const body = await request.json().catch(() => ({}));
    const collections: CollectionTarget[] = Array.isArray(body?.collections)
      ? body.collections.filter((c: string) => c === 'deals' || c === 'products')
      : ['deals', 'products'];

    if (collections.length === 0) {
      return NextResponse.json(
        { error: 'invalid_collections', message: 'Musisz wskazać kolekcje do czyszczenia.' },
        { status: 400 }
      );
    }

    const results: Record<string, { deleted: number; checked: number; skipped: number; }> = {};

    if (collections.includes('deals')) {
      results.deals = await purgeEmptyDeals();
    }
    if (collections.includes('products')) {
      results.products = await purgeEmptyProducts();
    }

    return NextResponse.json({
      success: true,
      performedBy: adminUid,
      results,
    });
  } catch (error) {
    const code = (error as Error)?.message;
    if (code === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (code === 'FORBIDDEN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    console.error('purge-empty failed:', error);
    return NextResponse.json({ error: 'cleanup_failed', message: String(error) }, { status: 500 });
  }
}
