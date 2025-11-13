/**
 * Advanced Moderation Service (M2)
 * 
 * Handles moderation queue, AI scoring, bulk operations,
 * and productivity tracking
 */

import { logger } from '@/lib/logging';
import {
  ModerationQueueItem,
  ModerationAIScore,
  ModerationStats,
  ModerationNote,
  Product,
  Deal,
} from '@/lib/types';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { ai } from '@/ai/genkit';

/**
 * Add item to moderation queue
 */
export async function addToModerationQueue(
  itemId: string,
  itemType: 'product' | 'deal',
  source: 'import' | 'manual' | 'ai_flagged',
  submittedBy?: string,
  priority: ModerationQueueItem['priority'] = 'normal'
): Promise<ModerationQueueItem> {
  try {
    const queueRef = doc(collection(db, 'moderationQueue'));
    const now = new Date().toISOString();

    // Generate AI score
    const aiScore = await generateModerationScore(itemId, itemType);

    const queueItem: ModerationQueueItem = {
      id: queueRef.id,
      itemId,
      itemType,
      status: 'pending',
      priority,
      submittedAt: now,
      submittedBy,
      source,
      aiScore,
      flags: aiScore.suspicionFlags || [],
      notes: [],
      tags: [],
    };

    await setDoc(queueRef, {
      ...queueItem,
      submittedAt: Timestamp.fromDate(new Date(queueItem.submittedAt)),
      assignedAt: null,
      reviewedAt: null,
    });

    logger.info('Item added to moderation queue', {
      queueItemId: queueItem.id,
      itemId,
      itemType,
      priority,
    });

    return queueItem;
  } catch (error) {
    logger.error('Failed to add item to moderation queue', { itemId, itemType, error });
    throw error;
  }
}

/**
 * Generate AI moderation score for an item
 */
export async function generateModerationScore(
  itemId: string,
  itemType: 'product' | 'deal'
): Promise<ModerationAIScore> {
  try {
    logger.info('Generating moderation score', { itemId, itemType });

    // Fetch the item
    const itemRef = doc(db, itemType === 'product' ? 'products' : 'deals', itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error(`${itemType} ${itemId} not found`);
    }

    const item = { id: itemSnap.id, ...itemSnap.data() } as Product | Deal;

    // Prepare prompt for AI scoring
    const prompt = `
Analyze this ${itemType} for moderation and provide a quality/safety score.

${itemType === 'product' ? 'Product' : 'Deal'} Details:
- Title: ${itemType === 'product' ? (item as Product).name : (item as Deal).title}
- Description: ${item.description.substring(0, 500)}
- Price: ${itemType === 'product' ? (item as Product).price : (item as Deal).price}
${
  itemType === 'product'
    ? `- Rating: ${(item as Product).ratingCard.average} (${(item as Product).ratingCard.count} reviews)`
    : `- Original Price: ${(item as Deal).originalPrice || 'N/A'}`
}

Evaluate:
1. Content Quality (0-100): Is the description clear and useful?
2. Price Quality (0-100): Is the price reasonable and not suspiciously low/high?
3. Trustworthiness (0-100): Does it seem legitimate?

Check for:
- Offensive or inappropriate content
- Spam keywords (FREE, HOT SALE, etc.)
- Suspiciously high discounts (>90%)
- Poor grammar or machine-generated text
- Duplicate content
- Missing information

Return JSON:
{
  "overallScore": 0-100,
  "contentQuality": 0-100,
  "priceQuality": 0-100,
  "trustworthiness": 0-100,
  "suspicionFlags": ["flag1", "flag2"],
  "recommendation": "approve" | "review" | "reject",
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}
`;

    const result = await ai.generate({
      prompt,
    });

    const score = JSON.parse(result.text);

    const aiScore: ModerationAIScore = {
      overallScore: score.overallScore,
      contentQuality: score.contentQuality,
      priceQuality: score.priceQuality,
      trustworthiness: score.trustworthiness,
      suspicionFlags: score.suspicionFlags || [],
      recommendation: score.recommendation,
      confidence: score.confidence,
      reasoning: score.reasoning,
      generatedAt: new Date().toISOString(),
      modelVersion: 'gemini-2.5-flash-v1',
    };

    logger.info('Moderation score generated', {
      itemId,
      overallScore: aiScore.overallScore,
      recommendation: aiScore.recommendation,
    });

    return aiScore;
  } catch (error) {
    logger.error('Failed to generate moderation score', { itemId, itemType, error });

    // Return fallback score
    return {
      overallScore: 50,
      contentQuality: 50,
      priceQuality: 50,
      trustworthiness: 50,
      suspicionFlags: ['ai_scoring_failed'],
      recommendation: 'review',
      confidence: 0,
      reasoning: 'AI scoring failed, manual review required',
      generatedAt: new Date().toISOString(),
      modelVersion: 'fallback',
    };
  }
}

