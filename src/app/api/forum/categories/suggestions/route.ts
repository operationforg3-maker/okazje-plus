import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();

    if (!name || !description) {
      return NextResponse.json({ error: 'Brak wymaganych pól' }, { status: 400 });
    }

    const payload = {
      name,
      description,
      suggestedByUid: decoded.uid,
      suggestedByName: body?.suggestedByName || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const ref = await adminDb.collection('forum_category_suggestions').add(payload);

    return NextResponse.json({ success: true, suggestionId: ref.id });
  } catch (error: any) {
    console.error('[Forum Category Suggestion API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się wysłać propozycji' },
      { status: 500 }
    );
  }
}
