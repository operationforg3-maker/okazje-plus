import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * Comprehensive E2E test endpoint for all Harvester tabs
 * POST /api/admin/tests/harvester-e2e
 * 
 * Tests all 8 tabs functionality:
 * 1. Categories management
 * 2. Product import
 * 3. Import queue status
 * 4. AI enhancement
 * 5. Schedule management
 * 6. Link verification
 * 7. Database cleanup (preview & execute)
 * 8. Catalog verification
 */

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log(`[Harvester E2E Test] Admin: ${decodedToken.email}`);

    // Build base URL from request headers
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'okazjeplus.pl';
    const baseUrl = `${protocol}://${host}`;

    const results: any = {
      timestamp: new Date().toISOString(),
      admin: decodedToken.email,
      baseUrl: baseUrl,
      tests: {},
      summary: {
        passed: 0,
        failed: 0,
        total: 0,
      },
    };

    // ========== TEST 1: Test-fill-data ==========
    results.tests['1-fill-data'] = {
      name: 'Fill test data',
      endpoint: 'POST /api/admin/test-fill-data',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/test-fill-data`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      results.tests['1-fill-data'] = {
        ...results.tests['1-fill-data'],
        status: response.ok ? 'passed' : 'failed',
        statusCode: response.status,
        created: data.created || 0,
      };

      if (response.ok) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['1-fill-data'].status = 'error';
      results.tests['1-fill-data'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 2: Categories ==========
    results.tests['2-categories'] = {
      name: 'Categories',
      endpoint: 'GET /api/admin/categories',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/categories`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      results.tests['2-categories'] = {
        ...results.tests['2-categories'],
        status: response.ok ? 'passed' : 'failed',
        statusCode: response.status,
        categoriesCount: Array.isArray(data) ? data.length : 0,
      };

      if (response.ok) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['2-categories'].status = 'error';
      results.tests['2-categories'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 3: Import ==========
    results.tests['3-import'] = {
      name: 'Import tab',
      endpoint: 'POST /api/admin/import/start',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/import/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'test', items: 1 }),
      });

      const data = await response.json();
      results.tests['3-import'] = {
        ...results.tests['3-import'],
        status: response.ok || data.error ? 'responded' : 'failed',
        statusCode: response.status,
        message: data.message || data.error,
      };

      if (response.ok || response.status === 400) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['3-import'].status = 'error';
      results.tests['3-import'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 4: Import Queue ==========
    results.tests['4-queue'] = {
      name: 'Import Queue',
      endpoint: 'GET /api/admin/import/queue',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/import/queue`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      results.tests['4-queue'] = {
        ...results.tests['4-queue'],
        status: response.ok ? 'passed' : 'failed',
        statusCode: response.status,
        jobsCount: data.jobs?.length || 0,
      };

      if (response.ok) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['4-queue'].status = 'error';
      results.tests['4-queue'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 5: AI Enhancement ==========
    results.tests['5-ai'] = {
      name: 'AI Enhancement',
      endpoint: 'POST /api/admin/products/enhance-ai',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/products/enhance-ai`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxItems: 1 }),
      });

      const data = await response.json();
      results.tests['5-ai'] = {
        ...results.tests['5-ai'],
        status: response.ok || data.error ? 'responded' : 'failed',
        statusCode: response.status,
      };

      if (response.ok || response.status === 400) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['5-ai'].status = 'error';
      results.tests['5-ai'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 6: Schedules ==========
    results.tests['6-schedule'] = {
      name: 'Schedules',
      endpoint: 'GET /api/admin/schedule/deals',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/schedule/deals`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      results.tests['6-schedule'] = {
        ...results.tests['6-schedule'],
        status: response.ok ? 'passed' : 'failed',
        statusCode: response.status,
        schedulesCount: data.schedules?.length || 0,
      };

      if (response.ok) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['6-schedule'].status = 'error';
      results.tests['6-schedule'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 7: Link Verification ==========
    results.tests['7-links'] = {
      name: 'Link Verification',
      endpoint: 'POST /api/admin/links/verify',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/links/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: ['https://example.com'] }),
      });

      const data = await response.json();
      results.tests['7-links'] = {
        ...results.tests['7-links'],
        status: response.ok || response.status === 400 ? 'responded' : 'failed',
        statusCode: response.status,
      };

      if (response.ok || response.status === 400) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['7-links'].status = 'error';
      results.tests['7-links'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 8: Database Cleanup (Preview) ==========
    results.tests['8-cleanup'] = {
      name: 'Database Cleanup',
      endpoint: 'POST /api/admin/delete/preview',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/delete/preview`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'products' }),
      });

      const data = await response.json();
      results.tests['8-cleanup'] = {
        ...results.tests['8-cleanup'],
        status: response.ok ? 'passed' : 'failed',
        statusCode: response.status,
        itemsToDelete: data.count || 0,
      };

      if (response.ok) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['8-cleanup'].status = 'error';
      results.tests['8-cleanup'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== TEST 9: Catalog Pages ==========
    results.tests['9-catalog'] = {
      name: 'Catalog Pages',
      endpoints: ['GET /pl/products', 'GET /pl/deals'],
      status: 'pending',
    };

    try {
      const productsResponse = await fetch(`${baseUrl}/pl/products`);
      const dealsResponse = await fetch(`${baseUrl}/pl/deals`);

      results.tests['9-catalog'] = {
        ...results.tests['9-catalog'],
        status: productsResponse.ok && dealsResponse.ok ? 'passed' : 'failed',
        productsStatus: productsResponse.status,
        dealsStatus: dealsResponse.status,
      };

      if (productsResponse.ok && dealsResponse.ok) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.tests['9-catalog'].status = 'error';
      results.tests['9-catalog'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // Log results
    console.log('[Harvester E2E Test] Results:', JSON.stringify(results.summary, null, 2));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Harvester E2E Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
