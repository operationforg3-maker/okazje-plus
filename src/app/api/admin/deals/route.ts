import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Walidacja wymaganych pól
    if (!data.title || !data.description || !data.price || !data.link || !data.image) {
      return NextResponse.json(
        { error: 'Brakuje wymaganych pól' },
        { status: 400 }
      );
    }

    // Przygotuj dane do zapisu
    const dealData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      temperature: data.temperature || 0,
      voteCount: data.voteCount || 0,
      commentsCount: data.commentsCount || 0,
    };

    // Zapisz do Firestore
    const docRef = await addDoc(collection(db, 'deals'), dealData);

    return NextResponse.json(
      { 
        success: true, 
        id: docRef.id,
        message: 'Okazja została dodana pomyślnie' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia okazji' },
      { status: 500 }
    );
  }
}
