import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  setDoc,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  UserPoints,
  PointTransaction,
  Badge,
  UserBadge,
  ReputationLevel,
  Leaderboard,
  LeaderboardEntry,
  UserActivity,
  Report,
} from '@/lib/types';

/**
 * Point values for different actions
 */
export const POINT_VALUES = {
  DEAL_SUBMITTED: 10,
  DEAL_APPROVED: 20,
  PRODUCT_REVIEW: 15,
  COMMENT_POSTED: 5,
  VOTE_CAST: 1,
  REPORT_VERIFIED: 25,
  REPORT_SPAM: -10,
  BADGE_EARNED: 50,
  DAILY_LOGIN: 5,
  FIRST_DEAL: 50,
  HELPFUL_REVIEW: 10,
} as const;

/**
 * Reputation levels
 */
export const REPUTATION_LEVELS: ReputationLevel[] = [
  {
    level: 1,
    name: 'Nowicjusz',
    minPoints: 0,
    maxPoints: 99,
    icon: '🌱',
    color: '#94a3b8',
    perks: ['Podstawowe funkcje'],
  },
  {
    level: 2,
    name: 'Entuzjasta',
    minPoints: 100,
    maxPoints: 499,
    icon: '⭐',
    color: '#60a5fa',
    perks: ['Priorytet w moderacji', 'Wyróżnione komentarze'],
  },
  {
    level: 3,
    name: 'Ekspert',
    minPoints: 500,
    maxPoints: 1999,
    icon: '💎',
    color: '#8b5cf6',
    perks: ['Badge ekspert', 'Szybsza moderacja', 'Priorytet w wynikach'],
  },
  {
    level: 4,
    name: 'Mistrz',
    minPoints: 2000,
    maxPoints: 4999,
    icon: '👑',
    color: '#f59e0b',
    perks: ['Własne badge', 'Beta features', 'VIP support'],
  },
  {
    level: 5,
    name: 'Legenda',
    minPoints: 5000,
    icon: '🏆',
    color: '#eab308',
    perks: ['Wszystkie funkcje', 'Specjalna oznaka', 'Direct support', 'Możliwość tworzenia eventów'],
  },
];

/**
 * Award points to a user for an action
 */
export async function awardPoints(
  userId: string,
  points: number,
  action: string,
  reason: string,
  options?: {
    relatedItemId?: string;
    relatedItemType?: 'deal' | 'product' | 'comment' | 'review';
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const userPointsRef = doc(db, 'user_points', userId);
    const userPointsDoc = await transaction.get(userPointsRef);

    let currentPoints: UserPoints;
    if (userPointsDoc.exists()) {
      currentPoints = { userId, ...userPointsDoc.data() } as UserPoints;
    } else {
      currentPoints = {
        userId,
        totalPoints: 0,
        currentLevel: 1,
        pointsToNextLevel: 100,
        lifetimePoints: 0,
        lastUpdated: new Date().toISOString(),
        breakdown: {
          dealSubmissions: 0,
          productReviews: 0,
          comments: 0,
          votes: 0,
          reports: 0,
          moderationActions: 0,
        },
      };
    }

    // Update points
    const newTotal = currentPoints.totalPoints + points;
    const newLifetime = currentPoints.lifetimePoints + Math.max(0, points);

    // Update breakdown based on action
    const breakdown = { ...currentPoints.breakdown };
    if (action.includes('deal')) breakdown.dealSubmissions += 1;
    else if (action.includes('review')) breakdown.productReviews += 1;
    else if (action.includes('comment')) breakdown.comments += 1;
    else if (action.includes('vote')) breakdown.votes += 1;
    else if (action.includes('report')) breakdown.reports += 1;

    // Determine new level
    const newLevel = REPUTATION_LEVELS.find(
      (level) => newTotal >= level.minPoints && (!level.maxPoints || newTotal <= level.maxPoints)
    );

    const updatedPoints: UserPoints = {
      ...currentPoints,
      totalPoints: newTotal,
      lifetimePoints: newLifetime,
      currentLevel: newLevel?.level || currentPoints.currentLevel,
      pointsToNextLevel: newLevel?.maxPoints ? newLevel.maxPoints - newTotal + 1 : 0,
      lastUpdated: new Date().toISOString(),
      breakdown,
    };

    transaction.set(userPointsRef, updatedPoints);

    // Create transaction record
    const transactionData: Omit<PointTransaction, 'id'> = {
      userId,
      amount: points,
      type: points > 0 ? 'earn' : 'penalty',
      action,
      reason,
      relatedItemId: options?.relatedItemId,
      relatedItemType: options?.relatedItemType,
      timestamp: new Date().toISOString(),
      metadata: options?.metadata,
    };

    const transactionRef = doc(collection(db, 'point_transactions'));
    transaction.set(transactionRef, transactionData);

    // Check for level up
    if (newLevel && newLevel.level > currentPoints.currentLevel) {
      await recordActivity(userId, 'level_up', `Awans na poziom ${newLevel.name}!`, {
        relatedItemType: 'badge',
        points: 0,
        metadata: { level: newLevel.level, levelName: newLevel.name },
      });
    }
  });
}

