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
export async function getUserComments(userId: string): Promise<UserComment[]> {
  console.log('[getUserComments] Called with userId:', userId);
  
  if (!userId) {
    console.error('[getUserComments] No userId provided!');
    throw new Error('Nie jesteś zalogowany');
  }

  try {
    console.log('[getUserComments] Querying comments for userId:', userId);
    const commentsQuery = query(
      firestoreCollectionGroup(db, 'comments'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const commentsSnapshot = await getDocs(commentsQuery);
    console.log('[getUserComments] Found comments:', commentsSnapshot.docs.length);

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

export interface UserForumActivity {
  forumPostsCount: number;
  forumRepliesCount: number;
}

/**
 * Pobiera forum activity użytkownika
 */
export async function getUserForumActivity(userId: string): Promise<UserForumActivity> {
  console.log('[getUserForumActivity] Called with userId:', userId);
  
  if (!userId) {
    console.error('[getUserForumActivity] No userId provided!');
    return { forumPostsCount: 0, forumRepliesCount: 0 };
  }

  try {
    // Pobierz posty użytkownika
    let forumPostsCount = 0;
    try {
      const postsQuery = query(
        collection(db, 'forumPosts'),
        where('authorId', '==', userId),
        limit(100)
      );
      const postsSnapshot = await getDocs(postsQuery);
      forumPostsCount = postsSnapshot.docs.length;
      console.log('[getUserForumActivity] Forum posts:', forumPostsCount);
    } catch (err) {
      console.warn('Error fetching forum posts:', err);
    }

    // Pobierz replies użytkownika (z subkolekcji)
    let forumRepliesCount = 0;
    try {
      const postsSnapshot = await getDocs(
        query(collection(db, 'forumPosts'), limit(100))
      );
      
      for (const postDoc of postsSnapshot.docs) {
        try {
          const repliesSnapshot = await getDocs(
            query(collection(db, `forumPosts/${postDoc.id}/replies`), 
                  where('authorId', '==', userId))
          );
          forumRepliesCount += repliesSnapshot.docs.length;
        } catch (e) {
          // Silent fail
        }
      }
      console.log('[getUserForumActivity] Forum replies:', forumRepliesCount);
    } catch (err) {
      console.warn('Error fetching forum replies:', err);
    }

    return { forumPostsCount, forumRepliesCount };
  } catch (error: any) {
    console.error('Error fetching forum activity:', error);
    return { forumPostsCount: 0, forumRepliesCount: 0 };
  }
}
