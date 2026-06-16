import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { SmartHarvester } from '@/lib/automation/harvester';
import { adminDb } from '@/lib/firebase-admin';

const HARVESTER_STALE_MS = 15 * 60 * 1000;

/**
 * POST /api/admin/harvester/run
 * 
 * Uruchamia Harvester do pobierania produktów z Convertiser/AliExpress/Amazon/Allegro
 * 
 * Request body:
 * {
 *   source: 'convertiser' | 'aliexpress' | 'amazon' | 'allegro',
 *   query: string,
 *   maxResults: number (10-1000)
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
      autoBrowse = false, // Convertiser: fetch entire catalog without keywords
      importStrategy = 'bestsellers',
      resumeFromJobId,
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

    if (!['bestsellers', 'price_asc'].includes(importStrategy)) {
      return NextResponse.json(
        { error: 'Invalid importStrategy. Must be bestsellers or price_asc' },
        { status: 400 }
      );
    }

    if (source === 'convertiser' && !process.env.CONVERTISER_API_TOKEN) {
      return NextResponse.json(
        { error: 'Convertiser API token nie jest skonfigurowany (CONVERTISER_API_TOKEN)' },
        { status: 400 }
      );
    }

    const max = Math.max(10, Math.min(1000, maxResults || 50));

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

    // 4b. Resume support: continue only remaining categories from previous job
    if (resumeFromJobId && categories && categories.length > 0) {
      const previousJobRef = adminDb.collection('harvester_jobs').doc(String(resumeFromJobId));
      const previousJobSnap = await previousJobRef.get();

      if (!previousJobSnap.exists) {
        return NextResponse.json(
          { error: `Nie znaleziono joba do wznowienia: ${resumeFromJobId}` },
          { status: 404 }
        );
      }

      const previousJob = previousJobSnap.data() as any;
      const processed = Array.isArray(previousJob?.processedCategories)
        ? previousJob.processedCategories
        : [];

      const completedCategories = new Set<string>(
        processed
          .map((entry: any) => String(entry?.category || '').trim())
          .filter((entry: string) => entry.length > 0)
      );

      const remainingCategories = categories.filter((category) => !completedCategories.has(category));

      const lastUpdatedAt = Date.parse(previousJob?.lastUpdatedAt || '');
      const isStaleRunning =
        previousJob?.status === 'running' &&
        Number.isFinite(lastUpdatedAt) &&
        Date.now() - lastUpdatedAt > HARVESTER_STALE_MS;

      if (isStaleRunning) {
        const existingLogs = Array.isArray(previousJob?.logs) ? previousJob.logs : [];
        await previousJobRef.set(
          {
            status: 'failed',
            completedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            orphaned: true,
            orphanedReason: `Brak heartbeat > ${Math.round(HARVESTER_STALE_MS / 60000)} min`,
            logs: [
              ...existingLogs.slice(-199),
              {
                level: 'error',
                message: `Job oznaczony jako osierocony podczas wznawiania: brak heartbeat > ${Math.round(HARVESTER_STALE_MS / 60000)} min`,
                timestamp: new Date().toISOString(),
              },
            ],
          },
          { merge: true }
        );
      }

      if (remainingCategories.length === 0) {
        return NextResponse.json(
          {
            success: true,
            resumed: true,
            message: 'Brak kategorii do wznowienia — wszystkie zostały już oznaczone jako przetworzone.',
            previousJobId: resumeFromJobId,
            remainingCategories: 0,
          },
          { status: 200 }
        );
      }

      categories = remainingCategories;
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
      source: source as 'aliexpress' | 'amazon' | 'allegro' | 'convertiser' | 'manual',
      query: effectiveQuery,
      maxResults: max,
      productsFound: 0,
      productsCreated: 0,
      dealsCreated: 0,
      dealsLinked: 0,
      duplicatesSkipped: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      logs: [],
    };

    // 6b. Save initial job record to Firestore synchronously to prevent CPU throttling from losing it
    await adminDb.collection('harvester_jobs').doc(jobId).set(initialJob);

    // 7. Run harvest in background (don't await - async execution)
    harvester.harvestProducts(
      source as 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
      effectiveQuery,
      max,
      categories,
      isTreeMode,
      source === 'convertiser' ? convertiserMode : undefined,
      autoBrowse,
      source === 'aliexpress' ? importStrategy : 'bestsellers'
    ).catch((err) => {
      console.error(`[Harvester ${jobId}] Background job failed:`, err);
    });

    // Give the background job 2 seconds of guaranteed CPU processing before returning
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
