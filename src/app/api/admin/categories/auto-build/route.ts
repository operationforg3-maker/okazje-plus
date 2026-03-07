import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-server';
import { seedCategoriesFromJsonFile } from '@/lib/category-tree-seeder';

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

    console.log('[auto-build] Starting category build process from JSON...');
    const result = await seedCategoriesFromJsonFile();
    
    console.log(`[auto-build] ✅ Success! Created: Main=${result.mainCount}, Sub=${result.subCount}, SubSub=${result.subSubCount}`);

    return NextResponse.json({ 
      success: true, 
      created: result.total, 
      categories: result.mainCount,
      subcategories: result.subCount,
      subSubcategories: result.subSubCount,
      sourcePath: result.inputPath,
      generatedAt: result.generatedAt || null,
      message: `✅ Zbudowano ${result.mainCount} głównych kategorii, ${result.subCount} podkategorii, ${result.subSubCount} pod-podkategorii z pliku JSON.`
    });

  } catch (error: any) {
    console.error('[auto-build] Error building categories:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to auto-build categories' },
      { status: 500 }
    );
  }
}
