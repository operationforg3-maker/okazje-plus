import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, increment, addDoc, serverTimestamp, setDoc, getCountFromServer, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Category, Deal, Product, Comment, NavigationShowcaseConfig, Subcategory, CategoryPromo, ProductRating, Favorite } from "@/lib/types";

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

// Pobiera kilka losowych okazji (np. do sekcji trending AI porównawczych) - fallback gdy mało danych
export async function getRandomDeals(count: number): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const q = query(dealsRef, where("status", "==", "approved"), limit(count * 5));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
  // prosty shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
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

export async function getProductsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  count: number = 100
): Promise<Product[]> {
  const productsRef = collection(db, "products");
  let q;
  
  if (subCategorySlug) {
    q = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      where("subCategorySlug", "==", subCategorySlug),
      limit(count)
    );
  } else {
    q = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      limit(count)
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export async function getDealsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  count: number = 100
): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  let q;
  
  if (subCategorySlug) {
    q = query(
      dealsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      where("subCategorySlug", "==", subCategorySlug),
      orderBy("temperature", "desc"),
      limit(count)
    );
  } else {
    q = query(
      dealsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      orderBy("temperature", "desc"),
      limit(count)
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
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

// Statystyki: liczba produktów, okazji i użytkowników
export async function getCounts(): Promise<{ products: number; deals: number; users: number }> {
  const [productsSnap, dealsSnap, usersSnap] = await Promise.all([
    getCountFromServer(collection(db, 'products')),
    getCountFromServer(collection(db, 'deals')),
    getCountFromServer(collection(db, 'users')),
  ]);
  return {
    products: productsSnap.data().count,
    deals: dealsSnap.data().count,
    users: usersSnap.data().count,
  };
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
            transaction.update(dealDocRef, { 
                temperature: increment(vote),
                voteCount: increment(vote > 0 ? 1 : -1)
            });
        });
    } catch (e) {
        console.error("Błąd podczas głosowania: ", e);
        throw e;
    }
}

export async function addComment(collectionName: "products" | "deals", docId: string, userId: string, content: string) {
    const commentsColRef = collection(db, collectionName, docId, "comments");
    await addDoc(commentsColRef, {
        userId: userId,
        content: content,
        createdAt: serverTimestamp(),
    });
}

export async function getComments(collectionName: "products" | "deals", docId: string): Promise<Comment[]> {
    const commentsColRef = collection(db, collectionName, docId, "comments");
    const q = query(commentsColRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
}

// === SYSTEM OCEN PRODUKTÓW ===

export async function submitProductRating(
    productId: string, 
    userId: string, 
    ratingData: {
        rating: number;
        durability: number;
        easeOfUse: number;
        valueForMoney: number;
        versatility: number;
        review?: string;
        userDisplayName?: string;
    }
) {
    const ratingDocRef = doc(db, "products", productId, "ratings", userId);
    const productDocRef = doc(db, "products", productId);

    try {
        await runTransaction(db, async (transaction) => {
            const existingRating = await transaction.get(ratingDocRef);
            
            // Zapisz lub aktualizuj ocenę użytkownika
            transaction.set(ratingDocRef, {
                ...ratingData,
                productId,
                userId,
                createdAt: new Date().toISOString(),
            });

            // Pobierz wszystkie oceny po zapisaniu
            const ratingsRef = collection(db, "products", productId, "ratings");
            const ratingsSnapshot = await getDocs(ratingsRef);
            
            // Przelicz średnie
            let totalRating = 0;
            let totalDurability = 0;
            let totalEaseOfUse = 0;
            let totalValueForMoney = 0;
            let totalVersatility = 0;
            const count = ratingsSnapshot.size;

            ratingsSnapshot.forEach(doc => {
                const data = doc.data();
                totalRating += data.rating || 0;
                totalDurability += data.durability || 0;
                totalEaseOfUse += data.easeOfUse || 0;
                totalValueForMoney += data.valueForMoney || 0;
                totalVersatility += data.versatility || 0;
            });

            // Aktualizuj ratingCard produktu
            transaction.update(productDocRef, {
                'ratingCard.average': count > 0 ? totalRating / count : 0,
                'ratingCard.count': count,
                'ratingCard.durability': count > 0 ? totalDurability / count : 0,
                'ratingCard.easeOfUse': count > 0 ? totalEaseOfUse / count : 0,
                'ratingCard.valueForMoney': count > 0 ? totalValueForMoney / count : 0,
                'ratingCard.versatility': count > 0 ? totalVersatility / count : 0,
            });
        });
    } catch (e) {
        console.error("Błąd podczas zapisywania oceny: ", e);
        throw e;
    }
}

export async function getUserProductRating(productId: string, userId: string): Promise<ProductRating | null> {
    const ratingDocRef = doc(db, "products", productId, "ratings", userId);
    const docSnap = await getDoc(ratingDocRef);
    
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ProductRating;
    }
    return null;
}

