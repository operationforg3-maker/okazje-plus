import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, increment, addDoc, serverTimestamp, setDoc, getCountFromServer, deleteDoc, updateDoc, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Category, Deal, Product, Comment, NavigationShowcaseConfig, Subcategory, CategoryPromo, ProductRating, Favorite, Notification, CategoryTile } from "@/lib/types";
import { cacheGet, cacheSet } from "@/lib/cache";

/**
 * Helper function to split an array into chunks
 * @param arr Array to chunk
 * @param size Chunk size (max 30 for Firestore 'in' operator)
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function getHotDeals(count: number): Promise<Deal[]> {
  // Cache hot deals for 5 minutes
  const cacheKey = `deals:hot:${count}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached as Deal[];
  }

  const dealsRef = collection(db, "deals");
  const q = query(
    dealsRef,
    where("status", "==", "approved"),
    orderBy("temperature", "desc"),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  const deals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
  
  // Cache for 5 minutes (300 seconds)
  await cacheSet(cacheKey, deals, 300);
  
  return deals;
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
    // Cache recommended products for 10 minutes
    const cacheKey = `products:recommended:${count}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached as Product[];
    }

    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("status", "==", "approved"),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    
    // Cache for 10 minutes (600 seconds)
    await cacheSet(cacheKey, products, 600);
    
    return products;
}

// Najwyżej oceniane produkty w kategorii (fallback: sortowanie po ratingCard.count)
export async function getTopProductsByCategory(mainCategorySlug: string, count: number = 3): Promise<Product[]> {
  const productsRef = collection(db, "products");
  // Najpierw spróbuj po average + count
  try {
    const q1 = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      orderBy("ratingCard.average", "desc"),
      orderBy("ratingCard.count", "desc"),
      limit(count)
    );
    const snap = await getDocs(q1);
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  } catch (_) {
    // możliwy brak indeksu – przejdź do fallbacku
  }
  // Fallback: tylko count
  try {
    const q2 = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      orderBy("ratingCard.count", "desc"),
      limit(count)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return snap2.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  } catch (_) {}
  // Ostatecznie: pierwsze N
  const q3 = query(productsRef, where("status", "==", "approved"), where("mainCategorySlug", "==", mainCategorySlug), limit(count));
  const snap3 = await getDocs(q3);
  return snap3.docs.map(d => ({ id: d.id, ...d.data() } as Product));
}

// Najgorętsze okazje w kategorii
export async function getHotDealsByCategory(mainCategorySlug: string, count: number = 3): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  try {
    const q1 = query(
      dealsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      orderBy("temperature", "desc"),
      limit(count)
    );
    const snap = await getDocs(q1);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
  } catch (_) {
    const q2 = query(dealsRef, where("status", "==", "approved"), where("mainCategorySlug", "==", mainCategorySlug), limit(count));
    const snap2 = await getDocs(q2);
    return snap2.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
  }
}

// Funkcje do moderacji - pobieranie treści oczekujących
export async function getPendingDeals(): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const q = query(
    dealsRef,
    where("status", "in", ["draft", "pending"]),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
}

export async function getPendingProducts(): Promise<Product[]> {
  const productsRef = collection(db, "products");
  const q = query(
    productsRef,
    where("status", "in", ["draft", "pending"]),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export async function getRecentlyModerated(status: "approved" | "rejected", days: number = 7): Promise<(Deal | Product)[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  // Pobierz okazje
  const dealsRef = collection(db, "deals");
  const dealsQuery = query(
    dealsRef,
    where("status", "==", status),
    where("updatedAt", ">=", cutoffDate),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  const dealsSnapshot = await getDocs(dealsQuery);
  const deals = dealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'deal' } as any));
  
  // Pobierz produkty
  const productsRef = collection(db, "products");
  const productsQuery = query(
    productsRef,
    where("status", "==", status),
    where("updatedAt", ">=", cutoffDate),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  const productsSnapshot = await getDocs(productsQuery);
  const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'product' } as any));
  
  // Połącz i posortuj po dacie
  const all = [...deals, ...products];
  all.sort((a, b) => {
    const dateA = a.updatedAt?.toDate?.() || new Date(0);
    const dateB = b.updatedAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
  
  return all;
}

export async function getProductsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  count: number = 100
): Promise<Product[]> {
  const productsRef = collection(db, "products");
  let q;

  if (subSubCategorySlug && subCategorySlug) {
    // Filtruj po wszystkich trzech poziomach
    q = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      where("subCategorySlug", "==", subCategorySlug),
      where("subSubCategorySlug", "==", subSubCategorySlug),
      limit(count)
    );
  } else if (subCategorySlug) {
    // Filtruj po kategorii głównej i podkategorii
    q = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      where("subCategorySlug", "==", subCategorySlug),
      limit(count)
    );
  } else {
    // Filtruj tylko po kategorii głównej
    q = query(
      productsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      limit(count)
    );
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}export async function getDealsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  count: number = 100
): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  let q;
  
  if (subSubCategorySlug && subCategorySlug) {
    // Filtruj po wszystkich trzech poziomach
    q = query(
      dealsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      where("subCategorySlug", "==", subCategorySlug),
      where("subSubCategorySlug", "==", subSubCategorySlug),
      orderBy("temperature", "desc"),
      limit(count)
    );
  } else if (subCategorySlug) {
    // Filtruj po kategorii głównej i podkategorii
    q = query(
      dealsRef,
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
      where("subCategorySlug", "==", subCategorySlug),
      orderBy("temperature", "desc"),
      limit(count)
    );
  } else {
    // Filtruj tylko po kategorii głównej
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
  // Use category slug fields from the new data model
  const categoryQuery = query(productsRef, where('mainCategorySlug', '>=', searchTerm), where('mainCategorySlug', '<=', searchTerm + '\uf8ff'));
  const subcategoryQuery = query(productsRef, where('subCategorySlug', '>=', searchTerm), where('subCategorySlug', '<=', searchTerm + '\uf8ff'));

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

export async function searchDeals(searchTerm: string): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const titleQuery = query(dealsRef, where('title', '>=', searchTerm), where('title', '<=', searchTerm + '\uf8ff'));
  const [titleSnapshot] = await Promise.all([
    getDocs(titleQuery),
  ]);

  const results: { [id: string]: Deal } = {};
  titleSnapshot.forEach(doc => {
    results[doc.id] = { id: doc.id, ...doc.data() } as Deal;
  });

  return Object.values(results).filter(d => d.status === 'approved');
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

/**
 * @deprecated Używaj API endpoint /api/deals/[id]/vote zamiast bezpośredniego wywołania
 * Stara wersja - nie obsługuje idempotencji ani zmiany głosów
 */
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

