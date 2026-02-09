import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { SmartHarvester } from '@/lib/automation/harvester';

/**
 * POST /api/admin/harvester/run
 * 
 * Uruchamia Harvester do pobierania produktów z Convertiser/AliExpress/Amazon/Allegro
 * 
 * Request body:
 * {
 *   source: 'convertiser' | 'aliexpress' | 'amazon' | 'allegro',
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
    await requireAdmin();

    // 2. Parse request body
    const body = await request.json();
    const { 
      source, 
      query, 
      maxResults, 
      mode = 'single', 
      rootCategorySlug, 
      categories: categoriesFromBody,
      convertiserMode = 'products', // New: 'products' or 'offers' for Convertiser
      autoBrowse = false // Convertiser: fetch entire catalog without keywords
    } = body;

    // 3. Validate input
    const isQueryValid = query && typeof query === 'string' && query.trim().length > 0 && query.trim() !== 'category-tree';
    const isCategoryTreeMode = mode === 'category-tree' || (query?.trim() === '' && mode === 'single' && !autoBrowse) || (query?.trim() === 'category-tree');
    
    if (!source) {
      return NextResponse.json(
        { error: 'Missing source' },
        { status: 400 }
      );
    }

    if (!isQueryValid && !isCategoryTreeMode && !autoBrowse) {
      return NextResponse.json(
        { error: 'Missing query or must set mode=category-tree or autoBrowse=true' },
        { status: 400 }
      );
    }

    if (!['aliexpress', 'amazon', 'allegro', 'convertiser'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be aliexpress, amazon, allegro, or convertiser' },
        { status: 400 }
      );
    }

    if (source === 'convertiser' && !process.env.CONVERTISER_API_TOKEN) {
      return NextResponse.json(
        { error: 'Convertiser API token nie jest skonfigurowany (CONVERTISER_API_TOKEN)' },
        { status: 400 }
      );
    }

    const max = Math.max(10, Math.min(200, maxResults || 50));

    // 4. Resolve categories when running full tree mode
    // CONVERTISER: Always uses simple query mode - moderator categorizes manually
    let categories: string[] | undefined;
    if (source === 'convertiser') {
      // Convertiser: block category-tree mode, force simple query
      if (mode === 'category-tree') {
        return NextResponse.json(
          { error: 'Convertiser nie obsługuje category-tree mode. Użyj prostego query (np. "iPhone 15", "laptop gaming"). Kategorie przypisuje moderator.' },
          { status: 400 }
        );
      }
      categories = undefined;
    } else if (mode === 'category-tree') {
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

    // 6. Initialize job record (for immediate response to UI)
    const isTreeMode = (isCategoryTreeMode || (categories && categories.length > 0)) && !autoBrowse;
    const initialJob = {
      id: jobId,
      status: 'running' as const,
      source,
      query: effectiveQuery,
      maxResults: max,
      productsFound: 0,
      productsCreated: 0,
      dealsCreated: 0,
      duplicatesSkipped: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      logs: [],
    };

    // 7. Run harvest in background (don't await - async execution)
    harvester.harvestProducts(
      source as 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
      effectiveQuery,
      max,
      categories,
      isTreeMode,
      source === 'convertiser' ? convertiserMode : undefined,
      autoBrowse
    ).catch((err) => {
      console.error(`[Harvester ${jobId}] Background job failed:`, err);
    });

    // 8. Return job ID immediately (UI can poll for updates)
    return NextResponse.json({
      success: true,
      job: initialJob,
      message: 'Harvester started in background. Poll /api/admin/harvester-jobs for updates.',
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
