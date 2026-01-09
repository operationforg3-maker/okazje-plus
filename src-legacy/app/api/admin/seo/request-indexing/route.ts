/**
 * API Route: Manual Google Indexing Trigger
 * 
 * POST /api/admin/seo/request-indexing
 * 
 * Allows admins to manually request indexing for specific deals or URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-helpers';
import { requestIndexing, requestDealIndexing, batchRequestIndexing } from '@/lib/google-indexing';

export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const adminCheck = await verifyAdmin(request);
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { dealSlug, dealSlugs, url, urls, type = 'URL_UPDATED' } = body;

    // Single deal by slug
    if (dealSlug) {
      const result = await requestDealIndexing(dealSlug, type);
      
      return NextResponse.json({
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success 
          ? `Indexing requested for deal: ${dealSlug}`
          : `Failed to request indexing: ${result.error}`,
      });
    }

    // Single URL
    if (url) {
      const result = await requestIndexing(url, type);
      
      return NextResponse.json({
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success 
          ? `Indexing requested for URL: ${url}`
          : `Failed to request indexing: ${result.error}`,
      });
    }

    // Batch deals
    if (dealSlugs && Array.isArray(dealSlugs)) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
      const dealUrls = dealSlugs.map(slug => `${siteUrl}/deals/${slug}`);
      
      const results = await batchRequestIndexing(dealUrls);
      
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;
      
      return NextResponse.json({
        success: failedCount === 0,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failedCount,
        },
        message: `Batch indexing: ${successCount}/${results.length} successful`,
      });
    }

    // Batch URLs
    if (urls && Array.isArray(urls)) {
      const results = await batchRequestIndexing(urls);
      
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;
      
      return NextResponse.json({
        success: failedCount === 0,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failedCount,
        },
        message: `Batch indexing: ${successCount}/${results.length} successful`,
      });
    }

    return NextResponse.json(
      { error: 'Missing required fields: dealSlug, dealSlugs, url, or urls' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[API] Google Indexing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Check indexing status
 */
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request);
    if (!adminCheck.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    const { getIndexingStatus } = await import('@/lib/google-indexing');
    const status = await getIndexingStatus(url);

    return NextResponse.json({
      success: true,
      status,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get status', details: error.message },
      { status: 500 }
    );
  }
}
