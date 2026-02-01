import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit') || 20);
    const categoryId = searchParams.get('categoryId') || undefined;
    const limitCount = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 20;

    let queryRef = adminDb.collection('forum_threads');
    let snap;

    try {
      if (categoryId) {
        snap = await queryRef
          .where('categoryId', '==', categoryId)
          .orderBy('isPinned', 'desc')
          .orderBy('lastPostAt', 'desc')
          .limit(limitCount)
          .get();
      } else {
        snap = await queryRef
          .orderBy('isPinned', 'desc')
          .orderBy('lastPostAt', 'desc')
          .limit(limitCount)
          .get();
      }
    } catch (error) {
      if (categoryId) {
        snap = await queryRef
          .where('categoryId', '==', categoryId)
          .orderBy('createdAt', 'desc')
          .limit(limitCount)
          .get();
      } else {
        snap = await queryRef
          .orderBy('createdAt', 'desc')
          .limit(limitCount)
          .get();
      }
    }

    const threads = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }))
      .map((thread) => ({
        ...thread,
        createdAt: normalizeTimestamp(thread.createdAt),
        updatedAt: normalizeTimestamp(thread.updatedAt),
        lastPostAt: normalizeTimestamp(thread.lastPostAt),
      }))
      .filter((t) => !t.status || t.status === 'approved')
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });

    return NextResponse.json({ success: true, threads });
  } catch (error: any) {
    console.error('[Forum Threads API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się pobrać wątków' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const categoryId = body?.categoryId || null;
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!title || !content) {
      return NextResponse.json({ error: 'Brak tytułu lub treści' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const threadData: Record<string, any> = {
      title,
      authorUid: decoded.uid,
      authorDisplayName: body?.authorDisplayName || decoded.name || null,
      categoryId,
      tags: [],
      summary: content.slice(0, 200),
      postsCount: 1,
      createdAt: now,
      updatedAt: now,
      lastPostAt: now,
    };

    if (attachments.length > 0) {
      threadData.attachments = attachments;
    }

    const threadRef = await adminDb.collection('forum_threads').add(threadData);

    const postData: Record<string, any> = {
      threadId: threadRef.id,
      authorUid: decoded.uid,
      authorDisplayName: body?.authorDisplayName || decoded.name || null,
      content,
      parentId: null,
      upvotes: 0,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (attachments.length > 0) {
      postData.attachments = attachments;
    }

    await threadRef.collection('posts').add(postData);

    return NextResponse.json({ success: true, threadId: threadRef.id });
  } catch (error: any) {
    console.error('[Forum Threads API] Create error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się utworzyć wątku' },
      { status: 500 }
    );
  }
}
