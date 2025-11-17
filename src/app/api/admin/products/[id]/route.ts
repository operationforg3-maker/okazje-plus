import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const data = await request.json();

    // Jeśli to tylko aktualizacja statusu lub częściowa edycja, nie wymagaj wszystkich pól
    // Walidacja tylko jeśli próbujemy edytować główne pola
    if (data.name !== undefined || data.description !== undefined || data.price !== undefined) {
      if (!data.name || !data.description || data.price === undefined) {
        return NextResponse.json(
          { error: 'Brakuje wymaganych pól' },
          { status: 400 }
        );
      }
    }

    const productRef = doc(db, 'products', id);
    
    // Sprawdź czy produkt istnieje
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      return NextResponse.json(
        { error: 'Produkt nie został znaleziony' },
        { status: 404 }
      );
    }

    // Usuń pola które nie powinny być w Firestore
    const { id: _, ...updateData } = data;
    
    // Zaktualizuj
    await updateDoc(productRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json(
      { 
        success: true, 
        message: 'Produkt został zaktualizowany' 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji produktu' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const productRef = doc(db, 'products', id);
    
    // Sprawdź czy produkt istnieje
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      return NextResponse.json(
        { error: 'Produkt nie został znaleziony' },
        { status: 404 }
      );
    }

    // Usuń
    await deleteDoc(productRef);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Produkt został usunięty' 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Błąd podczas usuwania produktu' },
      { status: 500 }
    );
  }
}
