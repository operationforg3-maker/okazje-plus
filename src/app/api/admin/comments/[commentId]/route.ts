import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    // W produkcji: weryfikuj auth i role admina
    // const user = await verifyAuth(request);
    // if (!user || user.role !== 'admin') return 401

    const commentId = params.commentId;
    const body = await request.json();
    const { collectionName, docId } = body as { collectionName: 'deals' | 'products'; docId: string };

    if (!collectionName || !docId) {
      return NextResponse.json(
        { success: false, message: 'collectionName i docId są wymagane' },
        { status: 400 }
      );
    }

    // Ścieżka do komentarza w subkolekcji
    const commentRef = doc(db, collectionName, docId, 'comments', commentId);
    
    await deleteDoc(commentRef);

    return NextResponse.json({
      success: true,
      message: 'Komentarz został usunięty',
    });

  } catch (error: any) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { success: false, message: 'Błąd podczas usuwania komentarza' },
      { status: 500 }
    );
  }
}
