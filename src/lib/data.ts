import { collection, collectionGroup, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, increment, addDoc, serverTimestamp, setDoc, getCountFromServer, deleteDoc, updateDoc, documentId, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Category, Deal, Product, ProductCore, Comment, NavigationShowcaseConfig, Subcategory, CategoryPromo, ProductRating, Favorite, Notification, CategoryTile, ForumThread, ForumPost, ForumCategory, PostAttachment, CategorySuggestion } from "@/lib/types";
import { sanitizeDealRecord, sanitizeProductRecord, sanitizeProductCoreRecord } from '@/lib/sanitizers';
import { getExternalUrl } from '@/lib/external-url';
import { filterCategoriesByContent } from '@/lib/data/categories-content';
import {
  getDealsByCategoryData,
  getDealsByFiltersData,
  getDealsCountData,
  getHotDealsByCategoryData,
  getHotDealsData,
} from '@/lib/data/deals';
import {
  getProductCoresByCategoryData,
  getProductCoresByFiltersData,
  getRecommendedProductCoresData,
} from '@/lib/data/products';
import {
  getDealsForModerationData,
  getPendingDealsData,
  getPendingProductsData,
  getProductCoresForModerationData,
  getRecentlyModeratedData,
} from '@/lib/data/moderation';
import {
  createNotificationData,
  deleteNotificationData,
  getNotificationsData,
  getUnreadNotificationsCountData,
  getUnreadNotificationsData,
  markAllNotificationsAsReadData,
  markNotificationAsReadData,
} from '@/lib/data/notifications';
import {
  addForumPostData,
  approveCategorySuggestionData,
  createCategorySuggestionData,
  createForumThreadData,
  getForumThreadData,
  listCategorySuggestionsData,
  listForumCategoriesData,
  listForumPostsData,
  listForumThreadsData,
  rejectCategorySuggestionData,
} from '@/lib/data/forum';
import { ensureCategoryTranslations } from '@/lib/category-translations';

const DEBUG_DATA_LOGS = process.env.NEXT_PUBLIC_DEBUG === 'true';
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
const docToProductCore = (snap: any): ProductCore => sanitizeProductCoreRecord(snap.data(), snap.id);

const TEMPERATURE_HALF_LIFE_HOURS = 48;

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function withDecayedTemperature(deal: Deal): Deal {
  const baseTemperature = Number(deal.temperature || 0);
  if (!Number.isFinite(baseTemperature) || baseTemperature <= 0) return deal;

  const referenceTs =
    (deal as any).lastVoteAt ||
    (deal as any).updatedAt ||
    deal.postedAt;

  const referenceMillis = toMillis(referenceTs);
  if (!referenceMillis) return deal;

  const ageHours = Math.max(0, (Date.now() - referenceMillis) / (1000 * 60 * 60));
  const decayFactor = Math.exp((-Math.log(2) * ageHours) / TEMPERATURE_HALF_LIFE_HOURS);
  const decayedTemperature = Math.round(baseTemperature * decayFactor * 100) / 100;

  return {
    ...deal,
    temperature: decayedTemperature,
  };
}

function rankDealsWithDecay(deals: Deal[], count: number): Deal[] {
  return deals
    .map(withDecayedTemperature)
    .sort((a, b) => (b.temperature || 0) - (a.temperature || 0))
    .slice(0, count);
}

