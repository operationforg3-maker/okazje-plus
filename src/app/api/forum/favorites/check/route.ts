import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * GET /api/forum/favorites/check?threadId=X or /api/forum/favorites/check?postId=X
 * Check if current user has favorited a thread or post
 */
export async function GET(req: NextRequest) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json({ isFavorited: false });
    }

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    const postId = searchParams.get('postId');

    if (!threadId && !postId) {
      return NextResponse.json({ error: 'threadId or postId required' }, { status: 400 });
    }

    const favoritesRef = collection(db, 'forum_favorites');
    let q;

    if (threadId) {
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

    const snap = await getDocs(q);
    const isFavorited = !snap.empty;
    const favoriteId = isFavorited ? snap.docs[0].id : null;

    return NextResponse.json({ isFavorited, favoriteId });
  } catch (error: any) {
    console.error('Forum favorites check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
