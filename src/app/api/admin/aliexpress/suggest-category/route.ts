import { NextRequest, NextResponse } from 'next/server';
import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';

/**
 * AI Category Suggestion API
 * 
 * POST /api/admin/aliexpress/suggest-category
 * Body: { title, description?, aliexpressCategory?, price? }
 * Returns: { mainCategorySlug, subCategorySlug, subSubCategorySlug, confidence, reasoning }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, aliexpressCategory, price } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Title is required and must be at least 3 characters' },
        { status: 400 }
      );
    }

    console.log('[AI Category] Suggesting category for:', title.slice(0, 60));

    const result = await aiSuggestCategory({
      title: title.trim(),
      description: description?.trim(),
      aliexpressCategory: aliexpressCategory?.trim(),
      price: price ? Number(price) : undefined,
    });

    console.log('[AI Category] Suggested:', {
      main: result.mainCategorySlug,
      sub: result.subCategorySlug,
      subSub: result.subSubCategorySlug,
      confidence: result.confidence.toFixed(2),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[AI Category] Error:', error);
    return NextResponse.json(
      { 
        error: 'ai_failed', 
        message: String(error),
        // Fallback category
        mainCategorySlug: 'inne',
        subCategorySlug: 'pozostale',
        subSubCategorySlug: 'niesklasyfikowane',
        confidence: 0.1,
        reasoning: 'AI categorization failed - fallback to uncategorized',
      },
      { status: 500 }
    );
  }
}
