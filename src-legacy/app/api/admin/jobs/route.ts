import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { startHarvesterJob } from '@/lib/automation/harvester';
import { startRefinerJob, refinePendingProducts } from '@/lib/automation/refiner';

/**
 * POST /api/admin/harvester/start
 * Start a new harvester job
 * Body: { source: 'aliexpress' | 'amazon' | 'allegro', query: string, maxResults?: number }
 */
export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle harvester endpoint
  if (pathname === '/api/admin/harvester/start') {
    try {
      await requireAdmin();

      const body = await request.json();
      const { source, query, maxResults = 50 } = body;

      if (!source || !query) {
        return NextResponse.json(
          { error: 'Missing required fields: source, query' },
          { status: 400 }
        );
      }

      const job = await startHarvesterJob(source, query, maxResults);

      return NextResponse.json({
        success: true,
        job,
      });
    } catch (error) {
      console.error('Error starting harvester:', error);
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 }
      );
    }
  }

  // Handle refiner endpoint
  if (pathname === '/api/admin/refiner/start') {
    try {
      await requireAdmin();

      const body = await request.json();
      const { productIds, refinationType = 'full_enrichment' } = body;

      if (!productIds || !Array.isArray(productIds)) {
        return NextResponse.json(
          { error: 'Missing required field: productIds (array)' },
          { status: 400 }
        );
      }

      const job = await startRefinerJob(productIds, refinationType);

      return NextResponse.json({
        success: true,
        job,
      });
    } catch (error) {
      console.error('Error starting refiner:', error);
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 }
      );
    }
  }

  // Handle refine pending endpoint
  if (pathname === '/api/admin/refiner/pending') {
    try {
      await requireAdmin();

      const job = await refinePendingProducts();

      return NextResponse.json({
        success: true,
        job,
      });
    } catch (error) {
      console.error('Error refining pending products:', error);
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Unknown endpoint' },
    { status: 404 }
  );
}