export async function getHotDeals(count: number): Promise<Deal[]> {
  return getHotDealsData(count);
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

    const cacheKey = `products:recommended:v2:${count}`;
    if (cacheGetFn) {
      const cached = await cacheGetFn(cacheKey);
      if (cached) return cached as Product[];
    }

    // Try M6 ProductCores first (they have bestPrice and deals).
    // Public Firestore rules allow only approved, so non-public statuses are fetched via Admin SDK on server.
    const coresRef = collection(db, "product_cores");
    const productMap = new Map<string, Product>();
    const baseLimit = count * 2;

    try {
      const approvedQ = query(
        coresRef,
        where("status", "==", "approved"),
        limit(baseLimit)
      );
      const approvedSnap = await getDocs(approvedQ);

      for (const snap of approvedSnap.docs) {
        if (!productMap.has(snap.id)) {
          productMap.set(snap.id, docToProductCore(snap) as any as Product);
        }
      }
    } catch (err) {
      console.error("getRecommendedProducts approved query failed:", err);
    }

    if (typeof window === 'undefined' && productMap.size < count) {
      try {
        const { getAdminFirestore } = await import('@/lib/firebase-admin-server');
        const adminDb = getAdminFirestore();
        const statusPriority = ['pending_approval', 'approval'];

        for (const status of statusPriority) {
          if (productMap.size >= baseLimit) break;

          const snap = await adminDb
            .collection('product_cores')
            .where('status', '==', status)
            .limit(baseLimit)
            .get();

          for (const doc of snap.docs) {
            if (!productMap.has(doc.id)) {
              productMap.set(doc.id, sanitizeProductCoreRecord(doc.data(), doc.id) as any as Product);
            }
          }
        }
      } catch (err) {
        // Keep homepage resilient when local admin credentials are unavailable.
        console.warn('getRecommendedProducts admin fallback unavailable:', err);
      }
    }

    const products = Array.from(productMap.values())
      .sort((a: any, b: any) => (a?.bestPrice?.amount || 0) - (b?.bestPrice?.amount || 0))
      .slice(0, count);
    
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
  return getHotDealsByCategoryData(mainCategorySlug, count);
}

// Funkcje do moderacji - pobieranie treści oczekujących
/**
 * Pobiera deale dla moderacji - WSZYSTKIE statusy (approved, pending, draft, rejected)
 * @param statusFilter - opcjonalny filtr statusu; jeśli undefined, pobiera wszystkie
 * @param maxLimit - maksymalna liczba wyników
 */
export async function getDealsForModeration(statusFilter?: string[], maxLimit = 200): Promise<Deal[]> {
  return getDealsForModerationData(statusFilter, maxLimit);
}

/**
 * Backward compatibility: getPendingDeals używa getDealsForModeration z filtrem pending/draft
 */
export async function getPendingDeals(): Promise<Deal[]> {
  return getPendingDealsData();
}

/**
 * Pobiera ProductCores dla moderacji - WSZYSTKIE statusy (approved, pending_approval, draft, rejected)
 * M6: używa product_cores collection
 * @param statusFilter - opcjonalny filtr statusu; jeśli undefined, pobiera wszystkie
 * @param maxLimit - maksymalna liczba wyników
 */
export async function getProductCoresForModeration(statusFilter?: string[], maxLimit = 200): Promise<Product[]> {
  return getProductCoresForModerationData(statusFilter, maxLimit);
}

/**
 * Backward compatibility: getPendingProducts używa getProductCoresForModeration z filtrem pending/draft
 */
export async function getPendingProducts(): Promise<Product[]> {
  return getPendingProductsData();
}

export async function getRecentlyModerated(status: "approved" | "rejected", days: number = 7): Promise<(Deal | Product)[]> {
  return getRecentlyModeratedData(status, days);
}

