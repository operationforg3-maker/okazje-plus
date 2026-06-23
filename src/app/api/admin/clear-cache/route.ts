import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * Clear categories cache endpoint
 * GET /api/admin/clear-cache
 * 
 * Clears in-memory and Redis cache for categories
 * Use after updating category structure in Firestore
 */
export async function GET() {
  try {
    // Import cache functions
    const { cacheDel } = await import('@/lib/cache');
    
    // Clear category-related cache keys
    const cacheKeys = [
      'categories:all',
      'categories:all:v2',
      'categories:with_content_products',
      'categories:with_content_deals',
      'public:products:bootstrap:v1',
    ];
    
    for (const key of cacheKeys) {
      await cacheDel(key);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Categories cache cleared successfully',
      clearedKeys: cacheKeys,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[clear-cache] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to clear cache',
      },
      { status: 500 }
    );
  }
}
