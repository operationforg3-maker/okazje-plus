import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-server';
import { SmartHarvester } from '@/lib/automation/harvester';
import { v4 as uuid } from 'uuid';

/**
 * POST /api/admin/harvester/start
 * Start a new harvester job
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { source, query, maxResults } = body;

    // Validation
    if (!source || !['convertiser', 'aliexpress', 'amazon', 'allegro'].includes(source)) {
      return NextResponse.json(
        { success: false, error: 'Invalid source' },
        { status: 400 }
      );
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    const limit = Math.min(Math.max(parseInt(maxResults) || 20, 1), 100);

    // Create harvester and run
    const jobId = uuid();
    const harvester = new SmartHarvester(jobId);

    console.log(`[Harvester API] Starting job ${jobId}: ${source} / ${query} (limit: ${limit})`);

    const result = await harvester.harvestProducts(
      source as any,
      query,
      limit
    );

    console.log(`[Harvester API] Job ${jobId} completed:`, {
      productsCreated: result.productsCreated,
      dealsCreated: result.dealsCreated,
      duplicatesSkipped: result.duplicatesSkipped,
    });

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error: any) {
    console.error('[Harvester API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
