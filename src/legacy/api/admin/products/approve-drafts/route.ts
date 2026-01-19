import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit ?? 50), 1), 500);
    const { mainCategorySlug, subCategorySlug, subSubCategorySlug } = body || {};

    // Build query with optional filters
    let q: FirebaseFirestore.Query = adminDb.collection('products').where('status', '==', 'draft');
    if (mainCategorySlug) q = q.where('mainCategorySlug', '==', String(mainCategorySlug));
    if (subCategorySlug) q = q.where('subCategorySlug', '==', String(subCategorySlug));
    if (subSubCategorySlug) q = q.where('subSubCategorySlug', '==', String(subSubCategorySlug));

    const snap = await q.limit(limit).get();
    if (snap.empty) return NextResponse.json({ success: true, updated: 0 });

    const batch = adminDb.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { status: 'approved', updatedAt: new Date().toISOString() }));
    await batch.commit();

    return NextResponse.json({ success: true, updated: snap.size });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Approve drafts failed' }, { status: 500 });
  }
}
