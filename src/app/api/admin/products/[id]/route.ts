import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    // Obsłuż oba formaty: bezpośrednie pola lub { id, data }
    const data: any = body?.data && typeof body.data === 'object' ? body.data : body;

    // Jeśli to tylko aktualizacja statusu lub częściowa edycja, nie wymagaj wszystkich pól
    // Walidacja tylko jeśli próbujemy edytować główne pola
    // Główne pola są wymagane tylko przy pełnej edycji formularza.
    // Dla częściowych aktualizacji (np. status) nie blokuj.
    if (data && (data.name !== undefined || data.description !== undefined || data.price !== undefined)) {
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
    const { id: _ignored, ...updateData } = data || {};
    
    // Przygotuj dane do aktualizacji
    const firestoreData: any = {};
    
    // Skopiuj wszystkie pola oprócz ratingCard
    if (updateData && typeof updateData === 'object') {
      for (const [key, value] of Object.entries(updateData)) {
        if (key !== 'ratingCard') {
          firestoreData[key] = value;
        }
      }
    }
    
    // Konwertuj ratingCard na dot notation dla Firestore
    if (updateData && (updateData as any).ratingCard) {
      const rc = (updateData as any).ratingCard;
      firestoreData['ratingCard.average'] = rc.average ?? 0;
      firestoreData['ratingCard.count'] = rc.count ?? 0;
      firestoreData['ratingCard.durability'] = rc.durability ?? 0;
      firestoreData['ratingCard.easeOfUse'] = rc.easeOfUse ?? 0;
      firestoreData['ratingCard.valueForMoney'] = rc.valueForMoney ?? 0;
      firestoreData['ratingCard.versatility'] = rc.versatility ?? 0;
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
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
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