export async function getComments(collectionName: "products" | "deals", docId: string, limitCount: number = 20): Promise<Comment[]> {
  const commentsColRef = collection(db, collectionName, docId, "comments");
  const q = query(commentsColRef, orderBy("createdAt", "desc"), limit(limitCount));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
}

// === SYSTEM OCEN PRODUKTÓW ===

/**
 * Submits or updates a product rating
 * Optimized to use incremental aggregation instead of recalculating all ratings
 */
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
    // Zabezpieczenie: waliduj wszystkie oceny przed wysłaniem
    const validateRating = (val: any, fieldName: string): number => {
        const num = Number(val);
        if (isNaN(num) || num < 1 || num > 5) {
            throw new Error(`${fieldName}: Wartość musi być liczbą od 1 do 5, otrzymano: ${val}`);
        }
        return num;
    };

    try {
        const validatedRating = {
            rating: validateRating(ratingData.rating, 'Ocena główna'),
            durability: validateRating(ratingData.durability, 'Trwałość'),
            easeOfUse: validateRating(ratingData.easeOfUse, 'Łatwość użycia'),
            valueForMoney: validateRating(ratingData.valueForMoney, 'Stosunek jakości do ceny'),
            versatility: validateRating(ratingData.versatility, 'Wszechstronność'),
            review: ratingData.review?.trim() || undefined,
            userDisplayName: ratingData.userDisplayName || 'Użytkownik anonimowy',
        };

        const ratingDocRef = doc(db, "products", productId, "ratings", userId);
        const productDocRef = doc(db, "products", productId);

        await runTransaction(db, async (transaction) => {
            // Get existing rating and product data
            const existingRating = await transaction.get(ratingDocRef);
            const productDoc = await transaction.get(productDocRef);
            
            if (!productDoc.exists()) {
                throw new Error('Product not found');
            }

            const productData = productDoc.data();
            const currentRatingCard = productData.ratingCard || {
                average: 0,
                count: 0,
                durability: 0,
                easeOfUse: 0,
                valueForMoney: 0,
                versatility: 0,
            };

            let newCount = currentRatingCard.count;
            let totalRating = currentRatingCard.average * currentRatingCard.count;
            let totalDurability = currentRatingCard.durability * currentRatingCard.count;
            let totalEaseOfUse = currentRatingCard.easeOfUse * currentRatingCard.count;
            let totalValueForMoney = currentRatingCard.valueForMoney * currentRatingCard.count;
            let totalVersatility = currentRatingCard.versatility * currentRatingCard.count;

            // If updating existing rating, subtract old values first
            if (existingRating.exists()) {
                const oldData = existingRating.data();
                totalRating -= Number(oldData.rating) || 0;
                totalDurability -= Number(oldData.durability) || 0;
                totalEaseOfUse -= Number(oldData.easeOfUse) || 0;
                totalValueForMoney -= Number(oldData.valueForMoney) || 0;
                totalVersatility -= Number(oldData.versatility) || 0;
            } else {
                // New rating, increment count
                newCount += 1;
            }

            // Add new values
            totalRating += validatedRating.rating;
            totalDurability += validatedRating.durability;
            totalEaseOfUse += validatedRating.easeOfUse;
            totalValueForMoney += validatedRating.valueForMoney;
            totalVersatility += validatedRating.versatility;

            // Save the rating
            transaction.set(ratingDocRef, {
                ...validatedRating,
                productId,
                userId,
                createdAt: existingRating.exists() ? existingRating.data().createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Update aggregated rating card in product
            transaction.update(productDocRef, {
                'ratingCard.average': newCount > 0 ? totalRating / newCount : 0,
                'ratingCard.count': newCount,
                'ratingCard.durability': newCount > 0 ? totalDurability / newCount : 0,
                'ratingCard.easeOfUse': newCount > 0 ? totalEaseOfUse / newCount : 0,
                'ratingCard.valueForMoney': newCount > 0 ? totalValueForMoney / newCount : 0,
                'ratingCard.versatility': newCount > 0 ? totalVersatility / newCount : 0,
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
  // Check cache first - categories rarely change, so cache for 1 hour
  const cacheKey = 'categories:all';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached as Category[];
  }

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
        subcategories = await Promise.all(
          subSnapshot.docs.map(async (subDoc) => {
            const subData = subDoc.data() as Partial<Subcategory>;
            
            // Wczytaj sub-subkategorie (poziom 3) z embedded array lub subcollection
            let subSubcategories = subData.subcategories ?? [];
            
            // Spróbuj również załadować z podkolekcji (jeśli istnieje)
            try {
              const subSubRef = collection(db, "categories", categoryDoc.id, "subcategories", subDoc.id, "subcategories");
              const subSubSnap = await getDocs(subSubRef);
              if (!subSubSnap.empty) {
                subSubcategories = subSubSnap.docs.map((ssDoc) => {
                  const ssData = ssDoc.data();
                  return {
                    name: ssData.name ?? ssDoc.id,
                    slug: ssData.slug ?? ssDoc.id,
                    id: ssDoc.id,
                    icon: ssData.icon,
                    description: ssData.description,
                    sortOrder: ssData.sortOrder,
                    image: ssData.image,
                  };
                }).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              }
            } catch (_) {
              // Jeśli subcollection nie istnieje, zostaw embedded array
            }

            return {
              id: subDoc.id,
              name: subData.name ?? subDoc.id,
              slug: subData.slug ?? subDoc.id,
              icon: subData.icon,
              description: subData.description,
              sortOrder: subData.sortOrder,
              image: subData.image,
              highlight: subData.highlight,
              subcategories: subSubcategories,
            } satisfies Subcategory;
          })
        );
        subcategories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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

      // Wczytaj opcjonalne kafelki z podkolekcji categories/{id}/tiles
      let tiles: CategoryTile[] = [];
      try {
        const tilesRef = collection(db, "categories", categoryDoc.id, "tiles");
        const tilesSnap = await getDocs(tilesRef);
        if (!tilesSnap.empty) {
          tiles = tilesSnap.docs.map((t) => ({ id: t.id, ...(t.data() as CategoryTile) }));
        }
      } catch (_) {
        tiles = [];
      }

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
        tiles,
        subcategories,
      } satisfies Category;
    })
  );

  const sortedCategories = categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  
  // Cache the result for 1 hour (3600 seconds)
  await cacheSet(cacheKey, sortedCategories, 3600);
  
  return sortedCategories;
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
  // Cache navigation showcase for 30 minutes
  const cacheKey = 'navigation:showcase';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached as NavigationShowcaseConfig | null;
  }

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

  const promotedType: NavigationShowcaseConfig['promotedType'] =
    rawData.promotedType === "products" ? "products" : "deals";
  const dealOfTheDayId = typeof rawData.dealOfTheDayId === "string" ? rawData.dealOfTheDayId : null;

  const config: NavigationShowcaseConfig = {
    promotedType,
    promotedIds,
    dealOfTheDayId,
  };

  // Cache for 30 minutes (1800 seconds)
  await cacheSet(cacheKey, config, 1800);

  return config;
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
 * Optimized to avoid N+1 queries by batching document fetches
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
  
  // Batch fetch deals using 'in' operator (max 30 items per query)
  // This reduces N queries to ceil(N/30) queries
  const dealsRef = collection(db, 'deals');
  const chunks = chunkArray(dealIds, 30); // Firestore 'in' operator limit is 30
  
  const dealSnapshots = await Promise.all(
    chunks.map(chunk => 
      getDocs(query(dealsRef, where(documentId(), 'in', chunk)))
    )
  );
  
  // Flatten results and map to Deal objects
  const deals: Deal[] = [];
  for (const snapshot of dealSnapshots) {
    snapshot.docs.forEach(doc => {
      deals.push({ id: doc.id, ...doc.data() } as Deal);
    });
  }
  
  // Maintain original order from favorites
  const dealMap = new Map(deals.map(deal => [deal.id, deal]));
  return dealIds.map(id => dealMap.get(id)).filter((deal): deal is Deal => deal !== undefined);
}

