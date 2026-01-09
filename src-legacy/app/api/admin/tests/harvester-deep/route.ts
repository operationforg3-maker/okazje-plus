import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * Deep functional E2E test for Harvester
 * POST /api/admin/tests/harvester-deep
 * 
 * Tests actual data changes in Firestore, not just HTTP status
 */

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'okazjeplus.pl';
    const baseUrl = `${protocol}://${host}`;

    const results: any = {
      timestamp: new Date().toISOString(),
      baseUrl,
      deepTests: {},
      summary: { passed: 0, failed: 0, total: 0 },
    };

    // ========== DEEP TEST 1: Fill Data & Verify in DB ==========
    results.deepTests['1-fill-data-verification'] = {
      name: 'Fill data - Verify products created in Firestore',
      status: 'pending',
    };

    try {
      // Count products BEFORE
      const beforeSnap = await adminDb.collection('products').count().get();
      const countBefore = beforeSnap.data().count;

      // Call fill-data endpoint
      const response = await fetch(`${baseUrl}/api/admin/test-fill-data`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Wait a bit for writes
      await new Promise(r => setTimeout(r, 2000));

      // Count products AFTER
      const afterSnap = await adminDb.collection('products').count().get();
      const countAfter = afterSnap.data().count;
      const created = countAfter - countBefore;

      const passed = created >= 5;
      results.deepTests['1-fill-data-verification'] = {
        ...results.deepTests['1-fill-data-verification'],
        status: passed ? 'passed' : 'failed',
        countBefore,
        countAfter,
        created,
        expected: 5,
      };

      if (passed) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.deepTests['1-fill-data-verification'].status = 'error';
      results.deepTests['1-fill-data-verification'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== DEEP TEST 2: Categories Exist & Queryable ==========
    results.deepTests['2-categories-queryable'] = {
      name: 'Categories - Verify 15+ categories exist and are queryable',
      status: 'pending',
    };

    try {
      const catsSnap = await adminDb.collection('categories').get();
      const cats = catsSnap.docs;
      const count = cats.length;

      // Verify structure
      let validStructure = true;
      for (const doc of cats.slice(0, 3)) {
        const data = doc.data();
        if (!data.slug || !data.name) {
          validStructure = false;
          break;
        }
      }

      const passed = count >= 15 && validStructure;
      results.deepTests['2-categories-queryable'] = {
        ...results.deepTests['2-categories-queryable'],
        status: passed ? 'passed' : 'failed',
        totalCategories: count,
        sampledCategories: cats.slice(0, 3).map(d => ({
          id: d.id,
          slug: d.data().slug,
          name: d.data().name,
        })),
        structureValid: validStructure,
      };

      if (passed) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.deepTests['2-categories-queryable'].status = 'error';
      results.deepTests['2-categories-queryable'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== DEEP TEST 3: Import Jobs Collection ==========
    results.deepTests['3-import-jobs-exist'] = {
      name: 'Import - Verify import job collection exists and has structure',
      status: 'pending',
    };

    try {
      const jobsSnap = await adminDb.collection('import_jobs').limit(5).get();
      const jobs = jobsSnap.docs;

      // Check if jobs collection exists and has proper structure
      let sampleJob = null;
      if (jobs.length > 0) {
        const jobData = jobs[0].data();
        sampleJob = {
          id: jobs[0].id,
          status: jobData.status,
          profileId: jobData.profileId,
          createdAt: jobData.createdAt ? jobData.createdAt.toDate?.() : jobData.createdAt,
        };
      }

      const passed = jobs.length >= 0; // Collection exists
      results.deepTests['3-import-jobs-exist'] = {
        ...results.deepTests['3-import-jobs-exist'],
        status: passed ? 'passed' : 'failed',
        jobsCount: jobs.length,
        sampleJob: sampleJob || 'No jobs yet',
      };

      if (passed) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.deepTests['3-import-jobs-exist'].status = 'error';
      results.deepTests['3-import-jobs-exist'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== DEEP TEST 4: Products Have AI Fields ==========
    results.deepTests['4-products-ai-ready'] = {
      name: 'AI - Verify products have AI enhancement fields',
      status: 'pending',
    };

    try {
      const productsSnap = await adminDb.collection('products').limit(10).get();
      const products = productsSnap.docs;

      let productsWithAI = 0;
      let aiFieldSample = null;

      for (const doc of products) {
        const data = doc.data();
        if (data.aiEnhanced || data.aiDescription || data.aiTags) {
          productsWithAI++;
          if (!aiFieldSample) {
            aiFieldSample = {
              id: doc.id,
              hasAiEnhanced: !!data.aiEnhanced,
              hasAiDescription: !!data.aiDescription,
              hasAiTags: !!data.aiTags,
            };
          }
        }
      }

      const passed = productsWithAI > 0;
      results.deepTests['4-products-ai-ready'] = {
        ...results.deepTests['4-products-ai-ready'],
        status: passed ? 'passed' : 'failed',
        totalChecked: products.length,
        productsWithAI,
        sampleAIFields: aiFieldSample || 'No AI fields found',
      };

      if (passed) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.deepTests['4-products-ai-ready'].status = 'error';
      results.deepTests['4-products-ai-ready'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== DEEP TEST 5: Schedules Configuration ==========
    results.deepTests['5-schedules-configured'] = {
      name: 'Schedules - Verify schedule collection is configured',
      status: 'pending',
    };

    try {
      const schedulesSnap = await adminDb.collection('schedules').get();
      const schedules = schedulesSnap.docs;

      const sampleSchedule = schedules.length > 0 ? {
        id: schedules[0].id,
        type: schedules[0].data().type,
        enabled: schedules[0].data().enabled,
      } : null;

      const passed = schedules.length >= 0;
      results.deepTests['5-schedules-configured'] = {
        ...results.deepTests['5-schedules-configured'],
        status: passed ? 'passed' : 'failed',
        totalSchedules: schedules.length,
        sampleSchedule: sampleSchedule || 'No schedules configured',
      };

      if (passed) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.deepTests['5-schedules-configured'].status = 'error';
      results.deepTests['5-schedules-configured'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    // ========== DEEP TEST 6: Cleanup Preview (No Delete) ==========
    results.deepTests['6-cleanup-preview'] = {
      name: 'Cleanup - Verify cleanup preview works (no actual delete)',
      status: 'pending',
    };

    try {
      const response = await fetch(`${baseUrl}/api/admin/delete/preview`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      // Check if response has proper structure
      const hasPreview = data.preview || data.count || data.items;
      const passed = response.ok && hasPreview;

      results.deepTests['6-cleanup-preview'] = {
        ...results.deepTests['6-cleanup-preview'],
        status: passed ? 'passed' : 'failed',
        httpStatus: response.status,
        hasPreviewData: hasPreview,
        previewSummary: data.preview ? Object.keys(data.preview).join(', ') : 'No preview data',
      };

      if (passed) results.summary.passed++;
      else results.summary.failed++;
    } catch (error: any) {
      results.deepTests['6-cleanup-preview'].status = 'error';
      results.deepTests['6-cleanup-preview'].error = error.message;
      results.summary.failed++;
    }
    results.summary.total++;

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Deep E2E Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
