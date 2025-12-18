import { NextRequest, NextResponse } from 'next/server';
import { importFromAliExpress } from '@/lib/aliexpress-importer';
import { requireAdmin } from '@/lib/auth-server';

/**
 * POST /api/admin/imports/run
 * 
 * Trigger an AliExpress import based on a profile
 * Admin-only endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      profileId,
      searchQuery,
      categoryFilter,
      minPrice,
      maxPrice,
      minRating,
      minOrders,
      minDiscount,
      maxItems,
      dryRun,
      autoApprove,
      enableAI,
    } = body;

    // Validate required fields
    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      );
    }

    // Run import
    const result = await importFromAliExpress({
      profileId,
      searchQuery,
      categoryFilter,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      minOrders: minOrders ? parseInt(minOrders) : undefined,
      minDiscount: minDiscount ? parseInt(minDiscount) : undefined,
      maxItems: maxItems ? parseInt(maxItems) : 50,
      dryRun: dryRun === true,
      autoApprove: autoApprove !== false, // Default to true
      enableAI: enableAI === true,
      triggeredBy: 'manual',
      triggeredByUid: session.uid,
    });

    return NextResponse.json({
      success: true,
      importRunId: result.importRunId,
      stats: result.stats,
      errors: result.errors,
    });

  } catch (error) {
    console.error('Import run failed:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
