import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, increment, addDoc, serverTimestamp, setDoc, getCountFromServer, deleteDoc, updateDoc, documentId, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Category, Deal, Product, ProductCore, Comment, NavigationShowcaseConfig, Subcategory, CategoryPromo, ProductRating, Favorite, Notification, CategoryTile, ForumThread, ForumPost, ForumCategory, PostAttachment } from "@/lib/types";
import { sanitizeDealRecord, sanitizeProductRecord } from '@/lib/sanitizers';
// Jednorazowe ostrzeżenia aby nie spamować konsoli przy powtarzających się brakach indeksów / uprawnień.
const _warnedOnce = new Set<string>();
function warnOnce(key: string, ...args: any[]) {
  if (!_warnedOnce.has(key)) {
    console.warn(...args);
    _warnedOnce.add(key);
  }
}
// Uwaga: cache (Redis / LRU) ładowany leniwie tylko na serwerze; klient otrzymuje no-op.
let _cacheModule: any = null;
async function getCacheModule() {
  if (_cacheModule) return _cacheModule;
  if (typeof window !== 'undefined') return null; // klient – brak cache
  try {
    _cacheModule = await import('@/lib/cache');
    return _cacheModule;
  } catch (_) {
    return null;
  }
}
async function cacheGet(key: string) {
  const mod = await getCacheModule();
  return mod ? mod.cacheGet(key) : null;
}
async function cacheSet(key: string, value: any, ttl?: number) {
  const mod = await getCacheModule();
  if (mod) return mod.cacheSet(key, value, ttl);
}

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

const docToProduct = (snap: any): Product => sanitizeProductRecord(snap.data(), snap.id);
const docToDeal = (snap: any): Deal => sanitizeDealRecord(snap.data(), snap.id);

export async function getHotDeals(count: number): Promise<Deal[]> {
  // Lazy import cache tylko na serwerze; dla klienta funkcja i tak zwykle nie będzie używana.
  let cacheGetFn: any = null, cacheSetFn: any = null;
  if (typeof window === 'undefined') {
    try {
      const mod = await import('@/lib/cache');
      cacheGetFn = mod.cacheGet;
      cacheSetFn = mod.cacheSet;
    } catch (_) {}
  }

  const cacheKey = `deals:hot:${count}`;
  if (cacheGetFn) {
    const cached = await cacheGetFn(cacheKey);
    if (cached) return cached as Deal[];
  }

  const dealsRef = collection(db, "deals");
  const q = query(
    dealsRef,
    where("status", "==", "approved"),
    orderBy("temperature", "desc"),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  const deals = querySnapshot.docs.map(docToDeal);
  
  if (cacheSetFn) {
    await cacheSetFn(cacheKey, deals, 300);
  }
  
  return deals;
}

// Pobiera kilka losowych okazji (np. do sekcji trending AI porównawczych) - fallback gdy mało danych
export async function getRandomDeals(count: number): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const q = query(dealsRef, where("status", "==", "approved"), limit(count * 5));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map(docToDeal);
  // prosty shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

// Admin: pobierz produkty z opcjonalnym filtrem statusu
export async function getProductsForAdmin(status?: string, maxCount: number = 200): Promise<Product[]> {
  const productsRef = collection(db, "products");

  const resultsMap = new Map<string, Product>();

  // Primary: order by createdAt desc (new records usually have this field)
  try {
    let primaryQ;
    if (status && status !== 'all') {
      primaryQ = query(productsRef, where("status", "==", status), orderBy("createdAt", "desc"), limit(maxCount));
    } else {
      primaryQ = query(productsRef, orderBy("createdAt", "desc"), limit(maxCount));
    }
    const snap = await getDocs(primaryQ);
    for (const d of snap.docs) resultsMap.set(d.id, docToProduct(d));
  } catch (err: any) {
    warnOnce('getProductsForAdmin-primary', 'getProductsForAdmin primary query failed – fallback', err?.message || err);
  }

  // Fallback A: same filter without orderBy (includes docs without createdAt)
  try {
    let fallbackQ;
    if (status && status !== 'all') {
      fallbackQ = query(productsRef, where("status", "==", status), limit(maxCount));
    } else {
      fallbackQ = query(productsRef, limit(maxCount));
    }
    const snap = await getDocs(fallbackQ);
    for (const d of snap.docs) {
      if (!resultsMap.has(d.id)) resultsMap.set(d.id, docToProduct(d));
      if (resultsMap.size >= maxCount) break;
    }
  } catch (inner: any) {
    console.error('getProductsForAdmin fallback failed', inner?.message || inner);
  }

  // Optional: sort by createdAt desc when available, otherwise by name
  const all = Array.from(resultsMap.values());
  all.sort((a: any, b: any) => {
    const aTs = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
    const bTs = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
    if (aTs !== bTs) return bTs - aTs;
    const an = (a.name || '').localeCompare?.(b.name || '') ?? 0;
    return an;
  });
  return all.slice(0, maxCount);
}

// Admin: pobierz deale z opcjonalnym filtrem statusu
export async function getDealsForAdmin(status?: string, maxCount: number = 200): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const resultsMap = new Map<string, Deal>();

  // Primary order by postedAt
  try {
    let primaryQ;
    if (status && status !== 'all') {
      primaryQ = query(dealsRef, where("status", "==", status), orderBy("postedAt", "desc"), limit(maxCount));
    } else {
      primaryQ = query(dealsRef, orderBy("postedAt", "desc"), limit(maxCount));
    }
    const snap = await getDocs(primaryQ);
    for (const d of snap.docs) resultsMap.set(d.id, docToDeal(d));
  } catch (err: any) {
    warnOnce('getDealsForAdmin-primary', 'getDealsForAdmin primary query failed – fallback', err?.message || err);
  }

  // Fallback without orderBy to include docs missing postedAt
  try {
    let fallbackQ;
    if (status && status !== 'all') {
      fallbackQ = query(dealsRef, where("status", "==", status), limit(maxCount));
    } else {
      fallbackQ = query(dealsRef, limit(maxCount));
    }
    const snap = await getDocs(fallbackQ);
    for (const d of snap.docs) {
      if (!resultsMap.has(d.id)) resultsMap.set(d.id, docToDeal(d));
      if (resultsMap.size >= maxCount) break;
    }
  } catch (inner: any) {
    console.error('getDealsForAdmin fallback failed', inner?.message || inner);
  }

  const all = Array.from(resultsMap.values());
  all.sort((a: any, b: any) => {
    const aTs = (a.postedAt as any)?.toMillis ? (a.postedAt as any).toMillis() : 0;
    const bTs = (b.postedAt as any)?.toMillis ? (b.postedAt as any).toMillis() : 0;
    return bTs - aTs;
  });
  return all.slice(0, maxCount);
}

export async function getRecommendedProducts(count: number): Promise<Product[]> {
    let cacheGetFn: any = null, cacheSetFn: any = null;
    if (typeof window === 'undefined') {
      try {
        const mod = await import('@/lib/cache');
        cacheGetFn = mod.cacheGet;
        cacheSetFn = mod.cacheSet;
      } catch (_) {}
    }

    const cacheKey = `products:recommended:${count}`;
    if (cacheGetFn) {
      const cached = await cacheGetFn(cacheKey);
      if (cached) return cached as Product[];
    }

    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("status", "==", "approved"),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(docToProduct);
    
    if (cacheSetFn) {
      await cacheSetFn(cacheKey, products, 600);
    }
    
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
    if (!snap.empty) return snap.docs.map(docToProduct);
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
    if (!snap2.empty) return snap2.docs.map(docToProduct);
  } catch (_) {}
  // Ostatecznie: pierwsze N
  const q3 = query(productsRef, where("status", "==", "approved"), where("mainCategorySlug", "==", mainCategorySlug), limit(count));
  const snap3 = await getDocs(q3);
  return snap3.docs.map(docToProduct);
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
    return snap.docs.map(docToDeal);
  } catch (_) {
    const q2 = query(dealsRef, where("status", "==", "approved"), where("mainCategorySlug", "==", mainCategorySlug), limit(count));
    const snap2 = await getDocs(q2);
    return snap2.docs.map(docToDeal);
  }
}

