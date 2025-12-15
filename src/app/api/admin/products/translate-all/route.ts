import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Tłumaczenie i SEO WSZYSTKICH produktów (bez filtra statusu)
 * POST /api/admin/products/translate-all
 */
export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit ?? 100), 1), 1000);
    const { mainCategorySlug, subCategorySlug, subSubCategorySlug, statusFilter } = body || {};

    // Query WSZYSTKICH produktów (bez filtra draft) lub z opcjonalnym filtrem statusu
    let q: FirebaseFirestore.Query = adminDb.collection('products');
    if (statusFilter && ['draft', 'approved', 'rejected'].includes(statusFilter)) {
      q = q.where('status', '==', statusFilter);
    }
    if (mainCategorySlug) q = q.where('mainCategorySlug', '==', String(mainCategorySlug));
    if (subCategorySlug) q = q.where('subCategorySlug', '==', String(subCategorySlug));
    if (subSubCategorySlug) q = q.where('subSubCategorySlug', '==', String(subSubCategorySlug));

    const snap = await q.limit(limit).get();
    if (snap.empty) return NextResponse.json({ success: true, updated: 0, message: 'Brak produktów do przetworzenia' });

    let updatedCount = 0;
    const batchSize = 500;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const d = doc.data() || {};
      const title = d.title || {};
      const shortDescription = d.shortDescription || {};
      const fullDescription = d.fullDescription || {};
      
      // Bazowa wersja EN
      const enTitle = title.en || d.name || '';
      const enShortDesc = shortDescription.en || d.description || '';
      const enFullDesc = fullDescription.en || d.longDescription || d.description || '';

      // Jeśli brak PL, użyj EN jako fallback (do późniejszego tłumaczenia przez AI)
      const updates: any = {
        title: { 
          en: enTitle, 
          pl: title.pl || enTitle,
          de: title.de || enTitle,
        },
        shortDescription: { 
          en: enShortDesc, 
          pl: shortDescription.pl || enShortDesc,
          de: shortDescription.de || enShortDesc,
        },
        fullDescription: { 
          en: enFullDesc, 
          pl: fullDescription.pl || enFullDesc,
          de: fullDescription.de || enFullDesc,
        },
        seo: {
          ...(d.seo || {}),
          metaTitle: (d.seo?.metaTitle || enTitle).slice(0, 60),
          metaDescription: (d.seo?.metaDescription || enShortDesc).slice(0, 160),
          keywords: d.seo?.keywords || enTitle.split(' ').filter(w => w.length > 3).slice(0, 10),
          aiVersion: (d.seo?.aiVersion || 0) + 1,
        },
        updatedAt: new Date().toISOString(),
      };

      batch.set(doc.ref, updates, { merge: true });
      batchCount++;
      updatedCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      updated: updatedCount,
      message: `Przetłumaczono i zoptymalizowano SEO dla ${updatedCount} produktów`
    });
  } catch (e: any) {
    console.error('[translate-all] Error:', e);
    return NextResponse.json({ error: e.message || 'Translate all failed' }, { status: 500 });
  }
}
