/**
 * User Segmentation Engine (M5)
 * 
 * Classifies users into behavioral segments based on their interactions
 * and generates behavioral scores for personalization
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  UserSegment,
  UserBehaviorScore,
  UserInteraction,
  Deal,
  Product,
} from '@/lib/types';
import { getUserInteractions } from '@/lib/personalization';
import { logger } from '@/lib/logging';

/**
 * Calculate user behavior scores based on their interactions
 */
export async function calculateUserBehaviorScores(userId: string): Promise<UserBehaviorScore> {
  try {
    logger.info('Calculating behavior scores', { userId });

    // Get user's recent interactions (last 100)
    const interactions = await getUserInteractions(userId, 100);

    if (interactions.length === 0) {
      // Return default scores for new users
      return {
        userId,
        scores: {
          pricesensitivity: 50,
          brandLoyalty: 50,
          qualityFocus: 50,
          speedPriority: 50,
          engagementLevel: 0,
          conversionPotential: 50,
        },
        basedOnInteractions: 0,
        calculatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Collect price points from clicked items
    const pricePoints: number[] = [];
    const categories = new Map<string, number>();
    const merchantsInteracted = new Set<string>();
    
    let clickCount = 0;
    let viewCount = 0;
    let voteCount = 0;
    let commentCount = 0;
    let shareCount = 0;

    // Analyze interactions
    for (const interaction of interactions) {
      // Count interaction types
      switch (interaction.interactionType) {
        case 'click':
          clickCount++;
          break;
        case 'view':
          viewCount++;
          break;
        case 'vote':
          voteCount++;
          break;
        case 'comment':
          commentCount++;
          break;
        case 'share':
          shareCount++;
          break;
      }

      // Track category preferences
      if (interaction.metadata?.categorySlug) {
        const count = categories.get(interaction.metadata.categorySlug) || 0;
        categories.set(interaction.metadata.categorySlug, count + 1);
      }

      // Fetch item details to get price and other metadata
      try {
        if (interaction.itemType === 'deal') {
          const dealRef = doc(db, 'deals', interaction.itemId);
          const dealSnap = await getDoc(dealRef);
          if (dealSnap.exists()) {
            const deal = { id: dealSnap.id, ...dealSnap.data() } as Deal;
            if (deal.price) {
              pricePoints.push(deal.price);
            }
            if (deal.merchant) {
              merchantsInteracted.add(deal.merchant);
            }
          }
        } else if (interaction.itemType === 'product') {
          const productRef = doc(db, 'products', interaction.itemId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const product = { id: productSnap.id, ...productSnap.data() } as Product;
            if (product.price) {
              pricePoints.push(product.price);
            }
          }
        }
      } catch (error) {
        logger.debug('Failed to fetch item details', { error, itemId: interaction.itemId });
      }
    }

    // Calculate scores (0-100)

    // 1. Price Sensitivity (lower prices = higher score)
    const avgPrice = pricePoints.length > 0
      ? pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length
      : 0;
    const priceSensitivity = avgPrice === 0 ? 50 : Math.max(0, Math.min(100, 100 - (avgPrice / 10)));

    // 2. Brand Loyalty (consistent merchants = higher score)
    const brandLoyalty = merchantsInteracted.size === 0
      ? 50
      : Math.min(100, (1 / merchantsInteracted.size) * 100);

    // 3. Quality Focus (high engagement with products = higher score)
    const productInteractions = interactions.filter(i => i.itemType === 'product').length;
    const qualityFocus = interactions.length === 0
      ? 50
      : Math.min(100, (productInteractions / interactions.length) * 120);

    // 4. Speed Priority (would need shipping data - placeholder)
    const speedPriority = 50; // Would calculate from shipping preferences

    // 5. Engagement Level (total interactions normalized)
    const engagementLevel = Math.min(100, (
      (viewCount * 1) +
      (clickCount * 3) +
      (voteCount * 2) +
      (commentCount * 4) +
      (shareCount * 5)
    ) / 2);

    // 6. Conversion Potential (click-through rate)
    const conversionPotential = viewCount === 0
      ? 50
      : Math.min(100, (clickCount / viewCount) * 200);

    const scores: UserBehaviorScore = {
      userId,
      scores: {
        pricesensitivity: Math.round(priceSensitivity),
        brandLoyalty: Math.round(brandLoyalty),
        qualityFocus: Math.round(qualityFocus),
        speedPriority: Math.round(speedPriority),
        engagementLevel: Math.round(engagementLevel),
        conversionPotential: Math.round(conversionPotential),
      },
      basedOnInteractions: interactions.length,
      calculatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore
    await setDoc(doc(db, 'user_behavior_scores', userId), scores);

    logger.info('Behavior scores calculated', { userId, scores: scores.scores });
    return scores;
  } catch (error) {
    logger.error('Failed to calculate behavior scores', { userId, error });
    throw error;
  }
}

/**
 * Classify user into primary segment based on behavior scores
 */
export async function classifyUserSegment(userId: string): Promise<UserSegment> {
  try {
    logger.info('Classifying user segment', { userId });

    // Get or calculate behavior scores
    let scores: UserBehaviorScore;
    const scoresRef = doc(db, 'user_behavior_scores', userId);
    const scoresSnap = await getDoc(scoresRef);

    if (scoresSnap.exists()) {
      scores = { userId, ...scoresSnap.data() } as UserBehaviorScore;
    } else {
      scores = await calculateUserBehaviorScores(userId);
    }

    // Determine primary segment based on highest score
    const scoreEntries = Object.entries(scores.scores) as Array<[string, number]>;
    const topScores = scoreEntries.sort((a, b) => b[1] - a[1]);

    let segmentType: UserSegment['segmentType'];
    let confidence: number;

    // Map scores to segment types
    if (topScores[0][0] === 'pricesensitivity' && topScores[0][1] >= 70) {
      segmentType = 'price_sensitive';
      confidence = topScores[0][1] / 100;
    } else if (topScores[0][0] === 'speedPriority' && topScores[0][1] >= 70) {
      segmentType = 'fast_delivery';
      confidence = topScores[0][1] / 100;
    } else if (topScores[0][0] === 'brandLoyalty' && topScores[0][1] >= 70) {
      segmentType = 'brand_lover';
      confidence = topScores[0][1] / 100;
    } else if (topScores[0][0] === 'qualityFocus' && topScores[0][1] >= 70) {
      segmentType = 'quality_seeker';
      confidence = topScores[0][1] / 100;
    } else if (scores.scores.engagementLevel >= 75 && scores.scores.conversionPotential >= 75) {
      segmentType = 'deal_hunter';
      confidence = (scores.scores.engagementLevel + scores.scores.conversionPotential) / 200;
    } else if (scores.scores.conversionPotential >= 80) {
      segmentType = 'impulse_buyer';
      confidence = scores.scores.conversionPotential / 100;
    } else {
      // Default segment
      segmentType = 'deal_hunter';
      confidence = 0.5;
    }

    // Get activity level
    const activityLevel: 'low' | 'medium' | 'high' =
      scores.scores.engagementLevel < 30 ? 'low' :
      scores.scores.engagementLevel < 70 ? 'medium' : 'high';

    // Get category preferences
    const interactions = await getUserInteractions(userId, 50);
    const categoryMap = new Map<string, number>();
    interactions.forEach(i => {
      if (i.metadata?.categorySlug) {
        const count = categoryMap.get(i.metadata.categorySlug) || 0;
        categoryMap.set(i.metadata.categorySlug, count + 1);
      }
    });

    const topCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug]) => slug);

    // Calculate average price point
    const pricePoints: number[] = [];
    for (const interaction of interactions.slice(0, 20)) {
      try {
        if (interaction.itemType === 'deal') {
          const dealRef = doc(db, 'deals', interaction.itemId);
          const dealSnap = await getDoc(dealRef);
          if (dealSnap.exists()) {
            const deal = dealSnap.data() as Deal;
            if (deal.price) pricePoints.push(deal.price);
          }
        } else if (interaction.itemType === 'product') {
          const productRef = doc(db, 'products', interaction.itemId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const product = productSnap.data() as Product;
            if (product.price) pricePoints.push(product.price);
          }
        }
      } catch (error) {
        // Ignore errors in price fetching
      }
    }

    const avgPricePoint = pricePoints.length > 0
      ? pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length
      : undefined;

    // Check for existing segment to maintain version
    const segmentRef = doc(db, 'user_segments', userId);
    const existingSnap = await getDoc(segmentRef);
    const version = existingSnap.exists() ? ((existingSnap.data().version || 0) + 1) : 1;

    const segment: UserSegment = {
      id: userId,
      userId,
      segmentType,
      confidence,
      characteristics: {
        avgPricePoint,
        categoryPreferences: topCategories,
        dealPreferences: segmentType === 'price_sensitive' ? ['discount', 'coupon'] :
                         segmentType === 'fast_delivery' ? ['free_shipping', 'fast_delivery'] :
                         segmentType === 'brand_lover' ? ['brand'] :
                         segmentType === 'quality_seeker' ? ['quality', 'rating'] :
                         ['discount', 'trending'],
        activityLevel,
        conversionRate: scores.scores.conversionPotential / 100,
      },
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version,
    };

    // Save segment
    await setDoc(segmentRef, segment);

    logger.info('User segment classified', {
      userId,
      segmentType,
      confidence,
      version,
    });

    return segment;
  } catch (error) {
    logger.error('Failed to classify user segment', { userId, error });
    throw error;
  }
}