// Funkcje do moderacji - pobieranie treści oczekujących
export async function getPendingDeals(): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  
  // Pobierz draft i pending osobno, potem połącz
  const draftQuery = query(
    dealsRef,
    where("status", "==", "draft"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const pendingQuery = query(
    dealsRef,
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  
  const [draftSnapshot, pendingSnapshot] = await Promise.all([
    getDocs(draftQuery),
    getDocs(pendingQuery)
  ]);
  
  const drafts = draftSnapshot.docs.map(docToDeal);
  const pendings = pendingSnapshot.docs.map(docToDeal);
  
  // Połącz i posortuj
  const all = [...drafts, ...pendings];
  all.sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime());
  
  return all.slice(0, 100);
}

export async function getPendingProducts(): Promise<Product[]> {
  // M6: Pobierz z product_cores zamiast products
  const productCoresRef = collection(db, "product_cores");
  
  // Pobierz draft i pending_approval osobno, potem połącz
  const draftQuery = query(
    productCoresRef,
    where("status", "==", "draft"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const pendingQuery = query(
    productCoresRef,
    where("status", "==", "pending_approval"), // M6: zmiana z "pending" na "pending_approval"
    orderBy("createdAt", "desc"),
    limit(50)
  );
  
  const [draftSnapshot, pendingSnapshot] = await Promise.all([
    getDocs(draftQuery),
    getDocs(pendingQuery)
  ]);
  
  const drafts = draftSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  const pendings = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  
  // Połącz i posortuj - użyj metadata.importedAt lub fallback na id
  const all = [...drafts, ...pendings];
  all.sort((a, b) => {
     const dateA = new Date(a.metadata?.importedAt || (a as any).createdAt || 0).getTime();
     const dateB = new Date(b.metadata?.importedAt || (b as any).createdAt || 0).getTime();
    return dateB - dateA;
  });
  
  return all.slice(0, 100);
}

export async function getRecentlyModerated(status: "approved" | "rejected", days: number = 7): Promise<(Deal | Product)[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTime = cutoffDate.getTime();
  
  // Pobierz okazje - bez range filter na updatedAt, filtrujemy w pamięci
  const dealsRef = collection(db, "deals");
  const dealsQuery = query(
    dealsRef,
    where("status", "==", status),
    orderBy("updatedAt", "desc"),
    limit(100) // pobierz więcej i przefiltruj
  );
  const dealsSnapshot = await getDocs(dealsQuery);
  const deals = dealsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data(), type: 'deal' } as any))
    .filter(deal => {
      const updatedAt = deal.updatedAt?.toDate?.() || new Date(0);
      return updatedAt.getTime() >= cutoffTime;
    })
    .slice(0, 50); // ogranicz do 50 po filtrowaniu
  
  // Pobierz produkty - podobnie
  const productsRef = collection(db, "products");
  const productsQuery = query(
    productsRef,
    where("status", "==", status),
    orderBy("updatedAt", "desc"),
    limit(100)
  );
  const productsSnapshot = await getDocs(productsQuery);
  const products = productsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data(), type: 'product' } as any))
    .filter(product => {
      const updatedAt = product.updatedAt?.toDate?.() || new Date(0);
      return updatedAt.getTime() >= cutoffTime;
    })
    .slice(0, 50);
  
  // Połącz i posortuj po dacie
  const all = [...deals, ...products];
  all.sort((a, b) => {
    const dateA = a.updatedAt?.toDate?.() || new Date(0);
    const dateB = b.updatedAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
  
  return all.slice(0, 50); // ostateczny limit
}

export async function getDealsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  count: number = 100
): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");

  // Budujemy główną próbę z sortowaniem po temperaturze (wymaga często indeksów kompozytowych)
  const buildPrimaryQuery = () => {
    if (subSubCategorySlug && subCategorySlug) {
      return query(
        dealsRef,
        where("status", "==", "approved"),
        where("mainCategorySlug", "==", mainCategorySlug),
        where("subCategorySlug", "==", subCategorySlug),
        where("subSubCategorySlug", "==", subSubCategorySlug),
        orderBy("temperature", "desc"),
        limit(count)
      );
    } else if (subCategorySlug) {
      return query(
        dealsRef,
        where("status", "==", "approved"),
        where("mainCategorySlug", "==", mainCategorySlug),
        where("subCategorySlug", "==", subCategorySlug),
        orderBy("temperature", "desc"),
        limit(count)
      );
    } else {
      return query(
        dealsRef,
        where("status", "==", "approved"),
        where("mainCategorySlug", "==", mainCategorySlug),
        orderBy("temperature", "desc"),
        limit(count)
      );
    }
  };

  // Fallback bez sortowania po temperaturze (mniejsza szansa na wymaganie indeksu)
  const buildFallbackQuery = () => {
    if (subSubCategorySlug && subCategorySlug) {
      return query(
        dealsRef,
        where("status", "==", "approved"),
        where("mainCategorySlug", "==", mainCategorySlug),
        where("subCategorySlug", "==", subCategorySlug),
        where("subSubCategorySlug", "==", subSubCategorySlug),
        limit(count)
      );
    } else if (subCategorySlug) {
      return query(
        dealsRef,
        where("status", "==", "approved"),
        where("mainCategorySlug", "==", mainCategorySlug),
        where("subCategorySlug", "==", subCategorySlug),
        limit(count)
      );
    } else {
      return query(
        dealsRef,
        where("status", "==", "approved"),
        where("mainCategorySlug", "==", mainCategorySlug),
        limit(count)
      );
    }
  };

  try {
    const primarySnap = await getDocs(buildPrimaryQuery());
    return primarySnap.docs.map(docToDeal);
  } catch (err: any) {
    // Missing index lub permission – spróbuj fallback bez sortowania
  warnOnce("getDealsByCategory-primary", "getDealsByCategory primary query failed – fallback", err?.message || err);
    try {
      const fbSnap = await getDocs(buildFallbackQuery());
      return fbSnap.docs.map(docToDeal);
    } catch (inner: any) {
      console.error("getDealsByCategory fallback failed", inner?.message || inner);
      return [];
    }
  }
}

