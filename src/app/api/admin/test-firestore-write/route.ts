import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const testDoc = {
      title: { pl: 'TEST – zapis Firestore', en: 'TEST – Firestore write' },
      price: { amount: 1, currency: 'PLN', shippingCost: 0, totalPrice: 1, lastUpdated: new Date().toISOString() },
      image: 'https://example.com/test.png',
      mainCategorySlug: 'test',
      status: 'approved',
      metadata: { source: 'admin-test' },
      createdAt: new Date().toISOString(),
    };

    const ref = await adminDb.collection('products').add(testDoc as any);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e), code: e?.code }, { status: 500 });
  }
}
