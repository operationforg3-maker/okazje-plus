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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  UserPreferences,
  UserInteraction,
  UserEmbedding,
  FeedRecommendation,
  ABTestVariant,
  ABTestAssignment,
  Deal,
  Product,
} from '@/lib/types';

/**
 * Gets or creates user preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const prefsRef = doc(db, 'user_preferences', userId);
  const prefsDoc = await getDoc(prefsRef);

  if (prefsDoc.exists()) {
    return { userId, ...prefsDoc.data() } as UserPreferences;
  }

  // Create default preferences
  const defaultPrefs: UserPreferences = {
    userId,
    favoriteCategories: [],
    subscribedTopics: [],
    notificationSettings: {
      priceAlerts: true,
      newDealsInCategories: true,
      reviewResponses: true,
      badgesAndAchievements: true,
      weeklyDigest: true,
    },
    feedPreferences: {
      showPersonalized: true,
      includeFollowedUsers: false,
      sortBy: 'trending',
    },
    updatedAt: new Date().toISOString(),
  };

  await setDoc(prefsRef, defaultPrefs);
  return defaultPrefs;
}

/**
 * Updates user preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<void> {
  const prefsRef = doc(db, 'user_preferences', userId);
  await updateDoc(prefsRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Adds a favorite category for a user
 */
export async function addFavoriteCategory(userId: string, categorySlug: string): Promise<void> {
  const prefs = await getUserPreferences(userId);
  if (!prefs.favoriteCategories.includes(categorySlug)) {
    prefs.favoriteCategories.push(categorySlug);
    await updateUserPreferences(userId, { favoriteCategories: prefs.favoriteCategories });
  }
}

/**
 * Removes a favorite category for a user
 */
export async function removeFavoriteCategory(userId: string, categorySlug: string): Promise<void> {
  const prefs = await getUserPreferences(userId);
  const updated = prefs.favoriteCategories.filter((cat) => cat !== categorySlug);
  await updateUserPreferences(userId, { favoriteCategories: updated });
}

/**
 * Records a user interaction with an item
 */
export async function recordUserInteraction(
  userId: string,
  itemId: string,
  itemType: 'deal' | 'product',
  interactionType: 'view' | 'click' | 'favorite' | 'vote' | 'comment' | 'share',
  metadata?: {
    duration?: number;
    source?: string;
    position?: number;
    categorySlug?: string;
  }
): Promise<string> {
  const interaction: Omit<UserInteraction, 'id'> = {
    userId,
    itemId,
    itemType,
    interactionType,
    timestamp: new Date().toISOString(),
    duration: metadata?.duration,
    metadata: {
      source: metadata?.source,
      position: metadata?.position,
      categorySlug: metadata?.categorySlug,
    },
  };

  const docRef = await addDoc(collection(db, 'user_interactions'), interaction);
  return docRef.id;
}

/**
 * Gets user interactions
 */
export async function getUserInteractions(
  userId: string,
  limitCount: number = 100
): Promise<UserInteraction[]> {
  const interactionsRef = collection(db, 'user_interactions');
  const q = query(
    interactionsRef,
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserInteraction));
}

/**
 * Generates personalized feed recommendations for a user
 */
export async function generateFeedRecommendations(
  userId: string,
  count: number = 20
): Promise<FeedRecommendation[]> {
  // Get user preferences and interactions
  const prefs = await getUserPreferences(userId);
  const interactions = await getUserInteractions(userId, 50);

  // Simple content-based recommendation (can be enhanced with embeddings)
  const recommendations: FeedRecommendation[] = [];

  // Get deals from favorite categories
  if (prefs.favoriteCategories.length > 0) {
    for (const categorySlug of prefs.favoriteCategories) {
      const dealsRef = collection(db, 'deals');
      const q = query(
        dealsRef,
        where('mainCategorySlug', '==', categorySlug),
        where('status', '==', 'approved'),
        orderBy('temperature', 'desc'),
        limit(5)
      );

      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        const deal = { id: docSnap.id, ...docSnap.data() } as Deal;
        recommendations.push({
          id: `rec_${docSnap.id}_${Date.now()}`,
          userId,
          itemId: docSnap.id,
          itemType: 'deal',
          score: 0.8,
          reason: `Z Twojej ulubionej kategorii: ${categorySlug}`,
          algorithm: 'content',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
          shown: false,
          clicked: false,
          metadata: {
            matchingCategories: [categorySlug],
            confidence: 0.8,
          },
        });
      }
    }
  }

  // Get trending deals (fallback)
  if (recommendations.length < count) {
    const dealsRef = collection(db, 'deals');
    const q = query(
      dealsRef,
      where('status', '==', 'approved'),
      orderBy('temperature', 'desc'),
      limit(count - recommendations.length)
    );

    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      recommendations.push({
        id: `rec_${docSnap.id}_${Date.now()}`,
        userId,
        itemId: docSnap.id,
        itemType: 'deal',
        score: 0.6,
        reason: 'Popularne w tej chwili',
        algorithm: 'trending',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        shown: false,
        clicked: false,
      });
    }
  }

  // Save recommendations
  for (const rec of recommendations.slice(0, count)) {
    await addDoc(collection(db, 'feed_recommendations'), rec);
  }

  return recommendations.slice(0, count);
}

