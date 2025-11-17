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
    
    // Przygotuj dane do aktualizacji
    const firestoreData: any = {};
    
    // Skopiuj wszystkie pola oprócz ratingCard
    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'ratingCard') {
        firestoreData[key] = value;
      }
    }
    
    // Konwertuj ratingCard na dot notation dla Firestore
    if (updateData.ratingCard) {
      firestoreData['ratingCard.average'] = updateData.ratingCard.average ?? 0;
      firestoreData['ratingCard.count'] = updateData.ratingCard.count ?? 0;
      firestoreData['ratingCard.durability'] = updateData.ratingCard.durability ?? 0;
      firestoreData['ratingCard.easeOfUse'] = updateData.ratingCard.easeOfUse ?? 0;
      firestoreData['ratingCard.valueForMoney'] = updateData.ratingCard.valueForMoney ?? 0;
      firestoreData['ratingCard.versatility'] = updateData.ratingCard.versatility ?? 0;
    }
    
    // Dodaj timestamp
    firestoreData.updatedAt = Timestamp.now();
    
    // Zaktualizuj
    await updateDoc(productRef, firestoreData);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Produkt został zaktualizowany' 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PUT /api/admin/products/[id]] Error updating product:', error);
    console.error('[PUT /api/admin/products/[id]] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any).code,
    });
    return NextResponse.json(
      { 
        error: 'Błąd podczas aktualizacji produktu',
        details: error instanceof Error ? error.message : String(error),
      },
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
