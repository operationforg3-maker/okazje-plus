import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Walidacja wymaganych pól
    if (!data.name || !data.description || !data.price || !data.image || !data.affiliateUrl) {
      return NextResponse.json(
        { error: 'Brakuje wymaganych pól' },
        { status: 400 }
      );
    }

    // Przygotuj dane do zapisu
    const productData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Zapisz do Firestore
    const docRef = await addDoc(collection(db, 'products'), productData);

    return NextResponse.json(
      { 
        success: true, 
        id: docRef.id,
        message: 'Produkt został dodany pomyślnie' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia produktu' },
      { status: 500 }
    );
  }
}