/**
 * Gets feed recommendations for a user
 */
export async function getFeedRecommendations(userId: string): Promise<FeedRecommendation[]> {
  const now = new Date().toISOString();
  const recsRef = collection(db, 'feed_recommendations');
  const q = query(
    recsRef,
    where('userId', '==', userId),
    where('expiresAt', '>', now),
    where('shown', '==', false),
    orderBy('expiresAt', 'asc'),
    orderBy('score', 'desc'),
    limit(20)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FeedRecommendation));
}

/**
 * Marks a recommendation as shown
 */
export async function markRecommendationShown(recommendationId: string): Promise<void> {
  const recRef = doc(db, 'feed_recommendations', recommendationId);
  await updateDoc(recRef, { shown: true });
}

/**
 * Marks a recommendation as clicked
 */
export async function markRecommendationClicked(recommendationId: string): Promise<void> {
  const recRef = doc(db, 'feed_recommendations', recommendationId);
  await updateDoc(recRef, { clicked: true });
}

/**
 * Gets user's A/B test assignment
 */
export async function getABTestAssignment(
  userId: string,
  testName: string
): Promise<ABTestAssignment | null> {
  const assignmentsRef = collection(db, 'ab_test_assignments');
  const q = query(assignmentsRef, where('userId', '==', userId), where('testName', '==', testName), limit(1));

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return { userId, ...snapshot.docs[0].data() } as ABTestAssignment;
}

/**
 * Assigns user to an A/B test variant
 */
export async function assignUserToABTest(userId: string, testName: string): Promise<ABTestAssignment> {
  // Check if already assigned
  const existing = await getABTestAssignment(userId, testName);
  if (existing) {
    return existing;
  }

  // Get active variants for this test
  const variantsRef = collection(db, 'ab_test_variants');
  const q = query(
    variantsRef,
    where('testName', '==', testName),
    where('enabled', '==', true)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`No active variants for test: ${testName}`);
  }

  const variants = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ABTestVariant));

  // Weighted random selection based on traffic percentage
  const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  const random = Math.random() * totalTraffic;
  let accumulated = 0;
  let selectedVariant: ABTestVariant | null = null;

  for (const variant of variants) {
    accumulated += variant.trafficPercentage;
    if (random <= accumulated) {
      selectedVariant = variant;
      break;
    }
  }

  if (!selectedVariant) {
    selectedVariant = variants[0]; // Fallback to first variant
  }

  // Create assignment
  const assignment: ABTestAssignment = {
    userId,
    testName,
    variantId: selectedVariant.id,
    assignedAt: new Date().toISOString(),
    sticky: true,
  };

  await setDoc(doc(db, 'ab_test_assignments', `${userId}_${testName}`), assignment);
  return assignment;
}

/**
 * Gets A/B test variant configuration
 */
export async function getABTestVariant(variantId: string): Promise<ABTestVariant | null> {
  const variantRef = doc(db, 'ab_test_variants', variantId);
  const variantDoc = await getDoc(variantRef);

  if (!variantDoc.exists()) {
    return null;
  }

  return { id: variantDoc.id, ...variantDoc.data() } as ABTestVariant;
}

/**
 * Helper function to get personalized feed items
 */
export async function getPersonalizedFeed(
  userId: string,
  options?: {
    includeRecommendations?: boolean;
    count?: number;
  }
): Promise<Array<Deal | Product>> {
  const count = options?.count || 20;
  const items: Array<Deal | Product> = [];

  if (options?.includeRecommendations !== false) {
    // Get fresh recommendations if needed
    let recommendations = await getFeedRecommendations(userId);
    if (recommendations.length < 5) {
      recommendations = await generateFeedRecommendations(userId, count);
    }

    // Fetch actual items based on recommendations
    for (const rec of recommendations.slice(0, count)) {
      if (rec.itemType === 'deal') {
        const dealRef = doc(db, 'deals', rec.itemId);
        const dealDoc = await getDoc(dealRef);
        if (dealDoc.exists()) {
          items.push({ id: dealDoc.id, ...dealDoc.data() } as Deal);
        }
      } else if (rec.itemType === 'product') {
        const productRef = doc(db, 'products', rec.itemId);
        const productDoc = await getDoc(productRef);
        if (productDoc.exists()) {
          items.push({ id: productDoc.id, ...productDoc.data() } as Product);
        }
      }
    }
  }

  // Fill with trending items if needed
  if (items.length < count) {
    const dealsRef = collection(db, 'deals');
    const q = query(
      dealsRef,
      where('status', '==', 'approved'),
      orderBy('temperature', 'desc'),
      limit(count - items.length)
    );

    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      items.push({ id: docSnap.id, ...docSnap.data() } as Deal);
    }
  }

  return items;
}

/**
 * Calculates similarity between two items based on category overlap
 * Simple version - can be enhanced with embeddings
 */
export function calculateItemSimilarity(
  item1: { mainCategorySlug?: string; subCategorySlug?: string },
  item2: { mainCategorySlug?: string; subCategorySlug?: string }
): number {
  let similarity = 0;

  if (item1.mainCategorySlug === item2.mainCategorySlug) {
    similarity += 0.5;
  }

  if (item1.subCategorySlug === item2.subCategorySlug) {
    similarity += 0.5;
  }

  return similarity;
}
