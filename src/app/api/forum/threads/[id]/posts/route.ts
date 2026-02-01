import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const threadId = context.params.id;
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit') || 100);
    const limitCount = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100;

    const snap = await adminDb
      .collection('forum_threads')
      .doc(threadId)
      .collection('posts')
      .orderBy('createdAt', 'asc')
      .limit(limitCount)
      .get();

    const posts = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }))
      .map((post) => ({
        ...post,
        createdAt: normalizeTimestamp(post.createdAt),
        updatedAt: normalizeTimestamp(post.updatedAt),
      }))
      .filter((p) => !p.status || p.status === 'approved');

    return NextResponse.json({ success: true, posts });
  } catch (error: any) {
    console.error('[Forum Posts API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się pobrać postów' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const threadId = context.params.id;
    const body = await req.json();
    const content = String(body?.content || '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!content) {
      return NextResponse.json({ error: 'Treść jest wymagana' }, { status: 400 });
    }

    const threadRef = adminDb.collection('forum_threads').doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return NextResponse.json({ error: 'Wątek nie istnieje' }, { status: 404 });
    }

    const threadData = threadSnap.data();
    if (threadData?.isLocked) {
      return NextResponse.json({ error: 'Wątek jest zablokowany' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const postData: Record<string, any> = {
      threadId,
      authorUid: decoded.uid,
      authorDisplayName: body?.authorDisplayName || decoded.name || null,
      content,
      parentId: body?.parentId || null,
      upvotes: 0,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (attachments.length > 0) {
      postData.attachments = attachments;
    }

    const postRef = await threadRef.collection('posts').add(postData);

    await threadRef.update({
      postsCount: FieldValue.increment(1),
      lastPostAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, postId: postRef.id });
  } catch (error: any) {
    console.error('[Forum Posts API] Create error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się dodać postu' },
      { status: 500 }
    );
  }
}