// Produkty wg kategorii (z prostym fallbackiem na brak indeksu / orderBy). Primary próbuje sortować po createdAt.
export async function getProductsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  count: number = 100
): Promise<Product[]> {
  const productsRef = collection(db, 'products');

  const buildPrimaryQuery = () => {
    if (subSubCategorySlug && subCategorySlug) {
      return query(
        productsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        where('subSubCategorySlug', '==', subSubCategorySlug),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
    } else if (subCategorySlug) {
      return query(
        productsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
    } else {
      return query(
        productsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
    }
  };

  const buildFallbackQuery = () => {
    if (subSubCategorySlug && subCategorySlug) {
      return query(
        productsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        where('subSubCategorySlug', '==', subSubCategorySlug),
        limit(count)
      );
    } else if (subCategorySlug) {
      return query(
        productsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        limit(count)
      );
    } else {
      return query(
        productsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        limit(count)
      );
    }
  };

  try {
    const primarySnap = await getDocs(buildPrimaryQuery());
    return primarySnap.docs.map(docToProduct);
  } catch (err: any) {
  warnOnce('getProductsByCategory-primary', 'getProductsByCategory primary query failed – fallback', err?.message || err);
    try {
      const fbSnap = await getDocs(buildFallbackQuery());
      return fbSnap.docs.map(docToProduct);
    } catch (inner: any) {
      console.error('getProductsByCategory fallback failed', inner?.message || inner);
      return [];
    }
  }
}

export async function searchProducts(searchTerm: string): Promise<ProductCore[]> {
  // M6: Search in product_cores instead of legacy products collection
  const productCoresRef = collection(db, "product_cores");
  
  // Search in title field (localized)
  // For now, search the raw title field since title is a LocalizedText object
  try {
    // Create search constraints - match against all approved products with search term in searchTags
    const constraints = [where('status', '==', 'approved')];
    
    // Note: Firestore doesn't support full-text search, so this is a simplified pattern match
    // For better search, Typesense is the primary system
    const q = query(productCoresRef, ...constraints, limit(100));
    const snapshot = await getDocs(q);
    
    const results: { [id: string]: ProductCore } = {};
    const searchTermLower = searchTerm.toLowerCase();
    
    snapshot.forEach(doc => {
      const data = doc.data() as ProductCore;
      const titleText = typeof data.title === 'object' ? (data.title.pl || '') : (data.title || '');
      const searchTags = data.searchTags || [];
      
      // Simple client-side filtering: match search term in title or searchTags
      if (titleText.toLowerCase().includes(searchTermLower) || 
          searchTags.some(tag => tag.toLowerCase().includes(searchTermLower))) {
          results[doc.id] = { ...data, id: doc.id };
      }
    });
    
    return Object.values(results);
  } catch (err) {
    console.error('[searchProducts] Error searching in product_cores:', err);
    return [];
  }
}

export async function searchDeals(searchTerm: string): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");
  const titleQuery = query(dealsRef, where('title', '>=', searchTerm), where('title', '<=', searchTerm + '\uf8ff'));
  const [titleSnapshot] = await Promise.all([
    getDocs(titleQuery),
  ]);

  const results: { [id: string]: Deal } = {};
  titleSnapshot.forEach(doc => {
    results[doc.id] = docToDeal(doc);
  });

  return Object.values(results).filter(d => d.status === 'approved');
}

// Statystyki: liczba produktów, okazji i użytkowników
export async function getCounts(): Promise<{ products: number; deals: number; users: number }> {
  try {
    const [productsSnap, dealsSnap, usersSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'products'), where('status', '==', 'approved'))),
      getCountFromServer(query(collection(db, 'deals'), where('status', '==', 'approved'))),
      getCountFromServer(collection(db, 'users')),
    ]);
    return {
      products: productsSnap.data().count,
      deals: dealsSnap.data().count,
      users: usersSnap.data().count,
    };
  } catch (err: any) {
    // Brak uprawnień (permission-denied) lub inny błąd agregacji – zwróć bezpieczny fallback
    console.warn('getCounts failed – returning fallback zeros', err?.message || err);
    return { products: 0, deals: 0, users: 0 };
  }
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

export async function addComment(collectionName: "products" | "deals", docId: string, userId: string, content: string, parentId?: string | null) {
    const commentsColRef = collection(db, collectionName, docId, "comments");
    
    // Pobierz user data dla photoURL
    let userPhotoURL: string | undefined;
    let userDisplayName: string | undefined;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userPhotoURL = userData.photoURL || undefined;
        userDisplayName = userData.displayName || undefined;
      }
    } catch (error) {
      console.warn('Could not fetch user data for comment:', error);
    }
    
    await addDoc(commentsColRef, {
        userId: userId,
        userDisplayName: userDisplayName,
        userPhotoURL: userPhotoURL,
        content: content,
        parentId: parentId || null,
        repliesCount: 0,
        edited: false,
        createdAt: serverTimestamp(),
    });
    
    // Jeśli to odpowiedź, zwiększ repliesCount rodzica
    if (parentId) {
      try {
        const parentRef = doc(db, collectionName, docId, "comments", parentId);
        await updateDoc(parentRef, {
          repliesCount: increment(1)
        });
      } catch (error) {
        console.warn('Could not update parent repliesCount:', error);
      }
    }
}

export async function getComments(collectionName: "products" | "deals", docId: string, limitCount: number = 20): Promise<Comment[]> {
  const commentsColRef = collection(db, collectionName, docId, "comments");
  const q = query(commentsColRef, orderBy("createdAt", "desc"), limit(limitCount));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
}

/**
 * Edycja własnego komentarza (ustawia edited + editedAt)
 */
export async function updateComment(
  collectionName: "products" | "deals",
  docId: string,
  commentId: string,
  userId: string,
  content: string
): Promise<void> {
  const commentRef = doc(db, collectionName, docId, "comments", commentId);
  const snap = await getDoc(commentRef);
  if (!snap.exists()) throw new Error("Komentarz nie istnieje");
  const data = snap.data() as Comment;
  if (data.userId !== userId) throw new Error("Brak uprawnień do edycji");

  await updateDoc(commentRef, {
    content,
    edited: true,
    editedAt: new Date().toISOString(),
  } as any);
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
            userDisplayName: ratingData.userDisplayName || 'Użytkownik anonimowy',
        };

        // Review jest opcjonalne - dodaj tylko jeśli istnieje (Firestore nie akceptuje undefined)
        const reviewText = ratingData.review?.trim();
        const ratingPayload = reviewText 
            ? { ...validatedRating, review: reviewText }
            : validatedRating;

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

            // Save the rating (bez undefined - używamy ratingPayload)
            transaction.set(ratingDocRef, {
                ...ratingPayload,
                productId,
                userId,
                createdAt: existingRating.exists() ? existingRating.data().createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Update aggregated rating card in product
      const avg = newCount > 0 ? totalRating / newCount : 0;
      const durabilityAvg = newCount > 0 ? totalDurability / newCount : 0;
      const easeAvg = newCount > 0 ? totalEaseOfUse / newCount : 0;
      const valueAvg = newCount > 0 ? totalValueForMoney / newCount : 0;
      const versatilityAvg = newCount > 0 ? totalVersatility / newCount : 0;

      transaction.update(productDocRef, {
        'ratingCard.average': avg,
        'ratingCard.count': newCount,
        'ratingCard.durability': durabilityAvg,
        'ratingCard.easeOfUse': easeAvg,
        'ratingCard.valueForMoney': valueAvg,
        'ratingCard.versatility': versatilityAvg,
        'ratingSources.users.average': avg,
        'ratingSources.users.count': newCount,
        'ratingSources.users.updatedAt': new Date().toISOString(),
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
    return querySnapshot.docs.map(docToProduct);
}

export async function getCategories(): Promise<Category[]> {
  // Check cache first - categories rarely change, so cache for 1 hour
  const cacheKey = 'categories:all';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    console.log('[getCategories] Returning cached categories, count:', Array.isArray(cached) ? cached.length : 0);
    return cached as Category[];
  }

  const categoriesRef = collection(db, "categories");
  const snapshot = await getDocs(categoriesRef);
  console.log('[getCategories] Firestore snapshot loaded, docs count:', snapshot.docs.length);

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
              console.log(`[getCategories] Loaded subsub for ${categoryDoc.id}/${subDoc.id}: ${subSubSnap.docs.length} items`);
              if (!subSubSnap.empty) {
                subSubcategories = subSubSnap.docs.map((ssDoc) => {
                  const ssData = ssDoc.data();
                  return {
                    name: ssData.name ?? ssDoc.id,
                    slug: ssData.slug ?? ssDoc.id,
                    id: ssDoc.id,
                    icon: ssData.icon,
                    description: ssData.description,
                    importKeywords: ssData.importKeywords,
                    translations: ssData.translations,
                    sortOrder: ssData.sortOrder,
                    image: ssData.image,
                  };
                }).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              }
            } catch (err) {
              // Jeśli subcollection nie istnieje, zostaw embedded array
              console.warn(`[getCategories] Failed to load subsub for ${categoryDoc.id}/${subDoc.id}:`, err);
            }

            return {
              id: subDoc.id,
              name: subData.name ?? subDoc.id,
              slug: subData.slug ?? subDoc.id,
              icon: subData.icon,
              description: subData.description,
              translations: subData.translations,
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
        translations: data.translations,
        promo,
        tiles,
        subcategories,
      } satisfies Category;
    })
  );

  const sortedCategories = categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  console.log('[getCategories] Final result, count:', sortedCategories.length, 'with subcategories count:', sortedCategories.reduce((sum, c) => sum + (c.subcategories?.length || 0), 0));
  
  // Cache the result for 1 hour (3600 seconds)
  await cacheSet(cacheKey, sortedCategories, 3600);
  
  return sortedCategories;
}

