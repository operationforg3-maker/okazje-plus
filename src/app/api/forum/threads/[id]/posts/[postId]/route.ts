import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function getPost(threadId: string, postId: string) {
  const postRef = adminDb.collection('forum_threads').doc(threadId).collection('posts').doc(postId);
  const postSnap = await postRef.get();
  return { postRef, postSnap };
}

export async function PATCH(req: NextRequest, context: { params: { id: string; postId: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const threadId = context.params.id;
    const postId = context.params.postId;
    const body = await req.json();
    const content = String(body?.content || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'Treść jest wymagana' }, { status: 400 });
    }

    const { postRef, postSnap } = await getPost(threadId, postId);
    if (!postSnap.exists) {
      return NextResponse.json({ error: 'Post nie istnieje' }, { status: 404 });
    }

    const postData = postSnap.data();
    const isAuthor = postData?.authorUid === decoded.uid;
    const isAdmin = decoded.admin === true || decoded.moderator === true;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
    }

    await postRef.update({
      content,
      isEdited: true,
      editedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Forum Post Edit API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się zaktualizować posta' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: { id: string; postId: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const threadId = context.params.id;
    const postId = context.params.postId;

    const { postRef, postSnap } = await getPost(threadId, postId);
    if (!postSnap.exists) {
      return NextResponse.json({ error: 'Post nie istnieje' }, { status: 404 });
    }

    const postData = postSnap.data();
    const isAuthor = postData?.authorUid === decoded.uid;
    const isAdmin = decoded.admin === true || decoded.moderator === true;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
    }

    await postRef.update({
      status: 'deleted',
      deletedBy: decoded.uid,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Forum Post Delete API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się usunąć posta' },
      { status: 500 }
    );
  }
}
