import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, query, where, getDocs, doc, Timestamp } from 'firebase/firestore';

/**
 * GET /api/forum/favorites
 * Get all favorited threads/posts for current user
 */
export async function GET(req: NextRequest) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'thread' or 'post'

    const favoritesRef = collection(db, 'forum_favorites');
    let q = query(favoritesRef, where('userId', '==', user.uid));
    
    if (type === 'thread' || type === 'post') {
      q = query(q, where('type', '==', type));
    }

    const snap = await getDocs(q);
    const favorites = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ favorites });
  } catch (error: any) {
    console.error('Forum favorites GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/forum/favorites
 * Add thread or post to favorites
 * Body: { threadId?: string, postId?: string, type: 'thread' | 'post' }
 */
export async function POST(req: NextRequest) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { threadId, postId, type } = body;

    if (!type || !['thread', 'post'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (type === 'thread' && !threadId) {
      return NextResponse.json({ error: 'threadId required for type=thread' }, { status: 400 });
    }

    if (type === 'post' && !postId) {
      return NextResponse.json({ error: 'postId required for type=post' }, { status: 400 });
    }

    // Check if already favorited
    const favoritesRef = collection(db, 'forum_favorites');
    let q;
    
    if (type === 'thread') {
      q = query(
        favoritesRef,
        where('userId', '==', user.uid),
        where('threadId', '==', threadId),
        where('type', '==', 'thread')
      );
    } else {
      q = query(
        favoritesRef,
        where('userId', '==', user.uid),
        where('postId', '==', postId),
        where('type', '==', 'post')
      );
    }

    const existing = await getDocs(q);
    if (!existing.empty) {
      return NextResponse.json({ error: 'Already favorited' }, { status: 409 });
    }

    // Add favorite
    const favoriteData = {
      userId: user.uid,
      type,
      threadId: type === 'thread' ? threadId : null,
      postId: type === 'post' ? postId : null,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(favoritesRef, favoriteData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      ...favoriteData,
    });
  } catch (error: any) {
    console.error('Forum favorites POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/forum/favorites
 * Remove thread or post from favorites
 * Body: { favoriteId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { favoriteId } = body;

    if (!favoriteId) {
      return NextResponse.json({ error: 'favoriteId required' }, { status: 400 });
    }

    // Verify ownership
    const favRef = doc(db, 'forum_favorites', favoriteId);
    const favSnap = await favRef.get() as any;
    
    if (!favSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const favData = favSnap.data() as any;
    if (favData.userId !== user.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteDoc(favRef);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Forum favorites DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