/**
 * Pobiera kategorie z deals/produktami (filtruje puste)
 * Sprawdza ile deals/produktów jest w każdej kategorii i subcategorii
 * @param contentType 'deals' lub 'products'
 */
export async function getCategoriesWithContent(
  contentType: 'deals' | 'products' = 'deals'
): Promise<Category[]> {
  const allCategories = await getCategories();
  
  // Funkcja pomocnicza do sprawdzenia czy kategoria ma kontentu
  const getCategoryContentCount = async (categoryId: string): Promise<number> => {
    try {
      const collection_name = contentType === 'deals' ? 'deals' : 'products';
      const dealsRef = collection(db, collection_name);
      const q = query(
        dealsRef,
        where('mainCategorySlug', '==', categoryId),
        where('status', '==', 'approved'),
        limit(1) // Wystarczy wiedza czy istnieje choć jeden
      );
      const snapshot = await getDocs(q);
      return snapshot.size > 0 ? 1 : 0;
    } catch {
      return 0;
    }
  };
  
  // Filtruj kategorie - zostawiaj tylko te, które mają kontentu
  const filteredCategories = await Promise.all(
    allCategories.map(async (category) => {
      const hasContent = await getCategoryContentCount(category.id!);
      
      if (!hasContent && (!category.subcategories || category.subcategories.length === 0)) {
        return null; // Usuń kategorię bez treści i bez podkategorii
      }
      
      // Filtruj podkategorie aby pokazywać tylko te, które mają kontentu
      if (category.subcategories) {
        const filteredSubcategories = await Promise.all(
          category.subcategories.map(async (subcategory) => {
            const subHasContent = await getCategoryContentCount(subcategory.slug! || subcategory.id!);
            
            if (!subHasContent && (!subcategory.subcategories || subcategory.subcategories.length === 0)) {
              return null; // Usuń podkategorię bez treści i bez pod-podkategorii
            }
            
            // Filtruj pod-podkategorie
            if (subcategory.subcategories) {
              const filteredSubSubcategories = await Promise.all(
                subcategory.subcategories.map(async (subsubcategory) => {
                  const subsubHasContent = await getCategoryContentCount(subsubcategory.slug! || subsubcategory.id!);
                  return subsubHasContent > 0 ? subsubcategory : null;
                })
              );
              
              return {
                ...subcategory,
                subcategories: filteredSubSubcategories.filter(s => s !== null),
              };
            }
            
            return subHasContent > 0 ? subcategory : null;
          })
        );
        
        const validSubcategories = filteredSubcategories.filter(s => s !== null);
        
        // Jeśli kategoria nie ma treści ale ma podkategorie z treścią, zachowaj kategorię
        if (hasContent > 0 || validSubcategories.length > 0) {
          return {
            ...category,
            subcategories: validSubcategories,
          };
        }
      }
      
      return hasContent > 0 ? category : null;
    })
  );
  
  return filteredCategories.filter(c => c !== null);
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  const dealRef = doc(db, "deals", dealId);
  const snapshot = await getDoc(dealRef);
  if (!snapshot.exists()) {
    return null;
  }
  const raw = snapshot.data();
  const sanitized = sanitizeDealRecord(raw, snapshot.id);
  return { ...(raw as any), ...sanitized } as Deal;
}

export async function getProductById(productId: string): Promise<Product | null> {
  const productRef = doc(db, "products", productId);
  const snapshot = await getDoc(productRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<Product, "id">) };
}

/**
 * Alias for getProductById (for backward compatibility)
 */
export async function getProduct(productId: string): Promise<Product | null> {
  return getProductById(productId);
}

// === POWIĄZANIA DEAL ↔ PRODUCT ===
/**
 * Tworzy powiązanie między dealem a produktem (bidirectional, future-proof).
 * - Dodaje productId do deal.linkedProductIds (bez duplikatów)
 * - Dodaje dealId do product.linkedDealIds (bez duplikatów)
 */
export async function linkDealToProduct(dealId: string, productId: string): Promise<void> {
  const dealRef = doc(db, 'deals', dealId);
  const productRef = doc(db, 'products', productId);
  await runTransaction(db, async (tx) => {
    const dealSnap = await tx.get(dealRef);
    const productSnap = await tx.get(productRef);
    if (!dealSnap.exists()) throw new Error('Deal not found');
    if (!productSnap.exists()) throw new Error('Product not found');
    const dealData = dealSnap.data() as any;
    const productData = productSnap.data() as any;
    const linkedProductIds: string[] = Array.isArray(dealData.linkedProductIds) ? dealData.linkedProductIds : [];
    const linkedDealIds: string[] = Array.isArray(productData.linkedDealIds) ? productData.linkedDealIds : [];
    if (!linkedProductIds.includes(productId)) linkedProductIds.push(productId);
    if (!linkedDealIds.includes(dealId)) linkedDealIds.push(dealId);
    tx.update(dealRef, { linkedProductIds });
    tx.update(productRef, { linkedDealIds });
  });
}

/**
 * Usuwa powiązanie między dealem a produktem.
 */
export async function unlinkDealFromProduct(dealId: string, productId: string): Promise<void> {
  const dealRef = doc(db, 'deals', dealId);
  const productRef = doc(db, 'products', productId);
  await runTransaction(db, async (tx) => {
    const dealSnap = await tx.get(dealRef);
    const productSnap = await tx.get(productRef);
    if (!dealSnap.exists() || !productSnap.exists()) return; // silent no-op
    const dealData = dealSnap.data() as any;
    const productData = productSnap.data() as any;
    const linkedProductIds: string[] = (dealData.linkedProductIds || []).filter((id: string) => id !== productId);
    const linkedDealIds: string[] = (productData.linkedDealIds || []).filter((id: string) => id !== dealId);
    tx.update(dealRef, { linkedProductIds });
    tx.update(productRef, { linkedDealIds });
  });
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

// === AI: Tworzenie kategorii, podkategorii i produktów ===


/**
 * Tworzy kategorię główną w kolekcji "categories".
 */
export async function createCategory(data: { name: string; slug: string; icon?: string; description?: string; sortOrder?: number; accentColor?: string; heroImage?: string; }): Promise<string> {
  const ref = collection(db, 'categories');
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
}

/**
 * Tworzy podkategorię w subkolekcji "subcategories" danej kategorii.
 */
export async function createSubcategory(categoryId: string, data: { name: string; slug: string; icon?: string; description?: string; sortOrder?: number; }): Promise<string> {
  const ref = collection(db, 'categories', categoryId, 'subcategories');
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
}

/**
 * Tworzy pod-podkategorię w subkolekcji "subcategories" danej podkategorii.
 */
export async function createSubSubcategory(categoryId: string, subcategoryId: string, data: { name: string; slug: string; icon?: string; description?: string; sortOrder?: number; }): Promise<string> {
  const ref = collection(db, 'categories', categoryId, 'subcategories', subcategoryId, 'subcategories');
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    sortOrder: data.sortOrder ?? 0,
  });
  return docRef.id;
}

