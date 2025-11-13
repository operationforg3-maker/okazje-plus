/**
 * Product Embedding Generation (M2)
 * 
 * Generates vector embeddings for products to enable similarity comparison
 * Uses Google Gemini for embedding generation via Genkit
 */

import { ai } from '@/ai/genkit';
import { logger } from '@/lib/logging';
import { Product, ProductEmbedding } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

/**
 * Model version for embeddings
 * Change this when model changes to invalidate old embeddings
 */
const EMBEDDING_MODEL_VERSION = 'gemini-2.5-flash-v1';

/**
 * Generate embedding for text using Gemini
 */
async function generateTextEmbedding(text: string): Promise<number[]> {
  try {
    // Use Gemini to generate embedding
    // Note: This is a simplified version. In production, use dedicated embedding model
    const result = await ai.generate({
      prompt: `Generate a semantic embedding vector for the following text. Return only the vector as a JSON array of numbers: ${text}`,
    });
    
    // Parse the embedding from the response
    // In practice, you'd use a dedicated embedding API
    const embedding = JSON.parse(result.text);
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding format');
    }
    
    return embedding;
  } catch (error) {
    logger.error('Failed to generate text embedding', { error });
    throw error;
  }
}

/**
 * Normalize text for embedding generation
 * Removes special characters, normalizes whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate embeddings for a product
 * Creates embeddings for title, description, and a combined version
 */
export async function generateProductEmbedding(product: Product): Promise<ProductEmbedding> {
  try {
    logger.info('Generating product embedding', { productId: product.id });
    
    // Normalize product text
    const normalizedTitle = normalizeText(product.name);
    const normalizedDescription = normalizeText(product.description);
    
    // Generate embeddings
    const [titleEmbedding, descriptionEmbedding] = await Promise.all([
      generateTextEmbedding(normalizedTitle),
      generateTextEmbedding(normalizedDescription),
    ]);
    
    // Create combined embedding (weighted average)
    // Title gets 70% weight, description gets 30%
    const combinedEmbedding = titleEmbedding.map((val, idx) => {
      const descVal = descriptionEmbedding[idx] || 0;
      return val * 0.7 + descVal * 0.3;
    });
    
    const embedding: ProductEmbedding = {
      id: product.id,
      productId: product.id,
      titleEmbedding,
      descriptionEmbedding,
      combinedEmbedding,
      embeddingVersion: EMBEDDING_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
    };
    
    // Store embedding in Firestore
    await setDoc(doc(db, 'productEmbeddings', product.id), {
      ...embedding,
      generatedAt: Timestamp.fromDate(new Date(embedding.generatedAt)),
      updatedAt: embedding.updatedAt ? Timestamp.fromDate(new Date(embedding.updatedAt)) : null,
    });
    
    logger.info('Product embedding generated and stored', {
      productId: product.id,
      embeddingDimensions: combinedEmbedding.length,
    });
    
    return embedding;
  } catch (error) {
    logger.error('Failed to generate product embedding', {
      productId: product.id,
      error,
    });
    throw error;
  }
}

/**
 * Get embedding for a product
 * Returns cached embedding if available, otherwise generates new one
 */
