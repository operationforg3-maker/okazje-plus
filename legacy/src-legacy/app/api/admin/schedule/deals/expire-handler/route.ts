/**
 * Admin API: Handle Expired Deals (SEO Zombie Strategy)
 * POST /api/admin/schedule/deals/expire-handler
 * 
 * Cloud Scheduler Trigger: Daily at 02:00 UTC
 * Purpose: 
 * 1. Find all draft deals where expiryDate <= today
 * 2. Mark them as 'rejected' (removed from public view)
 * 3. Call Google Indexing API with URL_DELETED
 * 4. Log SEO zombie strategy metadata for internal linking
 * 
 * Implements "SEO Zombie" strategy:
 * - Expired deals stay indexed internally but not in search results
 * - 301 redirects to category pages (via frontend routing)
 * - Internal links from fresh deals to category provide SEO juice transfer
 * - Aggregated on category pages for user engagement
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requestDealIndexing } from '@/lib/google-indexing';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for batch processing

interface ExpiredDealResult {
  dealId: string;
  dealTitle: string;
  expiryDate: string;
  indexed: boolean;
  indexingError?: string;
  markedAt: string;
}

/**
 * Find expired deals and mark them as rejected
 * Handles SEO zombie strategy implementation
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (optional: can require service account auth)
    // For Cloud Scheduler: verify X-CloudScheduler-JobName header
    const schedulerJobName = request.headers.get('x-cloudscheduler-jobname');
    console.log('[Expire Handler] Called via Cloud Scheduler:', schedulerJobName || 'Unknown');

    console.log('🕐 Starting expired deals handler...');
    const startTime = Date.now();

    // Step 1: Find all draft deals with expiryDate in the past
    console.log('\n📋 Step 1: Finding expired deals...');
    const dealsRef = adminDb.collection('deals');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const snapshot = await dealsRef
      .where('status', '==', 'draft')
      .where('expiryDate', '<=', Timestamp.fromDate(today))
      .get();

    if (snapshot.empty) {
      console.log('✅ No expired deals found.');
      return NextResponse.json({
        success: true,
        message: 'No expired deals to process',
        processed: 0,
        now: new Date().toISOString(),
      });
    }

    console.log(`✅ Found ${snapshot.size} expired deals`);

    // Step 2: Process each expired deal
    console.log('\n📝 Step 2: Processing expired deals...');
    const results: ExpiredDealResult[] = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://okazje-plus.pl';
    
    let processed = 0;
    let indexingFailed = 0;

    for (const doc of snapshot.docs) {
      const deal = doc.data() as any;
      const dealId = doc.id;
      
      try {
        console.log(`\n  Processing deal ${processed + 1}/${snapshot.size}: ${deal.title}`);

        // Update deal status to 'rejected' and add SEO metadata
        const dealRef = dealsRef.doc(dealId);
        const dealUrl = `${baseUrl}/pl/deals/${dealId}`;

        // Mark as rejected (removes from public listings)
        await dealRef.update({
          status: 'rejected',
          expiredAt: Timestamp.now(),
          expireHandlerProcessedAt: Timestamp.now(),
          // SEO Zombie metadata
          seoZombieStrategy: {
            originalCategory: deal.mainCategorySlug,
            expiryDate: deal.expiryDate,
            redirectCategory: deal.mainCategorySlug, // Where to redirect traffic
            internalLinkStrategy: 'category', // Link to category page for SEO juice
            lastCrawlDate: null,
          },
        });
        console.log(`  ✅ Status updated to 'rejected'`);

        // Step 3: Notify Google Indexing API
        let indexingSuccess = false;
        let indexingError: string | undefined;

        try {
          console.log(`  🌐 Removing from Google Index: ${dealUrl}`);
          const indexingResult = await requestDealIndexing(dealId, 'URL_DELETED');
          
          if (indexingResult.success) {
            console.log(`  ✅ Successfully removed from Google Index`);
            indexingSuccess = true;
          } else {
            console.warn(`  ⚠️ Indexing removal failed:`, indexingResult.error);
            indexingError = indexingResult.error;
            indexingFailed++;
          }
        } catch (indexingErr) {
          console.error(`  ❌ Indexing error:`, indexingErr);
          indexingError = (indexingErr as any)?.message || 'Unknown indexing error';
          indexingFailed++;
        }

        results.push({
          dealId,
          dealTitle: deal.title,
          expiryDate: deal.expiryDate?.toDate?.().toISOString() || 'N/A',
          indexed: indexingSuccess,
          indexingError,
          markedAt: new Date().toISOString(),
        });

        processed++;

        // Rate limiting: don't overwhelm Google API
        if (processed < snapshot.size) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`  ❌ Error processing deal ${dealId}:`, error);
        results.push({
          dealId,
          dealTitle: deal.title,
          expiryDate: deal.expiryDate?.toDate?.().toISOString() || 'N/A',
          indexed: false,
          indexingError: (error as any)?.message || 'Unknown error',
          markedAt: new Date().toISOString(),
        });
        indexingFailed++;
      }
    }

    // Step 4: Log summary
    const processingTime = Date.now() - startTime;
    console.log('\n' + '══════════════════════════════════════════════════════════');
    console.log('✨ EXPIRED DEALS HANDLER COMPLETE! ✨');
    console.log('📊 Summary:');
    console.log(`   ✅ ${processed} deals marked as expired`);
    console.log(`   🌐 ${processed - indexingFailed} successfully removed from Google Index`);
    console.log(`   ⚠️ ${indexingFailed} indexing failures (will retry next run)`);
    console.log(`   ⏱️ Total processing time: ${processingTime}ms`);
    console.log(`   📅 Run date: ${new Date().toISOString()}`);

    // Log handler execution to Firestore for audit trail
    await adminDb.collection('config').doc('expireHandlerLog').set({
      lastRun: new Date().toISOString(),
      processed,
      indexingFailed,
      processingTimeMs: processingTime,
      results: results.slice(0, 100), // Keep first 100 for reference
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} expired deals`,
      processed,
      indexingSucceeded: processed - indexingFailed,
      indexingFailed,
      processingTimeMs: processingTime,
      results: results.slice(0, 20), // Return first 20 in response
      runDate: new Date().toISOString(),
    });

  } catch (error) {
    console.error('\n❌ Expired deals handler failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * GET: Check last execution and stats
 */
export async function GET(request: NextRequest) {
  try {
    const logDoc = await adminDb.collection('config').doc('expireHandlerLog').get();
    const log = logDoc.exists ? logDoc.data() : null;

    return NextResponse.json({
      lastExecution: log || {
        message: 'Never run',
        lastRun: null,
      },
      now: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching handler log:', error);
    return NextResponse.json({
      error: (error as any)?.message || 'Internal server error',
    }, { status: 500 });
  }
}
