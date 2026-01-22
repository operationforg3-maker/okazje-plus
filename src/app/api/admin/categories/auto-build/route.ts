import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-server';
import { CATEGORY_SEEDS } from '@/lib/category-seeds';
import { buildCategoriesFromSeeds } from '@/lib/category-builder';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    // Check if user is admin
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    console.log('[auto-build] Starting category build process...');
    const result = await buildCategoriesFromSeeds(CATEGORY_SEEDS);
    
    console.log(`[auto-build] ✅ Success! Created: Main=${result.mainCount}, Sub=${result.subCount}, SubSub=${result.subSubCount}`);

    return NextResponse.json({ 
      success: true, 
      created: result.total, 
      categories: result.mainCount,
      subcategories: result.subCount,
      subSubcategories: result.subSubCount,
      message: `✅ Zbudowano ${result.mainCount} głównych kategorii, ${result.subCount} podkategorii, ${result.subSubCount} pod-podkategorii.`
    });

  } catch (error: any) {
    console.error('[auto-build] Error building categories:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to auto-build categories' },
      { status: 500 }
    );
  }
}
