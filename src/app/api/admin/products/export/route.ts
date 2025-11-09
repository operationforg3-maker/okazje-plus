import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Product } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // W produkcji: weryfikuj auth i role admina

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'approved';
    const maxResults = parseInt(searchParams.get('limit') || '1000');

    // Query Firestore
    const productsRef = collection(db, 'products');
    const q = query(
      productsRef,
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

    // Generuj CSV
    const headers = [
      'ID',
      'Nazwa',
      'Opis krótki',
      'Opis długi',
      'Cena',
      'Link afiliacyjny',
      'Obraz',
      'Kategoria główna',
      'Podkategoria',
      'Status',
      'Ocena średnia',
      'Liczba ocen',
      'Trwałość',
      'Łatwość użycia',
      'Stosunek jakości do ceny',
      'Wszechstronność',
    ];

    const rows = products.map(product => [
      product.id,
      `"${(product.name || '').replace(/"/g, '""')}"`,
      `"${(product.description || '').replace(/"/g, '""')}"`,
      `"${(product.longDescription || '').replace(/"/g, '""')}"`,
      product.price || 0,
      product.affiliateUrl || '',
      product.image || '',
      product.mainCategorySlug || '',
      product.subCategorySlug || '',
      product.status || 'draft',
      product.ratingCard?.average || 0,
      product.ratingCard?.count || 0,
      product.ratingCard?.durability || 0,
      product.ratingCard?.easeOfUse || 0,
      product.ratingCard?.valueForMoney || 0,
      product.ratingCard?.versatility || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="products-${status}-${new Date().toISOString().split('T')[0]}.csv"`,
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
