/**
 * POST /api/admin/categories/generate-context
 * 
 * Generates descriptions and example products for a sub-subcategory
 * using AI to improve import keyword matching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { generateSubcategoryContext } from '@/ai/flows/generateSubcategoryContext';

export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { mainCategoryName, subcategoryName, subsubcategoryName } = body;

    if (!mainCategoryName || !subcategoryName || !subsubcategoryName) {
      return NextResponse.json(
        { error: 'Missing required fields: mainCategoryName, subcategoryName, subsubcategoryName' },
        { status: 400 }
      );
    }

    console.log('[POST /api/admin/categories/generate-context] Generating context for:', {
      mainCategoryName,
      subcategoryName,
      subsubcategoryName,
    });

    const result = await generateSubcategoryContext({
      mainCategoryName,
      subcategoryName,
      subsubcategoryName,
    });

    console.log('[POST /api/admin/categories/generate-context] ✅ Generated:', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/categories/generate-context] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate category context' },
      { status: 500 }
    );
  }
}
