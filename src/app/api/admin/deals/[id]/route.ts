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

    // Walidacja wymaganych pól
    if (!data.title || !data.description || !data.price || !data.link || !data.image) {
      return NextResponse.json(
        { error: 'Brakuje wymaganych pól' },
        { status: 400 }
      );
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
    const { id: _, ...updateData } = data;
    
    // Zaktualizuj
    await updateDoc(dealRef, {
      ...updateData,
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
