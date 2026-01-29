'use server';

import { getServerAuthSession } from '@/lib/auth-server';
import { PostAttachment } from '@/lib/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Server action to create forum thread with user authentication
 * Uses Firebase Admin SDK to bypass client-side Firestore permission issues
 */
export async function createForumThreadServerAction(params: {
  title: string;
  content: string;
  categoryId?: string;
  attachments?: PostAttachment[];
}): Promise<string> {
  // Verify auth on server side
  const session = await getServerAuthSession();
  if (!session?.uid) {
    throw new Error('Unauthorized - user not authenticated');
  }

  try {
    const now = new Date();
    
    // Create thread document using Admin SDK
    const threadData: Record<string, any> = {
      title: params.title,
      authorUid: session.uid,
      authorDisplayName: session.email || null,
      categoryId: params.categoryId ?? null,
      tags: [],
      summary: params.content.slice(0, 200),
      postsCount: 1,
      createdAt: now,
      updatedAt: now,
      lastPostAt: now,
      status: 'approved',
    };

    // Add attachments only if they exist
    if (params.attachments && params.attachments.length > 0) {
      threadData.attachments = params.attachments;
    }

    const threadRef = await adminDb.collection('forum_threads').add(threadData);

    // Create first post in subcollection
    const post: Record<string, any> = {
      threadId: threadRef.id,
      authorUid: session.uid,
      authorDisplayName: session.email || null,
      content: params.content,
      parentId: null,
      upvotes: 0,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
      status: 'approved',
    };

    // Add attachments to post if they exist
    if (params.attachments && params.attachments.length > 0) {
      post.attachments = params.attachments;
    }

    await adminDb.collection('forum_threads').doc(threadRef.id).collection('posts').add(post);

    return threadRef.id;
  } catch (error) {
    console.error('[createForumThreadServerAction] Error:', error);
    throw new Error(`Failed to create forum thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