/**
 * Get moderation queue items with filters
 */
export async function getModerationQueue(filters?: {
  status?: ModerationQueueItem['status'];
  priority?: ModerationQueueItem['priority'];
  itemType?: 'product' | 'deal';
  assignedTo?: string;
  limit?: number;
}): Promise<ModerationQueueItem[]> {
  try {
    let q = query(collection(db, 'moderationQueue'));

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters?.priority) {
      q = query(q, where('priority', '==', filters.priority));
    }

    if (filters?.itemType) {
      q = query(q, where('itemType', '==', filters.itemType));
    }

    if (filters?.assignedTo) {
      q = query(q, where('assignedTo', '==', filters.assignedTo));
    }

    q = query(q, orderBy('priority', 'desc'), orderBy('submittedAt', 'asc'));

    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data.submittedAt.toDate().toISOString(),
        assignedAt: data.assignedAt?.toDate().toISOString(),
        reviewedAt: data.reviewedAt?.toDate().toISOString(),
      } as ModerationQueueItem;
    });
  } catch (error) {
    logger.error('Failed to get moderation queue', { filters, error });
    throw error;
  }
}

/**
 * Assign queue item to moderator
 */
export async function assignToModerator(
  queueItemId: string,
  moderatorId: string
): Promise<void> {
  try {
    const queueRef = doc(db, 'moderationQueue', queueItemId);

    await updateDoc(queueRef, {
      status: 'in_review',
      assignedTo: moderatorId,
      assignedAt: Timestamp.now(),
    });

    logger.info('Queue item assigned to moderator', { queueItemId, moderatorId });
  } catch (error) {
    logger.error('Failed to assign queue item', { queueItemId, moderatorId, error });
    throw error;
  }
}

/**
 * Add note to moderation queue item
 */
export async function addModerationNote(
  queueItemId: string,
  userId: string,
  userDisplayName: string,
  content: string,
  visibility: 'internal' | 'public' = 'internal'
): Promise<void> {
  try {
    const queueRef = doc(db, 'moderationQueue', queueItemId);
    const queueSnap = await getDoc(queueRef);

    if (!queueSnap.exists()) {
      throw new Error(`Queue item ${queueItemId} not found`);
    }

    const queueItem = { id: queueSnap.id, ...queueSnap.data() } as ModerationQueueItem;

    const note: ModerationNote = {
      id: `note_${Date.now()}`,
      userId,
      userDisplayName,
      content,
      createdAt: new Date().toISOString(),
      visibility,
    };

    await updateDoc(queueRef, {
      notes: [...(queueItem.notes || []), note],
    });

    logger.info('Moderation note added', { queueItemId, noteId: note.id });
  } catch (error) {
    logger.error('Failed to add moderation note', { queueItemId, error });
    throw error;
  }
}

/**
 * Approve or reject queue item (single action)
 */
export async function moderateQueueItem(
  queueItemId: string,
  action: 'approve' | 'reject',
  moderatorId: string,
  reason?: string
): Promise<void> {
  try {
    logger.info('Moderating queue item', { queueItemId, action, moderatorId });

    // Get queue item
    const queueRef = doc(db, 'moderationQueue', queueItemId);
    const queueSnap = await getDoc(queueRef);

    if (!queueSnap.exists()) {
      throw new Error(`Queue item ${queueItemId} not found`);
    }

    const queueItem = { id: queueSnap.id, ...queueSnap.data() } as ModerationQueueItem;

    // Update the actual item (product or deal)
    const itemRef = doc(
      db,
      queueItem.itemType === 'product' ? 'products' : 'deals',
      queueItem.itemId
    );

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await updateDoc(itemRef, {
      status: newStatus,
      'moderation.reviewedAt': Timestamp.now(),
      'moderation.reviewerUid': moderatorId,
      ...(action === 'reject' && reason ? { 'moderation.rejectionReason': reason } : {}),
    });

    // Update queue item
    await updateDoc(queueRef, {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: Timestamp.now(),
      reviewedBy: moderatorId,
    });

    logger.info('Queue item moderated', {
      queueItemId,
      itemId: queueItem.itemId,
      action,
    });
  } catch (error) {
    logger.error('Failed to moderate queue item', { queueItemId, action, error });
    throw error;
  }
}