/**
 * Gets user points and stats
 */
export async function getUserPoints(userId: string): Promise<UserPoints | null> {
  const userPointsRef = doc(db, 'user_points', userId);
  const userPointsDoc = await getDoc(userPointsRef);

  if (!userPointsDoc.exists()) {
    return null;
  }

  return { userId, ...userPointsDoc.data() } as UserPoints;
}

/**
 * Gets user's point transaction history
 */
export async function getUserPointTransactions(
  userId: string,
  limitCount: number = 50
): Promise<PointTransaction[]> {
  const transactionsRef = collection(db, 'point_transactions');
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PointTransaction));
}

/**
 * Gets user's current reputation level
 */
export function getUserReputationLevel(points: number): ReputationLevel {
  return (
    REPUTATION_LEVELS.find((level) => points >= level.minPoints && (!level.maxPoints || points <= level.maxPoints)) ||
    REPUTATION_LEVELS[0]
  );
}

/**
 * Awards a badge to a user
 */
export async function awardBadge(
  userId: string,
  badgeId: string,
  options?: {
    progress?: number;
    level?: number;
  }
): Promise<string> {
  // Check if user already has this badge
  const userBadgesRef = collection(db, 'user_badges');
  const existingQuery = query(userBadgesRef, where('userId', '==', userId), where('badgeId', '==', badgeId));
  const existingBadges = await getDocs(existingQuery);

  if (!existingBadges.empty) {
    // Update existing badge
    const badgeDocRef = doc(db, 'user_badges', existingBadges.docs[0].id);
    await updateDoc(badgeDocRef, {
      progress: options?.progress,
      level: options?.level,
    });
    return existingBadges.docs[0].id;
  }

  // Create new badge
  const userBadge: Omit<UserBadge, 'id'> = {
    userId,
    badgeId,
    earnedAt: new Date().toISOString(),
    progress: options?.progress,
    level: options?.level,
    displayOnProfile: true,
  };

  const docRef = await addDoc(userBadgesRef, userBadge);

  // Get badge details for points
  const badgeDoc = await getDoc(doc(db, 'badges', badgeId));
  if (badgeDoc.exists()) {
    const badge = badgeDoc.data() as Badge;
    await awardPoints(userId, badge.points, 'badge_earned', `Zdobyto badge: ${badge.name}`, {
      relatedItemType: 'badge' as any,
      relatedItemId: badgeId,
    });
  }

  // Record activity
  await recordActivity(userId, 'badge_earned', `Zdobyto nową odznakę!`, {
    relatedItemId: badgeId,
    relatedItemType: 'badge' as any,
  });

  return docRef.id;
}

/**
 * Gets user's badges
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const userBadgesRef = collection(db, 'user_badges');
  const q = query(userBadgesRef, where('userId', '==', userId), orderBy('earnedAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserBadge));
}

/**
 * Gets all available badges
 */
