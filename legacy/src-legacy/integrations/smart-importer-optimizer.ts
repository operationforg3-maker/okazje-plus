// @ts-nocheck
/**
 * Smart Import Pipeline - Optimization & Caching Layer
 * 
 * Adds:
 * - Caching for repeated product titles/descriptions
 * - Performance monitoring and metrics
 * - Batch processing optimization
 * - Processing history and statistics
 */

import { logger } from '@/lib/logging';
// @ts-nocheck
import type { SmartImportResult, SmartImportInput } from './smart-importer';

/**
 * Cache entry for processed products
 */
interface CacheEntry {
  hash: string;
  input: SmartImportInput;
  result: SmartImportResult;
  timestamp: number;
  hitCount: number;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  totalProcessed: number;
  totalTime: number;
  avgTimePerProduct: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  bestTimeMs: number;
  worstTimeMs: number;
  qualityScoreAvg: number;
  qualityScoreDistribution: {
    excellent: number; // >= 80
    good: number;      // 60-79
    fair: number;      // 40-59
    poor: number;      // < 40
  };
  categoryConfidenceAvg: number;
  recommendationCounts: {
    publish: number;
    manual_review: number;
    reject: number;
  };
}

/**
 * Smart Import Optimizer
 */
class SmartImportOptimizer {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: ProcessingStats = {
    totalProcessed: 0,
    totalTime: 0,
    avgTimePerProduct: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    bestTimeMs: Infinity,
    worstTimeMs: 0,
    qualityScoreAvg: 0,
    qualityScoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
    categoryConfidenceAvg: 0,
    recommendationCounts: { publish: 0, manual_review: 0, reject: 0 },
  };
  
