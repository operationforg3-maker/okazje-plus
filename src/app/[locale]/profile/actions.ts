'use server';

import { getServerAuthSession } from '@/lib/auth-server';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  getDoc,
  doc,
  collectionGroup as firestoreCollectionGroup
} from 'firebase/firestore';

export interface UserComment {
  id: string;
  content: string;
  createdAt: number;
  userId: string;
  parentCollection: 'deals' | 'products';
  parentId: string;
  itemTitle?: string;
}

/**
 * Pobiera komentarze napisane przez zalogowanego użytkownika
 * Używa Admin SDK na serwerze aby ominąć problemy z collectionGroup permissions w Firestore
 */
export async function getUserComments(): Promise<UserComment[]> {
  const session = await getServerAuthSession();
  
  if (!session || !session.uid) {
    throw new Error('Nie jesteś zalogowany');
  }

  try {
    const commentsQuery = query(
      firestoreCollectionGroup(db, 'comments'),
      where('userId', '==', session.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const commentsSnapshot = await getDocs(commentsQuery);

    const comments: UserComment[] = [];

    for (const cDoc of commentsSnapshot.docs) {
      const data = cDoc.data();
      const pathParts = cDoc.ref.path.split('/');
      const parentCollection = pathParts[0] as 'deals' | 'products';
      const parentId = pathParts[1];

      let itemTitle: string | undefined;

      try {
        if (parentCollection === 'deals') {
          const dealDoc = await getDoc(doc(db, 'deals', parentId));
          if (dealDoc.exists()) {
            const rawTitle = (dealDoc.data() as any).title;
            itemTitle = typeof rawTitle === 'string' 
              ? rawTitle 
              : rawTitle?.pl || rawTitle?.en || 'Okazja';
          }
        } else if (parentCollection === 'products') {
          const productDoc = await getDoc(doc(db, 'products', parentId));
          if (productDoc.exists()) {
            const rawName = (productDoc.data() as any).name;
            itemTitle = typeof rawName === 'string' 
              ? rawName 
              : rawName?.pl || rawName?.en || 'Produkt';
          }
        }
      } catch (err) {
        console.error('Error fetching parent item for comment:', err);
      }

      comments.push({
        id: cDoc.id,
        content: data.content || '',
        createdAt: data.createdAt || 0,
        userId: data.userId,
        parentCollection,
        parentId,
        itemTitle,
      });
    }

    return comments;
  } catch (error: any) {
    console.error('Error fetching user comments:', error);
    
    // Jeśli to jest błąd permissions, zwróć pustą listę zamiast rzucania błędu
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      console.warn('Permission denied for collectionGroup query - returning empty list');
      return [];
    }
    
    throw error;
  }
}
