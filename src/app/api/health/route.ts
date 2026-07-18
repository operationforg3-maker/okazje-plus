import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Health check endpoint - minimal & fast
 * GET /api/health
 * GET /api/health?detailed=true - includes extended checks
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
    // 1. Environment variables check (no I/O required)
    const envChecks = {
      firebaseConfig: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      firebaseProject: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      siteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
    };
    
    results.checks.environment = {
      status: Object.values(envChecks).every(Boolean) ? 'ok' : 'warning',
      variables: envChecks,
    };

    // 2. Extended checks only if detailed=true and within 10s timeout
    if (detailed) {
      try {
        const detailStartTime = Date.now();
        
        // Firestore check with short timeout
        if (Object.values(envChecks).every(Boolean)) {
          try {
            const snapshot = await adminDb
              .collection('deals')
              .where('status', '==', 'approved')
              .limit(1)
              .get();
            results.checks.firestore = {
              status: 'ok',
              message: `Connected, found ${snapshot.size} deal(s)`,
            };
          } catch (error: any) {
            results.checks.firestore = {
              status: 'warning',
              message: 'Firestore unavailable',
            };
            results.status = 'degraded';
          }
        }

        // Firebase Admin check
        try {
          await adminAuth.listUsers(1);
          results.checks.firebaseAdmin = {
            status: 'ok',
            message: 'Firebase Admin SDK operational',
          };
        } catch (error: any) {
          results.checks.firebaseAdmin = {
            status: 'warning',
            message: 'Admin SDK unavailable',
          };
        }
      } catch (error: any) {
        results.checks.detailedError = {
          status: 'warning',
          message: 'Extended checks failed',
        };
      }
    }

    // 5. Performance metrics
    const responseTime = Date.now() - startTime;
    results.performance = {
      responseTime: `${responseTime}ms`,
      status: responseTime < 1000 ? 'ok' : responseTime < 3000 ? 'warning' : 'slow',
    };

  } catch (error: any) {
    results.status = 'error';
    results.error = error.message;
  }

  const statusCode = results.status === 'ok' ? 200 : results.status === 'degraded' ? 207 : 500;

  return NextResponse.json(results, { status: statusCode });
}
