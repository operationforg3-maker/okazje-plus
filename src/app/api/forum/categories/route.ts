import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const snap = await adminDb
      .collection('forum_categories')
      .orderBy('sortOrder', 'asc')
      .get();

    const categories = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
    }));

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error('[Forum Categories API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się pobrać kategorii' },
      { status: 500 }
    );
  }
}