/**
 * Pobiera ulubione produkty użytkownika
 * Optimized to avoid N+1 queries by batching document fetches
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
  
  // Batch fetch products using 'in' operator (max 30 items per query)
  // This reduces N queries to ceil(N/30) queries
  const productsRef = collection(db, 'products');
  const chunks = chunkArray(productIds, 30); // Firestore 'in' operator limit is 30
  
  const productSnapshots = await Promise.all(
    chunks.map(chunk => 
      getDocs(query(productsRef, where(documentId(), 'in', chunk)))
    )
  );
  
  // Flatten results and map to Product objects
  const products: Product[] = [];
  for (const snapshot of productSnapshots) {
    snapshot.docs.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() } as Product);
    });
  }
  
  // Maintain original order from favorites
  const productMap = new Map(products.map(product => [product.id, product]));
  return productIds.map(id => productMap.get(id)).filter((product): product is Product => product !== undefined);
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

// === SYSTEM POWIADOMIEŃ ===

/**
 * Tworzy nowe powiadomienie dla użytkownika
 */
export async function createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
  const notificationsRef = collection(db, 'notifications');
  const docRef = await addDoc(notificationsRef, {
    ...notification,
    createdAt: serverTimestamp(),
    read: false,
  });
  return docRef.id;
}

/**
 * Pobiera powiadomienia użytkownika
 */
