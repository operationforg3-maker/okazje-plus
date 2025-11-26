import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, writeBatch, Timestamp } from 'firebase/firestore';

/**
 * Bulk moderation endpoint
 * Body: { items: Array<{ id: string; type: 'deal' | 'product' }>, action: 'approve' | 'reject' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, action } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Brak elementów do przetworzenia' }, { status: 400 });
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowa akcja' }, { status: 400 });
    }

    const batch = writeBatch(db);
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const ts = Timestamp.now();

    for (const item of items) {
      if (!item?.id || !['deal', 'product'].includes(item.type)) continue;
      const col = item.type === 'deal' ? 'deals' : 'products';
      batch.update(doc(db, col, item.id), { status: newStatus, updatedAt: ts });
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: `Zmieniono status ${items.length} elementów na ${newStatus}` });
  } catch (e: any) {
    console.error('[bulk moderation] error', e);
    return NextResponse.json({ success: false, message: 'Błąd przetwarzania' }, { status: 500 });
  }
}
