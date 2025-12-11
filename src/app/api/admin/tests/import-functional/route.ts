import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * Import Functional Test - Tests real AliExpress & Convertiser imports
 * POST /api/admin/tests/import-functional
 * 
 * Tests:
 * 1. Start import from AliExpress
 * 2. Start import from Convertiser
 * 3. Wait for job completion
 * 4. Verify products imported with correct structure
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
      imports: {},
      summary: { completed: 0, pending: 0, total: 0 },
    };

    // ========== IMPORT 1: AliExpress ==========
    results.imports['1-aliexpress'] = {
      name: 'AliExpress Import',
      profileId: 'aliexpress_pl',
      status: 'starting',
      steps: [],
    };

    try {
      // Step 1: Start import
      results.imports['1-aliexpress'].steps.push({
        step: 'Start import job',
        status: 'pending',
      });

      const startResp = await fetch(`${baseUrl}/api/admin/import/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: 'aliexpress_pl',
          max: 10, // Import only 10 for testing
        }),
      });

      const startData = await startResp.json();
      const jobId1 = startData.jobId || startData.id;

      results.imports['1-aliexpress'].steps[0].status = startResp.ok ? 'completed' : 'failed';
      results.imports['1-aliexpress'].steps[0].jobId = jobId1;
      results.imports['1-aliexpress'].steps[0].httpStatus = startResp.status;

      if (!startResp.ok) {
        throw new Error(`Start failed: HTTP ${startResp.status}`);
      }

      // Step 2: Wait for job to complete
      results.imports['1-aliexpress'].steps.push({
        step: 'Wait for job completion',
        status: 'pending',
        jobId: jobId1,
      });

      let jobCompleted = false;
      let jobData = null;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout (1 sec per attempt)

      while (!jobCompleted && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
        attempts++;

        // Check job status
        const jobSnap = await adminDb.collection('import_jobs').doc(jobId1).get();
        if (jobSnap.exists) {
          jobData = jobSnap.data();
          if (jobData.status === 'completed' || jobData.status === 'failed') {
            jobCompleted = true;
          }
        }
      }

      results.imports['1-aliexpress'].steps[1].status = jobCompleted ? 'completed' : 'timeout';
      results.imports['1-aliexpress'].steps[1].jobStatus = jobData?.status || 'unknown';
      results.imports['1-aliexpress'].steps[1].attempts = attempts;

      if (!jobCompleted) {
        throw new Error(`Job timeout after ${attempts}s`);
      }

      // Step 3: Verify imported products
      results.imports['1-aliexpress'].steps.push({
        step: 'Verify imported products',
        status: 'pending',
      });

      const productsSnap = await adminDb
        .collection('products')
        .where('source', '==', 'aliexpress')
        .limit(5)
        .get();

      const importedProducts = productsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'N/A',
          price: data.price || 'N/A',
          source: data.source,
          hasImage: !!data.imageUrl,
          hasDescription: !!data.description,
          hasCategories: !!data.mainCategorySlug,
        };
      });

      const hasValidStructure = importedProducts.every(p =>
        p.title && p.price && p.hasImage && p.hasDescription
      );

      results.imports['1-aliexpress'].steps[2].status = importedProducts.length > 0 ? 'completed' : 'no-products';
      results.imports['1-aliexpress'].steps[2].productsFound = importedProducts.length;
      results.imports['1-aliexpress'].steps[2].validStructure = hasValidStructure;
      results.imports['1-aliexpress'].steps[2].samples = importedProducts;

      results.imports['1-aliexpress'].status = importedProducts.length > 0 ? 'success' : 'no-products';
      results.imports['1-aliexpress'].productCount = importedProducts.length;

      if (importedProducts.length > 0) results.summary.completed++;
      else results.summary.pending++;
    } catch (error: any) {
      results.imports['1-aliexpress'].status = 'error';
      results.imports['1-aliexpress'].error = error.message;
      results.summary.pending++;
    }
    results.summary.total++;

    // ========== IMPORT 2: Convertiser ==========
    results.imports['2-convertiser'] = {
      name: 'Convertiser Import',
      profileId: 'convertiser_pl',
      status: 'starting',
      steps: [],
    };

    try {
      // Step 1: Start import
      results.imports['2-convertiser'].steps.push({
        step: 'Start import job',
        status: 'pending',
      });

      const startResp = await fetch(`${baseUrl}/api/admin/import/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: 'convertiser_pl',
          max: 10,
        }),
      });

      const startData = await startResp.json();
      const jobId2 = startData.jobId || startData.id;

      results.imports['2-convertiser'].steps[0].status = startResp.ok ? 'completed' : 'failed';
      results.imports['2-convertiser'].steps[0].jobId = jobId2;
      results.imports['2-convertiser'].steps[0].httpStatus = startResp.status;

      if (!startResp.ok) {
        throw new Error(`Start failed: HTTP ${startResp.status}`);
      }

      // Step 2: Wait for job
      results.imports['2-convertiser'].steps.push({
        step: 'Wait for job completion',
        status: 'pending',
        jobId: jobId2,
      });

      let jobCompleted = false;
      let jobData = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!jobCompleted && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
        attempts++;

        const jobSnap = await adminDb.collection('import_jobs').doc(jobId2).get();
        if (jobSnap.exists) {
          jobData = jobSnap.data();
          if (jobData.status === 'completed' || jobData.status === 'failed') {
            jobCompleted = true;
          }
        }
      }

      results.imports['2-convertiser'].steps[1].status = jobCompleted ? 'completed' : 'timeout';
      results.imports['2-convertiser'].steps[1].jobStatus = jobData?.status || 'unknown';
      results.imports['2-convertiser'].steps[1].attempts = attempts;

      if (!jobCompleted) {
        throw new Error(`Job timeout after ${attempts}s`);
      }

      // Step 3: Verify imported products
      results.imports['2-convertiser'].steps.push({
        step: 'Verify imported products',
        status: 'pending',
      });

      const productsSnap = await adminDb
        .collection('products')
        .where('source', '==', 'convertiser')
        .limit(5)
        .get();

      const importedProducts = productsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'N/A',
          price: data.price || 'N/A',
          source: data.source,
          hasImage: !!data.imageUrl,
          hasDescription: !!data.description,
          hasCategories: !!data.mainCategorySlug,
        };
      });

      const hasValidStructure = importedProducts.every(p =>
        p.title && p.price && p.hasImage
      );

      results.imports['2-convertiser'].steps[2].status = importedProducts.length > 0 ? 'completed' : 'no-products';
      results.imports['2-convertiser'].steps[2].productsFound = importedProducts.length;
      results.imports['2-convertiser'].steps[2].validStructure = hasValidStructure;
      results.imports['2-convertiser'].steps[2].samples = importedProducts;

      results.imports['2-convertiser'].status = importedProducts.length > 0 ? 'success' : 'no-products';
      results.imports['2-convertiser'].productCount = importedProducts.length;

      if (importedProducts.length > 0) results.summary.completed++;
      else results.summary.pending++;
    } catch (error: any) {
      results.imports['2-convertiser'].status = 'error';
      results.imports['2-convertiser'].error = error.message;
      results.summary.pending++;
    }
    results.summary.total++;

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Import Functional Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