export async function getProductRatings(productId: string, limitCount: number = 10): Promise<ProductRating[]> {
    const ratingsRef = collection(db, "products", productId, "ratings");
    const q = query(ratingsRef, orderBy("createdAt", "desc"), limit(limitCount));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductRating));
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

export async function getCategories(): Promise<Category[]> {
  const categoriesRef = collection(db, "categories");
  const snapshot = await getDocs(categoriesRef);

  const categories = await Promise.all(
    snapshot.docs.map(async (categoryDoc) => {
      const data = categoryDoc.data() as Partial<Category> & {
        subcategories?: Array<Partial<Subcategory>>;
        promo?: Partial<CategoryPromo> | null;
      };

      // Start with embedded subcategories array (legacy structure)
      let subcategories: Subcategory[] = Array.isArray(data.subcategories)
        ? data.subcategories.map((sub) => ({
          ...sub,
          id: sub.id ?? sub.slug,
        }))
        : [];

      // Try to load subcategories from dedicated subcollection (new structure)
      const subcategoriesRef = collection(db, "categories", categoryDoc.id, "subcategories");
      const subSnapshot = await getDocs(subcategoriesRef);

      if (!subSnapshot.empty) {
        subcategories = subSnapshot.docs
          .map((subDoc) => {
            const subData = subDoc.data() as Partial<Subcategory>;
            return {
              id: subDoc.id,
              name: subData.name ?? subDoc.id,
              slug: subData.slug ?? subDoc.id,
              icon: subData.icon,
              description: subData.description,
              sortOrder: subData.sortOrder,
              image: subData.image,
              highlight: subData.highlight,
            } satisfies Subcategory;
          })
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      }

      const promo = data.promo
        ? {
            title: data.promo.title ?? data.name ?? categoryDoc.id,
            subtitle: data.promo.subtitle,
            description: data.promo.description,
            image: data.promo.image,
            link: data.promo.link,
            cta: data.promo.cta,
            badge: data.promo.badge,
            color: data.promo.color,
          }
        : undefined;

      return {
        id: categoryDoc.id,
        name: data.name ?? categoryDoc.id,
        slug: data.slug ?? categoryDoc.id,
        icon: data.icon,
        description: data.description,
        sortOrder: data.sortOrder,
        accentColor: data.accentColor,
        heroImage: data.heroImage,
        promo,
        subcategories,
      } satisfies Category;
    })
  );

  return categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  const dealRef = doc(db, "deals", dealId);
  const snapshot = await getDoc(dealRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<Deal, "id">) };
}

export async function getProductById(productId: string): Promise<Product | null> {
  const productRef = doc(db, "products", productId);
  const snapshot = await getDoc(productRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<Product, "id">) };
}

