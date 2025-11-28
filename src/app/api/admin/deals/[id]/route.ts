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
    const data: any = body?.data && typeof body.data === 'object' ? body.data : body;

    // Wymagane pola tylko przy pełnej edycji – częściowe aktualizacje (np. status) dozwolone
    if (data && (data.title !== undefined || data.description !== undefined || data.price !== undefined || data.link !== undefined || data.image !== undefined)) {
      if (!data.title || !data.description || data.price === undefined || !data.link || !data.image) {
        return NextResponse.json(
          { error: 'Brakuje wymaganych pól' },
          { status: 400 }
        );
      }
    }

    const dealRef = doc(db, 'deals', id);
    
    // Sprawdź czy deal istnieje
    const dealSnap = await getDoc(dealRef);
    if (!dealSnap.exists()) {
      return NextResponse.json(
        { error: 'Okazja nie została znaleziona' },
        { status: 404 }
      );
    }

    // Usuń pola które nie powinny być w Firestore
    const { id: _ignored, ...updateData } = data || {};
    
    // Zaktualizuj
    await updateDoc(dealRef, {
      ...(updateData || {}),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json(
      { 
        success: true, 
        message: 'Okazja została zaktualizowana' 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating deal:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji okazji' },
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
    const dealRef = doc(db, 'deals', id);
    
    // Sprawdź czy deal istnieje
    const dealSnap = await getDoc(dealRef);
    if (!dealSnap.exists()) {
      return NextResponse.json(
        { error: 'Okazja nie została znaleziona' },
        { status: 404 }
      );
    }

    // Usuń
    await deleteDoc(dealRef);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Okazja została usunięta' 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting deal:', error);
    return NextResponse.json(
      { error: 'Błąd podczas usuwania okazji' },
      { status: 500 }
    );
  }
}
