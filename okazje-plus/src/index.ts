// W pliku: okazje-plus/src/index.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

// KROK 1: Importuj typy z JEDNEGO źródła prawdy
import { Deal, Product, User, ProductRatingCard } from "../../src/lib/types";

// --- Typy pomocnicze dla danych wejściowych ---
// Używamy Partial<T> aby pozwolić na niepełne dane z CSV
type ImportDealData = Partial<
  Omit<Deal, "id" | "postedBy" | "postedAt" | "voteCount" | "commentsCount">
> & {
  mainCategorySlug: string;
  subCategorySlug: string;
};

type ImportProductData = Partial<Omit<Product, "id" | "ratingCard">> & {
  mainCategorySlug: string;
  subCategorySlug: string;
};

initializeApp();
const db = getFirestore();

// --- Funkcja pomocnicza do weryfikacji Admina ---
const ensureAdmin = async (auth: any): Promise<void> => {
  if (!auth) {
    logger.error("Brak uwierzytelnienia.");
    throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
  }
  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data() as User | undefined;

  if (userData?.role !== "admin") {
    logger.warn(`Użytkownik ${auth.uid} bez uprawnień admina próbował wykonać akcję.`);
    throw new HttpsError("permission-denied", "Tylko administratorzy mogą wykonać tę akcję.");
  }
};

/**
 * Importuje wsadowo listę OKAZJI (Deals) do kolekcji 'deals'.
 * Wymaga uprawnień administratora.
 */
export const batchImportDeals = onCall(async (request) => {
  await ensureAdmin(request.auth);

  const dealsToImport = request.data.deals as ImportDealData[];
  if (!Array.isArray(dealsToImport) || dealsToImport.length === 0) {
    throw new HttpsError("invalid-argument", "Tablica 'deals' jest pusta.");
  }

  const batch = db.batch();
  let successCount = 0;
  const errors: string[] = [];

  for (const [index, deal] of dealsToImport.entries()) {
    try {
      if (!deal.title || !deal.link || !deal.mainCategorySlug || !deal.subCategorySlug) {
        throw new Error(`Wiersz ${index + 1}: Brak tytułu, linku lub pełnej kategoryzacji.`);
      }

      const newDealRef = db.collection("deals").doc();
      
      // Poprawny obiekt zgodny z interfejsem Deal
      const newDealData: Omit<Deal, "id"> = {
        title: deal.title,
        description: deal.description || "",
        price: typeof deal.price === "number" ? deal.price : 0,
        originalPrice: deal.originalPrice,
        link: deal.link,
        image: deal.image || "",
        imageHint: deal.imageHint || "",
        mainCategorySlug: deal.mainCategorySlug,
        subCategorySlug: deal.subCategorySlug,
        postedBy: request.auth!.uid,
        postedAt: Timestamp.now().toDate().toISOString(), // Poprawiony błąd
        voteCount: 0,
        commentsCount: 0,
        temperature: 0, // Początkowa temperatura
        status: 'draft', // Domyślny status do moderacji
      };
      batch.set(newDealRef, newDealData);
      successCount++;
    } catch (error: any) {
      errors.push(`Wiersz ${index + 1}: ${error.message}`);
    }
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return {
    message: `Import Deals: ${successCount}/${dealsToImport.length} pomyślnie.`,
    successCount,
    errorCount: errors.length,
    errors,
  };
});

/**
 * Importuje wsadowo listę PRODUKTÓW (Products) do kolekcji 'products'.
 * Wymaga uprawnień administratora.
 */
export const batchImportProducts = onCall(async (request) => {
  await ensureAdmin(request.auth);

  const productsToImport = request.data.products as ImportProductData[];
  if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
    throw new HttpsError("invalid-argument", "Tablica 'products' jest pusta.");
  }

  const batch = db.batch();
  let successCount = 0;
  const errors: string[] = [];

  // Domyślna "Karta Gracza" dla nowych produktów
  const defaultRatingCard: ProductRatingCard = {
    average: 0,
    count: 0,
    durability: 0,
    easeOfUse: 0,
    valueForMoney: 0,
    versatility: 0,
  };

  for (const [index, product] of productsToImport.entries()) {
    try {
      if (!product.name || !product.affiliateUrl || !product.mainCategorySlug || !product.subCategorySlug) {
        throw new Error(`Wiersz ${index + 1}: Brak nazwy, linku afiliacyjnego lub pełnej kategoryzacji.`);
      }

      const newProductRef = db.collection("products").doc();
      
      // Poprawny obiekt zgodny z interfejsem Product
      const newProductData: Omit<Product, "id"> = {
        name: product.name,
        description: product.description || "",
        longDescription: product.longDescription || product.description || "",
        price: typeof product.price === "number" ? product.price : 0,
        affiliateUrl: product.affiliateUrl,
        image: product.image || "",
        imageHint: product.imageHint || "",
        mainCategorySlug: product.mainCategorySlug,
        subCategorySlug: product.subCategorySlug,
        ratingCard: defaultRatingCard,
        status: 'draft', // Domyślny status do moderacji
        category: product.mainCategorySlug, // Kompatybilność wsteczna
      };
      batch.set(newProductRef, newProductData);
      successCount++;
    } catch (error: any) {
      errors.push(`Wiersz ${index + 1}: ${error.message}`);
    }
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return {
    message: `Import Products: ${successCount}/${productsToImport.length} pomyślnie.`,
    successCount,
    errorCount: errors.length,
    errors,
  };
});


// --- Istniejące Funkcje Agregujące ---

export const updateVoteCount = onDocumentWritten(
  "/deals/{dealId}/votes/{userId}",
  async (event) => {
    const dealId = event.params.dealId;
    const dealRef = db.doc(`deals/${dealId}`);

    // Użyj transakcji do odczytu i zapisu dla spójności
    return db.runTransaction(async (transaction) => {
      const votesColRef = dealRef.collection("votes");
      const votesSnapshot = await transaction.get(votesColRef);

      let newCount = 0;
      votesSnapshot.docs.forEach((doc) => {
        const voteData = doc.data();
        if (voteData.direction === "up") newCount++;
        else if (voteData.direction === "down") newCount--;
      });

      logger.info(`Aktualizowanie licznika głosów dla ${dealId} na: ${newCount}`);
      transaction.update(dealRef, { voteCount: newCount });
      return newCount;
    });
  },
);

export const updateCommentCount = onDocumentWritten(
  "/deals/{dealId}/comments/{commentId}",
  async (event) => {
    const dealId = event.params.dealId;
    const dealRef = db.doc(`deals/${dealId}`);

    // Pobierz aktualną liczbę komentarzy
    const commentsColRef = dealRef.collection("comments");
    const commentsSnapshot = await commentsColRef.get();
    const newCount = commentsSnapshot.size;

    logger.info(`Aktualizowanie licznika komentarzy dla ${dealId} na: ${newCount}`);
    return dealRef.update({ commentCount: newCount });
  },
);
