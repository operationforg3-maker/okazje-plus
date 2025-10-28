import { collection, getDocs, query, where, orderBy, limit, doc, runTransaction, increment, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Deal, Product, Comment } from "@/lib/types";

export async function getHotDeals(count: number): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const q = query(
    dealsRef,
    where("status", "==", "approved"),
    orderBy("temperature", "desc"),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
}

export async function getRecommendedProducts(count: number): Promise<Product[]> {
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("status", "==", "approved"),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export async function searchProducts(searchTerm: string): Promise<Product[]> {
  const productsRef = collection(db, "products");
  const nameQuery = query(productsRef, where('name', '>=', searchTerm), where('name', '<=', searchTerm + '\uf8ff'));
  const categoryQuery = query(productsRef, where('category', '>=', searchTerm), where('category', '<=', searchTerm + '\uf8ff'));
  const subcategoryQuery = query(productsRef, where('subcategory', '>=', searchTerm), where('subcategory', '<=', searchTerm + '\uf8ff'));

  const [nameSnapshot, categorySnapshot, subcategorySnapshot] = await Promise.all([
    getDocs(nameQuery),
    getDocs(categoryQuery),
    getDocs(subcategoryQuery),
  ]);

  const results: { [id: string]: Product } = {};
  nameSnapshot.forEach(doc => {
    results[doc.id] = { id: doc.id, ...doc.data() } as Product;
  });
  categorySnapshot.forEach(doc => {
    results[doc.id] = { id: doc.id, ...doc.data() } as Product;
  });
  subcategorySnapshot.forEach(doc => {
    results[doc.id] = { id: doc.id, ...doc.data() } as Product;
  });

  return Object.values(results).filter(p => p.status === 'approved');
}

export async function voteOnDeal(dealId: string, userId: string, vote: 1 | -1) {
    const voteDocRef = doc(db, "deals", dealId, "votes", userId);
    const dealDocRef = doc(db, "deals", dealId);

    try {
        await runTransaction(db, async (transaction) => {
            const voteDoc = await transaction.get(voteDocRef);
            if (voteDoc.exists()) {
                throw new Error("Już głosowałeś na tą okazję.");
            }

            transaction.set(voteDocRef, { vote: vote });
            transaction.update(dealDocRef, { temperature: increment(vote) });
        });
    } catch (e) {
        console.error("Błąd podczas głosowania: ", e);
        throw e;
    }
}

export async function addComment(collectionName: "products" | "deals", docId: string, userId: string, text: string) {
    const commentsColRef = collection(db, collectionName, docId, "comments");
    await addDoc(commentsColRef, {
        userId: userId,
        text: text,
        createdAt: serverTimestamp(),
    });
}

export async function getComments(collectionName: "products" | "deals", docId: string): Promise<Comment[]> {
    const commentsColRef = collection(db, collectionName, docId, "comments");
    const q = query(commentsColRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
}

export async function searchProductsForLinking(searchText: string): Promise<Product[]> {
    if (!searchText.trim()) {
        return [];
    }
    const productsRef = collection(db, "products");
    const lowerCaseSearchText = searchText.toLowerCase();
    const q = query(productsRef,
        where('name', '>=', lowerCaseSearchText),
        where('name', '<=', lowerCaseSearchText + '\uf8ff'),
        limit(5)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

// Placeholder data for users to fix build error
export const users = [
  {
    id: '1',
    name: 'Jan Kowalski',
    email: 'jan.kowalski@example.com',
    avatar: 'https://github.com/shadcn.png',
    role: 'admin',
    joined: '2023-10-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Anna Nowak',
    email: 'anna.nowak@example.com',
    avatar: 'https://github.com/shadcn.png',
    role: 'user',
    joined: '2023-10-15T00:00:00.000Z',
  },
  {
    id: '3',
    name: 'Piotr Wiśniewski',
    email: 'piotr.wisniewski@example.com',
    avatar: 'https://github.com/shadcn.png',
    role: 'user',
    joined: '2023-11-01T00:00:00.000Z',
  },
];
