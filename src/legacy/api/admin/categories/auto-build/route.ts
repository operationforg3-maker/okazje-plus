import { NextRequest, NextResponse } from 'next/server';
import { CATEGORY_SEEDS } from '@/lib/category-seeds';
import { buildCategoriesFromSeeds } from '@/lib/category-builder';
import { checkAdminAuth } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { mainCount, subCount, subSubCount, total } = await buildCategoriesFromSeeds(CATEGORY_SEEDS);
    
    // Detailed logging
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[auto-build] ✅ Kategorie zostały zbudowane pomyślnie!`);
    console.log(`[auto-build] 📊 Summary by level:`);
    console.log(`  🏆 Główne kategorie (Main): ${mainCount}`);
    console.log(`  📂 Podkategorie (Sub): ${subCount}`);
    console.log(`  📋 Pod-podkategorie (SubSub): ${subSubCount}`);
    console.log(`  📊 Razem: ${total} dokumentów`);
    console.log(`[auto-build] 🌐 Języki: PL (native), EN, DE (translations)`);
    console.log(`[auto-build] Cache cleared for categories:all`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({ 
      success: true, 
      created: total, 
      categories: mainCount,
      subcategories: subCount,
      subSubcategories: subSubCount,
      message: `Zbudowano ${mainCount} głównych kategorii, ${subCount} podkategorii, ${subSubCount} pod-podkategorii (razem ${total} dokumentów) z tłumaczeniami PL/EN/DE`,
    });
  } catch (err: any) {
    console.error('auto-build categories failed', err);
    return NextResponse.json({ error: err?.message || 'Failed to auto-build categories' }, { status: 500 });
  }
}
