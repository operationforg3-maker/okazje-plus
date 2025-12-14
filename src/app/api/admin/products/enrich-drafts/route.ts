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

    let q: FirebaseFirestore.Query = adminDb.collection('products').where('status', '==', 'draft');
    if (mainCategorySlug) q = q.where('mainCategorySlug', '==', String(mainCategorySlug));
    if (subCategorySlug) q = q.where('subCategorySlug', '==', String(subCategorySlug));
    if (subSubCategorySlug) q = q.where('subSubCategorySlug', '==', String(subSubCategorySlug));

    const snap = await q.limit(limit).get();
    if (snap.empty) return NextResponse.json({ success: true, updated: 0 });

    const batch = adminDb.batch();
    let updated = 0;
    snap.docs.forEach(doc => {
      const d = doc.data() || {};
      const title = d.title || {};
      const enTitle = title.en || d.name || '';
      const desc = d.fullDescription?.en || d.description || '';
      const updates: any = {
        imageHint: d.imageHint || enTitle,
        seo: {
          ...(d.seo || {}),
          metaTitle: (d.seo?.metaTitle || enTitle)?.slice(0, 60),
          metaDescription: (d.seo?.metaDescription || desc)?.slice(0, 160),
          aiVersion: d.seo?.aiVersion || 1,
        },
        ai: {
          ...(d.ai || {}),
          enrichment: {
            ...(d.ai?.enrichment || {}),
            keywords: (d.ai?.enrichment?.keywords || enTitle.split(' ').slice(0, 8)),
          }
        },
        updatedAt: new Date().toISOString(),
      };
      batch.set(doc.ref, updates, { merge: true });
      updated++;
    });
    await batch.commit();

    return NextResponse.json({ success: true, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Enrich drafts failed' }, { status: 500 });
  }
}