export async function getDealsByCategory(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  count: number = 100
): Promise<Deal[]> {
  return getDealsByCategoryData(mainCategorySlug, subCategorySlug, subSubCategorySlug, count);
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
      getCountFromServer(query(collection(db, 'product_cores'), where('status', '==', 'approved'))),
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

            transaction.set(voteDocRef, { vote: vote, createdAt: serverTimestamp() });
            transaction.update(dealDocRef, { 
                temperature: increment(vote),
              voteCount: increment(vote > 0 ? 1 : -1),
              lastVoteAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
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
    let userPhotoURL: string | null = null;
    let userDisplayName: string = `Użytkownik ${userId.substring(0, 6)}...`; // Default fallback
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userPhotoURL = userData.photoURL || null;
        userDisplayName = userData.displayName || userDisplayName;
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
  return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Comment));
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
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductRating));
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
  const cacheKey = 'categories:all:v2';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    if (DEBUG_DATA_LOGS) {
      console.log('[getCategories] Returning cached categories, count:', Array.isArray(cached) ? cached.length : 0);
    }
    return cached as Category[];
  }

  // Batch 3 Firestore reads instead of N + N*M + N individual reads.
  // collectionGroup('subcategories') fetches all L2 + L3 subcategories in one round-trip.
  // collectionGroup('tiles') fetches all category tiles similarly.
  const [categoriesSnap, allSubsSnap, allTilesSnap] = await Promise.all([
    getDocs(collection(db, 'categories')),
    getDocs(collectionGroup(db, 'subcategories')),
    getDocs(collectionGroup(db, 'tiles')),
  ]);

  if (DEBUG_DATA_LOGS) {
    console.log(
      `[getCategories] Loaded: ${categoriesSnap.size} categories, ` +
      `${allSubsSnap.size} subcollection subs, ${allTilesSnap.size} tiles (3 reads total).`
    );
  }

  // Index L2 subcategories by parent category ID.
  // Path pattern: categories/{catId}/subcategories/{subId} → 4 path segments.
  const l2Map = new Map<string, Array<{ id: string; path: string; [k: string]: unknown }>>();

  // Index L3 sub-subcategories by parent subcategory path.
  // Path pattern: categories/{catId}/subcategories/{subId}/subcategories/{ssId} → 6 segments.
  const l3Map = new Map<string, Array<{ id: string; [k: string]: unknown }>>();

  for (const subDoc of allSubsSnap.docs) {
    const pathParts = subDoc.ref.path.split('/');
    const entry = { id: subDoc.id, path: subDoc.ref.path, ...subDoc.data() };

    if (pathParts.length === 4) {
      // L2: categories/{catId}/subcategories/{subId}
      const catId = pathParts[1];
      if (!l2Map.has(catId)) l2Map.set(catId, []);
      l2Map.get(catId)!.push(entry);
    } else if (pathParts.length === 6) {
      // L3: categories/{catId}/subcategories/{subId}/subcategories/{ssId}
      const parentPath = pathParts.slice(0, 4).join('/');
      if (!l3Map.has(parentPath)) l3Map.set(parentPath, []);
      l3Map.get(parentPath)!.push(entry);
    }
  }

  // Index tiles by category ID.
  // Path pattern: categories/{catId}/tiles/{tileId} → 4 segments.
  const tilesMap = new Map<string, CategoryTile[]>();
  for (const tileDoc of allTilesSnap.docs) {
    const pathParts = tileDoc.ref.path.split('/');
    if (pathParts.length === 4) {
      const catId = pathParts[1];
      if (!tilesMap.has(catId)) tilesMap.set(catId, []);
      tilesMap.get(catId)!.push({ id: tileDoc.id, ...(tileDoc.data() as CategoryTile) });
    }
  }

  const categories = categoriesSnap.docs.map((categoryDoc) => {
    const data = categoryDoc.data() as Partial<Category> & {
      subcategories?: Array<Partial<Subcategory>>;
      promo?: Partial<CategoryPromo> | null;
    };

    // Prefer subcollection L2 subs; fall back to embedded array (legacy structure).
    const l2Subs = l2Map.get(categoryDoc.id) || [];
    const embeddedSubs: Array<Partial<Subcategory> & { id?: string }> = Array.isArray(data.subcategories)
      ? data.subcategories.map((sub) => ({ ...sub, id: sub.id ?? sub.slug }))
      : [];

    const rawSubs = l2Subs.length > 0 ? l2Subs : embeddedSubs;

    const subcategories: Subcategory[] = rawSubs
      .map((subData: any) => {
        const subId = subData.id || subData.slug;
        // L3 lookup: "categories/{catId}/subcategories/{subId}"
        const subPath = `categories/${categoryDoc.id}/subcategories/${subId}`;
        const l3Subs = l3Map.get(subPath) || [];
        const embeddedSubSubs: Subcategory[] = subData.subcategories ?? [];

        const subSubcategories = (l3Subs.length > 0 ? l3Subs : embeddedSubSubs)
          .map((ss: any) => ({
            name: ss.name ?? ss.id,
            slug: ss.slug ?? ss.id,
            id: ss.id,
            icon: ss.icon,
            description: ss.description,
            importKeywords: ss.importKeywords,
            translations: ensureCategoryTranslations(ss.translations, ss.name ?? ss.id, ss.description),
            sortOrder: ss.sortOrder,
            image: ss.image,
          }))
          .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        return {
          id: subId,
          name: subData.name ?? subId,
          slug: subData.slug ?? subId,
          icon: subData.icon,
          description: subData.description,
          translations: ensureCategoryTranslations(subData.translations, subData.name ?? subId, subData.description),
          sortOrder: subData.sortOrder,
          image: subData.image,
          highlight: subData.highlight,
          subcategories: subSubcategories,
        } satisfies Subcategory;
      })
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

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

    const tiles: CategoryTile[] = tilesMap.get(categoryDoc.id) || [];

    return {
      id: categoryDoc.id,
      name: data.name ?? categoryDoc.id,
      slug: data.slug ?? categoryDoc.id,
      icon: data.icon,
      description: data.description,
      sortOrder: data.sortOrder,
      accentColor: data.accentColor,
      heroImage: data.heroImage,
      translations: ensureCategoryTranslations(
        data.translations,
        data.name ?? categoryDoc.id,
        data.description
      ),
      promo,
      tiles,
      subcategories,
    } satisfies Category;
  });

  const sortedCategories = categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (DEBUG_DATA_LOGS) {
    console.log('[getCategories] Final result, count:', sortedCategories.length, 'with subcategories count:', sortedCategories.reduce((sum, c) => sum + (c.subcategories?.length || 0), 0));
  }

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

  // N+1 reduction: one batched read in dedicated module.
  return filterCategoriesByContent(allCategories, contentType);
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
  const translations = ensureCategoryTranslations(undefined, data.name, data.description);
  const docRef = await addDoc(ref, {
    ...data,
    translations,
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
  const translations = ensureCategoryTranslations(undefined, data.name, data.description);
  const docRef = await addDoc(ref, {
    ...data,
    translations,
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
  const translations = ensureCategoryTranslations(undefined, data.name, data.description);
  const docRef = await addDoc(ref, {
    ...data,
    translations,
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
      const currentPrice = typeof data.price === 'object' ? data.price.amount : data.price;
      const discount = data.originalPrice && currentPrice
        ? Math.round(((data.originalPrice - currentPrice) / data.originalPrice) * 100)
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
  return createNotificationData(notification);
}

/**
 * Pobiera powiadomienia użytkownika
 */
export async function getNotifications(userId: string, limitCount: number = 50): Promise<Notification[]> {
  return getNotificationsData(userId, limitCount);
}

/**
 * Pobiera nieprzeczytane powiadomienia użytkownika
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  return getUnreadNotificationsData(userId);
}

/**
 * Oznacza powiadomienie jako przeczytane
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  return markNotificationAsReadData(notificationId);
}

/**
 * Oznacza wszystkie powiadomienia użytkownika jako przeczytane
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  return markAllNotificationsAsReadData(userId);
}

/**
 * Usuwa powiadomienie
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  return deleteNotificationData(notificationId);
}

/**
 * Pobiera liczbę nieprzeczytanych powiadomień
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  return getUnreadNotificationsCountData(userId);
}

// === ADMIN DASHBOARD STATISTICS ===

/**
 * Pobiera statystyki dashboardu admina
 * Cached for 15 minutes to reduce load
 */
export async function getAdminDashboardStats(token?: string) {
  // Prefer server-side API to avoid client Firestore permissions and speed up with server caching
  const cacheKey = 'admin:dashboard:stats';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/admin/stats', { cache: 'no-store', headers, credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Stats API failed: ${res.status} ${text || ''}`.trim());
    }
    const data = await res.json();
    const totals = {
      deals: data?.totals?.deals ?? 0,
      products: data?.totals?.products ?? 0,
      users: data?.totals?.users ?? 0,
    };

    const dashboard = {
      totals,
      pending: {
        deals: data?.pending?.deals ?? 0,
        products: data?.pending?.products ?? 0,
      },
      new24h: {
        deals: data?.recent24h?.deals ?? 0,
        users: data?.recent24h?.users ?? 0,
      },
      avgTemperature: 0,
      topCategories: [],
      recentActivity: 0,
      analytics: {
        views: { 
          total: data?.analytics?.views?.total ?? 0, 
          today: data?.analytics?.views?.today ?? 0, 
          trend: 0 
        },
        clicks: { 
          total: data?.analytics?.clicks?.total ?? 0, 
          today: data?.analytics?.clicks?.today ?? 0, 
          trend: 0 
        },
        shares: { total: 0 },
        conversionRate: 0,
      },
      growth: { deals: 0, products: 0, users: 0 },
      categories: { 
        total: data?.categories?.total ?? 0, 
        main: data?.categories?.total ?? 0, // Assumption: all in 'categories' are main for now
        sub: 0, 
        subSub: 0 
      },
      imports: { 
        running: data?.imports?.running ?? 0, 
        queued: data?.imports?.queued ?? 0, 
        completed24h: data?.imports?.completed24h ?? 0, 
        failed24h: data?.imports?.failed24h ?? 0 
      },
      harvester: { 
        running: data?.harvester?.running ?? 0, 
        created24h: data?.harvester?.created24h ?? 0 
      },
    };

    // Cache short-term (60s) to speed up repeated renders
    await cacheSet(cacheKey, dashboard, 60);
    return dashboard;
  } catch (error) {
    console.error('[getAdminDashboardStats] API error, falling back:', error);
    // Minimal safe fallback matching DashboardStats interface
    const fallback = {
      totals: { deals: 0, products: 0, users: 0 },
      pending: { deals: 0, products: 0 },
      new24h: { deals: 0, users: 0 },
      avgTemperature: 0,
      topCategories: [],
      recentActivity: 0,
      analytics: {
        views: { total: 0, today: 0, trend: 0 },
        clicks: { total: 0, today: 0, trend: 0 },
        shares: { total: 0 },
        conversionRate: 0,
      },
      growth: { deals: 0, products: 0, users: 0 },
      categories: { total: 0, main: 0, sub: 0, subSub: 0 },
      imports: { running: 0, queued: 0, completed24h: 0, failed24h: 0 },
      harvester: { running: 0, created24h: 0 },
    };
    await cacheSet(cacheKey, fallback, 30);
    return fallback;
  }
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
  return listForumCategoriesData();
}

// ===== CATEGORY SUGGESTIONS =====

/** Dodaj propozycję kategorii od użytkownika */
export async function createCategorySuggestion(data: {
  name: string;
  description: string;
  suggestedByUid: string;
  suggestedByName?: string | null;
}): Promise<string> {
  return createCategorySuggestionData(data);
}

/** Lista propozycji kategorii dla admina */
export async function listCategorySuggestions(statusFilter?: 'pending' | 'approved' | 'rejected'): Promise<CategorySuggestion[]> {
  return listCategorySuggestionsData(statusFilter);
}

/** Zaakceptuj propozycję i stwórz nową kategorię */
export async function approveCategorySuggestion(suggestionId: string, adminUid: string): Promise<string> {
  return approveCategorySuggestionData(suggestionId, adminUid);
}

/** Odrzuć propozycję kategorii */
export async function rejectCategorySuggestion(suggestionId: string, adminUid: string, reason: string): Promise<void> {
  return rejectCategorySuggestionData(suggestionId, adminUid, reason);
}

// Lista wątków (z sortowaniem po ostatniej aktywności)
export async function listForumThreads(limitCount: number = 20, categoryId?: string): Promise<ForumThread[]> {
  return listForumThreadsData(limitCount, categoryId);
}

export async function getForumThread(threadId: string): Promise<ForumThread | null> {
  return getForumThreadData(threadId);
}

export async function listForumPosts(threadId: string, limitCount: number = 100): Promise<ForumPost[]> {
  return listForumPostsData(threadId, limitCount);
}

export async function createForumThread(params: {
  title: string;
  content: string;
  categoryId?: string | null;
  attachments?: PostAttachment[];
  authorUid: string;
  authorDisplayName?: string | null;
}): Promise<string> {
  return createForumThreadData(params);
}

export async function addForumPost(params: {
  threadId: string;
  content: string;
  attachments?: PostAttachment[];
  authorUid: string;
  authorDisplayName?: string | null;
  parentId?: string | null;
}): Promise<string> {
  return addForumPostData(params);
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
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
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
    
    // Spread data first, then force docSnap.id to prevent empty 'id' field in data from overwriting
    const data = docSnap.data();
    const product = {
      ...data,
      id: docSnap.id,
      // Convert Firestore timestamps to ISO strings for client serialization
      createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt || new Date().toISOString(),
    };
    
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
    const deals: any[] = dealsSnap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        // Convert timestamps
        createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt,
      };
    });

    const bestDeal = deals.length > 0
      ? deals.reduce((best, current) => {
          const bestShipping = best?.shipping?.cost || best?.shippingCost || 0;
          const currentShipping = current?.shipping?.cost || current?.shippingCost || 0;
          const bestTotal = (best?.price?.amount || best?.price || 0) + bestShipping;
          const currentTotal = (current?.price?.amount || current?.price || 0) + currentShipping;
          return currentTotal < bestTotal ? current : best;
        }, deals[0])
      : null;

    const resolvedProduct = bestDeal
      ? {
          ...product,
          bestPrice: {
            amount: (bestDeal?.price?.amount || bestDeal?.price || 0) + (bestDeal?.shipping?.cost || bestDeal?.shippingCost || 0),
            currency: bestDeal?.price?.currency || 'PLN',
          },
          bestTotalPrice: (bestDeal?.price?.amount || bestDeal?.price || 0) + (bestDeal?.shipping?.cost || bestDeal?.shippingCost || 0),
          bestDealId: bestDeal.id,
          linkedDealIds: deals.map((deal) => deal.id),
        }
      : {
          ...product,
          bestPrice: undefined,
          bestTotalPrice: undefined,
          bestDealId: undefined,
        };

    return { product: resolvedProduct, deals };
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
      return snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt,
        } as ProductCore;
      });
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
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt,
      };
    });
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

    const withAffiliate = deals.filter((deal) => {
      const link = getExternalUrl(
        deal?.affiliateLink,
        deal?.affiliateUrl,
        deal?.dealUrl,
        deal?.sourceUrl,
        deal?.link,
        deal?.metadata?.offerPreviewUrl,
        deal?.metadata?.previewUrl
      );
      return typeof link === 'string' && link.trim().length > 0;
    });
    const candidates = withAffiliate.length > 0 ? withAffiliate : deals;

    // Find the deal with the lowest total price (product + shipping)
    const bestDeal = candidates.reduce((best, current) => {
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
    const products = snap.docs.map(d => ({ ...d.data(), id: d.id } as ProductCore));

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
  return getRecommendedProductCoresData(count);
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
  return getProductCoresByCategoryData(mainCategorySlug, subCategorySlug, subSubCategorySlug, limitCount);
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
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
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
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
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
    priceLimitMin?: number;
    priceLimitMax?: number;
    minRating?: number;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    categoryId?: string;
    subCategorySlug?: string;
    subSubCategorySlug?: string;
    brands?: string[];
    searchTerm?: string;
    statusFilter?: 'approved' | 'waiting_room';
  },
  sortBy: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'relevance' | 'popularity' = 'relevance',
  limit_count: number = 50
): Promise<ProductCore[]> {
  return getProductCoresByFiltersData(filters, sortBy, limit_count);
}

/**
 * M6 Unified Filtering & Sorting for DealM6
 * Supports: price range, rating, availability, discount, source, category
 */
export async function getDealsByFilters(
  filters: {
    priceRange?: { min: number; max: number };
    priceLimitMin?: number;
    priceLimitMax?: number;
    minRating?: number;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    minDiscount?: number;
    categoryId?: string;
    subCategorySlug?: string;
    subSubCategorySlug?: string;
    sources?: Array<'aliexpress' | 'amazon' | 'allegro'>;
    searchTerm?: string;
    statusFilter?: 'approved' | 'waiting_room';
  },
  sortBy: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'discount_desc' | 'popularity' = 'hot',
  limit_count: number = 50
): Promise<Deal[]> {
  return getDealsByFiltersData(filters, sortBy, limit_count);
}

export async function getDealsCount(filters: {
  categoryId?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  status?: string;
} = {}): Promise<number> {
  return getDealsCountData(filters);
}

