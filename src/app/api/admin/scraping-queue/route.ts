import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

async function verifyAdminToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/scraping-queue
 * Query params:
 *   status=pending|running|failed|done  (default: pending,running,failed)
 *   limit=100 (default, max 200)
 *
 * Returns product_cores documents filtered by scrapingStatus + counts per status.
 */
export async function GET(request: NextRequest) {
  const uid = await verifyAdminToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') || 'pending,running,failed';
  const statuses = statusParam.split(',').filter(Boolean);
  const limit = Math.min(Number(searchParams.get('limit') || '100'), 200);

  try {
    // Fetch counts per status in parallel
    const [pendingSnap, runningSnap, failedSnap, doneSnap] = await Promise.all([
      adminDb.collection('product_cores').where('scrapingStatus', '==', 'pending').count().get(),
      adminDb.collection('product_cores').where('scrapingStatus', '==', 'running').count().get(),
      adminDb.collection('product_cores').where('scrapingStatus', '==', 'failed').count().get(),
      adminDb.collection('product_cores').where('scrapingStatus', '==', 'done').count().get(),
    ]);

    const counts = {
      pending: pendingSnap.data().count,
      running: runningSnap.data().count,
      failed: failedSnap.data().count,
      done: doneSnap.data().count,
    };

    // Fetch actual documents for requested statuses
    const items: Record<string, unknown>[] = [];
    for (const status of statuses.slice(0, 3)) {
      if (!['pending', 'running', 'failed', 'done'].includes(status)) continue;
      const snap = await adminDb
        .collection('product_cores')
        .where('scrapingStatus', '==', status)
        .orderBy('updatedAt', 'desc')
        .limit(Math.ceil(limit / statuses.length))
        .get();

      snap.docs.forEach(doc => {
        const d = doc.data();
        items.push({
          id: doc.id,
          title: d.title?.pl || d.title?.en || '—',
          aliExpressId: d.metadata?.originalId || null,
          scrapingStatus: d.scrapingStatus,
          scrapingAttempts: d.scrapingMetadata?.scrapingAttempts || 0,
          scrapingVersion: d.scrapingMetadata?.scrapingVersion || null,
          lastError: d.scrapingMetadata?.lastError || null,
          captchaEncountered: d.scrapingMetadata?.captchaEncountered || false,
          reviewsCount: d.scrapingMetadata?.reviewsCount || 0,
          scrapedAt: d.scrapingMetadata?.scrapedAt || null,
          updatedAt: d.updatedAt || null,
          imageUrl: d.imageUrl || d.images?.[0] || null,
        });
      });
    }

    return NextResponse.json({ ok: true, counts, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[scraping-queue] GET error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/scraping-queue
 * Body: { productId: string } — retry single product
 *       { retryAll: true }   — reset all 'failed' → 'pending'
 */
export async function PATCH(request: NextRequest) {
  const uid = await verifyAdminToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (body.retryAll) {
      const failedSnap = await adminDb
        .collection('product_cores')
        .where('scrapingStatus', '==', 'failed')
        .limit(500)
        .get();

      if (failedSnap.empty) {
        return NextResponse.json({ ok: true, updated: 0 });
      }

      const batch = adminDb.batch();
      const now = new Date().toISOString();
      failedSnap.docs.forEach(doc => {
        batch.update(doc.ref, {
          scrapingStatus: 'pending',
          'scrapingMetadata.scrapingAttempts': 0,
          'scrapingMetadata.lastError': null,
          updatedAt: now,
        });
      });
      await batch.commit();

      return NextResponse.json({ ok: true, updated: failedSnap.size });
    }

    if (body.productId && typeof body.productId === 'string') {
      const docRef = adminDb.collection('product_cores').doc(body.productId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      await docRef.update({
        scrapingStatus: 'pending',
        'scrapingMetadata.scrapingAttempts': 0,
        'scrapingMetadata.lastError': null,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, updated: 1 });
    }

    return NextResponse.json({ error: 'Missing productId or retryAll' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[scraping-queue] PATCH error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
