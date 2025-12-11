import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

/**
 * Health check endpoint - weryfikuje wszystkie kluczowe systemy
 * GET /api/health
 * GET /api/health?detailed=true - pełne informacje
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const detailed = searchParams.get('detailed') === 'true';
  
  const startTime = Date.now();
  const results: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {} as Record<string, any>,
  };

  try {
    // 1. Firestore connectivity
    try {
      const dealsQuery = query(
        collection(db, 'deals'),
        where('status', '==', 'approved'),
        limit(1)
      );
      const snapshot = await getDocs(dealsQuery);
      results.checks.firestore = {
        status: 'ok',
        message: `Connected, found ${snapshot.size} deal(s)`,
      };
    } catch (error: any) {
      results.checks.firestore = {
        status: 'error',
        message: error.message,
      };
      results.status = 'degraded';
    }

    // 2. Categories check
    try {
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      results.checks.categories = {
        status: 'ok',
        count: categoriesSnapshot.size,
      };
    } catch (error: any) {
      results.checks.categories = {
        status: 'error',
        message: error.message,
      };
      results.status = 'degraded';
    }

    // 3. Environment variables check
    const envChecks = {
      firebaseConfig: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      geminiKey: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENAI_API_KEY,
      siteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
    };
    
    results.checks.environment = {
      status: Object.values(envChecks).every(Boolean) ? 'ok' : 'warning',
      variables: envChecks,
    };

    // 4. Firebase Admin check (tylko detailed)
    if (detailed) {
      try {
        const { adminAuth } = await import('@/lib/firebase-admin');
        // Próba pobrania listy użytkowników (limit 1) jako test
        const listResult = await adminAuth.listUsers(1);
        results.checks.firebaseAdmin = {
          status: 'ok',
          message: 'Firebase Admin SDK operational',
        };
      } catch (error: any) {
        results.checks.firebaseAdmin = {
          status: 'error',
          message: error.message,
        };
        results.status = 'degraded';
      }
    }

    // 5. Performance metrics
    const responseTime = Date.now() - startTime;
    results.performance = {
      responseTime: `${responseTime}ms`,
      status: responseTime < 1000 ? 'ok' : responseTime < 3000 ? 'warning' : 'slow',
    };

    // Determine overall status
    const hasErrors = Object.values(results.checks).some(
      (check: any) => check.status === 'error'
    );
    if (hasErrors) {
      results.status = 'degraded';
    }

  } catch (error: any) {
    results.status = 'error';
    results.error = error.message;
  }

  const statusCode = results.status === 'ok' ? 200 : results.status === 'degraded' ? 207 : 500;

  return NextResponse.json(results, { status: statusCode });
}
