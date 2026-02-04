import { getServerAuthSession, requireAuth } from '@/lib/auth-server';
import { createDeal } from '@/lib/data-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Musisz być zalogowany' },
        { status: 401 }
      );
    }

    const data = await request.json();

    const {
      title,
      description,
      price,
      originalPrice,
      link,
      image,
      mainCategorySlug,
      subCategorySlug,
      subSubCategorySlug,
      linkedProductId,
    } = data;

    // Walidacja wymaganych pól
    if (!title || !price || !link) {
      return NextResponse.json(
        { message: 'Tytuł, cena i link są wymagane' },
        { status: 400 }
      );
    }

    // Tworzenie dokumentu Deal
    const dealData = {
      title,
      description: description || '',
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      link,
      image: image || '',
      mainCategorySlug,
      subCategorySlug,
      subSubCategorySlug,
      linkedProductId: linkedProductId || null,
      createdBy: session.user.email,
      createdAt: new Date().toISOString(),
      status: 'pending', // Wymaga moderacji
      votes: 0,
      temperature: 0,
      comments: [],
      source: 'user_submission',
      sourceId: `user-${Date.now()}`,
    };

    // Zapisanie do Firestore
    const docId = await createDeal(dealData);

    return NextResponse.json(
      { id: docId, message: 'Okazja dodana pomyślnie' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Błąd przy tworzeniu okazji:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Błąd serwera' },
      { status: 500 }
    );
  }
}
