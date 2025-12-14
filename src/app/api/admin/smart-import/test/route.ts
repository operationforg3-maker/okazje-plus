/**
 * API Endpoint for Smart Import Testing & Diagnostics
 * 
 * POST /api/admin/smart-import/test - Run full test suite
 * GET /api/admin/smart-import/stats - Get performance statistics
 * POST /api/admin/smart-import/stats/reset - Reset statistics
 * GET /api/admin/smart-import/cache - Get cache statistics
 * POST /api/admin/smart-import/cache/clear - Clear cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { optimizer } from '@/integrations/smart-importer-optimizer';
import { logger } from '@/lib/logging';

// TODO: Replace with real test suite implementations
async function runSmartImportTests() {
  logger.warn('runSmartImportTests stub executed');
}

async function runBatchPerformanceTest() {
  logger.warn('runBatchPerformanceTest stub executed');
}

async function testCategoryMapping() {
  logger.warn('testCategoryMapping stub executed');
}

/**
 * POST /api/admin/smart-import/test
 * Run comprehensive test suite
 */
export async function testSmartImport(req: NextRequest) {
  try {
    logger.info('🧪 Starting Smart Import test suite via API');

    // Reset stats before testing
    optimizer.resetStats();

    // Run tests
    await runSmartImportTests();
    await runBatchPerformanceTest();
    await testCategoryMapping();

    // Get final stats
    const stats = optimizer.getStats();

    return NextResponse.json({
      success: true,
      message: 'Test suite completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Test suite failed', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/smart-import/stats
 * Get current processing statistics
 */
export async function getSmartImportStats() {
  const stats = optimizer.getStats();
  const cacheStats = optimizer.getCacheStats();

  return NextResponse.json({
    success: true,
    processingStats: stats,
    cacheStats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/admin/smart-import/stats/reset
 * Reset all statistics
 */
export async function resetSmartImportStats() {
  optimizer.resetStats();
  logger.info('📊 Smart Import statistics reset via API');

  return NextResponse.json({
    success: true,
    message: 'Statistics reset',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/admin/smart-import/cache
 * Get cache statistics
 */
export async function getSmartImportCache() {
  const cacheStats = optimizer.getCacheStats();

  return NextResponse.json({
    success: true,
    cache: cacheStats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/admin/smart-import/cache/clear
 * Clear cache
 */
export async function clearSmartImportCache() {
  optimizer.clearCache();
  logger.info('🧹 Smart Import cache cleared via API');

  return NextResponse.json({
    success: true,
    message: 'Cache cleared',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Print performance report
 */
export function printSmartImportReport() {
  optimizer.printReport();
}