  private maxCacheSize = 1000;
  private cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Generate hash for caching key
   */
  private generateHash(input: SmartImportInput): string {
    const key = `${input.title}|${input.price}|${input.originalPrice}|${input.shippingCost}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Check cache for existing result
   */
  getCached(input: SmartImportInput): SmartImportResult | null {
    const hash = this.generateHash(input);
    const entry = this.cache.get(hash);

    if (!entry) {
      this.stats.cacheMisses++;
      return null;
    }

    // Check if cache entry has expired
    const age = Date.now() - entry.timestamp;
    if (age > this.cacheMaxAge) {
      this.cache.delete(hash);
      this.stats.cacheMisses++;
      return null;
    }

    // Cache hit
    this.stats.cacheHits++;
    entry.hitCount++;
    
    logger.debug('✨ Cache hit', {
      hash: hash.slice(0, 8),
      age: `${(age / 1000).toFixed(1)}s`,
      hitCount: entry.hitCount,
    });

    return entry.result;
  }

  /**
   * Store result in cache
   */
  setCached(input: SmartImportInput, result: SmartImportResult): void {
    // Don't cache failed results
    if (!result.success) {
      return;
    }

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestEntry = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0];
      
      if (oldestEntry) {
        this.cache.delete(oldestEntry[0]);
        logger.debug('Cache eviction: removed oldest entry');
      }
    }

    const hash = this.generateHash(input);
    this.cache.set(hash, {
      hash,
      input,
      result,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Record processing metrics
   */
  recordProcessing(result: SmartImportResult, processingTimeMs: number): void {
    // Update timing stats
    this.stats.totalProcessed++;
    this.stats.totalTime += processingTimeMs;
    this.stats.avgTimePerProduct = this.stats.totalTime / this.stats.totalProcessed;
    this.stats.bestTimeMs = Math.min(this.stats.bestTimeMs, processingTimeMs);
    this.stats.worstTimeMs = Math.max(this.stats.worstTimeMs, processingTimeMs);

    // Update quality score stats
    const prevAvg = this.stats.qualityScoreAvg * (this.stats.totalProcessed - 1);
    this.stats.qualityScoreAvg = (prevAvg + result.qualityScore) / this.stats.totalProcessed;

    // Update quality score distribution
    if (result.qualityScore >= 80) {
      this.stats.qualityScoreDistribution.excellent++;
    } else if (result.qualityScore >= 60) {
      this.stats.qualityScoreDistribution.good++;
    } else if (result.qualityScore >= 40) {
      this.stats.qualityScoreDistribution.fair++;
    } else {
      this.stats.qualityScoreDistribution.poor++;
    }

    // Update category confidence stats
    if (result.category) {
      const prevConfAvg = this.stats.categoryConfidenceAvg * (this.stats.totalProcessed - 1);
      this.stats.categoryConfidenceAvg =
        (prevConfAvg + (result.categoryConfidence || 0)) / this.stats.totalProcessed;
    }

    // Update recommendation counts
    this.stats.recommendationCounts[result.qualityRecommendation]++;

    // Update hit rate
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.hitRate = total > 0 ? (this.stats.cacheHits / total) * 100 : 0;
  }

  /**
   * Get current statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      totalTime: 0,
      avgTimePerProduct: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      bestTimeMs: Infinity,
      worstTimeMs: 0,
      qualityScoreAvg: 0,
      qualityScoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      categoryConfidenceAvg: 0,
      recommendationCounts: { publish: 0, manual_review: 0, reject: 0 },
    };
    logger.info('📊 Processing statistics reset');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    logger.info('🧹 Cache cleared', { entriesRemoved: cacheSize });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ hash: string; hitCount: number; ageSeconds: number }>;
  } {
    const entries = Array.from(this.cache.values())
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map(entry => ({
        hash: entry.hash.slice(0, 8),
        hitCount: entry.hitCount,
        ageSeconds: ((Date.now() - entry.timestamp) / 1000).toFixed(1),
      }));

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      entries,
    };
  }

  /**
   * Print detailed statistics report
   */
  printReport(): void {
    const stats = this.getStats();
    const cacheStats = this.getCacheStats();

    logger.info('\n' + '='.repeat(80));
    logger.info('📊 SMART IMPORT PIPELINE - PERFORMANCE REPORT');
    logger.info('='.repeat(80));

    // Processing metrics
    logger.info('\n⏱️  PROCESSING METRICS:', {
      totalProcessed: stats.totalProcessed,
      totalTimeMs: stats.totalTime,
      avgTimeMs: stats.avgTimePerProduct.toFixed(1),
      bestTimeMs: stats.bestTimeMs === Infinity ? 'N/A' : stats.bestTimeMs,
      worstTimeMs: stats.worstTimeMs,
    });

    // Cache metrics
    logger.info('\n💾 CACHE METRICS:', {
      cacheSize: cacheStats.size,
      maxCacheSize: cacheStats.maxSize,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      hitRate: `${stats.hitRate.toFixed(1)}%`,
      timesSaved: `${((stats.cacheHits * stats.avgTimePerProduct) / 1000).toFixed(1)}s`,
    });

    // Quality metrics
    logger.info('\n⭐ QUALITY METRICS:', {
      avgScore: stats.qualityScoreAvg.toFixed(1),
      scoreDistribution: stats.qualityScoreDistribution,
      avgCategoryConfidence: stats.categoryConfidenceAvg.toFixed(2),
    });

    // Recommendation breakdown
    logger.info('\n📋 RECOMMENDATION BREAKDOWN:', {
      publish: `${stats.recommendationCounts.publish} (${((stats.recommendationCounts.publish / stats.totalProcessed) * 100).toFixed(1)}%)`,
      manual_review: `${stats.recommendationCounts.manual_review} (${((stats.recommendationCounts.manual_review / stats.totalProcessed) * 100).toFixed(1)}%)`,
      reject: `${stats.recommendationCounts.reject} (${((stats.recommendationCounts.reject / stats.totalProcessed) * 100).toFixed(1)}%)`,
    });

    // Top cache entries
    if (cacheStats.entries.length > 0) {
      logger.info('\n🏆 TOP CACHE ENTRIES (by hit count):', {
        entries: cacheStats.entries,
      });
    }

    logger.info('\n' + '='.repeat(80));
  }
}

// Export singleton instance
export const optimizer = new SmartImportOptimizer();

/**
 * Wrapper function for smart import with caching and metrics
 */
export async function smartImportProductWithCache(
  input: SmartImportInput,
  importFn: (input: SmartImportInput) => Promise<SmartImportResult>
): Promise<SmartImportResult> {
  // Check cache first
  const cached = optimizer.getCached(input);
  if (cached) {
    logger.debug('Using cached result for product', { title: input.title.slice(0, 50) });
    return cached;
  }

  // Process product
  const startTime = Date.now();
  const result = await importFn(input);
  const processingTimeMs = Date.now() - startTime;

  // Record metrics and cache result
  optimizer.recordProcessing(result, processingTimeMs);
  optimizer.setCached(input, result);

  return result;
}

/**
 * Export optimizer for testing and diagnostics
 */
if (typeof window !== 'undefined') {
  (window as any).smartImportOptimizer = optimizer;
}
