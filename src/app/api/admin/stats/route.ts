import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/auth-server';

export async function GET() {
  // Ensure only admins can access — separate try for auth
  let session;
  try {
    session = await requireAdmin();
  } catch (authError) {
    const message = (authError as any)?.message || '';
    const isUnauthorized = typeof message === 'string' && message.includes('Unauthorized');
    const status = isUnauthorized ? 401 : 403;
    return NextResponse.json(
      {
        success: false,
        error: isUnauthorized ? 'Nieautoryzowany' : 'Brak uprawnień',
      },
      { status }
    );
  }

  try {
    // Time window
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24Ts = Timestamp.fromDate(last24Hours);

    // Approved counts with fallback (M6: product_cores)
    let approvedDeals, approvedProducts, usersTotal;
    try {
      [approvedDeals, approvedProducts, usersTotal] = await Promise.all([
        adminDb.collection('deals').where('status', '==', 'approved').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
        adminDb.collection('users').count().get(),
      ]);
    } catch (err) {
      console.warn('[Admin Stats API] Approved counts error:', err);
      approvedDeals = { data: () => ({ count: 0 }) };
      approvedProducts = { data: () => ({ count: 0 }) };
      usersTotal = { data: () => ({ count: 0 }) };
    }

    // Pending/draft counts with fallback
    let pendingDeals, draftDeals, pendingProducts, draftProducts;
    try {
      [pendingDeals, draftDeals, pendingProducts, draftProducts] = await Promise.all([
        adminDb.collection('deals').where('status', '==', 'pending').count().get(),
        adminDb.collection('deals').where('status', '==', 'draft').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'pending_approval').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'draft').count().get(),
      ]);
    } catch (err) {
      console.warn('[Admin Stats API] Pending counts error:', err);
      pendingDeals = { data: () => ({ count: 0 }) };
      draftDeals = { data: () => ({ count: 0 }) };
      pendingProducts = { data: () => ({ count: 0 }) };
      draftProducts = { data: () => ({ count: 0 }) };
    }

    // New items in last 24h with fallback
    let newDeals24h, newUsers24h;
    try {
      [newDeals24h, newUsers24h] = await Promise.all([
        adminDb.collection('deals').where('createdAt', '>=', last24Ts).count().get(),
        adminDb.collection('users').where('createdAt', '>=', last24Ts).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      ]);
    } catch (err) {
      console.warn('[Admin Stats API] Recent 24h error:', err);
      newDeals24h = { data: () => ({ count: 0 }) };
      newUsers24h = { data: () => ({ count: 0 }) };
    }

    // Engagement proxy with fallback
    // REMOVED expensive loop for totalSavings as it is not used in the dashboard
    let totalSavings = 0;

    // Categories Calculation (Main, Sub, SubSub)
    let categoriesMain = 0;
    let categoriesSub = 0;
    let categoriesSubSub = 0;
    let categoriesTotal = 0;
    
    try {
       // 1. Get Main Categories (L1)
       const mainCatsSnap = await adminDb.collection('categories').get();
       categoriesMain = mainCatsSnap.size;

       // 2. Get All Subcategories (L2 + L3) - Collection Group
       const totalSubGroupSnap = await adminDb.collectionGroup('subcategories').count().get();
       const totalSubGroup = totalSubGroupSnap.data().count;

       // 3. Get Level 2 (direct children of Main)
       // Iterate only the main categories (approx 15-20 docs)
       const lvl2Counts = await Promise.all(
          mainCatsSnap.docs.map(doc => doc.ref.collection('subcategories').count().get())
       );
       categoriesSub = lvl2Counts.reduce((acc, snap) => acc + snap.data().count, 0);

       // 4. Calculate Level 3 and Total
       // Level 3 = (All Subcategories) - (Level 2)
       categoriesSubSub = Math.max(0, totalSubGroup - categoriesSub);
       categoriesTotal = categoriesMain + totalSubGroup;

    } catch(e) {
       console.warn('[Admin Stats API] Categories count detailed error:', e);
    }
    
    // Harvester Stats
    let harvesterRunning = 0;
    let harvesterCreated24h = 0;
    try {
       const [runningSnap, createdSnap] = await Promise.all([
          adminDb.collection('harvester_jobs').where('status', '==', 'running').count().get(),
          adminDb.collection('harvester_jobs').where('startedAt', '>=', last24Hours.toISOString()).count().get()
       ]);
       harvesterRunning = runningSnap.data().count;
       harvesterCreated24h = createdSnap.data().count;
    } catch(e) {
       console.warn('[Admin Stats API] Harvester stats error:', e);
    }
    
    // Analytics (Views/Clicks) - All Time & Today
    // User requested "Google Analytics" style stats matches -> All Time totals
    let viewsTotal = 0;
    let viewsToday = 0;
    let clicksTotal = 0;
    let clicksToday = 0;
    
    try {
        const todayStartTs = new Date(now.setHours(0,0,0,0)).toISOString();
        
        // Parallel queries
        const [viewsTotalSnap, viewsTodaySnap, clicksTotalSnap, clicksTodaySnap] = await Promise.all([
             // Total = All time (no date filter)
             adminDb.collection('analytics').where('type', '==', 'view').count().get(),
             adminDb.collection('analytics').where('type', '==', 'view').where('timestamp', '>=', todayStartTs).count().get(),
             
             // Total = All time
             adminDb.collection('analytics').where('type', '==', 'click').count().get(),
             adminDb.collection('analytics').where('type', '==', 'click').where('timestamp', '>=', todayStartTs).count().get()
        ]);
        
        viewsTotal = viewsTotalSnap.data().count;
        viewsToday = viewsTodaySnap.data().count;
        clicksTotal = clicksTotalSnap.data().count;
        clicksToday = clicksTodaySnap.data().count;

    } catch(e) {
        console.warn('[Admin Stats API] Analytics stats error:', e);
    }
    
    return NextResponse.json({
      success: true,
      totals: {
        products: approvedProducts.data().count,
        deals: approvedDeals.data().count,
        users: usersTotal.data().count,
      },
      pending: {
        deals: pendingDeals.data().count + draftDeals.data().count,
        products: pendingProducts.data().count + draftProducts.data().count,
      },
      recent24h: {
        deals: newDeals24h.data().count,
        users: newUsers24h.data().count,
      },
      categories: {
          total: categoriesTotal,
          main: categoriesMain,
          sub: categoriesSub,
          subSub: categoriesSubSub
      },
      harvester: {
          running: harvesterRunning,
          created24h: harvesterCreated24h
      },
      analytics: {
          views: { total: viewsTotal, today: viewsToday },
          clicks: { total: clicksTotal, today: clicksToday }
      },
      totalSavings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin Stats API] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera',
      details: (error as any)?.message || 'unknown',
      // Fallback with zero stats
      totals: { products: 0, deals: 0, users: 0 },
      pending: { deals: 0, products: 0 },
      recent24h: { deals: 0, users: 0 },
      totalSavings: 0,
    });
  }
}

export const revalidate = 120; // Cache for 2 minutes