export async function getNavigationShowcase(): Promise<NavigationShowcaseConfig | null> {
  const configRef = doc(db, "settings", "navigationShowcase");
  const snapshot = await getDoc(configRef);

  if (!snapshot.exists()) {
    return null;
  }

  const rawData = snapshot.data() as Partial<NavigationShowcaseConfig> & {
    promotedIds?: unknown;
    promotedType?: unknown;
    dealOfTheDayId?: unknown;
  };

  const promotedIds = Array.isArray(rawData.promotedIds)
    ? rawData.promotedIds.filter((value): value is string => typeof value === "string")
    : [];

  const promotedType = rawData.promotedType === "products" ? "products" : "deals";
  const dealOfTheDayId = typeof rawData.dealOfTheDayId === "string" ? rawData.dealOfTheDayId : null;

  return {
    promotedType,
    promotedIds,
    dealOfTheDayId,
  };
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

// === SYSTEM ULUBIONYCH ===

/**
 * Dodaje element do ulubionych użytkownika
 */
export async function addToFavorites(userId: string, itemId: string, itemType: 'deal' | 'product'): Promise<void> {
  const favoritesRef = collection(db, 'favorites');
  
  // Sprawdź czy już istnieje
  const existingQuery = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemId', '==', itemId),
    where('itemType', '==', itemType)
  );
  
  const existingSnapshot = await getDocs(existingQuery);
  
  if (!existingSnapshot.empty) {
    throw new Error('Item already in favorites');
  }
  
  await addDoc(favoritesRef, {
    userId,
    itemId,
    itemType,
    createdAt: serverTimestamp()
  });
}

/**
 * Usuwa element z ulubionych użytkownika
 */
export async function removeFromFavorites(userId: string, itemId: string, itemType: 'deal' | 'product'): Promise<void> {
  const favoritesRef = collection(db, 'favorites');
  const q = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemId', '==', itemId),
    where('itemType', '==', itemType)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Favorite not found');
  }
  
  // Usuń wszystkie znalezione (powinien być tylko jeden)
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
}

/**
 * Sprawdza czy element jest w ulubionych użytkownika
 */
export async function isFavorite(userId: string, itemId: string, itemType: 'deal' | 'product'): Promise<boolean> {
  const favoritesRef = collection(db, 'favorites');
  const q = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemId', '==', itemId),
    where('itemType', '==', itemType),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Pobiera ulubione okazje użytkownika
 */
export async function getFavoriteDeals(userId: string, limitCount: number = 50): Promise<Deal[]> {
  const favoritesRef = collection(db, 'favorites');
  const q = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemType', '==', 'deal'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  const dealIds = snapshot.docs.map(doc => doc.data().itemId);
  
  if (dealIds.length === 0) {
    return [];
  }
  
  // Pobierz pełne dane okazji
  const deals: Deal[] = [];
  for (const dealId of dealIds) {
    const deal = await getDealById(dealId);
    if (deal) {
      deals.push(deal);
    }
  }
  
  return deals;
}

/**
 * Pobiera ulubione produkty użytkownika
 */
export async function getFavoriteProducts(userId: string, limitCount: number = 50): Promise<Product[]> {
  const favoritesRef = collection(db, 'favorites');
  const q = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemType', '==', 'product'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  const productIds = snapshot.docs.map(doc => doc.data().itemId);
  
  if (productIds.length === 0) {
    return [];
  }
  
  // Pobierz pełne dane produktów
  const products: Product[] = [];
  for (const productId of productIds) {
    const product = await getProductById(productId);
    if (product) {
      products.push(product);
    }
  }
  
  return products;
}

/**
 * Pobiera liczbę ulubionych użytkownika
 */
export async function getFavoritesCount(userId: string): Promise<{ deals: number; products: number }> {
  const favoritesRef = collection(db, 'favorites');
  
  const dealsQuery = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemType', '==', 'deal')
  );
  
  const productsQuery = query(
    favoritesRef,
    where('userId', '==', userId),
    where('itemType', '==', 'product')
  );
  
  const [dealsCount, productsCount] = await Promise.all([
    getCountFromServer(dealsQuery),
    getCountFromServer(productsQuery)
  ]);
  
  return {
    deals: dealsCount.data().count,
    products: productsCount.data().count
  };
}

