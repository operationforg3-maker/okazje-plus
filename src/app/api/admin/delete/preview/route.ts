import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { type, filters } = await req.json();

    if (!type || !['products', 'deals', 'categories', 'users', 'orphaned'].includes(type)) {
      return NextResponse.json(
        { error: 'Nieznany typ usuwania' },
        { status: 400 }
      );
    }

    // TODO: Załaduj dokumenty matchujące filtry z Firestore
    // Policz szacunkowy rozmiar
    // Sprawdź czy jest jakieś kaskaadowe usuwanie

    const mockItems = Array.from({ length: 50 }, (_, i) => ({
      id: `${type}_${i}`,
      name: `Element ${type} nr ${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const warnings = [];
    if (type === 'categories') {
      warnings.push('Usunięcie kategorii spowoduje kaskaadowe usunięcie wszystkich produktów i okazji w niej!');
    }
    if (type === 'users' && !filters.anonymize) {
      warnings.push('Usunięcie użytkowników może naruszać GDPR. Rozważ opcję anonimizacji.');
    }

    return NextResponse.json({
      type,
      count: mockItems.length,
      items: mockItems.slice(0, 10), // Pokaż tylko pierwsze 10 w podglądzie
      estimatedSize: `${(mockItems.length * 0.5).toFixed(1)} MB`,
      warnings,
    });
  } catch (error) {
    console.error('❌ Błąd w delete/preview:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