/**
 * Tworzy produkt w kolekcji "products" i przypisuje do kategorii/podkategorii.
 */
export async function createProduct(data: Omit<Product, 'id' | 'createdAt'> & { mainCategorySlug: string; subCategorySlug?: string; subSubCategorySlug?: string; }): Promise<string> {
  const ref = collection(db, 'products');
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    status: data.status ?? 'approved',
  });
  return docRef.id;
}

/**
 * Tworzy deal w kolekcji "deals" na podstawie produktu lub danych.
 */
export async function createDeal(data: Omit<Deal, 'id' | 'postedAt' | 'createdAt'> & { mainCategorySlug: string; subCategorySlug?: string; subSubCategorySlug?: string; }): Promise<string> {
  const ref = collection(db, 'deals');
  const docRef = await addDoc(ref, {
    ...data,
    postedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    status: data.status ?? 'approved',
    temperature: data.temperature ?? 0,
    voteCount: data.voteCount ?? 0,
  });
  
  const dealId = docRef.id;
  
  // Auto-queue hot deals to social media (if enabled and deal is approved)
  if (data.status === 'approved' && data.temperature && data.temperature > 500) {
    try {
      const { autoQueueHotDeal } = await import('./social-automation');
      const discount = data.originalPrice && data.price 
        ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
        : undefined;
      
      await autoQueueHotDeal(dealId, {
        title: data.title,
        description: data.description,
        price: data.price,
        originalPrice: data.originalPrice,
        discount,
        temperature: data.temperature,
        merchant: data.merchant,
        imageUrl: data.image,
        url: data.link,
      });
    } catch (error) {
      // Don't fail deal creation if social auto-queue fails
      console.error('Failed to auto-queue hot deal to social media:', error);
    }
  }
  
  return dealId;
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
      deals.push(docToDeal(doc));
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
      products.push(docToProduct(doc));
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
  const recentDeals = recentDealsSnapshot.docs.map(docToDeal);

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
  const allDeals = allDealsSnapshot.docs.map(docToDeal);

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

  // Categories statistics
  let categoriesStats = { total: 0, main: 0, sub: 0, subSub: 0 };
  try {
    const categoriesQuery = query(collection(db, 'categories'));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    // Zliczamy dokumenty głównych kategorii
    categoriesStats.main = categoriesSnapshot.size;
    
    // Dla podkategorii i pod-podkategorii musimy sprawdzić zagnieżdżone kolekcje
    let totalSub = 0;
    let totalSubSub = 0;
    
    for (const catDoc of categoriesSnapshot.docs) {
      const catId = catDoc.id;
      
      // Podkategorie jako subcollection
      const subCatsSnapshot = await getDocs(collection(db, 'categories', catId, 'subcategories'));
      totalSub += subCatsSnapshot.size;
      
      // Pod-podkategorie dla każdej podkategorii (też w 'subcategories')
      for (const subDoc of subCatsSnapshot.docs) {
        const subId = subDoc.id;
        const subSubSnapshot = await getDocs(collection(db, 'categories', catId, 'subcategories', subId, 'subcategories'));
        totalSubSub += subSubSnapshot.size;
      }
    }
    
    categoriesStats.sub = totalSub;
    categoriesStats.subSub = totalSubSub;
    categoriesStats.total = categoriesStats.main + categoriesStats.sub + categoriesStats.subSub;
  } catch (error) {
    console.warn('Categories stats query failed:', error);
  }

  // Import jobs statistics
  let importsStats = { running: 0, queued: 0, completed24h: 0, failed24h: 0 };
  try {
    const runningQuery = query(
      collection(db, 'import_jobs'),
      where('status', '==', 'running')
    );
    const queuedQuery = query(
      collection(db, 'import_jobs'),
      where('status', '==', 'queued')
    );
    const completed24hQuery = query(
      collection(db, 'import_jobs'),
      where('status', '==', 'completed'),
      where('completedAt', '>=', last24Hours.toISOString())
    );
    const failed24hQuery = query(
      collection(db, 'import_jobs'),
      where('status', '==', 'failed'),
      where('completedAt', '>=', last24Hours.toISOString())
    );

    const [runningCount, queuedCount, completed24hCount, failed24hCount] = await Promise.all([
      getCountFromServer(runningQuery),
      getCountFromServer(queuedQuery),
      getCountFromServer(completed24hQuery),
      getCountFromServer(failed24hQuery)
    ]);

    importsStats.running = runningCount.data().count;
    importsStats.queued = queuedCount.data().count;
    importsStats.completed24h = completed24hCount.data().count;
    importsStats.failed24h = failed24hCount.data().count;
  } catch (error) {
    console.warn('Import jobs stats query failed:', error);
  }

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
    },
    categories: categoriesStats,
    imports: importsStats,
    harvester: {
      running: importsStats.running,
      created24h: importsStats.completed24h
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

// ================================
// Forum: funkcje dostępu do danych
// ================================

// Kategorie forum
export async function listForumCategories(): Promise<ForumCategory[]> {
  const ref = collection(db, 'forum_categories');
  const snap = await getDocs(query(ref, orderBy('sortOrder', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ForumCategory));
}

// Lista wątków (z sortowaniem po ostatniej aktywności)
export async function listForumThreads(limitCount: number = 20, categoryId?: string): Promise<ForumThread[]> {
  const ref = collection(db, 'forum_threads');
  let qBase;
  try {
    if (categoryId) {
      qBase = query(
        ref,
        where('categoryId', '==', categoryId),
        where('status', 'in', ['approved', undefined, null]),
        orderBy('isPinned', 'desc'),
        orderBy('lastPostAt', 'desc'),
        limit(limitCount)
      );
    } else {
      qBase = query(
        ref,
        where('status', 'in', ['approved', undefined, null]),
        orderBy('isPinned', 'desc'),
        orderBy('lastPostAt', 'desc'),
        limit(limitCount)
      );
    }
  } catch {
    // fallback jeśli brak indeksu
    qBase = categoryId
      ? query(ref, where('categoryId', '==', categoryId), orderBy('createdAt', 'desc'), limit(limitCount))
      : query(ref, orderBy('createdAt', 'desc'), limit(limitCount));
  }
  const snap = await getDocs(qBase);
  const threads = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ForumThread));
  
  // Filtruj tylko approved/undefined oraz sortuj przypięte na górze
  return threads
    .filter(t => !t.status || t.status === 'approved')
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
}

export async function getForumThread(threadId: string): Promise<ForumThread | null> {
  const ref = doc(db, 'forum_threads', threadId);
  const d = await getDoc(ref);
  if (!d.exists()) return null;
  return { id: d.id, ...(d.data() as any) } as ForumThread;
}