/**
 * Get user segment (fetch or classify)
 */
export async function getUserSegment(userId: string, forceRecalculate = false): Promise<UserSegment> {
  try {
    if (!forceRecalculate) {
      const segmentRef = doc(db, 'user_segments', userId);
      const segmentSnap = await getDoc(segmentRef);

      if (segmentSnap.exists()) {
        const segment = { id: segmentSnap.id, ...segmentSnap.data() } as UserSegment;
        
        // Check if segment is recent (less than 7 days old)
        const updatedAt = new Date(segment.updatedAt);
        const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 7) {
          logger.debug('Using cached segment', { userId, daysSinceUpdate });
          return segment;
        }
        
        logger.info('Segment is stale, recalculating', { userId, daysSinceUpdate });
      }
    }

    // Calculate new segment
    return await classifyUserSegment(userId);
  } catch (error) {
    logger.error('Failed to get user segment', { userId, error });
    throw error;
  }
}

/**
 * Get all users in a specific segment
 */
export async function getUsersBySegment(
  segmentType: UserSegment['segmentType'],
  limitCount: number = 100
): Promise<UserSegment[]> {
  try {
    const segmentsRef = collection(db, 'user_segments');
    const q = query(
      segmentsRef,
      where('segmentType', '==', segmentType),
      orderBy('confidence', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserSegment));
  } catch (error) {
    logger.error('Failed to get users by segment', { segmentType, error });
    throw error;
  }
}

/**
 * Get segment distribution statistics
 */
export async function getSegmentDistribution(): Promise<Record<UserSegment['segmentType'], number>> {
  try {
    const segmentsRef = collection(db, 'user_segments');
    const snapshot = await getDocs(segmentsRef);

    const distribution: Record<string, number> = {
      price_sensitive: 0,
      fast_delivery: 0,
      brand_lover: 0,
      deal_hunter: 0,
      quality_seeker: 0,
      impulse_buyer: 0,
    };

    snapshot.docs.forEach(doc => {
      const segment = doc.data() as UserSegment;
      if (segment.segmentType) {
        distribution[segment.segmentType] = (distribution[segment.segmentType] || 0) + 1;
      }
    });

    return distribution as Record<UserSegment['segmentType'], number>;
  } catch (error) {
    logger.error('Failed to get segment distribution', { error });
    throw error;
  }
}
