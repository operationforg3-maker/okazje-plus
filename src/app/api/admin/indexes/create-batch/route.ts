import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { indexes } = await req.json();

    if (!indexes || !Array.isArray(indexes)) {
      return NextResponse.json(
        { error: 'Brak indexes array' },
        { status: 400 }
      );
    }

    // TODO: Twórz indeksy równocześnie lub sekwencyjnie
    // Monitoruj postęp każdego

    return NextResponse.json({
      success: true,
      created: indexes.length,
      total: indexes.length,
      failed: 0,
    });
  } catch (error) {
    console.error('❌ Błąd w indexes/create-batch:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
