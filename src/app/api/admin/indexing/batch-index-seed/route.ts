/**
 * Batch Index Seed Deals API Endpoint
 * 
 * POST /api/admin/indexing/batch-index-seed
 * 
 * Indeksuje wszystkie zatwierdzone deale z KROK 1 w Google Search Console
 * - Pobiera 60 dealów ze statusem 'approved'
 * - Wysyła je do Google Indexing API w batches
 * - Loguje status dla każdego deala
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { batchRequestIndexing } from '@/lib/google-indexing';
import { Deal } from '@/lib/types';

export async function POST(request: NextRequest) {
  console.log('🚀 Starting Batch Indexing of Seed Deals via API...');
  console.log('══════════════════════════════════════════════════════════');

  try {
    // Verify admin token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak nagłówka Authorization Bearer <idToken>' }, { status: 401 });
    }

    const { getAuth } = await import('firebase-admin/auth');
    const idToken = authHeader.substring('Bearer '.length).trim();
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[Batch Index] Token verify error', e);
      return NextResponse.json({ error: 'Nieprawidłowy token użytkownika' }, { status: 401 });
    }

    // Pobierz wszystkie zatwierdzone deale
    console.log('\n📋 Step 1: Fetching approved deals from Firestore...');
    const dealsRef = adminDb.collection('deals');
    const snapshot = await dealsRef.where('status', '==', 'approved').get();

    if (snapshot.empty) {
      console.log('⚠️ No approved deals found.');
      return NextResponse.json({ 
        ok: true, 
        message: 'No approved deals to index',
        summary: { total: 0, indexed: 0 }
      }, { status: 200 });
    }

    const approvedDeals: Array<Deal & { id: string }> = [];
    snapshot.forEach(doc => {
      const data = doc.data() as Deal;
      approvedDeals.push({
        ...data,
        id: doc.id,
      });
    });

    console.log(`✅ Found ${approvedDeals.length} approved deals`);

    // Konstruuj URLs dla każdego deala
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://okazje-plus.pl';
    const dealUrls = approvedDeals.map(deal => {
      const dealUrl = `${baseUrl}/pl/deals/${deal.id}`;
      return dealUrl;
    });

    console.log(`\n📦 Step 2: Preparing batch of ${dealUrls.length} URLs for Google Indexing...`);
    dealUrls.slice(0, 5).forEach((url, idx) => {
      console.log(`   ${idx + 1}. ${url}`);
    });
    if (dealUrls.length > 5) {
      console.log(`   ... and ${dealUrls.length - 5} more`);
    }

    // Wyślij do Google Indexing API
    console.log('\n🌐 Step 3: Submitting to Google Indexing API...');
    const indexingResults = await batchRequestIndexing(dealUrls);

    console.log(`\n✅ Indexing Results:`);
    console.log(`   Total URLs: ${dealUrls.length}`);
    
    // Count successes/failures
    const successful = indexingResults.filter(r => r.success).length;
    const failed = indexingResults.filter(r => !r.success).length;
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);

    // Log sukces dla każdego deala
    console.log('\n📝 Step 4: Logging results to Firestore...');
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    approvedDeals.forEach((deal, idx) => {
      const result = indexingResults[idx];
      const docRef = dealsRef.doc(deal.id);
      batch.update(docRef, {
        indexedAt: now,
        indexingStatus: result.success ? 'submitted' : 'failed',
        indexingError: result.error || null,
      });
    });

    await batch.commit();
    console.log(`✅ Logged indexing status for ${approvedDeals.length} deals`);

    console.log('\n' + '══════════════════════════════════════════════════════════');
    console.log('✨ BATCH INDEXING COMPLETE! ✨');
    console.log('📊 Summary:');
    console.log(`   ✅ ${successful} deals successfully submitted`);
    console.log(`   ❌ ${failed} deals failed`);
    console.log(`   ⏱️  Quota: ~${dealUrls.length} requests used (200/day limit)`);

    return NextResponse.json({ 
      ok: true,
      message: 'Batch indexing completed',
      summary: { 
        total: dealUrls.length, 
        successful,
        failed,
        indexedAt: now,
      }
    }, { status: 200 });

  } catch (error) {
    console.error('\n❌ Error during batch indexing:', error);
    return NextResponse.json({ 
      error: 'Batch indexing failed', 
      message: (error as any)?.message 
    }, { status: 500 });
  }
}