export async function listForumPosts(threadId: string, limitCount: number = 100): Promise<ForumPost[]> {
  const ref = collection(db, 'forum_posts');
  const q = query(
    ref,
    where('threadId', '==', threadId),
    where('status', 'in', ['approved', undefined, null]),
    orderBy('createdAt', 'asc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  const posts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ForumPost));
  
  // Filtruj tylko approved/undefined (nie usunięte)
  return posts.filter(p => !p.status || p.status === 'approved');
}

export async function createForumThread(params: {
  title: string;
  content: string;
  categoryId?: string | null;
  attachments?: PostAttachment[];
  authorUid: string;
  authorDisplayName?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  // Najpierw utwórz wątek
  const thread: Omit<ForumThread, 'id'> = {
    title: params.title,
    authorUid: params.authorUid,
    authorDisplayName: params.authorDisplayName ?? null,
    categoryId: params.categoryId ?? null,
    tags: [],
    summary: params.content.slice(0, 200),
    attachments: params.attachments,
    postsCount: 1,
    createdAt: now,
    updatedAt: now,
    lastPostAt: now,
  };
  const threadRef = await addDoc(collection(db, 'forum_threads'), thread as any);

  // Następnie dodaj pierwszy post do subkolekcji
  const post: Omit<ForumPost, 'id'> = {
    threadId: threadRef.id,
    authorUid: params.authorUid,
    authorDisplayName: params.authorDisplayName ?? null,
    content: params.content,
    attachments: params.attachments,
    parentId: null,
    upvotes: 0,
    downvotes: 0,
    createdAt: now,
    updatedAt: now,
  };
  await addDoc(collection(db, 'forum_threads', threadRef.id, 'posts'), post as any);

  return threadRef.id;
}

export async function addForumPost(params: {
  threadId: string;
  content: string;
  attachments?: PostAttachment[];
  authorUid: string;
  authorDisplayName?: string | null;
  parentId?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const post: Omit<ForumPost, 'id'> = {
    threadId: params.threadId,
    authorUid: params.authorUid,
    authorDisplayName: params.authorDisplayName ?? null,
    content: params.content,
    attachments: params.attachments,
    parentId: params.parentId ?? null,
    upvotes: 0,
    downvotes: 0,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, 'forum_threads', params.threadId, 'posts'), post as any);
  // Aktualizuj licznik i lastPostAt
  await updateDoc(doc(db, 'forum_threads', params.threadId), {
    postsCount: increment(1),
    lastPostAt: now,
    updatedAt: now,
  });
  return ref.id;
}

// ============================================
// Secret Promotional Pages
// ============================================

/**
 * Get secret page by slug
 */
export async function getSecretPageBySlug(slug: string) {
  const cacheKey = `secret-page:${slug}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const secretPagesRef = collection(db, "secret_pages");
  const q = query(secretPagesRef, where("slug", "==", slug), where("isActive", "==", true), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  await cacheSet(cacheKey, data, 300); // 5min cache
  return data;
}

/**
 * Get all secret pages (admin)
 */
export async function getAllSecretPages() {
  const q = query(
    collection(db, "secret_pages"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get secret page by ID
 */
export async function getSecretPageById(id: string) {
  const docRef = doc(db, "secret_pages", id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Create secret page
 */
export async function createSecretPage(data: any) {
  const secretPagesRef = collection(db, "secret_pages");
  const docRef = await addDoc(secretPagesRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    stats: {
      totalViews: 0,
      totalSpins: 0,
      uniqueVisitors: 0,
    },
  });
  return docRef.id;
}

/**
 * Update secret page
 */
export async function updateSecretPage(id: string, data: any) {
  const docRef = doc(db, "secret_pages", id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
  
  // Clear cache
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const slug = docSnap.data().slug;
    await cacheSet(`secret-page:${slug}`, null);
  }
}

/**
 * Delete secret page
 */
export async function deleteSecretPage(id: string) {
  const docRef = doc(db, "secret_pages", id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const slug = docSnap.data().slug;
    await cacheSet(`secret-page:${slug}`, null);
  }
  
  await deleteDoc(docRef);
}

/**
 * Record page view
 */
export async function recordSecretPageView(pageId: string, ipAddress: string) {
  const docRef = doc(db, "secret_pages", pageId);
  await updateDoc(docRef, {
    "stats.totalViews": increment(1),
  });

  // Track unique visitor (simplified - could use separate collection)
  // For now just increment totalViews
}

/**
 * Record spin
 */
export async function recordSecretPageSpin(pageId: string, prizeId: string, prizeLabel: string, userId?: string) {
  const spinsRef = collection(db, "secret_page_spins");
  await addDoc(spinsRef, {
    pageId,
    prizeId,
    prizeLabel,
    userId: userId || null,
    timestamp: serverTimestamp(),
  });

  // Increment spin counter
  const docRef = doc(db, "secret_pages", pageId);
  await updateDoc(docRef, {
    "stats.totalSpins": increment(1),
  });
}

// =============================================================================
// PRE-REGISTRATION FUNCTIONS
// =============================================================================

/**
 * Get current pre-registration count
 */
export async function getPreRegistrationCount(): Promise<number> {
  const snapshot = await getDocs(collection(db, "pre_registrations"));
  return snapshot.size;
}

/**
 * Check if email already registered
 */
export async function checkPreRegistrationExists(email: string): Promise<boolean> {
  const q = query(
    collection(db, "pre_registrations"),
    where("email", "==", email.toLowerCase())
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Create pre-registration (max 5000)
 */
export async function createPreRegistration(data: {
  email: string;
  name: string;
  ipAddress?: string;
  userAgent?: string;
  referralSource?: string;
}): Promise<{ success: boolean; registrationNumber?: number; error?: string }> {
  const email = data.email.toLowerCase().trim();
  
  // Check if already registered
  const exists = await checkPreRegistrationExists(email);
  if (exists) {
    return { success: false, error: "Ten adres email jest już zarejestrowany" };
  }

  // Check limit
  const currentCount = await getPreRegistrationCount();
  if (currentCount >= 5000) {
    return { success: false, error: "Osiągnięto limit 5000 rejestracji" };
  }

  const registrationNumber = currentCount + 1;
  const PIONEER_LIMIT = 58;
  const role = registrationNumber <= PIONEER_LIMIT ? "pioneer" : "beta";

  const docRef = await addDoc(collection(db, "pre_registrations"), {
    email,
    name: data.name.trim(),
    role,
    status: "pending",
    registrationNumber,
    createdAt: serverTimestamp(),
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    referralSource: data.referralSource || null,
  });

  return { success: true, registrationNumber };
}

/**
 * Get all pre-registrations (admin only)
 */
export async function getAllPreRegistrations() {
  const q = query(
    collection(db, "pre_registrations"),
    orderBy("registrationNumber", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.().toISOString?.() || null,
    confirmedAt: doc.data().confirmedAt?.toDate?.().toISOString?.() || null,
    invitedAt: doc.data().invitedAt?.toDate?.().toISOString?.() || null,
  }));
}

/**
 * Zaloguj polecenie AI do Firestore
 */
export async function logAiCommand({
  command,
  status,
  result,
  userId = null,
  meta = null
}: {
  command: string;
  status: string;
  result: string;
  userId?: string | null;
  meta?: any;
}) {
  const ref = collection(db, "ai_commands");
  await addDoc(ref, {
    command,
    status,
    result,
    userId: userId || null,
    meta: meta || null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Pobierz historię poleceń AI (najnowsze pierwsze)
 */
export async function getAiCommandHistory(limitCount: number = 20) {
  const ref = collection(db, "ai_commands");
  const q = query(ref, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.().toISOString?.() || null,
  }));
}

// ============================================
// M6: PRODUCT-CENTRIC ARCHITECTURE QUERIES
// ============================================

/**
 * Get a ProductCore by ID
 */
export async function getProductCore(productId: string): Promise<any | null> {
  try {
    if (!productId || productId.trim() === '') {
      console.error('[getProductCore] Invalid product ID provided:', productId);
      return null;
    }
    
    const docRef = doc(db, "product_cores", productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.warn(`[getProductCore] Product core not found: ${productId}`);
      return null;
    }
    
    const product = { id: docSnap.id, ...docSnap.data() };
    
    // Validate that product has ID after mapping
    if (!product.id) {
      console.error('[getProductCore] Product created without ID:', product);
      return null;
    }
    
    return product;
  } catch (err) {
    console.error("[getProductCore] Error fetching product core:", err);
    return null;
  }
}

/**
 * Get ProductCore with all linked Deals
 */
export async function getProductWithDeals(productId: string): Promise<{ product: any; deals: any[] } | null> {
  try {
    const product = await getProductCore(productId);
    if (!product) return null;

    const dealsRef = collection(db, "deals");
    const q = query(dealsRef, where("productCoreId", "==", productId), where("status", "==", "approved"));
    const dealsSnap = await getDocs(q);
    const deals = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { product, deals };
  } catch (err) {
    console.error("Error fetching product with deals:", err);
    return null;
  }
}

/**
 * Get all ProductCores (with optional status filter)
 */
export async function getAllProductCores(
  status?: string,
    limitCount: number = 100
): Promise<any[]> {
  try {
    const ref = collection(db, "product_cores");
      const constraints: any[] = [orderBy("updatedAt", "desc"), limit(limitCount)];

    if (status) {
      constraints.unshift(where("status", "==", status));
    }

    const q = query(ref, ...constraints);
    const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductCore));
  } catch (err) {
    console.error("Error fetching product cores:", err);
    return [];
  }
}

/**
 * Get Deals for a specific ProductCore
 */
export async function getDealsForProduct(productId: string): Promise<any[]> {
  try {
    const dealsRef = collection(db, "deals");
    const q = query(
      dealsRef,
      where("productCoreId", "==", productId),
      where("status", "==", "approved"),
      orderBy("price.amount", "asc") // Sort by price ascending (best deals first)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error fetching deals for product:", err);
    return [];
  }
}

/**
 * Get best (lowest) deal for a ProductCore
 */
export async function getBestDealForProduct(productId: string): Promise<any | null> {
  try {
    const deals = await getDealsForProduct(productId);
    if (deals.length === 0) return null;

    // Find the deal with the lowest total price (product + shipping)
    const bestDeal = deals.reduce((best, current) => {
      const bestTotal = (best.price?.amount || 0) + (best.shipping?.cost || 0);
      const currentTotal = (current.price?.amount || 0) + (current.shipping?.cost || 0);
      return currentTotal < bestTotal ? current : best;
    });

    return bestDeal;
  } catch (err) {
    console.error("Error getting best deal:", err);
    return null;
  }
}

/**
 * Search ProductCores by title or specs
 */
export async function searchProductCores(
  searchText: string,
    limitCount: number = 20
): Promise<any[]> {
  try {
    // For now, use simple substring search
    // TODO: Integrate with Typesense for full-text search
    const ref = collection(db, "product_cores");
    const q = query(
      ref,
      where("status", "==", "approved"),
      orderBy("updatedAt", "desc"),
        limit(limitCount)
    );

    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductCore));

    // Client-side filtering
    const searchLower = searchText.toLowerCase();
    return products.filter(p => {
      const title = (p.title?.pl || "").toLowerCase();
      const specs = Object.entries(p.specs || {})
        .map(([k, v]) => `${k} ${v}`.toLowerCase())
        .join(" ");

      return title.includes(searchLower) || specs.includes(searchLower);
    });
  } catch (err) {
    console.error("Error searching products:", err);
    return [];
  }
}

/**
 * Get recommended ProductCores (M6)
 */
export async function getRecommendedProductCores(count: number = 50): Promise<any[]> {
  try {
    const ref = collection(db, "product_cores");
    const q = query(
      ref,
      where("status", "==", "approved"),
      limit(count * 2) // Fetch more to account for sorting on client
    );
    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductCore));
    // Sort by price on client side to avoid requiring a complex index
    products.sort((a, b) => {
      const priceA = a.bestPrice?.amount || 0;
      const priceB = b.bestPrice?.amount || 0;
      return priceA - priceB;
    });
    return products.slice(0, count);
  } catch (err) {
    console.error("Error fetching recommended products:", err);
    return [];
  }
}

/**
 * Get ProductCores by category (M6)
 */
export async function getProductCoresByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
    limitCount: number = 50
): Promise<any[]> {
  try {
    const ref = collection(db, "product_cores");
    const constraints: any[] = [
      where("status", "==", "approved"),
      where("mainCategorySlug", "==", mainCategorySlug),
    ];

    if (subCategorySlug) {
      constraints.push(where("subCategorySlug", "==", subCategorySlug));
    }

    if (subSubCategorySlug) {
      constraints.push(where("subSubCategorySlug", "==", subSubCategorySlug));
    }

    // Fetch more to account for sorting on client side
    constraints.push(limit(limitCount * 2));

    const q = query(ref, ...constraints);
    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductCore));
    
    // Sort by price on client side to avoid requiring complex indexes
    products.sort((a, b) => {
      const priceA = a.bestPrice?.amount || 0;
      const priceB = b.bestPrice?.amount || 0;
      return priceA - priceB;
    });
    
    return products.slice(0, limitCount);
  } catch (err) {
    console.error("Error fetching products by category:", err);
    return [];
  }
}

/**
 * Update ProductCore best price (called when deals change)
 */
export async function updateProductBestPrice(productId: string): Promise<void> {
  try {
    const deals = await getDealsForProduct(productId);
    if (deals.length === 0) return;

    // Find lowest price
    const bestDeal = deals.reduce((best, current) => {
      const bestPrice = (best.price?.amount || 0) + (best.shipping?.cost || 0);
      const currentPrice = (current.price?.amount || 0) + (current.shipping?.cost || 0);
      return currentPrice < bestPrice ? current : best;
    });

    const productRef = doc(db, "product_cores", productId);
    await updateDoc(productRef, {
      bestPrice: {
        amount: (bestDeal.price?.amount || 0) + (bestDeal.shipping?.cost || 0),
        currency: "USD",
      },
      linkedDealIds: deals.map((d: any) => d.id),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error updating product best price:", err);
  }
}

/**
 * Get Harvester jobs
 */
export async function getHarvesterJobs(limitCount: number = 20): Promise<any[]> {
  try {
    const ref = collection(db, "harvester_jobs");
    const q = query(ref, orderBy("startedAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error fetching harvester jobs:", err);
    return [];
  }
}

/**
 * Get Refiner jobs
 */
export async function getRefinerJobs(limitCount: number = 20): Promise<any[]> {
  try {
    const ref = collection(db, "refiner_jobs");
    const q = query(ref, orderBy("startedAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error fetching refiner jobs:", err);
    return [];
  }
}

/**
 * Get a specific Harvester job
 */
export async function getHarvesterJob(jobId: string): Promise<any | null> {
  try {
    const docRef = doc(db, "harvester_jobs", jobId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.error("Error fetching harvester job:", err);
    return null;
  }
}

/**
 * Merge two ProductCores (admin operation)
 * Combines specs and redirects all deals from targetId to sourceId
 */
export async function mergeProductCores(sourceId: string, targetId: string): Promise<void> {
  try {
    const source = await getProductCore(sourceId);
    const target = await getProductCore(targetId);

    if (!source || !target) throw new Error("Product not found");

    // Merge specs
    const mergedSpecs = { ...target.specs, ...source.specs };

    // Get all deals from target
    const targetDeals = await getDealsForProduct(targetId);

    // Update all deals to point to source
    const batch = writeBatch(db);
    for (const deal of targetDeals) {
      const dealRef = doc(db, "deals", deal.id);
      batch.update(dealRef, { productId: sourceId });
    }

    // Update source product
    const sourceRef = doc(db, "product_cores", sourceId);
    batch.update(sourceRef, {
      specs: mergedSpecs,
      linkedDealIds: [...(source.linkedDealIds || []), ...targetDeals.map((d: any) => d.id)],
      updatedAt: new Date().toISOString(),
    });

    // Delete target product
    const targetRef = doc(db, "product_cores", targetId);
    batch.delete(targetRef);

    await batch.commit();
  } catch (err) {
    console.error("Error merging products:", err);
    throw err;
  }
}

/**
 * M6 Unified Filtering & Sorting for ProductCore
 * Supports: price range, rating, availability, discount, category, brands, specs
 */
export async function getProductCoresByFilters(
  filters: {
    priceRange?: { min: number; max: number };
    minRating?: number;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    categoryId?: string;
    brands?: string[];
    searchTerm?: string;
  },
  sortBy: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'relevance' = 'relevance',
  limit_count: number = 50
): Promise<ProductCore[]> {
  try {
    let q = query(collection(db, 'product_cores'), where('status', '==', 'approved'));

    // Apply category filter
    if (filters.categoryId) {
      q = query(q, where('mainCategorySlug', '==', filters.categoryId));
    }

    // Build base query
    let constraints = [where('status', '==', 'approved')];
    
    if (filters.categoryId) {
      constraints.push(where('mainCategorySlug', '==', filters.categoryId));
    }

    // Firestore can't filter on nested fields like bestPrice.amount directly in where,
    // so we fetch all and filter in-memory (alternative: use Firestore Lite or index)
    q = query(collection(db, 'product_cores'), ...constraints, orderBy('updatedAt', 'desc'), limit(limit_count));

    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => {
      // CRITICAL: doc.data() does NOT include 'id' field - must add it manually
      const data = {
        ...doc.data(),
        id: doc.id  // Always use doc.id, never doc.data().id
      } as ProductCore;
      
      if (!doc.id) {
        console.error('[getProductCoresByFilters] Firestore doc missing ID (should never happen):', doc.ref.path);
      }
      return data;
    });
    
    console.log(`[getProductCoresByFilters] Fetched ${products.length} products, first 3:`, 
      products.slice(0, 3).map(p => ({ id: (p as ProductCore).id, title: typeof (p as ProductCore).title === 'object' ? (p as ProductCore).title.pl : (p as ProductCore).title }))
    );

    // Client-side filtering for complex conditions
    let filtered = products.filter(p => {
      const pc = p as ProductCore;
      // Price range
      if (filters.priceRange) {
        const price = pc.bestPrice?.amount || 0;
        if (price < filters.priceRange.min || price > filters.priceRange.max) return false;
      }

      // Rating
      if (filters.minRating && (pc.rating?.score || 0) < filters.minRating) return false;

      // Brand filter
      if (filters.brands && filters.brands.length > 0) {
        // Assuming brand might be in specs or metadata
        const productBrand = pc.metadata?.brand || '';
        if (!filters.brands.includes(productBrand)) return false;
      }

      // Search term (match against title, description, specs)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const titleMatch = (typeof pc.title === 'object' ? pc.title.pl : pc.title || '').toLowerCase().includes(searchLower);
        const descMatch = (typeof pc.description === 'object' ? pc.description.pl : pc.description || '').toLowerCase().includes(searchLower);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });

    // Client-side sorting
    filtered.sort((a, b) => {
      const pa = a as ProductCore;
      const pb = b as ProductCore;
      switch (sortBy) {
        case 'price_asc':
          return (pa.bestPrice?.amount || 0) - (pb.bestPrice?.amount || 0);
        case 'price_desc':
          return (pb.bestPrice?.amount || 0) - (pa.bestPrice?.amount || 0);
        case 'rating_desc':
          return (pb.rating?.score || 0) - (pa.rating?.score || 0);
        case 'newest':
          return new Date(pb.updatedAt || 0).getTime() - new Date(pa.updatedAt || 0).getTime();
        case 'hot':
          // Assuming hot products have higher temperature or popularity metric
          return (pb.rating?.count || 0) - (pa.rating?.count || 0);
        case 'relevance':
        default:
          return 0;
      }
    });

    return filtered.slice(0, limit_count) as ProductCore[];
  } catch (err) {
    console.error('Error filtering products:', err);
    return [] as ProductCore[];
  }
}

/**
 * M6 Unified Filtering & Sorting for DealM6
 * Supports: price range, rating, availability, discount, source, category
 */
export async function getDealsByFilters(
  filters: {
    priceRange?: { min: number; max: number };
    minRating?: number;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    minDiscount?: number;
    categoryId?: string;
    sources?: Array<'aliexpress' | 'amazon' | 'allegro'>;
    searchTerm?: string;
  },
  sortBy: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'discount_desc' = 'hot',
  limit_count: number = 50
): Promise<any[]> {
  try {
    const constraints = [where('status', '==', 'approved')];

    if (filters.categoryId) {
      constraints.push(where('mainCategorySlug', '==', filters.categoryId));
    }

    const q = query(
      collection(db, 'deals'),
      ...constraints,
      orderBy('updatedAt', 'desc'),
      limit(limit_count)
    );

    const snapshot = await getDocs(q);
    let deals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filtering for complex conditions
    let filtered = deals.filter(d => {
      const deal = d as Deal;
      // Price range
      if (filters.priceRange) {
        const price = (deal as any).priceV2?.amount || deal.price || 0;
        if (price < filters.priceRange.min || price > filters.priceRange.max) return false;
      }

      // In stock
      if (filters.inStockOnly && (deal as any).inStock === false) return false;

      // Discount
      if (filters.discountOnly && !deal.originalPrice) return false;
      if (filters.minDiscount && deal.originalPrice) {
        const discount = ((deal.originalPrice - ((deal as any).priceV2?.amount || deal.price)) / deal.originalPrice) * 100;
        if (discount < filters.minDiscount) return false;
      }

      // Source filter
      if (filters.sources && filters.sources.length > 0) {
        if (!filters.sources.includes((deal as any).source)) return false;
      }

      // Search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const titleText = typeof deal.title === 'object' ? (deal.title.pl || deal.title.en || '') : (deal.title || '');
        const titleMatch = titleText.toLowerCase().includes(searchLower);
        if (!titleMatch) return false;
      }

      return true;
    });

    // Client-side sorting
    filtered.sort((a, b) => {
      const da = a as Deal;
      const db = b as Deal;
      switch (sortBy) {
        case 'price_asc':
          return ((da as any).priceV2?.amount || da.price || 0) - ((db as any).priceV2?.amount || db.price || 0);
        case 'price_desc':
          return ((db as any).priceV2?.amount || db.price || 0) - ((da as any).priceV2?.amount || da.price || 0);
        case 'rating_desc':
          return ((db as any).rating || 0) - ((da as any).rating || 0);
        case 'newest':
          return new Date((db as any).createdAt || 0).getTime() - new Date((da as any).createdAt || 0).getTime();
        case 'discount_desc':
          if (da.originalPrice && db.originalPrice) {
            const aDiscount = ((da.originalPrice - ((da as any).priceV2?.amount || da.price)) / da.originalPrice) * 100;
            const bDiscount = ((db.originalPrice - ((db as any).priceV2?.amount || db.price)) / db.originalPrice) * 100;
            return bDiscount - aDiscount;
          }
          return 0;
        case 'hot':
        default:
          // Hot deals: sort by temperature or votes
          return ((db as any).temperature || 0) - ((da as any).temperature || 0);
      }
    });

    return filtered.slice(0, limit_count);
  } catch (err) {
    console.error('Error filtering deals:', err);
    return [];
  }
}

