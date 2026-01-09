import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { aiTranslateProduct } from '@/ai/flows/aiTranslateProduct';

/**
 * POST /api/admin/ai/enhance-product
 * 
 * On-demand AI enhancement dla istniejącego produktu
 * Body: { productId: string, operations: string[] }
 * operations: ['translate'] - obecnie tylko tłumaczenie
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, operations = ['translate'] } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'productId jest wymagane' },
        { status: 400 }
      );
    }

    // Pobierz produkt
    const productRef = adminDb.collection('products').doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return NextResponse.json(
        { error: 'Produkt nie istnieje' },
        { status: 404 }
      );
    }

    const product = productSnap.data();
    const results: any = {
      productId,
      operations: {},
    };

    // AI Translation
    if (operations.includes('translate')) {
      try {
        console.log(`[AI Enhance Product] 🤖 Translating product ${productId}...`);
        
        const translations = await aiTranslateProduct({
          name: product?.name || '',
          description: product?.description || '',
          longDescription: product?.longDescription,
          seoKeywords: product?.seoKeywords,
          metaTitle: product?.metaTitle,
          metaDescription: product?.metaDescription,
          targetLanguages: ['en', 'de'],
        });

        // Aktualizuj produkt z tłumaczeniami
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (translations.en) {
          updateData.nameEn = translations.en.name;
          updateData.descriptionEn = translations.en.description;
          updateData.longDescriptionEn = translations.en.longDescription;
          updateData.seoKeywordsEn = translations.en.seoKeywords;
          updateData.metaTitleEn = translations.en.metaTitle;
          updateData.metaDescriptionEn = translations.en.metaDescription;
        }

        if (translations.de) {
          updateData.nameDe = translations.de.name;
          updateData.descriptionDe = translations.de.description;
          updateData.longDescriptionDe = translations.de.longDescription;
          updateData.seoKeywordsDe = translations.de.seoKeywords;
          updateData.metaTitleDe = translations.de.metaTitle;
          updateData.metaDescriptionDe = translations.de.metaDescription;
        }

        await productRef.update(updateData);

        results.operations.translate = {
          success: true,
          translations,
        };

        console.log(`[AI Enhance Product] ✅ Translation completed for ${productId}`);
      } catch (error) {
        console.error(`[AI Enhance Product] ❌ Translation failed:`, error);
        results.operations.translate = {
          success: false,
          error: (error as Error).message,
        };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[AI Enhance Product] Error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas AI enhancement' },
      { status: 500 }
    );
  }
}
