import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    console.log('[POST /api/admin/deals] Received data:', JSON.stringify(data, null, 2));

    // Walidacja wymaganych pól
    if (!data.title || !data.description || data.price === undefined || !data.link || !data.image) {
      console.error('[POST /api/admin/deals] Validation failed:', {
        title: !!data.title,
        description: !!data.description,
        price: data.price,
        link: !!data.link,
        image: !!data.image,
      });
      return NextResponse.json(
        { error: 'Brakuje wymaganych pól (title, description, price, link, image)' },
        { status: 400 }
      );
    }

    // Przygotuj dane do zapisu - usuń pola które mogą powodować problemy
    const { id, ...dataToSave } = data;
    
    const dealData = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      temperature: data.temperature || 0,
      voteCount: data.voteCount || 0,
      commentsCount: data.commentsCount || 0,
    };

    console.log('[POST /api/admin/deals] Saving to Firestore:', JSON.stringify(dealData, null, 2));

    // Zapisz do Firestore
    const docRef = await addDoc(collection(db, 'deals'), dealData);

    console.log('[POST /api/admin/deals] Success! Doc ID:', docRef.id);

    return NextResponse.json(
      { 
        success: true, 
        id: docRef.id,
        message: 'Okazja została dodana pomyślnie' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/admin/deals] Error:', error);
    console.error('[POST /api/admin/deals] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any).code,
    });
    return NextResponse.json(
      { 
        error: 'Błąd podczas zapisywania okazji',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
