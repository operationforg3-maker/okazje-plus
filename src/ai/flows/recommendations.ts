/**
 * AI-Powered Recommendations Flow
 * Analyzes user behavior to suggest personalized deals/products
 */

import { ai } from '../genkit';
import { z } from 'zod';
import { getDealById, getProductById, getFavoriteDeals, getFavoriteProducts } from '@/lib/data';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Get recommendations based on user activity
 */
export const recommendDealsFlow = ai.defineFlow(
  {
    name: 'recommendDeals',
    inputSchema: z.object({
      userId: z.string().describe('User ID to generate recommendations for'),
      favoriteCategories: z.array(z.string()).optional().describe('User favorite categories'),
      recentViewedIds: z.array(z.string()).optional().describe('Recently viewed deal/product IDs'),
      maxResults: z.number().default(10).describe('Maximum number of recommendations'),
    }),
    outputSchema: z.object({
      dealIds: z.array(z.string()).describe('Recommended deal IDs'),
      reasoning: z.string().describe('Explanation of why these deals were recommended'),
      categories: z.array(z.string()).describe('Categories used for recommendations'),
    }),
  },
  async (input) => {
    const { userId, favoriteCategories = [], recentViewedIds = [], maxResults } = input;

    // Get user's favorite deals and products
    const [favoriteDeals, favoriteProducts] = await Promise.all([
      getFavoriteDeals(userId, 20).catch(() => []),
      getFavoriteProducts(userId, 20).catch(() => []),
    ]);

    // Extract categories from favorites
    const categoriesFromFavorites = new Set<string>();
    favoriteDeals.forEach(deal => {
      if (deal.mainCategorySlug) categoriesFromFavorites.add(deal.mainCategorySlug);
      if (deal.subCategorySlug) categoriesFromFavorites.add(deal.subCategorySlug);
    });

    // Get user's comment history to understand interests
    const commentsQuery = query(
      collection(db, 'deals'),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    commentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.mainCategorySlug) categoriesFromFavorites.add(data.mainCategorySlug);
      if (data.subCategorySlug) categoriesFromFavorites.add(data.subCategorySlug);
    });

    // Combine all categories
    const allCategories = [
      ...favoriteCategories,
      ...Array.from(categoriesFromFavorites),
    ];

    // Build recommendation query
    let recommendedDeals: string[] = [];

    if (allCategories.length > 0) {
      // Query deals in user's favorite categories
      const dealsQuery = query(
        collection(db, 'deals'),
        where('status', '==', 'approved'),
        where('mainCategorySlug', 'in', allCategories.slice(0, 10)), // Firestore limit
        orderBy('temperature', 'desc'),
        limit(maxResults * 2)
      );

      const dealsSnapshot = await getDocs(dealsQuery);
      recommendedDeals = dealsSnapshot.docs
        .map(doc => doc.id)
        .filter(id => !recentViewedIds.includes(id)) // Exclude recently viewed
        .slice(0, maxResults);
    }

    // If not enough recommendations, add hot deals
    if (recommendedDeals.length < maxResults) {
      const hotDealsQuery = query(
        collection(db, 'deals'),
        where('status', '==', 'approved'),
        orderBy('temperature', 'desc'),
        limit(maxResults)
      );

      const hotDealsSnapshot = await getDocs(hotDealsQuery);
      const hotDeals = hotDealsSnapshot.docs
        .map(doc => doc.id)
        .filter(id => !recommendedDeals.includes(id) && !recentViewedIds.includes(id));

      recommendedDeals = [...recommendedDeals, ...hotDeals].slice(0, maxResults);
    }

    const reasoning = allCategories.length > 0
      ? `Rekomendacje oparte na Twoich ulubionych kategoriach: ${allCategories.slice(0, 3).join(', ')} oraz najgorętszych okazjach`
      : 'Rekomendacje oparte na najgorętszych okazjach na platformie';

    return {
      dealIds: recommendedDeals,
      reasoning,
      categories: allCategories.slice(0, 5),
    };
  }
);

/**
 * Get similar deals based on a specific deal
 */
export const similarDealsFlow = ai.defineFlow(
  {
    name: 'similarDeals',
    inputSchema: z.object({
      dealId: z.string().describe('Deal ID to find similar deals for'),
      maxResults: z.number().default(8).describe('Maximum number of similar deals'),
    }),
    outputSchema: z.object({
      dealIds: z.array(z.string()).describe('Similar deal IDs'),
      similarityScore: z.array(z.number()).describe('Similarity scores (0-1)'),
      reasoning: z.string().describe('Explanation of similarity'),
    }),
  },
  async (input) => {
    const { dealId, maxResults } = input;

    // Get source deal
    const sourceDeal = await getDealById(dealId);
    if (!sourceDeal) {
      return {
        dealIds: [],
        similarityScore: [],
        reasoning: 'Deal not found',
      };
    }

    // Query similar deals by category and tags
    const similarQuery = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      where('subCategorySlug', '==', sourceDeal.subCategorySlug),
      orderBy('temperature', 'desc'),
      limit(maxResults * 2)
    );

    const similarSnapshot = await getDocs(similarQuery);
    const similarDeals = similarSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(deal => deal.id !== dealId);

    // Calculate similarity scores based on tags, price range, and merchant
    const dealsWithScores = similarDeals.map(deal => {
      let score = 0.5; // Base score for same category

      // Tag similarity
      const sourceTags = sourceDeal.tags || [];
      const dealTags = (deal as any).tags || [];
      const commonTags = sourceTags.filter((tag: string) => dealTags.includes(tag)).length;
      score += (commonTags / Math.max(sourceTags.length, 1)) * 0.3;

      // Price similarity
      const priceRatio = Math.min((deal as any).price, sourceDeal.price || 0) / Math.max((deal as any).price, sourceDeal.price || 1);
      score += priceRatio * 0.2;

      return {
        id: deal.id,
        score: Math.min(score, 1.0),
      };
    });

    // Sort by score and take top results
    dealsWithScores.sort((a, b) => b.score - a.score);
    const topDeals = dealsWithScores.slice(0, maxResults);

    return {
      dealIds: topDeals.map(d => d.id),
      similarityScore: topDeals.map(d => d.score),
      reasoning: `Znaleziono podobne okazje w kategorii ${sourceDeal.subCategorySlug} z podobnymi tagami i przedziałem cenowym`,
    };
  }
);
