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

// ============================================
// M5: Enhanced AI Scoring & Feed Generation
// ============================================

import { UserSegment, PersonalizedFeedConfig } from '@/lib/types';
import { getUserSegment, calculateUserBehaviorScores } from '@/lib/segmentation';
import { getUserEmbedding, calculateUserItemSimilarity } from '@/lib/embeddings';

/**
 * Calculate AI-powered relevance score for a deal/product for a specific user
 */
export async function calculateAIRelevanceScore(
  userId: string,
  item: Deal | Product,
  itemType: 'deal' | 'product'
): Promise<{ score: number; reason: string; confidence: number }> {
  try {
    let score = 0;
    let confidence = 0.5;
    const reasons: string[] = [];

    // Get user segment
    const segment = await getUserSegment(userId);
    
    // 1. Category matching (30% weight)
    const prefs = await getUserPreferences(userId);
    const categoryMatch = prefs.favoriteCategories.includes(item.mainCategorySlug);
    if (categoryMatch) {
      score += 30;
      reasons.push('Kategoria dopasowana do Twoich preferencji');
      confidence += 0.2;
    }

    // 2. Price alignment (25% weight)
    const behaviorScores = await calculateUserBehaviorScores(userId);
    if (behaviorScores.scores.pricesensitivity > 70 && item.price < 100) {
      score += 25;
      reasons.push('Cena odpowiednia dla Ciebie');
      confidence += 0.15;
    } else if (behaviorScores.scores.qualityFocus > 70 && item.price > 200) {
      score += 25;
      reasons.push('Produkt premium dla wymagających');
      confidence += 0.15;
    }

    // 3. Segment-specific scoring (25% weight)
    if (segment.segmentType === 'deal_hunter') {
      // Boost high-temperature deals
      if (itemType === 'deal' && (item as Deal).temperature > 50) {
        score += 25;
        reasons.push('Gorąca okazja dla łowców okazji');
        confidence += 0.2;
      }
    } else if (segment.segmentType === 'price_sensitive') {
      // Boost high discount items
      const discountPercent = item.originalPrice
        ? ((item.originalPrice - item.price) / item.originalPrice) * 100
        : 0;
      if (discountPercent > 30) {
        score += 25;
        reasons.push(`Wysoka zniżka: ${Math.round(discountPercent)}%`);
        confidence += 0.2;
      }
    } else if (segment.segmentType === 'quality_seeker') {
      // Boost high-rated products
      if (itemType === 'product') {
        const product = item as Product;
        if (product.ratingCard?.average > 4.5) {
          score += 25;
          reasons.push('Wysoko oceniany produkt');
          confidence += 0.2;
        }
      }
    }

    // 4. Trending/popularity (10% weight)
    if (itemType === 'deal' && (item as Deal).temperature > 70) {
      score += 10;
      reasons.push('Popularne w społeczności');
      confidence += 0.05;
    }

    // 5. Recency (10% weight)
    const itemDate = new Date(item.postedAt || item.createdAt || Date.now());
    const daysSincePosted = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePosted < 1) {
      score += 10;
      reasons.push('Nowa okazja');
      confidence += 0.1;
    }

    // Normalize score to 0-1
    const normalizedScore = Math.min(1, score / 100);
    const finalConfidence = Math.min(1, confidence);

    return {
      score: normalizedScore,
      reason: reasons.join(', ') || 'Rekomendacja dla Ciebie',
      confidence: finalConfidence,
    };
  } catch (error) {
    // Fallback to basic scoring
    return {
      score: 0.5,
      reason: 'Polecane',
      confidence: 0.3,
    };
  }
}

/**
 * Generate enhanced personalized feed with AI scoring
 */
