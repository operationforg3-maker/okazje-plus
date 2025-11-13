/**
 * Product Deduplication Engine (M2)
 * 
 * Detects and manages duplicate/similar products
 * - Embedding-based similarity detection
 * - Fuzzy merge logic with audit trail
 * - AI-powered canonical product suggestion
 */

import { logger } from '@/lib/logging';
import { Product, DuplicateGroup, MergeLog } from '@/lib/types';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';

/**
 * Create a duplicate group for similar products
 */
export async function createDuplicateGroup(
  canonicalProductId: string,
  alternativeProductIds: string[],
  similarityScores: Record<string, number>,
  aiSuggestion?: DuplicateGroup['aiSuggestion']
): Promise<DuplicateGroup> {
  try {
    const groupRef = doc(collection(db, 'duplicateGroups'));
    const now = new Date().toISOString();
    
    const group: DuplicateGroup = {
      id: groupRef.id,
      canonicalProductId,
      alternativeProductIds,
      similarityScores,
      status: 'pending_review',
      detectedAt: now,
      aiSuggestion,
    };
    
    await setDoc(groupRef, {
      ...group,
      detectedAt: Timestamp.fromDate(new Date(group.detectedAt)),
      reviewedAt: null,
    });
    
    logger.info('Duplicate group created', {
      groupId: group.id,
      canonical: canonicalProductId,
      alternatives: alternativeProductIds.length,
    });
    
    return group;
  } catch (error) {
    logger.error('Failed to create duplicate group', { error });
    throw error;
  }
}

/**
 * Merge products with fuzzy logic
 * Preserves best attributes from all products
 */
export async function mergeProducts(
  duplicateGroupId: string,
  mergeStrategy: 'keep_canonical' | 'merge_attributes' | 'keep_both',
  mergedBy: string
): Promise<MergeLog> {
  try {
    logger.info('Merging products', { duplicateGroupId, mergeStrategy });
    
    // Get duplicate group
    const groupRef = doc(db, 'duplicateGroups', duplicateGroupId);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      throw new Error(`Duplicate group ${duplicateGroupId} not found`);
    }
    
    const group = { id: groupSnap.id, ...groupSnap.data() } as DuplicateGroup;
    
    // Get all products in the group
    const productIds = [group.canonicalProductId, ...group.alternativeProductIds];
    const products: Product[] = [];
    
    for (const productId of productIds) {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        products.push({ id: productSnap.id, ...productSnap.data() } as Product);
      }
    }
    
    if (products.length === 0) {
      throw new Error('No products found in duplicate group');
    }
    
    const canonical = products.find(p => p.id === group.canonicalProductId);
    const alternatives = products.filter(p => p.id !== group.canonicalProductId);
    
    if (!canonical) {
      throw new Error('Canonical product not found');
    }
    
    // Create merge log
    const mergeLogRef = doc(collection(db, 'mergeLogs'));
    const now = new Date().toISOString();
    
    const changes: MergeLog['changes'] = [];
    const preservedFields: Record<string, any> = {};
    
    // Apply merge strategy
    if (mergeStrategy === 'merge_attributes') {
      // Merge attributes from alternatives into canonical
      // Example: keep best price, highest rating, combine galleries
      
      // Best price
      const bestPrice = Math.min(...products.map(p => p.price));
      if (bestPrice !== canonical.price) {
        changes.push({
          field: 'price',
          before: canonical.price,
          after: bestPrice,
          source: 'merged',
        });
        preservedFields.price = bestPrice;
      }
      
      // Best rating (if significantly better)
      const bestRating = products.reduce((best, p) =>
        p.ratingCard.average > best.ratingCard.average ? p : best
      );
      if (bestRating.id !== canonical.id) {
        changes.push({
          field: 'ratingCard',
          before: canonical.ratingCard,
          after: bestRating.ratingCard,
          source: 'merged',
        });
        preservedFields.ratingCard = bestRating.ratingCard;
      }
      
      // Combine galleries (unique images only)
      const allImages = new Set<string>();
      products.forEach(p => {
        p.gallery?.forEach(img => allImages.add(img.src));
      });
      
      if (allImages.size > (canonical.gallery?.length || 0)) {
        changes.push({
          field: 'gallery',
          before: canonical.gallery?.length || 0,
          after: allImages.size,
          source: 'merged',
        });
      }
      
      // Update canonical product
      if (changes.length > 0) {
        await updateDoc(doc(db, 'products', canonical.id), {
          ...preservedFields,
          updatedAt: Timestamp.now(),
        });
      }
      
      // Mark alternatives as merged
      for (const alt of alternatives) {
        await updateDoc(doc(db, 'products', alt.id), {
          status: 'rejected',
          ai: {
            ...alt.ai,
            softDuplicateOf: canonical.id,
            flags: [...(alt.ai?.flags || []), 'merged_into_canonical'],
          },
          updatedAt: Timestamp.now(),
        });
      }
    } else if (mergeStrategy === 'keep_canonical') {
      // Just mark alternatives as duplicates
      for (const alt of alternatives) {
        await updateDoc(doc(db, 'products', alt.id), {
          status: 'rejected',
          ai: {
            ...alt.ai,
            softDuplicateOf: canonical.id,
          },
          updatedAt: Timestamp.now(),
        });
      }
    }
    // 'keep_both' strategy doesn't modify products
    
    const mergeLog: MergeLog = {
      id: mergeLogRef.id,
      duplicateGroupId,
      canonicalProductId: canonical.id,
      mergedProductIds: alternatives.map(p => p.id),
      mergeStrategy,
      preservedFields,
      changes,
      mergedBy,
      mergedAt: now,
      snapshot: {
        canonical: { ...canonical },
        merged: alternatives.map(p => ({ ...p })),
      },
    };
    
    await setDoc(mergeLogRef, {
      ...mergeLog,
      mergedAt: Timestamp.fromDate(new Date(mergeLog.mergedAt)),
    });
    
    // Update duplicate group status
    await updateDoc(groupRef, {
      status: 'merged',
      reviewedAt: Timestamp.now(),
      reviewedBy: mergedBy,
      mergeStrategy,
    });
    
    logger.info('Products merged successfully', {
      mergeLogId: mergeLog.id,
      canonical: canonical.id,
      merged: alternatives.length,
      changes: changes.length,
    });
    
    return mergeLog;
  } catch (error) {
    logger.error('Failed to merge products', { duplicateGroupId, error });
    throw error;
  }
}

/**
 * Get all pending duplicate groups
 */
export async function getPendingDuplicateGroups(): Promise<DuplicateGroup[]> {
  try {
    const q = query(
      collection(db, 'duplicateGroups'),
      where('status', '==', 'pending_review')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        detectedAt: data.detectedAt.toDate().toISOString(),
        reviewedAt: data.reviewedAt?.toDate().toISOString(),
      } as DuplicateGroup;
    });
  } catch (error) {
    logger.error('Failed to get pending duplicate groups', { error });
    throw error;
  }
}

/**
 * Reject a duplicate group (mark as not duplicates)
 */
export async function rejectDuplicateGroup(
  groupId: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  try {
    const groupRef = doc(db, 'duplicateGroups', groupId);
    
    await updateDoc(groupRef, {
      status: 'rejected',
      reviewedAt: Timestamp.now(),
      reviewedBy,
      notes: notes || 'Marked as not duplicates',
    });
    
    logger.info('Duplicate group rejected', { groupId, reviewedBy });
  } catch (error) {
    logger.error('Failed to reject duplicate group', { groupId, error });
    throw error;
  }
}
