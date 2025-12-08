import { NextRequest, NextResponse } from 'next/server';
import { CATEGORY_SEEDS } from '@/lib/category-seeds';
import { adminDb } from '@/lib/firebase-admin';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { cacheDel } from '@/lib/cache';

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    let mainCount = 0;
    let subCount = 0;
    let subSubCount = 0;

    for (const main of CATEGORY_SEEDS) {
      const mainRef = adminDb.collection('categories').doc(main.slug);
      await mainRef.set({
        id: main.slug,
        slug: main.slug,
        name: main.name,
        description: main.description || '',
        icon: main.icon || '📂',
        sortOrder: main.sortOrder || 0,
        translations: main.translations || {},
        updatedAt: new Date(),
      }, { merge: true });
      mainCount++;

      const subcats = main.subcategories || [];
      for (const sub of subcats) {
        const subRef = mainRef.collection('subcategories').doc(sub.slug);
        await subRef.set({
          slug: sub.slug,
          name: sub.name,
          description: sub.description || '',
          icon: sub.icon || '',
          sortOrder: (sub as any).sortOrder || 0,
          translations: (sub as any).translations || {},
          updatedAt: new Date(),
        }, { merge: true });
        subCount++;

        const subsubs = sub.subcategories || [];
        for (const subsub of subsubs) {
          const subSubRef = subRef.collection('subcategories').doc(subsub.slug);
          await subSubRef.set({
            slug: subsub.slug,
            name: subsub.name,
            description: subsub.description || '',
            icon: subsub.icon || '',
            sortOrder: (subsub as any).sortOrder || 0,
            translations: (subsub as any).translations || {},
            importKeywords: (subsub as any).aliexpressKeywords || (subsub as any).importKeywords || [],
            updatedAt: new Date(),
          }, { merge: true });
          subSubCount++;
        }
      }
    }

    const totalWritten = mainCount + subCount + subSubCount;

    // Clear cache after successfully building categories
    await cacheDel('categories:all');
    
    // Detailed logging
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[auto-build] ✅ Kategorie zostały zbudowane pomyślnie!`);
    console.log(`[auto-build] 📊 Summary by level:`);
    console.log(`  🏆 Główne kategorie (Main): ${mainCount}`);
    console.log(`  📂 Podkategorie (Sub): ${subCount}`);
    console.log(`  📋 Pod-podkategorie (SubSub): ${subSubCount}`);
    console.log(`  📊 Razem: ${totalWritten} dokumentów`);
    console.log(`[auto-build] 🌐 Języki: PL (native), EN, DE (translations)`);
    console.log(`[auto-build] Cache cleared for categories:all`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({ 
      success: true, 
      created: totalWritten, 
      categories: mainCount,
      subcategories: subCount,
      subSubcategories: subSubCount,
      message: `Zbudowano ${mainCount} głównych kategorii, ${subCount} podkategorii, ${subSubCount} pod-podkategorii (razem ${totalWritten} dokumentów) z tłumaczeniami PL/EN/DE`,
    });
  } catch (err: any) {
    console.error('auto-build categories failed', err);
    return NextResponse.json({ error: err?.message || 'Failed to auto-build categories' }, { status: 500 });
  }
}
