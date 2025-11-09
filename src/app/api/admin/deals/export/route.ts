import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Deal } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // W produkcji: weryfikuj auth i role admina
    // const user = await verifyAuth(request);
    // if (!user || user.role !== 'admin') return 401

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'approved';
    const maxResults = parseInt(searchParams.get('limit') || '1000');

    // Query Firestore
    const dealsRef = collection(db, 'deals');
    const q = query(
      dealsRef,
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const deals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));

    // Generuj CSV
    const headers = [
      'ID',
      'Tytuł',
      'Opis',
      'Cena',
      'Cena oryginalna',
      'Link',
      'Obraz',
      'Kategoria główna',
      'Podkategoria',
      'Status',
      'Temperatura',
      'Liczba głosów',
      'Komentarze',
      'Data dodania',
      'Dodane przez',
    ];

    const rows = deals.map(deal => [
      deal.id,
      `"${(deal.title || '').replace(/"/g, '""')}"`, // Escape cudzysłowów
      `"${(deal.description || '').replace(/"/g, '""')}"`,
      deal.price || 0,
      deal.originalPrice || '',
      deal.link || '',
      deal.image || '',
      deal.mainCategorySlug || '',
      deal.subCategorySlug || '',
      deal.status || 'draft',
      deal.temperature || 0,
      deal.voteCount || 0,
      deal.commentsCount || 0,
      deal.postedAt || '',
      deal.postedBy || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Zwróć jako plik do pobrania
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="deals-${status}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, message: 'Błąd podczas eksportu' },
      { status: 500 }
    );
  }
}
