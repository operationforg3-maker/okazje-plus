import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

    const dealRef = adminDb.collection('deals').doc(id);

    const dealSnap = await dealRef.get();
    if (!dealSnap.exists) {
      return NextResponse.json(
        { error: 'Okazja nie została znaleziona' },
        { status: 404 }
      );
    }

    // Usuń pola które nie powinny być w Firestore
    const { id: _ignored, ...updateData } = data || {};
    
    // Zaktualizuj
    await dealRef.set({
      ...(updateData || {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

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
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid deal ID' },
        { status: 400 }
      );
    }
    const dealRef = adminDb.collection('deals').doc(id);
    const dealSnap = await dealRef.get();
    if (!dealSnap.exists) {
      return NextResponse.json(
        { error: 'Okazja nie została znaleziona' },
        { status: 404 }
      );
    }

    await dealRef.delete();

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
