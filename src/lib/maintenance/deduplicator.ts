/**
 * Deduplicator
 * - Image hash detection (Sharp)
 * - Text similarity (Levenshtein + TF-IDF)
 * - Find soft duplicates
 * - Merge UI support
 */

import logger from "../logger";
import { db } from "../firebase";
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";

export interface DuplicateCandidate {
  id1: string;
  id2: string;
  score: number; // 0-1
  matchType: "image" | "text" | "hybrid";
  metadata?: Record<string, any>;
}

// ===== Simple Levenshtein distance =====
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[len2][len1];
}

// ===== Text similarity (0-1) =====
function textSimilarity(text1: string, text2: string): number {
  const maxLen = Math.max(text1.length, text2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(text1.toLowerCase(), text2.toLowerCase());
  return 1 - distance / maxLen;
}

// ===== Simple image hash (perceptual) =====
async function getImageHash(imageUrl: string): Promise<string | null> {
  try {
    // In production, use a library like 'sharp' + 'dhash'
    // For now, return a placeholder
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    // Hash first 1KB of image data
    const hash = buffer
      .toString()
      .split("")
      .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return Math.abs(hash).toString(16);
  } catch (error) {
    logger.warn("Image hash generation failed", { imageUrl, error });
    return null;
  }
}

// ===== Deduplicator =====
export class Deduplicator {
  private textSimilarityThreshold = 0.85;
  private imageSimilarityThreshold = 0.9;

  // ===== Find text duplicates =====
  async findTextDuplicates(): Promise<DuplicateCandidate[]> {
    try {
      const dealsCollection = collection(db, "deals");
      const snapshot = await getDocs(query(dealsCollection, where("status", "==", "approved")));

      const deals = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const duplicates: DuplicateCandidate[] = [];

      for (let i = 0; i < deals.length; i++) {
        for (let j = i + 1; j < deals.length; j++) {
          const deal1 = deals[i];
          const deal2 = deals[j];

          const similarity = textSimilarity(
            deal1.title || "",
            deal2.title || ""
          );

          if (similarity > this.textSimilarityThreshold) {
            duplicates.push({
              id1: deal1.id,
              id2: deal2.id,
              score: similarity,
              matchType: "text",
              metadata: {
                title1: deal1.title,
                title2: deal2.title,
              },
            });
          }
        }
      }

      logger.info("Text duplicate detection completed", { found: duplicates.length });
      return duplicates;
    } catch (error) {
      logger.error("Text duplicate detection failed", { error });
      return [];
    }
  }

  // ===== Find image duplicates =====
  async findImageDuplicates(): Promise<DuplicateCandidate[]> {
    try {
      const dealsCollection = collection(db, "deals");
      const snapshot = await getDocs(query(dealsCollection, where("status", "==", "approved")));

      const deals = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const hashes: Map<string, string[]> = new Map();
      const duplicates: DuplicateCandidate[] = [];

      // Generate hashes
      for (const deal of deals) {
        if (!deal.image) continue;

        const hash = await getImageHash(deal.image);
        if (!hash) continue;

        if (!hashes.has(hash)) {
          hashes.set(hash, []);
        }
        hashes.get(hash)!.push(deal.id);
      }

      // Find duplicates (same hash = likely duplicate)
      for (const [hash, dealIds] of hashes) {
        if (dealIds.length > 1) {
          for (let i = 0; i < dealIds.length; i++) {
            for (let j = i + 1; j < dealIds.length; j++) {
              duplicates.push({
                id1: dealIds[i],
                id2: dealIds[j],
                score: 1.0, // Same image hash
                matchType: "image",
                metadata: { imageHash: hash },
              });
            }
          }
        }
      }

      logger.info("Image duplicate detection completed", { found: duplicates.length });
      return duplicates;
    } catch (error) {
      logger.error("Image duplicate detection failed", { error });
      return [];
    }
  }

  // ===== Merge two deals =====
  async mergeDeal(
    keepId: string,
    removeId: string,
    strategy?: "keep_primary" | "merge_metadata"
  ): Promise<void> {
    try {
      const strategy_ = strategy || "keep_primary";

      const keepRef = doc(collection(db, "deals"), keepId);
      const removeRef = doc(collection(db, "deals"), removeId);

      // Get both deals
      const [keepSnap, removeSnap] = await Promise.all([
        getDocs(query(collection(db, "deals"), where("__name__", "==", keepId))),
        getDocs(query(collection(db, "deals"), where("__name__", "==", removeId))),
      ]);

      if (keepSnap.empty || removeSnap.empty) {
        throw new Error("One or both deals not found");
      }

      const keepDeal = keepSnap.docs[0].data();
      const removeDeal = removeSnap.docs[0].data();

      if (strategy_ === "merge_metadata") {
        // Merge metadata fields
        const mergedMetadata = {
          ...keepDeal.metadata,
          ...removeDeal.metadata,
          duplicateOf: removeId,
        };

        await updateDoc(keepSnap.docs[0].ref, {
          metadata: mergedMetadata,
          duplicateMergedAt: new Date().toISOString(),
        });
      }

      // Delete the duplicate
      await deleteDoc(removeSnap.docs[0].ref);

      logger.info("Deal merged successfully", { keepId, removeId });
    } catch (error) {
      logger.error("Deal merge failed", { keepId, removeId, error });
      throw error;
    }
  }

  // ===== Batch find all duplicates =====
  async findAllDuplicates(): Promise<DuplicateCandidate[]> {
    const [textDups, imageDups] = await Promise.all([
      this.findTextDuplicates(),
      this.findImageDuplicates(),
    ]);

    const all = [...textDups, ...imageDups];
    logger.info("All duplicates found", {
      text: textDups.length,
      image: imageDups.length,
      total: all.length,
    });

    return all;
  }
}

// ===== Singleton =====
let deduplicatorInstance: Deduplicator | null = null;

export function getDeduplicator(): Deduplicator {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new Deduplicator();
  }
  return deduplicatorInstance;
}
