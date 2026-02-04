/**
 * User Statistics Cloud Functions
 * Automatically updates user.stats when votes, comments, likes are created/deleted
 * Ensures profile statistics are always accurate and scalable
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ============================================================================
// VOTES: Track when user votes on deals
// ============================================================================

/**
 * Increment voteCount on user.stats when vote is created
 */
export const onVoteCreated = functions.firestore
  .document('deals/{dealId}/votes/{voteId}')
  .onCreate(async (snap, context) => {
    const vote = snap.data();
    const userId = vote.userId;
    const dealId = context.params.dealId;

    if (!userId) {
      console.log('[onVoteCreated] No userId in vote document');
      return;
    }

    try {
      // Update user stats and deal voteCount in parallel
      await Promise.all([
        // Increment user's voteCount
        db.collection('users').doc(userId).update({
          'stats.voteCount': FieldValue.increment(1),
          'stats.lastUpdated': FieldValue.serverTimestamp(),
        } as any),
        
        // Increment deal's voteCount
        db.collection('deals').doc(dealId).update({
          voteCount: FieldValue.increment(1),
        } as any),
      ]);

      console.log(`[onVoteCreated] Updated stats for user ${userId}, deal ${dealId}`);
    } catch (error) {
      console.error('[onVoteCreated] Error:', error);
      throw error;
    }
  });

/**
 * Decrement voteCount on user.stats when vote is deleted
 */
export const onVoteDeleted = functions.firestore
  .document('deals/{dealId}/votes/{voteId}')
  .onDelete(async (snap, context) => {
    const vote = snap.data();
    const userId = vote.userId;
    const dealId = context.params.dealId;

    if (!userId) {
      console.log('[onVoteDeleted] No userId in vote document');
      return;
    }

    try {
      // Update user stats and deal voteCount in parallel
      await Promise.all([
        // Decrement user's voteCount
        db.collection('users').doc(userId).update({
          'stats.voteCount': FieldValue.increment(-1),
          'stats.lastUpdated': FieldValue.serverTimestamp(),
        } as any),

        // Decrement deal's voteCount
        db.collection('deals').doc(dealId).update({
          voteCount: FieldValue.increment(-1),
        } as any),
      ]);

      console.log(`[onVoteDeleted] Updated stats for user ${userId}, deal ${dealId}`);
    } catch (error) {
      console.error('[onVoteDeleted] Error:', error);
      throw error;
    }
  });

// ============================================================================
// COMMENTS: Track when user posts comments on deals/products
// ============================================================================

/**
 * Increment commentCount on user.stats when comment is created
 */
export const onCommentCreated = functions.firestore
  .document('{parentCollection}/{parentId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const comment = snap.data();
    const userId = comment.userId;
    const parentId = context.params.parentId;
    const parentCollection = context.params.parentCollection;

    if (!userId) {
      console.log('[onCommentCreated] No userId in comment document');
      return;
    }

    try {
      // Update user stats and parent item's commentCount in parallel
      await Promise.all([
        // Increment user's commentCount
        db.collection('users').doc(userId).update({
          'stats.commentCount': FieldValue.increment(1),
          'stats.lastUpdated': FieldValue.serverTimestamp(),
        } as any),

        // Increment parent item's commentCount (deal or product)
        db.collection(parentCollection).doc(parentId).update({
          commentCount: FieldValue.increment(1),
        } as any),
      ]);

      console.log(`[onCommentCreated] Updated stats for user ${userId}, ${parentCollection}/${parentId}`);
    } catch (error) {
      console.error('[onCommentCreated] Error:', error);
      throw error;
    }
  });

/**
 * Decrement commentCount on user.stats when comment is deleted
 */
export const onCommentDeleted = functions.firestore
  .document('{parentCollection}/{parentId}/comments/{commentId}')
  .onDelete(async (snap, context) => {
    const comment = snap.data();
    const userId = comment.userId;
    const parentId = context.params.parentId;
    const parentCollection = context.params.parentCollection;

    if (!userId) {
      console.log('[onCommentDeleted] No userId in comment document');
      return;
    }

    try {
      // Update user stats and parent item's commentCount in parallel
      await Promise.all([
        // Decrement user's commentCount
        db.collection('users').doc(userId).update({
          'stats.commentCount': FieldValue.increment(-1),
          'stats.lastUpdated': FieldValue.serverTimestamp(),
        } as any),

        // Decrement parent item's commentCount
        db.collection(parentCollection).doc(parentId).update({
          commentCount: FieldValue.increment(-1),
        } as any),
      ]);

      console.log(`[onCommentDeleted] Updated stats for user ${userId}, ${parentCollection}/${parentId}`);
    } catch (error) {
      console.error('[onCommentDeleted] Error:', error);
      throw error;
    }
  });

