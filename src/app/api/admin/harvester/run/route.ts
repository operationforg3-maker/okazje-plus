import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { SmartHarvester } from '@/lib/automation/harvester';

/**
 * POST /api/admin/harvester/run
 * 
 * Uruchamia Harvester do pobierania produktów z AliExpress/Amazon/Allegro
 * 
 * Request body:
 * {
 *   source: 'aliexpress' | 'amazon' | 'allegro',
 *   query: string,
 *   maxResults: number (10-200)
 *   mode?: 'single' | 'category-tree'
 *   rootCategorySlug?: string // optional: limit traversal to one main category
 *   categories?: string[] // optional: explicit category paths to iterate
 * }
 * 
 * Response:
 * {
 *   jobId: string,
 *   productsFound: number,
 *   productsCreated: number,
 *   dealsCreated: number,
 *   duplicatesSkipped: number,
 *   logs: Array<{level, message, timestamp}>,
 *   errors: Array<string>,
 *   status: 'running' | 'completed' | 'failed'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const session = await getServerAuthSession();
    await requireAdmin(session);

    // 2. Parse request body
    const body = await request.json();
    const { source, query, maxResults, mode = 'single', rootCategorySlug, categories: categoriesFromBody } = body;

    // 3. Validate input
    const isQueryValid = query && typeof query === 'string' && query.trim().length > 0 && query.trim() !== 'category-tree';
    const isCategoryTreeMode = mode === 'category-tree' || (query?.trim() === '' && mode === 'single') || (query?.trim() === 'category-tree');
    
    if (!source) {
      return NextResponse.json(
        { error: 'Missing source' },
        { status: 400 }
      );
    }

    if (!isQueryValid && !isCategoryTreeMode) {
      return NextResponse.json(
        { error: 'Missing query or must set mode=category-tree' },
        { status: 400 }
      );
    }

    if (!['aliexpress', 'amazon', 'allegro'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be aliexpress, amazon, or allegro' },
        { status: 400 }
      );
    }

    const max = Math.max(10, Math.min(200, maxResults || 50));

    // 4. Resolve categories when running full tree mode
    let categories: string[] | undefined;
    if (mode === 'category-tree') {
      categories = await SmartHarvester.buildCategoryQueries(rootCategorySlug);
      if (!categories || categories.length === 0) {
        return NextResponse.json(
          { error: 'Brak kategorii do przetworzenia (sprawdź czy drzewko jest zbudowane)' },
          { status: 400 }
        );
      }
    } else if (Array.isArray(categoriesFromBody) && categoriesFromBody.length > 0) {
      categories = categoriesFromBody;
    }

    // 5. Create job ID and run harvester
    const jobId = `harvest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const harvester = new SmartHarvester(jobId);

    const effectiveQuery = categories && categories.length > 0
      ? `category-tree (${categories.length})`
      : query;

    // 6. Run harvest (returns HarvesterJob result)
    const isTreeMode = isCategoryTreeMode || (categories && categories.length > 0);
    const result = await harvester.harvestProducts(
      source as 'aliexpress' | 'amazon' | 'allegro',
      effectiveQuery,
      max,
      categories,
      isTreeMode // Pass tree mode flag
    );

    // 7. Return results
    return NextResponse.json({
      success: true,
      job: result,
    });
  } catch (error: any) {
    console.error('[Harvester API Error]', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to run harvester',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