export async function getAllBadges(): Promise<Badge[]> {
  const badgesRef = collection(db, 'badges');
  const q = query(badgesRef, orderBy('sortOrder', 'asc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Badge));
}

/**
 * Records a user activity
 */
export async function recordActivity(
  userId: string,
  activityType: UserActivity['activityType'],
  description: string,
  options?: {
    points?: number;
    relatedItemId?: string;
    relatedItemType?: 'deal' | 'product' | 'comment' | 'review' | 'badge';
    visibility?: 'public' | 'private';
    metadata?: Record<string, any>;
  }
): Promise<string> {
  const activity: Omit<UserActivity, 'id'> = {
    userId,
    activityType,
    description,
    points: options?.points,
    relatedItemId: options?.relatedItemId,
    relatedItemType: options?.relatedItemType,
    timestamp: new Date().toISOString(),
    visibility: options?.visibility || 'public',
    metadata: options?.metadata,
  };

  const docRef = await addDoc(collection(db, 'user_activities'), activity);
  return docRef.id;
}

/**
 * Gets user's activity history
 */
export async function getUserActivities(
  userId: string,
  limitCount: number = 50,
  includePrivate: boolean = false
): Promise<UserActivity[]> {
  const activitiesRef = collection(db, 'user_activities');
  let q = query(activitiesRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));

  if (!includePrivate) {
    q = query(
      activitiesRef,
      where('userId', '==', userId),
      where('visibility', '==', 'public'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserActivity));
}

/**
 * Creates a leaderboard
 */
export async function generateLeaderboard(
  type: 'weekly' | 'monthly' | 'all_time' | 'category',
  options?: {
    category?: string;
    periodStart?: string;
    periodEnd?: string;
    topN?: number;
  }
): Promise<Leaderboard> {
  const topN = options?.topN || 100;
  const userPointsRef = collection(db, 'user_points');
  const q = query(userPointsRef, orderBy('totalPoints', 'desc'), limit(topN));

  const snapshot = await getDocs(q);
  const entries: LeaderboardEntry[] = [];

  let rank = 1;
  for (const docSnap of snapshot.docs) {
    const userPoints = docSnap.data() as UserPoints;
    const userId = docSnap.id;

    // Get user details (simplified - you'd fetch from users collection)
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();

    // Get user badges (top 3)
    const userBadges = await getUserBadges(userId);
    const topBadgeIds = userBadges.slice(0, 3).map((b) => b.badgeId);

    entries.push({
      rank,
      userId,
      displayName: userData?.displayName || 'Użytkownik',
      photoURL: userData?.photoURL,
      points: userPoints.totalPoints,
      contributionCount:
        userPoints.breakdown.dealSubmissions +
        userPoints.breakdown.productReviews +
        userPoints.breakdown.comments,
      badges: topBadgeIds,
    });

    rank++;
  }

  const leaderboard: Leaderboard = {
    id: `${type}_${Date.now()}`,
    type,
    category: options?.category,
    entries,
    periodStart: options?.periodStart || new Date().toISOString(),
    periodEnd: options?.periodEnd,
    lastUpdated: new Date().toISOString(),
  };

  // Save leaderboard
  await setDoc(doc(db, 'leaderboards', leaderboard.id), leaderboard);

  return leaderboard;
}

/**
 * Gets current leaderboard
 */
export async function getLeaderboard(type: 'weekly' | 'monthly' | 'all_time'): Promise<Leaderboard | null> {
  const leaderboardsRef = collection(db, 'leaderboards');
  const q = query(leaderboardsRef, where('type', '==', type), orderBy('lastUpdated', 'desc'), limit(1));

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Leaderboard;
}

/**
 * Creates a report
 */
export async function createReport(
  reportedBy: string,
  itemId: string,
  itemType: 'deal' | 'product' | 'comment' | 'review' | 'user',
  reportType: Report['reportType'],
  description: string
): Promise<string> {
  const report: Omit<Report, 'id'> = {
    reportedBy,
    itemId,
    itemType,
    reportType,
    description,
    status: 'pending',
    priority: reportType === 'spam' || reportType === 'offensive' ? 'high' : 'medium',
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, 'reports'), report);

  // Award points for reporting
  await awardPoints(reportedBy, POINT_VALUES.VOTE_CAST, 'report_submitted', 'Zgłoszono problem', {
    relatedItemId: itemId,
    relatedItemType: itemType as any,
  });

  return docRef.id;
}

/**
 * Resolves a report
 */
export async function resolveReport(
  reportId: string,
  reviewedBy: string,
  resolution: string,
  wasHelpful: boolean
): Promise<void> {
  const reportRef = doc(db, 'reports', reportId);
  const reportDoc = await getDoc(reportRef);

  if (!reportDoc.exists()) {
    throw new Error('Report not found');
  }

  const report = reportDoc.data() as Report;

  await updateDoc(reportRef, {
    status: 'resolved',
    reviewedAt: new Date().toISOString(),
    reviewedBy,
    resolution,
    pointsAwarded: wasHelpful ? POINT_VALUES.REPORT_VERIFIED : 0,
  });

  // Award bonus points if report was helpful
  if (wasHelpful) {
    await awardPoints(
      report.reportedBy,
      POINT_VALUES.REPORT_VERIFIED,
      'report_verified',
      'Zgłoszenie zweryfikowane jako trafne',
      {
        relatedItemId: reportId,
      }
    );
  }
}

/**
 * Gets pending reports
 */
export async function getPendingReports(limitCount: number = 50): Promise<Report[]> {
  const reportsRef = collection(db, 'reports');
  const q = query(reportsRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(limitCount));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Report));
}
