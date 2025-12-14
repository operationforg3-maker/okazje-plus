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

    let updatedCount = 0;
    const batch = adminDb.batch();
    snap.docs.forEach(doc => {
      const d = doc.data() || {};
      const title = d.title || {};
      const shortDescription = d.shortDescription || {};
      const fullDescription = d.fullDescription || {};
      const enTitle = title.en || d.name || '';
      const enDesc = fullDescription.en || d.description || '';
      const updates: any = {
        title: { en: enTitle, pl: title.pl || enTitle },
        shortDescription: { en: shortDescription.en || enDesc, pl: shortDescription.pl || shortDescription.en || enDesc },
        fullDescription: { en: fullDescription.en || enDesc, pl: fullDescription.pl || fullDescription.en || enDesc },
        updatedAt: new Date().toISOString(),
      };
      batch.set(doc.ref, updates, { merge: true });
      updatedCount++;
    });
    await batch.commit();

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Translate drafts failed' }, { status: 500 });
  }
}