/**
 * Bulk approve/reject queue items
 */
export async function bulkModerateQueueItems(
  queueItemIds: string[],
  action: 'approve' | 'reject',
  moderatorId: string,
  reason?: string
): Promise<{ succeeded: string[]; failed: string[] }> {
  try {
    logger.info('Bulk moderating queue items', {
      count: queueItemIds.length,
      action,
      moderatorId,
    });

    const succeeded: string[] = [];
    const failed: string[] = [];

    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    for (let i = 0; i < queueItemIds.length; i += batchSize) {
      const batchIds = queueItemIds.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const queueItemId of batchIds) {
        try {
          // Get queue item
          const queueRef = doc(db, 'moderationQueue', queueItemId);
          const queueSnap = await getDoc(queueRef);

          if (!queueSnap.exists()) {
            failed.push(queueItemId);
            continue;
          }

          const queueItem = { id: queueSnap.id, ...queueSnap.data() } as ModerationQueueItem;

          // Update the actual item
          const itemRef = doc(
            db,
            queueItem.itemType === 'product' ? 'products' : 'deals',
            queueItem.itemId
          );

          const newStatus = action === 'approve' ? 'approved' : 'rejected';

          batch.update(itemRef, {
            status: newStatus,
            'moderation.reviewedAt': Timestamp.now(),
            'moderation.reviewerUid': moderatorId,
            ...(action === 'reject' && reason ? { 'moderation.rejectionReason': reason } : {}),
          });

          // Update queue item
          batch.update(queueRef, {
            status: action === 'approve' ? 'approved' : 'rejected',
            reviewedAt: Timestamp.now(),
            reviewedBy: moderatorId,
          });

          succeeded.push(queueItemId);
        } catch (error) {
          logger.error('Failed to process queue item in batch', { queueItemId, error });
          failed.push(queueItemId);
        }
      }

      // Commit batch
      await batch.commit();
    }

    logger.info('Bulk moderation completed', {
      total: queueItemIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return { succeeded, failed };
  } catch (error) {
    logger.error('Bulk moderation failed', { error });
    throw error;
  }
}

/**
 * Calculate moderation statistics for a user
 */
export async function calculateModerationStats(
  userId: string,
  period: 'day' | 'week' | 'month' | 'all_time'
): Promise<ModerationStats> {
  try {
    logger.info('Calculating moderation stats', { userId, period });

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }

    // Query reviewed items
    const q = query(
      collection(db, 'moderationQueue'),
      where('reviewedBy', '==', userId),
      where('reviewedAt', '>=', Timestamp.fromDate(startDate))
    );

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ModerationQueueItem[];

    // Calculate statistics
    const totalReviewed = items.length;
    const totalApproved = items.filter(item => item.status === 'approved').length;
    const totalRejected = items.filter(item => item.status === 'rejected').length;

    // Calculate average review time
    let totalReviewTimeMs = 0;
    for (const item of items) {
      if (item.submittedAt && item.reviewedAt) {
        const submitted = new Date(item.submittedAt).getTime();
        const reviewed = new Date(item.reviewedAt).getTime();
        totalReviewTimeMs += reviewed - submitted;
      }
    }
    const averageReviewTimeMs = totalReviewed > 0 ? totalReviewTimeMs / totalReviewed : 0;

    // Calculate productivity score (items per hour)
    const periodHours = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const productivityScore = totalReviewed / periodHours;

    const stats: ModerationStats = {
      userId,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalReviewed,
      totalApproved,
      totalRejected,
      averageReviewTimeMs,
      productivityScore,
      generatedAt: now.toISOString(),
    };

    logger.info('Moderation stats calculated', {
      userId,
      totalReviewed,
      productivityScore,
    });

    return stats;
  } catch (error) {
    logger.error('Failed to calculate moderation stats', { userId, period, error });
    throw error;
  }
}
