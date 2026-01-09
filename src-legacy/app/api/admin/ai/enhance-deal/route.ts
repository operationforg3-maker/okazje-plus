import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';

/**
 * POST /api/admin/ai/enhance-deal
 * 
 * On-demand AI enhancement dla istniejącej okazji
 * Body: { dealId: string, operations: string[] }
 * operations: ['normalize-title'] - normalizacja tytułu
 */
export async function POST(request: NextRequest) {
  try {
    const { dealId, operations = ['normalize-title'] } = await request.json();

    if (!dealId) {
      return NextResponse.json(
        { error: 'dealId jest wymagane' },
        { status: 400 }
      );
    }

    // Pobierz deal
    const dealRef = adminDb.collection('deals').doc(dealId);
    const dealSnap = await dealRef.get();

    if (!dealSnap.exists) {
      return NextResponse.json(
        { error: 'Okazja nie istnieje' },
        { status: 404 }
      );
    }

    const deal = dealSnap.data();
    const results: any = {
      dealId,
      operations: {},
    };

    // AI Title Normalization
    if (operations.includes('normalize-title')) {
      try {
        console.log(`[AI Enhance Deal] 🤖 Normalizing title for deal ${dealId}...`);
        
        const titleResult = await aiNormalizeTitlePL({
          rawTitle: deal?.title || '',
        });

        // Aktualizuj deal z znormalizowanym tytułem
        await dealRef.update({
          title: titleResult,
          imageHint: titleResult,
          updatedAt: new Date(),
        });

        results.operations['normalize-title'] = {
          success: true,
          originalTitle: deal?.title,
          normalizedTitle: titleResult,
        };

        console.log(`[AI Enhance Deal] ✅ Title normalized for ${dealId}`);
      } catch (error) {
        console.error(`[AI Enhance Deal] ❌ Title normalization failed:`, error);
        results.operations['normalize-title'] = {
          success: false,
          error: (error as Error).message,
        };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[AI Enhance Deal] Error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas AI enhancement' },
      { status: 500 }
    );
  }
}
