import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * GET /api/forum/threads/[id]/stats
 * Get stats for a thread (saved count, etc)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const threadId = params.id;

    // Count saves for this thread
    const favoritesRef = collection(db, 'forum_favorites');
    const q = query(
      favoritesRef,
      where('threadId', '==', threadId),
      where('type', '==', 'thread')
    );

    const snap = await getDocs(q);
    const savedCount = snap.size;

    return NextResponse.json({ savedCount, threadId });
  } catch (error: any) {
    console.error('Thread stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
