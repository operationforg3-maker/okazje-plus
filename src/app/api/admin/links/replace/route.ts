import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { linkId, newUrl } = await req.json();

    if (!linkId || !newUrl) {
      return NextResponse.json(
        { error: 'Brakuje linkId lub newUrl' },
        { status: 400 }
      );
    }

    // TODO: Załaduj link z Firestore
    // Zaktualizuj URL
    // Zapisz timestamp replacedAt

    return NextResponse.json({
      success: true,
      linkId,
      newUrl,
      replacedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Błąd w links/replace:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