// ============================================================================
// COMMENT LIKES: Track when users like comments
// ============================================================================

/**
 * Increment likeCount on comment when like is created
 * Also increment totalLikesReceived for the comment's author
 */
export const onCommentLikeCreated = functions.firestore
  .document('{parentCollection}/{parentId}/comments/{commentId}/likes/{likeId}')
  .onCreate(async (snap, context) => {
    const like = snap.data();
    const likerUserId = like.userId;
    const commentId = context.params.commentId;
    const parentId = context.params.parentId;
    const parentCollection = context.params.parentCollection;

    if (!likerUserId) {
      console.log('[onCommentLikeCreated] No userId in like document');
      return;
    }

    try {
      // Get the comment to find its author
      const commentDoc = await db
        .collection(parentCollection)
        .doc(parentId)
        .collection('comments')
        .doc(commentId)
        .get();

      if (!commentDoc.exists) {
        console.log('[onCommentLikeCreated] Comment not found');
        return;
      }

      const comment = commentDoc.data();
      const commentAuthorId = comment?.userId;

      // Update in parallel
      await Promise.all([
        // Increment comment's likeCount
        commentDoc.ref.update({
          likeCount: FieldValue.increment(1),
        }),

        // Increment comment author's totalLikesReceived
        commentAuthorId
          ? db.collection('users').doc(commentAuthorId).update({
              'stats.totalLikesReceived': FieldValue.increment(1),
              'stats.lastUpdated': FieldValue.serverTimestamp(),
            } as any)
          : Promise.resolve(),
      ]);

      console.log(
        `[onCommentLikeCreated] Liked comment ${commentId} by author ${commentAuthorId}`
      );
    } catch (error) {
      console.error('[onCommentLikeCreated] Error:', error);
      throw error;
    }
  });

/**
 * Decrement likeCount on comment when like is deleted
 */
export const onCommentLikeDeleted = functions.firestore
  .document('{parentCollection}/{parentId}/comments/{commentId}/likes/{likeId}')
  .onDelete(async (snap, context) => {
    const commentId = context.params.commentId;
    const parentId = context.params.parentId;
    const parentCollection = context.params.parentCollection;

    try {
      // Get the comment to find its author
      const commentDoc = await db
        .collection(parentCollection)
        .doc(parentId)
        .collection('comments')
        .doc(commentId)
        .get();

      if (!commentDoc.exists) {
        console.log('[onCommentLikeDeleted] Comment not found');
        return;
      }

      const comment = commentDoc.data();
      const commentAuthorId = comment?.userId;

      // Update in parallel
      await Promise.all([
        // Decrement comment's likeCount
        commentDoc.ref.update({
          likeCount: FieldValue.increment(-1),
        }),

        // Decrement comment author's totalLikesReceived
        commentAuthorId
          ? db.collection('users').doc(commentAuthorId).update({
              'stats.totalLikesReceived': FieldValue.increment(-1),
              'stats.lastUpdated': FieldValue.serverTimestamp(),
            } as any)
          : Promise.resolve(),
      ]);

      console.log(`[onCommentLikeDeleted] Unliked comment ${commentId}`);
    } catch (error) {
      console.error('[onCommentLikeDeleted] Error:', error);
      throw error;
    }
  });

// ============================================================================
// FORUM: Track forum posts and replies
// ============================================================================

/**
 * Increment forumPostCount when forum post is created
 */
export const onForumPostCreated = functions.firestore
  .document('forum_threads/{threadId}/posts/{postId}')
  .onCreate(async (snap, context) => {
    const post = snap.data();
    const userId = post.authorId;

    if (!userId) {
      console.log('[onForumPostCreated] No authorId in post');
      return;
    }

    try {
      await db.collection('users').doc(userId).update({
        'stats.forumReplyCount': FieldValue.increment(1),
        'stats.lastUpdated': FieldValue.serverTimestamp(),
      } as any);

      console.log(`[onForumPostCreated] Updated stats for user ${userId}`);
    } catch (error) {
      console.error('[onForumPostCreated] Error:', error);
      throw error;
    }
  });

/**
 * Decrement forumPostCount when forum post is deleted
 */
export const onForumPostDeleted = functions.firestore
  .document('forum_threads/{threadId}/posts/{postId}')
  .onDelete(async (snap, context) => {
    const post = snap.data();
    const userId = post.authorId;

    if (!userId) {
      console.log('[onForumPostDeleted] No authorId in post');
      return;
    }

    try {
      await db.collection('users').doc(userId).update({
        'stats.forumReplyCount': FieldValue.increment(-1),
        'stats.lastUpdated': FieldValue.serverTimestamp(),
      } as any);

      console.log(`[onForumPostDeleted] Updated stats for user ${userId}`);
    } catch (error) {
      console.error('[onForumPostDeleted] Error:', error);
      throw error;
    }
  });
