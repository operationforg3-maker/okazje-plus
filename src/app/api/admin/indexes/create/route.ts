import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { indexName } = await req.json();

    if (!indexName) {
      return NextResponse.json(
        { error: 'Brak indexName' },
        { status: 400 }
      );
    }

    // TODO: Zaloguj się do Firebase Admin SDK
    // Wyślij request do Firestore API /admin/indexes/create
    // Śledź postęp tworzenia

    return NextResponse.json({
      success: true,
      indexName,
      state: 'CREATING',
      progress: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Błąd w indexes/create:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
