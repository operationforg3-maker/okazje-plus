import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

interface VoteTest {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
}

/**
 * /api/admin/tests/voting - Integration tests for voting system
 * 
 * Tests:
 * 1. Firebase connectivity
 * 2. Firebase Admin token verification
 * 3. Find deals with votes
 * 4. Check vote subcollection structure
 * 5. Verify data consistency (voteCount vs votes docs)
 * 6. Check vote endpoint response format
 */

export async function POST(request: NextRequest) {
  const tests: VoteTest[] = [];
  
  try {
    // Get auth header for vote endpoint test
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        status: 'error',
        message: 'Authorization header required',
        tests: [
          {
            name: 'Authorization Check',
            status: 'fail',
            message: 'No Authorization header provided',
            duration: 0,
          }
        ]
      }, { status: 401 });
    }

    // Verify token (same pattern as import-functional test)
    let token: string;
    try {
      token = authHeader.substring(7);
      await adminAuth.verifyIdToken(token);
    } catch (error: any) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid token',
        tests: [
          {
            name: 'Authorization Check',
            status: 'fail',
            message: error?.message || 'Invalid token',
            duration: 0,
          }
        ]
      }, { status: 401 });
    }

    // Test 1: Firestore connectivity (admin)
    let start = Date.now();
    try {
      const snapshot = await adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .limit(1)
        .get();

      tests.push({
        name: 'Firestore Connectivity',
        status: snapshot.size > 0 ? 'pass' : 'skip',
        message: snapshot.size > 0 ? `Found ${snapshot.size} deal(s)` : 'No approved deals in DB',
        duration: Date.now() - start,
      });
    } catch (error: any) {
      tests.push({
        name: 'Firestore Connectivity',
        status: 'fail',
        message: error.message,
        duration: Date.now() - start,
      });
    }

    // Test 2: Firebase Admin SDK
    start = Date.now();
    try {
      const token = authHeader.substring(7); // Remove 'Bearer '
      const decodedToken = await adminAuth.verifyIdToken(token);
      tests.push({
        name: 'Firebase Admin Token Verification',
        status: 'pass',
        message: `Token verified for user: ${decodedToken.uid}`,
        duration: Date.now() - start,
      });
    } catch (error: any) {
      tests.push({
        name: 'Firebase Admin Token Verification',
        status: 'fail',
        message: error.message,
        duration: Date.now() - start,
      });
    }

    // Test 3: Find deals with votes
    start = Date.now();
    let testDealId: string | null = null;
    try {
      const allDealsSnapshot = await adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .limit(50)
        .get();
      
      let dealWithVotes = null;
      for (const d of allDealsSnapshot.docs) {
        const data = d.data();
        if ((data.voteCount || 0) > 0) {
          dealWithVotes = { id: d.id, ...data };
          testDealId = d.id;
          break;
        }
      }

      if (dealWithVotes) {
        tests.push({
          name: 'Find Deal With Votes',
          status: 'pass',
          message: `Found deal ${testDealId} with voteCount=${dealWithVotes.voteCount}`,
          duration: Date.now() - start,
        });
      } else {
        tests.push({
          name: 'Find Deal With Votes',
          status: 'skip',
          message: 'No deals with votes found - creating test vote',
          duration: Date.now() - start,
        });

        // Create test vote if no votes exist
        if (allDealsSnapshot.docs.length > 0) {
          const firstDeal = allDealsSnapshot.docs[0];
          testDealId = firstDeal.id;
          const voteRef = adminDb
            .collection('deals')
            .doc(testDealId)
            .collection('votes')
            .doc('test-user-' + Date.now());
          await voteRef.set({
            vote: 1,
            userId: 'test-user',
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (error: any) {
      tests.push({
        name: 'Find Deal With Votes',
        status: 'fail',
        message: error.message,
        duration: Date.now() - start,
      });
    }

    // Test 4: Check vote subcollection structure
    if (testDealId) {
      start = Date.now();
      try {
        const votesSnapshot = await adminDb
          .collection('deals')
          .doc(testDealId)
          .collection('votes')
          .get();
        const hasProperStructure = votesSnapshot.docs.every(v => {
          const data = v.data();
          return data.vote !== undefined && (data.userId !== undefined || data.createdAt !== undefined);
        });

        tests.push({
          name: 'Vote Subcollection Structure',
          status: hasProperStructure ? 'pass' : 'fail',
          message: `${votesSnapshot.size} vote docs - all have required fields: ${hasProperStructure}`,
          duration: Date.now() - start,
        });
      } catch (error: any) {
        tests.push({
          name: 'Vote Subcollection Structure',
          status: 'fail',
          message: error.message,
          duration: Date.now() - start,
        });
      }
    }

    // Test 5: Data consistency (voteCount vs votes docs)
    if (testDealId) {
      start = Date.now();
      try {
        const dealDoc = await adminDb.collection('deals').doc(testDealId).get();
        const votesSnapshot = await adminDb
          .collection('deals')
          .doc(testDealId)
          .collection('votes')
          .get();
        
        const dealData = dealDoc.data() || {};
        const voteCountField = dealData?.voteCount || 0;
        const votesDocCount = votesSnapshot.size;

        const isConsistent = voteCountField === votesDocCount;
        tests.push({
          name: 'Data Consistency Check',
          status: isConsistent ? 'pass' : 'fail',
          message: isConsistent 
            ? `✓ voteCount=${voteCountField} matches votes docs=${votesDocCount}`
            : `✗ voteCount=${voteCountField} but votes docs=${votesDocCount}`,
          duration: Date.now() - start,
        });
      } catch (error: any) {
        tests.push({
          name: 'Data Consistency Check',
          status: 'fail',
          message: error.message,
          duration: Date.now() - start,
        });
      }
    }

    // Test 6: Vote endpoint format check
    start = Date.now();
    try {
      if (testDealId && authHeader) {
        // Simulate vote request to check response format
        const voteResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/deals/${testDealId}/vote`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({ action: 'up' }),
          }
        );

        const responseText = await voteResponse.text();
        let responseData: any;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        }

        if (voteResponse.ok && responseData.success !== false) {
          tests.push({
            name: 'Vote Endpoint Response Format',
            status: 'pass',
            message: `Valid response with success=${responseData.success}`,
            duration: Date.now() - start,
          });
        } else {
          tests.push({
            name: 'Vote Endpoint Response Format',
            status: 'fail',
            message: `Status ${voteResponse.status}: ${responseData.message || 'Unknown error'}`,
            duration: Date.now() - start,
          });
        }
      }
    } catch (error: any) {
      tests.push({
        name: 'Vote Endpoint Response Format',
        status: 'fail',
        message: error.message,
        duration: Date.now() - start,
      });
    }

    // Summary
    const passed = tests.filter(t => t.status === 'pass').length;
    const failed = tests.filter(t => t.status === 'fail').length;
    const skipped = tests.filter(t => t.status === 'skip').length;
    const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);

    const overallStatus = failed > 0 ? 'FAILED' : 'PASSED';

    return NextResponse.json({
      status: overallStatus,
      summary: {
        total: tests.length,
        passed,
        failed,
        skipped,
        totalDurationMs: totalDuration,
      },
      tests,
    }, { status: failed > 0 ? 207 : 200 });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      tests,
    }, { status: 500 });
  }
}