export async function getNotifications(userId: string, limitCount: number = 50): Promise<Notification[]> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
    } as Notification;
  });
}

/**
 * Pobiera nieprzeczytane powiadomienia użytkownika
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
    } as Notification;
  });
}

/**
 * Oznacza powiadomienie jako przeczytane
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
  });
}

/**
 * Oznacza wszystkie powiadomienia użytkownika jako przeczytane
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const updatePromises = snapshot.docs.map(doc => 
    updateDoc(doc.ref, { read: true })
  );
  
  await Promise.all(updatePromises);
}

/**
 * Usuwa powiadomienie
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'notifications', notificationId);
  await deleteDoc(notificationRef);
}

/**
 * Pobiera liczbę nieprzeczytanych powiadomień
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false)
  );
  
  const countSnapshot = await getCountFromServer(q);
  return countSnapshot.data().count;
}

// === ADMIN DASHBOARD STATISTICS ===

/**
 * Pobiera statystyki dashboardu admina
 * Cached for 15 minutes to reduce load
 */
export async function getAdminDashboardStats() {
  // Cache admin stats for 15 minutes
  const cacheKey = 'admin:dashboard:stats';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Podstawowe liczniki
  const counts = await getCounts();

  // Pending moderation
  const pendingDealsQuery = query(
    collection(db, 'deals'),
    where('status', 'in', ['draft', 'pending'])
  );
  const pendingProductsQuery = query(
    collection(db, 'products'),
    where('status', 'in', ['draft', 'pending'])
  );

  const [pendingDealsCount, pendingProductsCount] = await Promise.all([
    getCountFromServer(pendingDealsQuery),
    getCountFromServer(pendingProductsQuery)
  ]);

  // Nowe w ostatnich 24h
  const newDealsQuery = query(
    collection(db, 'deals'),
    where('createdAt', '>=', last24Hours.toISOString())
  );
  const newUsersQuery = query(
    collection(db, 'users'),
    where('createdAt', '>=', last24Hours.toISOString())
  );

  const [newDealsCount, newUsersCount] = await Promise.all([
    getCountFromServer(newDealsQuery),
    getCountFromServer(newUsersQuery)
  ]);

  // Aktywne w ostatnich 7 dniach (deals z komentarzami lub głosami)
  const recentDealsQuery = query(
    collection(db, 'deals'),
    where('updatedAt', '>=', last7Days.toISOString()),
    orderBy('updatedAt', 'desc'),
    limit(100)
  );
  const recentDealsSnapshot = await getDocs(recentDealsQuery);
  const recentDeals = recentDealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));

  // Średnia temperatura z aktywnych deals
  const avgTemperature = recentDeals.length > 0
    ? Math.round(recentDeals.reduce((sum, deal) => sum + (deal.temperature || 0), 0) / recentDeals.length)
    : 0;

  // Top kategorie (z approved deals)
  const allDealsQuery = query(
    collection(db, 'deals'),
    where('status', '==', 'approved'),
    limit(500)
  );
  const allDealsSnapshot = await getDocs(allDealsQuery);
  const allDeals = allDealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));

  const categoryCount: Record<string, number> = {};
  allDeals.forEach(deal => {
    const cat = deal.mainCategorySlug || 'other';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  const topCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([slug, count]) => ({ slug, count }));

  // Analytics z Firestore (views, clicks)
  const analyticsQuery = query(
    collection(db, 'analytics'),
    where('timestamp', '>=', last7Days.toISOString()),
    limit(10000)
  );
  
  let totalViews = 0;
  let totalClicks = 0;
  let totalShares = 0;
  let todayViews = 0;
  let todayClicks = 0;
  let prev7DaysViews = 0;
  let prev7DaysClicks = 0;
  
  try {
    const analyticsSnapshot = await getDocs(analyticsQuery);
    const events = analyticsSnapshot.docs.map(doc => doc.data());
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const prev7DaysStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    events.forEach((event: any) => {
      const eventDate = new Date(event.timestamp);
      
      if (event.type === 'view') {
        totalViews++;
        if (eventDate >= todayStart) todayViews++;
        if (eventDate >= prev7DaysStart && eventDate < last7Days) prev7DaysViews++;
      }
      if (event.type === 'click') {
        totalClicks++;
        if (eventDate >= todayStart) todayClicks++;
        if (eventDate >= prev7DaysStart && eventDate < last7Days) prev7DaysClicks++;
      }
      if (event.type === 'share') {
        totalShares++;
      }
    });
  } catch (error) {
    console.warn('Analytics query failed:', error);
    // Continue with zeros
  }

  // Oblicz trendy (porównanie z poprzednim tygodniem)
  const viewsTrend = prev7DaysViews > 0 
    ? Math.round(((totalViews - prev7DaysViews) / prev7DaysViews) * 100) 
    : 0;
  const clicksTrend = prev7DaysClicks > 0 
    ? Math.round(((totalClicks - prev7DaysClicks) / prev7DaysClicks) * 100) 
    : 0;

  // Oblicz growth dla pozostałych metryk (na podstawie danych z ostatnich 30 dni)
  const dealsGrowth = await calculateGrowth('deals', 30);
  const productsGrowth = await calculateGrowth('products', 30);
  const usersGrowth = await calculateGrowth('users', 30);

  const stats = {
    totals: counts,
    pending: {
      deals: pendingDealsCount.data().count,
      products: pendingProductsCount.data().count,
    },
    new24h: {
      deals: newDealsCount.data().count,
      users: newUsersCount.data().count,
    },
    avgTemperature,
    topCategories,
    recentActivity: recentDeals.length,
    analytics: {
      views: {
        total: totalViews,
        today: todayViews,
        trend: viewsTrend
      },
      clicks: {
        total: totalClicks,
        today: todayClicks,
        trend: clicksTrend
      },
      shares: {
        total: totalShares
      },
      conversionRate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0
    },
    growth: {
      deals: dealsGrowth,
      products: productsGrowth,
      users: usersGrowth
    }
  };

  // Cache stats for 15 minutes (900 seconds)
  await cacheSet(cacheKey, stats, 900);

  return stats;
}

/**
 * Oblicza wzrost procentowy dla kolekcji w określonym okresie
 */
async function calculateGrowth(collectionName: string, daysBack: number): Promise<number> {
  try {
    const now = new Date();
    const periodStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const prevPeriodStart = new Date(now.getTime() - 2 * daysBack * 24 * 60 * 60 * 1000);

    const currentQuery = query(
      collection(db, collectionName),
      where('createdAt', '>=', periodStart.toISOString())
    );
    const prevQuery = query(
      collection(db, collectionName),
      where('createdAt', '>=', prevPeriodStart.toISOString()),
      where('createdAt', '<', periodStart.toISOString())
    );

    const [currentCount, prevCount] = await Promise.all([
      getCountFromServer(currentQuery),
      getCountFromServer(prevQuery)
    ]);

    const current = currentCount.data().count;
    const prev = prevCount.data().count;

    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  } catch (error) {
    console.warn(`Growth calculation failed for ${collectionName}:`, error);
    return 0;
  }
}
