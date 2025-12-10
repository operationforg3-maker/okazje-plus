/**
 * Harvester/Jobs Compatibility Endpoint
 * POST /api/admin/import/queue
 * 
 * DELEGATES TO: /api/admin/import/start (new 5-stage pipeline system)
 * 
 * Purpose:
 * - Accept import jobs from old harvester/UI system  
 * - Route to new robust 5-stage pipeline
 * - Maintain backward compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  console.log('[Queue] ===== POST /api/admin/import/queue =====');
  
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    
    if (!authResult.authorized) {
      console.error('[Queue] ❌ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[Queue] Request body:', body);

    const {
      sources = { aliexpress: true },
      maxProductsPerCategory = 20,
      enableAIEnrichment = false,
      importerType = 'keyword-search',
    } = body;

    // Get enabled sources
    const enabledSources = typeof sources === 'object' 
      ? Object.entries(sources)
          .filter(([_, enabled]) => enabled)
          .map(([source]) => source)
      : Array.isArray(sources) ? sources : ['aliexpress'];

    console.log('[Queue] Enabled sources:', enabledSources);

    if (enabledSources.length === 0) {
      return NextResponse.json({ error: 'No sources enabled' }, { status: 400 });
    }

    // Map source to importerType
    const source = enabledSources[0];
    let finalImporterType = importerType;

    if (source === 'convertiser') {
      finalImporterType = 'convertiser';
    } else {
      finalImporterType = importerType || 'keyword-search';
    }

    console.log('[Queue] Delegating to /api/admin/import/start with importerType:', finalImporterType);

    // Get admin token from auth result
    const adminIdToken = authResult.idToken || '';

    // Delegate to new system
    const delegateUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://okazjeplus.pl';
    const delegatePath = `${delegateUrl.replace(/\/$/, '')}/api/admin/import/start`;
    
    console.log('[Queue] Calling:', delegatePath);

    const delegateResponse = await fetch(delegatePath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminIdToken}`,
      },
      body: JSON.stringify({
        type: 'products',
        maxItemsPerSubcategory: maxProductsPerCategory,
        importerType: finalImporterType,
      }),
    });

    if (!delegateResponse.ok) {
      const errorData = await delegateResponse.json().catch(() => ({}));
      console.error('[Queue] Delegation failed:', errorData);
      
      return NextResponse.json(
        { 
          error: 'Failed to delegate to import system',
          details: errorData,
        },
        { status: delegateResponse.status }
      );
    }

    const delegateData = await delegateResponse.json();
    console.log('[Queue] ✅ Delegated successfully:', delegateData);

    // Create backward-compatible job entry
    const jobId = delegateData.jobId || `queue-${Date.now()}`;
    const importJobRef = adminDb.collection('importJobs').doc(jobId);
    
    try {
      await importJobRef.set({
        id: jobId,
        status: 'queued',
        sources: enabledSources,
        config: {
          maxProductsPerCategory,
          enableAIEnrichment,
          importerType: finalImporterType,
        },
        createdAt: new Date().toISOString(),
        createdBy: authResult.uid,
        startedAt: null,
        completedAt: null,
        stats: { created: 0, updated: 0, skipped: 0, errors: 0 },
        note: `Delegated to /api/admin/import/start (${finalImporterType})`,
      });
      
      console.log('[Queue] ✅ Job entry created in importJobs');
    } catch (e: any) {
      console.warn('[Queue] Warning: Could not create importJobs entry:', e.message);
    }

    console.log('[Queue] ===== SUCCESS =====');
    return NextResponse.json({
      success: true,
      jobId,
      message: `Import delegated to new 5-stage pipeline (${finalImporterType})`,
      sources: enabledSources,
      config: {
        maxProductsPerCategory,
        importerType: finalImporterType,
      },
    });

  } catch (error: any) {
    console.error('[Queue] ❌ ERROR:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/import/queue/{jobId}
 * Track job progress
 */
export async function GET(req: NextRequest) {
  console.log('[Queue GET] Request...');
  
  try {
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract jobId from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId || jobId === 'queue') {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    console.log('[Queue GET] Fetching job:', jobId);

    // Try new system first, then backward compat
    let jobData = null;
    let source = 'unknown';

    try {
      const snap = await adminDb.collection('import_jobs').doc(jobId).get();
      if (snap.exists) {
        jobData = snap.data();
        source = 'import_jobs (new)';
      }
    } catch (e) {
      console.warn('[Queue GET] import_jobs lookup failed');
    }

    if (!jobData) {
      try {
        const snap = await adminDb.collection('importJobs').doc(jobId).get();
        if (snap.exists) {
          jobData = snap.data();
          source = 'importJobs (compat)';
        }
      } catch (e) {
        console.warn('[Queue GET] importJobs lookup failed');
      }
    }

    if (!jobData) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log('[Queue GET] ✅ Found in', source);

    // Map to common response format
    const response = {
      id: jobData.id || jobId,
      status: jobData.status || 'unknown',
      progress: jobData.progress || {},
      stats: jobData.stats || {},
      sources: jobData.sources || [],
      config: jobData.config || {},
      createdAt: jobData.createdAt,
      startedAt: jobData.startedAt,
      completedAt: jobData.completedAt,
      error: jobData.error,
      source,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Queue GET] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
