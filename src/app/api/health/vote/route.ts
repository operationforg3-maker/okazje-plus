import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, doc, getDoc, orderBy } from 'firebase/firestore';

/**
 * Voting system health check
 * GET /api/health/vote
 * 
 * Sprawdza czy system głosowania działa prawidłowo
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {} as Record<string, any>,
  };

  try {
    // 1. Znajdź przykładową okazję z głosami
    let dealsSnapshot;
    try {
      // Używamy orderBy zamiast where dla lepszej zgodności z indeksem
      const dealsQuery = query(
        collection(db, 'deals'),
        where('status', '==', 'approved'),
        orderBy('voteCount', 'desc'),
        limit(1)
      );
      dealsSnapshot = await getDocs(dealsQuery);
    } catch (indexError: any) {
      // Brak indeksu - użyj prostszego query
      results.checks.indexWarning = {
        status: 'warning',
        message: 'Missing Firestore index for status+voteCount query',
        action: 'Run: firebase deploy --only firestore:indexes',
      };
      
      // Fallback: pobierz wszystkie approved i filtruj w pamięci
      const simpleQuery = query(
        collection(db, 'deals'),
        where('status', '==', 'approved'),
        limit(100)
      );
      const allDeals = await getDocs(simpleQuery);
      const dealsWithVotes = allDeals.docs.filter(d => (d.data().voteCount || 0) > 0);
      
      if (dealsWithVotes.length === 0) {
        results.checks.sampleDeal = {
          status: 'warning',
          message: 'No deals with votes found (using fallback query)',
        };
        dealsSnapshot = { empty: true, docs: [] } as any;
      } else {
        dealsSnapshot = { empty: false, docs: [dealsWithVotes[0]] } as any;
      }
    }

    if (dealsSnapshot.empty) {
      results.checks.sampleDeal = {
        status: 'warning',
        message: 'No deals with votes found for testing',
      };
    } else {
      const deal = dealsSnapshot.docs[0];
      const dealData = deal.data();
      
      results.checks.sampleDeal = {
        status: 'ok',
        dealId: deal.id,
        voteCount: dealData.voteCount,
        temperature: dealData.temperature,
      };

      // 2. Sprawdź strukturę subcollection votes
      try {
        const votesSnapshot = await getDocs(collection(db, 'deals', deal.id, 'votes'));
        results.checks.votesSubcollection = {
          status: 'ok',
          count: votesSnapshot.size,
          message: `Found ${votesSnapshot.size} vote document(s)`,
        };

        // 3. Weryfikuj spójność
        const expectedVoteCount = dealData.voteCount || 0;
        if (votesSnapshot.size !== Math.abs(expectedVoteCount)) {
          results.checks.consistency = {
            status: 'warning',
            message: `Mismatch: voteCount=${expectedVoteCount}, votes docs=${votesSnapshot.size}`,
            details: {
              voteCountField: expectedVoteCount,
              actualVoteDocs: votesSnapshot.size,
            },
          };
        } else {
          results.checks.consistency = {
            status: 'ok',
            message: 'Vote count matches subcollection size',
          };
        }
      } catch (error: any) {
        results.checks.votesSubcollection = {
          status: 'error',
          message: error.message,
        };
        results.status = 'degraded';
      }
    }

    // 4. Test Firebase Admin (potrzebny do weryfikacji tokenów)
    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      results.checks.firebaseAdmin = {
        status: 'ok',
        message: 'Firebase Admin SDK loaded (required for token verification)',
      };
    } catch (error: any) {
      results.checks.firebaseAdmin = {
        status: 'error',
        message: `Firebase Admin SDK error: ${error.message}`,
        impact: 'Vote requests will fail with 401 Unauthorized',
      };
      results.status = 'error';
    }

    // 5. Test endpoint accessibility
    const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002';
    results.checks.voteEndpoint = {
      status: 'info',
      url: `${apiUrl}/api/deals/[id]/vote`,
      method: 'POST',
      requiredHeaders: ['Authorization: Bearer <token>', 'Content-Type: application/json'],
      requiredBody: { action: 'up | down | remove' },
    };

    // Performance
    const responseTime = Date.now() - startTime;
    results.performance = {
      responseTime: `${responseTime}ms`,
    };

    // Overall status
    const hasErrors = Object.values(results.checks).some(
      (check: any) => check.status === 'error'
    );
    if (hasErrors) {
      results.status = 'error';
    }

  } catch (error: any) {
    results.status = 'error';
    results.error = error.message;
    results.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
  }

  const statusCode = results.status === 'ok' ? 200 : results.status === 'degraded' ? 207 : 500;

  return NextResponse.json(results, { status: statusCode });
}
