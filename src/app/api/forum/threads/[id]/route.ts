import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const normalizeTimestamp = (value: any) => {
  if (!value) return value;
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value?._seconds === 'number') {
    return new Date(value._seconds * 1000).toISOString();
  }
  return value;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: threadId } = await params;
    const docSnap = await adminDb.collection('forum_threads').doc(threadId).get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Wątek nie istnieje' }, { status: 404 });
    }

    const data = docSnap.data() as Record<string, any>;
    const thread = {
      id: docSnap.id,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastPostAt: data.lastPostAt,
      status: data.status,
      ...data,
    };

    thread.createdAt = normalizeTimestamp(thread.createdAt);
    thread.updatedAt = normalizeTimestamp(thread.updatedAt);
    thread.lastPostAt = normalizeTimestamp(thread.lastPostAt);

    if (thread.status && thread.status !== 'approved') {
      return NextResponse.json({ success: false, error: 'Wątek niedostępny' }, { status: 404 });
    }

    return NextResponse.json({ success: true, thread });
  } catch (error: any) {
    console.error('[Forum Thread API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się pobrać wątku' },
      { status: 500 }
    );
  }
}