export async function getProductEmbedding(
  product: Product,
  regenerate: boolean = false
): Promise<ProductEmbedding> {
  try {
    // Check for existing embedding
    if (!regenerate) {
      const embeddingRef = doc(db, 'productEmbeddings', product.id);
      const embeddingSnap = await getDoc(embeddingRef);
      
      if (embeddingSnap.exists()) {
        const data = embeddingSnap.data();
        
        // Check if embedding is using current model version
        if (data.embeddingVersion === EMBEDDING_MODEL_VERSION) {
          logger.debug('Using cached embedding', { productId: product.id });
          
          return {
            id: embeddingSnap.id,
            ...data,
            generatedAt: data.generatedAt.toDate().toISOString(),
            updatedAt: data.updatedAt?.toDate().toISOString(),
          } as ProductEmbedding;
        }
        
        logger.info('Cached embedding is outdated, regenerating', {
          productId: product.id,
          cachedVersion: data.embeddingVersion,
          currentVersion: EMBEDDING_MODEL_VERSION,
        });
      }
    }
    
    // Generate new embedding
    return await generateProductEmbedding(product);
  } catch (error) {
    logger.error('Failed to get product embedding', { productId: product.id, error });
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns value between -1 (opposite) and 1 (identical)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate similarity score between two products
 * Returns score between 0 (completely different) and 1 (identical)
 */
export async function calculateProductSimilarity(
  productA: Product,
  productB: Product
): Promise<number> {
  try {
    logger.debug('Calculating product similarity', {
      productA: productA.id,
      productB: productB.id,
    });
    
    // Get embeddings for both products
    const [embeddingA, embeddingB] = await Promise.all([
      getProductEmbedding(productA),
      getProductEmbedding(productB),
    ]);
    
    // Calculate cosine similarity using combined embeddings
    const similarity = cosineSimilarity(
      embeddingA.combinedEmbedding,
      embeddingB.combinedEmbedding
    );
    
    // Normalize to 0-1 range (cosine similarity is -1 to 1)
    const normalizedScore = (similarity + 1) / 2;
    
    logger.debug('Similarity calculated', {
      productA: productA.id,
      productB: productB.id,
      score: normalizedScore,
    });
    
    return normalizedScore;
  } catch (error) {
    logger.error('Failed to calculate product similarity', {
      productA: productA.id,
      productB: productB.id,
      error,
    });
    throw error;
  }
}

/**
 * Find similar products using embeddings
 * Returns products with similarity above threshold
 */
export async function findSimilarProducts(
  product: Product,
  threshold: number = 0.8,
  limit: number = 10
): Promise<Array<{ product: Product; similarity: number }>> {
  try {
    logger.info('Finding similar products', {
      productId: product.id,
      threshold,
      limit,
    });
    
    // Get embedding for target product
    const targetEmbedding = await getProductEmbedding(product);
    
    // TODO: In production, use vector database for efficient similarity search
    // For now, this is a simplified version
    // You would typically use Firestore vector search or a dedicated vector DB
    
    // Get all product embeddings (this should be optimized with vector search)
    // This is a placeholder - in production, use proper vector search
    const similarProducts: Array<{ product: Product; similarity: number }> = [];
    
    logger.warn('Vector similarity search not fully implemented - returning placeholder');
    
    return similarProducts;
  } catch (error) {
    logger.error('Failed to find similar products', { productId: product.id, error });
    throw error;
  }
}

// ============================================
// M5: User Embeddings for Personalization
// ============================================

import { UserEmbedding, UserInteraction, Deal } from '@/lib/types';
import { collection, getDocs, query, where, orderBy as firestoreOrderBy, limit as firestoreLimit } from 'firebase/firestore';

/**
 * Generate user embedding based on their interaction history
 * Creates a vector representation of user preferences
 */
export async function generateUserEmbedding(userId: string): Promise<UserEmbedding> {
  try {
    logger.info('Generating user embedding', { userId });

    // Get user's recent interactions
    const interactionsRef = collection(db, 'user_interactions');
    const q = query(
      interactionsRef,
      where('userId', '==', userId),
      firestoreOrderBy('timestamp', 'desc'),
      firestoreLimit(100)
    );

    const snapshot = await getDocs(q);
    const interactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserInteraction));

    if (interactions.length === 0) {
      // Create default embedding for new users
      const defaultEmbedding = new Array(128).fill(0);
      
      const userEmbedding: UserEmbedding = {
        userId,
        embedding: defaultEmbedding,
        embeddingVersion: EMBEDDING_MODEL_VERSION,
        basedOnInteractions: 0,
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'user_embeddings', userId), userEmbedding);
      return userEmbedding;
    }

    // Build weighted feature vector based on interactions
    // Categories, price ranges, interaction types, etc.
    const categoryWeights = new Map<string, number>();
    const interactionTypeWeights = new Map<string, number>();
    const priceRanges = new Map<string, number>(); // <100, 100-500, 500-1000, >1000

    // Weight multipliers for different interaction types
    const typeWeights = {
      view: 1,
      click: 3,
      favorite: 5,
      vote: 2,
      comment: 4,
      share: 4,
    };

    for (const interaction of interactions) {
      const weight = typeWeights[interaction.interactionType] || 1;

      // Track interaction types
      const typeCount = interactionTypeWeights.get(interaction.interactionType) || 0;
      interactionTypeWeights.set(interaction.interactionType, typeCount + weight);

      // Track categories
      if (interaction.metadata?.categorySlug) {
        const catCount = categoryWeights.get(interaction.metadata.categorySlug) || 0;
        categoryWeights.set(interaction.metadata.categorySlug, catCount + weight);
      }

      // Track price ranges (fetch item details)
      try {
        if (interaction.itemType === 'deal') {
          const dealRef = doc(db, 'deals', interaction.itemId);
          const dealSnap = await getDoc(dealRef);
          if (dealSnap.exists()) {
            const deal = dealSnap.data() as Deal;
            const priceRange = 
              deal.price < 100 ? '<100' :
              deal.price < 500 ? '100-500' :
              deal.price < 1000 ? '500-1000' : '>1000';
            
            const rangeCount = priceRanges.get(priceRange) || 0;
            priceRanges.set(priceRange, rangeCount + weight);
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    // Create feature vector (simplified - in production would use proper embeddings)
    // For now, create a 128-dimensional vector with normalized weights
    const embedding = new Array(128).fill(0);

    // Fill first 32 dimensions with interaction type patterns
    let idx = 0;
    const maxInteractionWeight = Math.max(...Array.from(interactionTypeWeights.values()), 1);
    for (const [type, weight] of interactionTypeWeights) {
      if (idx < 32) {
        embedding[idx] = weight / maxInteractionWeight;
        idx++;
      }
    }

    // Fill next 64 dimensions with category preferences (normalized)
    idx = 32;
    const maxCategoryWeight = Math.max(...Array.from(categoryWeights.values()), 1);
    for (const [category, weight] of categoryWeights) {
      if (idx < 96) {
        embedding[idx] = weight / maxCategoryWeight;
        idx++;
      }
    }

    // Fill last 32 dimensions with price range preferences
    idx = 96;
    const maxPriceWeight = Math.max(...Array.from(priceRanges.values()), 1);
    for (const [range, weight] of priceRanges) {
      if (idx < 128) {
        embedding[idx] = weight / maxPriceWeight;
        idx++;
      }
    }

    const userEmbedding: UserEmbedding = {
      userId,
      embedding,
      embeddingVersion: EMBEDDING_MODEL_VERSION,
      basedOnInteractions: interactions.length,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in Firestore
    await setDoc(doc(db, 'user_embeddings', userId), userEmbedding);

    logger.info('User embedding generated', {
      userId,
      basedOnInteractions: interactions.length,
    });

    return userEmbedding;
  } catch (error) {
    logger.error('Failed to generate user embedding', { userId, error });
    throw error;
  }
}

/**
 * Get user embedding (cached or generate new)
 */
export async function getUserEmbedding(
  userId: string,
  regenerate: boolean = false
): Promise<UserEmbedding> {
  try {
    if (!regenerate) {
      const embeddingRef = doc(db, 'user_embeddings', userId);
      const embeddingSnap = await getDoc(embeddingRef);

      if (embeddingSnap.exists()) {
        const data = embeddingSnap.data();

        // Check if embedding is recent (less than 7 days)
        const updatedAt = new Date(data.updatedAt);
        const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceUpdate < 7 && data.embeddingVersion === EMBEDDING_MODEL_VERSION) {
          logger.debug('Using cached user embedding', { userId });
          return {
            userId,
            ...data,
          } as UserEmbedding;
        }

        logger.info('User embedding is stale, regenerating', { userId, daysSinceUpdate });
      }
    }

    return await generateUserEmbedding(userId);
  } catch (error) {
    logger.error('Failed to get user embedding', { userId, error });
    throw error;
  }
}

/**
 * Calculate similarity between user and item embeddings
 * Returns score between 0 (not similar) and 1 (very similar)
 */
export function calculateUserItemSimilarity(
  userEmbedding: number[],
  itemEmbedding: number[]
): number {
  try {
    // Ensure embeddings are same length (pad if needed)
    const maxLength = Math.max(userEmbedding.length, itemEmbedding.length);
    const paddedUserEmb = [...userEmbedding, ...new Array(maxLength - userEmbedding.length).fill(0)];
    const paddedItemEmb = [...itemEmbedding, ...new Array(maxLength - itemEmbedding.length).fill(0)];

    // Calculate cosine similarity
    const similarity = cosineSimilarity(paddedUserEmb, paddedItemEmb);

    // Normalize to 0-1 range
    return (similarity + 1) / 2;
  } catch (error) {
    logger.error('Failed to calculate user-item similarity', { error });
    return 0;
  }
}