export async function generateEnhancedFeedRecommendations(
  userId: string,
  count: number = 20
): Promise<FeedRecommendation[]> {
  try {
    const recommendations: FeedRecommendation[] = [];
    
    // Get user preferences and segment
    const prefs = await getUserPreferences(userId);
    const segment = await getUserSegment(userId);
    
    // Get personalized feed config if exists
    const configRef = doc(db, 'personalized_feed_configs', userId);
    const configSnap = await getDoc(configRef);
    const feedConfig = configSnap.exists()
      ? ({ userId, ...configSnap.data() } as PersonalizedFeedConfig)
      : null;

    // Determine content type mix
    const showDeals = feedConfig?.contentTypes.showDeals ?? true;
    const showProducts = feedConfig?.contentTypes.showProducts ?? true;
    const dealRatio = feedConfig?.contentTypes.dealToProductRatio ?? 0.7;

    const dealsNeeded = Math.ceil(count * dealRatio);
    const productsNeeded = count - dealsNeeded;

    // Get candidate deals
    if (showDeals && dealsNeeded > 0) {
      const dealsRef = collection(db, 'deals');
      let dealsQuery = query(
        dealsRef,
        where('status', '==', 'approved'),
        orderBy('temperature', 'desc'),
        limit(dealsNeeded * 2) // Get more for filtering
      );

      // Apply category filters
      if (feedConfig?.boostCategories && feedConfig.boostCategories.length > 0) {
        // Would need composite index or client-side filtering
      }

      const dealsSnapshot = await getDocs(dealsQuery);
      
      for (const docSnap of dealsSnapshot.docs) {
        const deal = { id: docSnap.id, ...docSnap.data() } as Deal;
        
        // Apply filters
        if (feedConfig?.priceRangeFilter) {
          if (feedConfig.priceRangeFilter.min && deal.price < feedConfig.priceRangeFilter.min) {
            continue;
          }
          if (feedConfig.priceRangeFilter.max && deal.price > feedConfig.priceRangeFilter.max) {
            continue;
          }
        }

        if (feedConfig?.suppressCategories?.includes(deal.mainCategorySlug)) {
          continue;
        }

        // Calculate AI score
        const scoring = await calculateAIRelevanceScore(userId, deal, 'deal');
        
        recommendations.push({
          id: `rec_${docSnap.id}_${Date.now()}`,
          userId,
          itemId: docSnap.id,
          itemType: 'deal',
          score: scoring.score,
          reason: scoring.reason,
          algorithm: 'hybrid',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          shown: false,
          clicked: false,
          metadata: {
            confidence: scoring.confidence,
            matchingCategories: prefs.favoriteCategories.includes(deal.mainCategorySlug)
              ? [deal.mainCategorySlug]
              : [],
          },
        });

        if (recommendations.filter(r => r.itemType === 'deal').length >= dealsNeeded) {
          break;
        }
      }
    }

    // Get candidate products
    if (showProducts && productsNeeded > 0) {
      const productsRef = collection(db, 'products');
      let productsQuery = query(
        productsRef,
        where('status', '==', 'approved'),
        limit(productsNeeded * 2)
      );

      const productsSnapshot = await getDocs(productsQuery);
      
      for (const docSnap of productsSnapshot.docs) {
        const product = { id: docSnap.id, ...docSnap.data() } as Product;
        
        // Apply filters
        if (feedConfig?.priceRangeFilter) {
          if (feedConfig.priceRangeFilter.min && product.price < feedConfig.priceRangeFilter.min) {
            continue;
          }
          if (feedConfig.priceRangeFilter.max && product.price > feedConfig.priceRangeFilter.max) {
            continue;
          }
        }

        if (feedConfig?.suppressCategories?.includes(product.mainCategorySlug)) {
          continue;
        }

        // Calculate AI score
        const scoring = await calculateAIRelevanceScore(userId, product, 'product');
        
        recommendations.push({
          id: `rec_${docSnap.id}_${Date.now()}`,
          userId,
          itemId: docSnap.id,
          itemType: 'product',
          score: scoring.score,
          reason: scoring.reason,
          algorithm: 'hybrid',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          shown: false,
          clicked: false,
          metadata: {
            confidence: scoring.confidence,
            matchingCategories: prefs.favoriteCategories.includes(product.mainCategorySlug)
              ? [product.mainCategorySlug]
              : [],
          },
        });

        if (recommendations.filter(r => r.itemType === 'product').length >= productsNeeded) {
          break;
        }
      }
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    // Save top recommendations
    for (const rec of recommendations.slice(0, count)) {
      await addDoc(collection(db, 'feed_recommendations'), rec);
    }

    return recommendations.slice(0, count);
  } catch (error) {
    console.error('Failed to generate enhanced feed recommendations:', error);
    // Fallback to basic recommendations
    return generateFeedRecommendations(userId, count);
  }
}

/**
 * Get or create personalized feed configuration
 */
export async function getPersonalizedFeedConfig(userId: string): Promise<PersonalizedFeedConfig> {
  const configRef = doc(db, 'personalized_feed_configs', userId);
  const configSnap = await getDoc(configRef);

  if (configSnap.exists()) {
    return { userId, ...configSnap.data() } as PersonalizedFeedConfig;
  }

  // Create default config
  const defaultConfig: PersonalizedFeedConfig = {
    userId,
    enabled: true,
    boostCategories: [],
    suppressCategories: [],
    merchantFilters: {
      preferred: [],
      excluded: [],
    },
    contentTypes: {
      showDeals: true,
      showProducts: true,
      dealToProductRatio: 0.7,
    },
    freshness: 'all',
    updatedAt: new Date().toISOString(),
  };

  await setDoc(configRef, defaultConfig);
  return defaultConfig;
}

/**
 * Update personalized feed configuration
 */
export async function updatePersonalizedFeedConfig(
  userId: string,
  updates: Partial<PersonalizedFeedConfig>
): Promise<void> {
  const configRef = doc(db, 'personalized_feed_configs', userId);
  await updateDoc(configRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}
