'use server';

import { getAdminFirestore } from '@/lib/firebase-admin-server';

export interface UserComment {
  id: string;
  content: string;
  createdAt: number;
  userId: string;
  parentCollection: 'deals' | 'products';
  parentId: string;
  itemTitle?: string;
  likeCount?: number; // For gamification - count of likes/reactions on this comment
}

/**
 * Pobiera komentarze napisane przez zalogowanego użytkownika
 * Używa Admin SDK na serwerze aby ominąć problemy z collectionGroup permissions
 */
export async function getUserComments(userId: string): Promise<UserComment[]> {
  if (!userId) {
    console.log('[getUserComments] userId is empty, returning empty list');
    return [];
  }

  console.log('[getUserComments] Called with userId:', userId);

  try {
    const db = getAdminFirestore();
    
    // Use collectionGroup to query all comments across deals and products
    const commentsSnapshot = await db.collectionGroup('comments')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    console.log('[getUserComments] Query executed, found:', commentsSnapshot.size, 'comments');

    const comments: UserComment[] = [];

    for (const cDoc of commentsSnapshot.docs) {
      const data = cDoc.data();
      const pathParts = cDoc.ref.path.split('/');
      const parentCollection = pathParts[0] as 'deals' | 'products';
      const parentId = pathParts[1];

      let itemTitle: string | undefined;

      try {
        if (parentCollection === 'deals') {
          const dealDoc = await db.collection('deals').doc(parentId).get();
          if (dealDoc.exists) {
            const rawTitle = (dealDoc.data() as any).title;
            itemTitle = typeof rawTitle === 'string' 
              ? rawTitle 
              : rawTitle?.pl || rawTitle?.en || 'Okazja';
          }
        } else if (parentCollection === 'products') {
          const productDoc = await db.collection('products').doc(parentId).get();
          if (productDoc.exists) {
            const rawName = (productDoc.data() as any).name;
            itemTitle = typeof rawName === 'string' 
              ? rawName 
              : rawName?.pl || rawName?.en || 'Produkt';
          }
        }
      } catch (err) {
        console.error('[getUserComments] Error fetching parent item:', err);
      }

      comments.push({
        id: cDoc.id,
        content: data.content || '',
        // Convert Firestore Timestamp to milliseconds for serialization
        createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
        userId: data.userId,
        parentCollection,
        parentId,
        itemTitle,
        // Get like count for gamification
        likeCount: data.likeCount || 0,
      });
    }

    console.log('[getUserComments] Returning', comments.length, 'comments');
    return comments;
  } catch (error: any) {
    console.error('[getUserComments] Error:', error.message);
    return [];
  }
}

export interface UserForumActivity {
  forumPostsCount: number;
  forumRepliesCount: number;
}

/**
 * Pobiera forum activity użytkownika (posty i odpowiedzi)
 */
export async function getUserForumActivity(userId: string): Promise<UserForumActivity> {
  console.log('[getUserForumActivity] Called with userId:', userId);
  
  if (!userId) {
    return { forumPostsCount: 0, forumRepliesCount: 0 };
  }

  try {
    const db = getAdminFirestore();
    
    // Count forum posts by this user
    const postsSnapshot = await db.collection('forumPosts')
      .where('authorId', '==', userId)
      .get();
    
    let forumPostsCount = postsSnapshot.size;
    console.log('[getUserForumActivity] Forum posts:', forumPostsCount);

    // Count forum replies by iterating through posts and checking replies subkolekcja
    let forumRepliesCount = 0;
    try {
      const postsQuery = await db.collection('forumPosts').get();
      
      for (const postDoc of postsQuery.docs) {
        const repliesSnapshot = await postDoc.ref.collection('replies')
          .where('authorId', '==', userId)
          .get();
        forumRepliesCount += repliesSnapshot.size;
      }
    } catch (err) {
      console.error('[getUserForumActivity] Error counting replies:', err);
    }
    
    console.log('[getUserForumActivity] Forum replies:', forumRepliesCount);
    return { forumPostsCount, forumRepliesCount };
  } catch (error: any) {
    console.error('[getUserForumActivity] Error:', error.message);
    return { forumPostsCount: 0, forumRepliesCount: 0 };
  }
}

export interface UserProductRatings {
  count: number;
}

/**
 * Pobiera liczbę ocen produktów dla użytkownika
 */
export async function getUserProductRatings(userId: string): Promise<UserProductRatings> {
  console.log('[getUserProductRatings] Called with userId:', userId);
  
  if (!userId) {
    return { count: 0 };
  }

  try {
    const db = getAdminFirestore();
    
    // First try to query productRatings collection
    try {
      const ratingsSnapshot = await db.collection('productRatings')
        .where('userId', '==', userId)
        .get();
      
      console.log('[getUserProductRatings] Found in productRatings collection:', ratingsSnapshot.size);
      return { count: ratingsSnapshot.size };
    } catch (err: any) {
      console.log('[getUserProductRatings] productRatings collection not accessible, trying fallback');
    }

    // Fallback: check products/{id}/ratings/{userId}
    let totalRatings = 0;
    try {
      const productsSnapshot = await db.collection('products').get();
      
      for (const productDoc of productsSnapshot.docs) {
        try {
          const ratingDoc = await productDoc.ref.collection('ratings').doc(userId).get();
          if (ratingDoc.exists) {
            totalRatings++;
          }
        } catch (err) {
          // Silent
        }
      }
      
      console.log('[getUserProductRatings] Found in subkolekcja fallback:', totalRatings);
      return { count: totalRatings };
    } catch (fallbackErr: any) {
      console.error('[getUserProductRatings] Fallback error:', fallbackErr.message);
      return { count: 0 };
    }
  } catch (error: any) {
    console.error('[getUserProductRatings] Error:', error.message);
    return { count: 0 };
  }
}

/**
 * Pobiera liczbę ALL votes dla użytkownika - OPTIMIZED VERSION
 * Zamiast iterować votes subkolekcja, sprawdzamy czy user głosował na deal
 * (Deal model ma voteCount pole - nie trzeba liczyć od zera)
 */
export async function getUserVotes(userId: string): Promise<{ count: number }> {
  console.log('[getUserVotes] Called with userId:', userId);
  
  if (!userId) {
    console.error('[getUserVotes] No userId provided!');
    return { count: 0 };
  }

  try {
    const db = getAdminFirestore();
    
    // Get approved deals (max 200)
    const dealsSnapshot = await db.collection('deals')
      .where('status', '==', 'approved')
      .limit(200)
      .get();
    
    console.log('[getUserVotes] Checking votes in', dealsSnapshot.size, 'approved deals');
    
    let totalVotes = 0;
    
    // For each deal, check if user has a vote in votes subkolekcja
    for (const dealDoc of dealsSnapshot.docs) {
      try {
        const votesSnapshot = await dealDoc.ref.collection('votes')
          .where('userId', '==', userId)
          .limit(1) // Only need to know if exists
          .get();
        
        if (votesSnapshot.size > 0) {
          totalVotes++;
          console.log('[getUserVotes] User voted on deal:', dealDoc.id);
        }
      } catch (err) {
        // Silent - deal may not have votes subkolekcja
      }
    }
    
    console.log('[getUserVotes] Total votes found:', totalVotes, 'in', dealsSnapshot.size, 'deals');
    return { count: totalVotes };
  } catch (error: any) {
    console.error('[getUserVotes] Error:', error.message);
    return { count: 0 };
  }
}
