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
    const { source, query, maxResults } = body;

    // 3. Validate input
    if (!source || !query) {
      return NextResponse.json(
        { error: 'Missing source or query' },
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

    // 4. Create job ID and run harvester
    const jobId = `harvest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const harvester = new SmartHarvester(jobId);

    // 5. Run harvest (returns HarvesterJob result)
    const result = await harvester.harvestProducts(
      source as 'aliexpress' | 'amazon' | 'allegro',
      query,
      max
    );

    // 6. Return results
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
