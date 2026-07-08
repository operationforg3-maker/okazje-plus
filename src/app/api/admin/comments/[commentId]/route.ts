import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireModerator } from '@/lib/auth-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    // Secure endpoint: moderator/admin access required
    await requireModerator();

    const commentId = params.commentId;
    const body = await request.json();
    const { collectionName, docId } = body as { collectionName: 'deals' | 'products'; docId: string };

    if (!collectionName || !docId) {
      return NextResponse.json(
        { success: false, message: 'collectionName i docId są wymagane' },
        { status: 400 }
      );
    }

    // Path to comment in subcollection (using Firestore Admin SDK)
    const commentRef = adminDb.collection(collectionName).doc(docId).collection('comments').doc(commentId);
    
    await commentRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Komentarz został usunięty',
    });

  } catch (error: any) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Błąd podczas usuwania komentarza' },
      { status: 500 }
    );
  }
}
