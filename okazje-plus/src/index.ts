// W pliku: okazje-plus/src/index.ts
import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as https from "https";

// KROK 1: Importuj typy z JEDNEGO źródła prawdy
import {
  Deal,
  Product,
  User,
  ProductRatingCard,
} from "../../src/lib/types";

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
const storageBucketName = process.env.STORAGE_BUCKET || null;

// --- Funkcja pomocnicza do weryfikacji Admina ---
const ensureAdmin = async (auth: {uid: string} | null): Promise<void> => {
  if (!auth) {
    logger.error("Brak uwierzytelnienia.");
    throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
  }
  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data() as User | undefined;
  if (userData?.role !== "admin") {
    logger.warn(
      `Użytkownik ${auth.uid} bez uprawnień admina próbował wykonać akcję.`
    );
    throw new HttpsError(
      "permission-denied",
      "Tylko administratorzy mogą wykonać tę akcję."
    );
  }
};

/**
 * Pobiera obraz ze zdalnego URL i przesyła do Firebase Storage.
 * @param {string} remoteUrl URL zdalnego obrazu
 * @param {string} storagePath Ścieżka zapisu w Storage
 * @return {Promise<string|null>} URL publiczny lub null
 */
async function downloadAndUploadImage(
  remoteUrl: string,
  storagePath: string
): Promise<string | null> {
  if (!storageBucketName || !remoteUrl) return null;

  try {
    return new Promise((resolve, reject) => {
      https.get(remoteUrl, async (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const storage = getStorage();
            const bucket = storage.bucket(storageBucketName);
            const file = bucket.file(storagePath);
            const headers = response.headers;
            const contentType = headers["content-type"] || "image/jpeg";
            await file.save(buffer, {contentType});
            const baseUrl = "https://firebasestorage.googleapis.com/v0/b";
            const encoded = encodeURIComponent(storagePath);
            const url = `${baseUrl}/${storageBucketName}/o/${encoded}`;
            const publicUrl = `${url}?alt=media`;
            resolve(publicUrl);
          } catch (e) {
            reject(e);
          }
        });
        response.on("error", reject);
      }).on("error", reject);
    });
  } catch (e: unknown) {
    logger.warn(`Failed to download/upload image from ${remoteUrl}:`, e);
    return null;
  }
}

/**
 * Importuje wsadowo listę OKAZJI (Deals) do kolekcji 'deals'.
 * Wymaga uprawnień administratora.
 */
export const batchImportDeals = onCall(async (request) => {
  await ensureAdmin(request.auth ?? null);

  const dealsToImport = request.data.deals as ImportDealData[];
  if (!Array.isArray(dealsToImport) || dealsToImport.length === 0) {
    throw new HttpsError("invalid-argument", "Tablica 'deals' jest pusta.");
  }

  const batch = db.batch();
  let successCount = 0;
  const errors: string[] = [];

  for (const [index, deal] of dealsToImport.entries()) {
    try {
      if (!deal.title || !deal.link || !deal.mainCategorySlug ||
        !deal.subCategorySlug) {
        throw new Error(
          `Wiersz ${index + 1}: Brak tytułu, linku lub pełnej` +
          " kategoryzacji."
        );
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
        category: deal.mainCategorySlug, // Dodane wymagane pole
        mainCategorySlug: deal.mainCategorySlug,
        subCategorySlug: deal.subCategorySlug,
        postedBy: (request.auth?.uid) || "unknown",
        postedAt: Timestamp.now().toDate().toISOString(), // Poprawiony błąd
        voteCount: 0,
        commentsCount: 0,
        temperature: 0, // Początkowa temperatura
        status: "draft", // Domyślny status do moderacji
      };
      batch.set(newDealRef, newDealData);
      successCount++;
    } catch (error: unknown) {
      errors.push(`Wiersz ${index + 1}: ${(error as Error).message}`);
    }
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return {
    message:
      `Import Deals: ${successCount}/${dealsToImport.length} pomyślnie.`,
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
  await ensureAdmin(request.auth ?? null);

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
      if (!product.name || !product.affiliateUrl || !product.mainCategorySlug ||
        !product.subCategorySlug) {
        throw new Error(
          `Wiersz ${index + 1}: Brak nazwy, linku afiliacyjnego` +
          " lub pełnej kategoryzacji."
        );
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
        status: "draft", // Domyślny status do moderacji
        category: product.mainCategorySlug, // Kompatybilność wsteczna
      };
      batch.set(newProductRef, newProductData);
      successCount++;
    } catch (error: unknown) {
      errors.push(`Wiersz ${index + 1}: ${(error as Error).message}`);
    }
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return {
    message:
      `Import Products: ${successCount}/${productsToImport.length} pomyślnie.`,
    successCount,
    errorCount: errors.length,
    errors,
  };
});

/**
 * Import pojedynczego produktu z AliExpress (wywołanie callable).
 * Wymaga uprawnień administratora.
 * Opcjonalnie przesyła obraz do Firebase Storage jeśli STORAGE_BUCKET
 * jest skonfigurowany.
 */
export const importAliProduct = onCall(async (request) => {
  await ensureAdmin(request.auth ?? null);

  const payload = request.data as Record<string, unknown>;
  const product = payload.product as Record<string, unknown>;
  const mainCategorySlug = payload.mainCategorySlug;
  const subCategorySlug = payload.subCategorySlug;

  if (!product || !product.title) {
    throw new HttpsError("invalid-argument", "Brak danych produktu");
  }

  // Deduplication: check externalId or link
  const externalId = (product.id || product.externalId) as string | null;
  if (externalId) {
    const q = await db.collection("products")
      .where("externalId", "==", externalId)
      .limit(1)
      .get();
    if (!q.empty) {
      throw new HttpsError(
        "already-exists",
        "Produkt o takim externalId już istnieje"
      );
    }
  }

  if (product.productUrl) {
    const q2 = await db.collection("products")
      .where("link", "==", product.productUrl)
      .limit(1)
      .get();
    if (!q2.empty) {
      throw new HttpsError(
        "already-exists",
        "Produkt o takim linku już istnieje"
      );
    }
  }

  const newRef = db.collection("products").doc();
  const now = Timestamp.now().toDate().toISOString();

  // Opcjonalnie pobierz i przesyłaj obraz
  let imageUrl = (product.imageUrl || product.image) as string;
  if (storageBucketName && imageUrl) {
    const ts = Date.now();
    const path = `aliexpress-products/${externalId}/${ts}-image.jpg`;
    try {
      const uploadedUrl = await downloadAndUploadImage(imageUrl, path);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
        logger.info(`Image uploaded to Storage: ${path}`);
      }
    } catch (uploadErr) {
      logger.warn(`Image upload failed, using original URL: ${uploadErr}`);
    }
  }

  const newProduct: Record<string, unknown> = {
    title: product.title,
    description: product.description || product.subTitle || "",
    price: typeof product.price === "number" ?
      product.price :
      Number(product.price) || 0,
    originalPrice: product.originalPrice || product.listPrice || null,
    currency: product.currency || "PLN",
    link: product.productUrl || product.url || null,
    image: imageUrl || null,
    imageHint: product.imageHint || "",
    externalId: externalId,
    postedBy: request.auth?.uid || "admin",
    postedAt: now,
    mainCategorySlug: mainCategorySlug || null,
    subCategorySlug: subCategorySlug || null,
    status: "draft", // wymaga moderacji
    createdAt: now,
    discountPercent: (() => {
      const op = Number(product.originalPrice || product.listPrice || 0);
      const p = Number(product.price || 0);
      if (op > 0 && p >= 0 && p < op) {
        return Math.round(((op - p) / op) * 100);
      }
      return null;
    })(),
    metadata: {
      source: "aliexpress",
      originalId: externalId || null,
      importedAt: now,
      orders: product.orders || null,
      shipping: product.shipping || null,
      merchant: product.merchant || null,
      rawDataStored: false,
    },
  };

  await newRef.set(newProduct);
  return {ok: true, id: newRef.id};
});

// Bulk import callable - accepts array of products
// Obsługuje pobieranie obrazów do Storage jeśli STORAGE_BUCKET jest
// skonfigurowany
export const bulkImportAliProducts = onCall(async (request) => {
  await ensureAdmin(request.auth ?? null);
  const payload = request.data as Record<string, unknown>;
  const products: Array<Record<string, unknown>> = Array.isArray(
    payload.products
  ) ? (payload.products as Array<Record<string, unknown>>) : [];
  if (products.length === 0) {
    throw new HttpsError("invalid-argument", "No products provided");
  }

  const batch = db.batch();
  let created = 0;
  const errors: string[] = [];

  for (const [i, product] of products.entries()) {
    try {
      const externalId = (product.id || product.externalId) as string | null;
      if (externalId) {
        const q = await db.collection("products")
          .where("externalId", "==", externalId)
          .limit(1)
          .get();
        if (!q.empty) {
          errors.push(`Row ${i + 1}: already exists by externalId`);
          continue;
        }
      }
      if (product.productUrl) {
        const q2 = await db.collection("products")
          .where("link", "==", product.productUrl)
          .limit(1)
          .get();
        if (!q2.empty) {
          errors.push(`Row ${i + 1}: already exists by link`);
          continue;
        }
      }

      const docRef = db.collection("products").doc();
      const now = Timestamp.now().toDate().toISOString();

      // Opcjonalnie pobierz i przesyłaj obraz
      let imageUrl = (product.imageUrl || product.image) as string;
      if (storageBucketName && imageUrl) {
        const ts = Date.now();
        const path = `aliexpress-products/${externalId}/${ts}-bulk.jpg`;
        try {
          const uploaded = await downloadAndUploadImage(imageUrl, path);
          if (uploaded) {
            imageUrl = uploaded;
          }
        } catch (uploadErr) {
          logger.warn(`Bulk image upload failed for row ${i + 1}:`, uploadErr);
        }
      }

      const docData: Record<string, unknown> = {
        title: product.title,
        description: product.description || product.subTitle || "",
        price: typeof product.price === "number" ?
          product.price :
          Number(product.price) || 0,
        originalPrice: product.originalPrice || product.listPrice || null,
        currency: product.currency || "PLN",
        link: product.productUrl || product.url || null,
        image: imageUrl || null,
        imageHint: product.imageHint || "",
        externalId: externalId,
        postedBy: request.auth?.uid || "admin",
        postedAt: now,
        mainCategorySlug: product.mainCategorySlug || null,
        subCategorySlug: product.subCategorySlug || null,
        status: "draft", // wymaga moderacji
        createdAt: now,
        discountPercent: (() => {
          const op = Number(product.originalPrice || product.listPrice || 0);
          const p = Number(product.price || 0);
          if (op > 0 && p >= 0 && p < op) {
            return Math.round(((op - p) / op) * 100);
          }
          return null;
        })(),
        metadata: {
          source: "aliexpress",
          originalId: externalId || null,
          importedAt: now,
          orders: product.orders || null,
          shipping: product.shipping || null,
          merchant: product.merchant || null,
          rawDataStored: false,
        },
      };

      batch.set(docRef, docData);
      created++;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push(`Row ${i + 1}: ${errorMsg}`);
    }
  }

  if (created > 0) await batch.commit();
  return {ok: true, created, errors};
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

      logger.info(
        `Aktualizowanie licznika głosów dla ${dealId} na: ${newCount}`
      );
      transaction.update(dealRef, {voteCount: newCount});
      return newCount;
    });
  },
);

export const updateCommentsCountDeals = onDocumentWritten(
  "/deals/{dealId}/comments/{commentId}",
  async (event) => {
    const dealId = event.params.dealId;
    const dealRef = db.doc(`deals/${dealId}`);
    const commentsColRef = dealRef.collection("comments");
    const commentsSnapshot = await commentsColRef.get();
    const newCount = commentsSnapshot.size;
    logger.info(
      `Aktualizacja commentsCount (deal) ${dealId} -> ${newCount}`
    );
    return dealRef.update({commentsCount: newCount});
  }
);

export const updateCommentsCountProducts = onDocumentWritten(
  "/products/{productId}/comments/{commentId}",
  async (event) => {
    const productId = event.params.productId;
    const productRef = db.doc(`products/${productId}`);
    const commentsColRef = productRef.collection("comments");
    const commentsSnapshot = await commentsColRef.get();
    const newCount = commentsSnapshot.size;
    logger.info(
      `Aktualizacja commentsCount (product) ${productId} -> ${newCount}`
    );
    return productRef.update({commentsCount: newCount});
  }
);

// --- Stuby funkcji AI / Audytów ---

/**
 * Tworzy zadania AI typu enrich_product dla przekazanych produktów.
 */
export const enrichProductBatch = onCall(async (request) => {
  await ensureAdmin(request.auth ?? null);
  const productIds = (request.data?.productIds as string[]) || [];
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new HttpsError("invalid-argument", "productIds: [] jest wymagane");
  }
  let created = 0;
  const batch = db.batch();
  for (const id of productIds) {
    const ref = db.collection("ai_jobs").doc();
    batch.set(ref, {
      id: ref.id,
      kind: "enrich_product",
      status: "pending",
      inputRef: {collection: "products", id},
      progress: 0,
      startedAt: null,
      createdAt: new Date().toISOString(),
    });
    created++;
  }
  await batch.commit();
  return {ok: true, created};
});

/**
 * Tworzy zadania AI typu expand_category dla wskazanych kategorii.
 */
export const autoFillCategories = onCall(async (request) => {
  await ensureAdmin(request.auth ?? null);
  const categories = (request.data?.categories as string[]) || [];
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new HttpsError("invalid-argument", "categories: [] jest wymagane");
  }
  let created = 0;
  const batch = db.batch();
  for (const categoryId of categories) {
    const ref = db.collection("ai_jobs").doc();
    batch.set(ref, {
      id: ref.id,
      kind: "expand_category",
      status: "pending",
      inputRef: {collection: "categories", id: categoryId},
      progress: 0,
      startedAt: null,
      createdAt: new Date().toISOString(),
    });
    created++;
  }
  await batch.commit();
  return {ok: true, created};
});

/**
 * Tworzy szkic raportu pokrycia treści w kolekcji system_reports.
 */
export const scheduleAudit = onCall(async (request) => {
  await ensureAdmin(request.auth ?? null);
  const ref = db.collection("system_reports").doc();
  await ref.set({
    id: ref.id,
    type: "coverage",
    createdAt: new Date().toISOString(),
    details: [],
    resolved: false,
    triggeredBy: "manual",
  });
  return {ok: true, id: ref.id};
});

// ============================================
// AliExpress Integration Functions (M1)
// ============================================

/**
 * Scheduled function to sync AliExpress products
 *
 * This function runs on a schedule (configured in Firebase Console)
 * and processes all enabled import profiles sequentially.
 *
 * TODO M2:
 * - Add parallel processing with rate limiting
 * - Add better error recovery
 * - Add metrics collection
 * - Add alerts for failed imports
 * - Store logs in Cloud Storage
 *
 * @schedule Every day at 2 AM (Europe/Warsaw timezone)
 * @region europe-west1
 */
import {onSchedule} from "firebase-functions/v2/scheduler";

export const scheduleAliExpressSync = onSchedule(
  {
    schedule: "0 2 * * *", // Daily at 2 AM
    timeZone: "Europe/Warsaw",
    region: "europe-west1",
    // TODO M2: Adjust memory/timeout based on actual import volume
    memory: "512MiB",
    timeoutSeconds: 540, // 9 minutes (max for scheduled functions)
  },
  async (event) => {
    logger.info("Starting scheduled AliExpress sync");

    try {
      // Get all enabled import profiles
      const profilesSnapshot = await db
        .collection("importProfiles")
        .where("enabled", "==", true)
        .get();

      if (profilesSnapshot.empty) {
        logger.info("No enabled import profiles found");
        return;
      }

      logger.info(`Found ${profilesSnapshot.size} enabled import profiles`);

      // Process each profile sequentially
      // TODO M2: Consider parallel processing with proper rate limiting
      for (const profileDoc of profilesSnapshot.docs) {
        const profile = {id: profileDoc.id, ...profileDoc.data()} as any;
        logger.info(`Processing import profile: ${profile.id}`, {
          name: profile.name || "Unknown",
        });

        try {
          // Create import run record
          const importRunRef = db.collection("importRuns").doc();
          await importRunRef.set({
            id: importRunRef.id,
            profileId: profile.id,
            vendorId: profile.vendorId || "unknown",
            status: "running",
            dryRun: false,
            stats: {
              fetched: 0,
              created: 0,
              updated: 0,
              skipped: 0,
              duplicates: 0,
              errors: 0,
            },
            startedAt: new Date().toISOString(),
            triggeredBy: "scheduled",
          });

          // TODO M2: Call actual import logic
          // For M1, we just log and mark as completed
          // In M2, integrate with src/integrations/aliexpress/ingest.ts
          logger.info(
            `Import run ${importRunRef.id} created for profile ${profile.id}`
          );

          // TODO M2: Replace this with actual import call:
          // const result = await runImport(profile.id, {
          //   triggeredBy: 'scheduled',
          //   maxItems: profile.maxItemsPerRun
          // });

          // Mark as completed (stub for M1)
          await importRunRef.update({
            status: "completed",
            finishedAt: new Date().toISOString(),
            durationMs: 0,
          });

          logger.info(`Import run ${importRunRef.id} completed successfully`);
        } catch (error: unknown) {
          logger.error(
            `Error processing profile ${profile.id}:`,
            error instanceof Error ? error.message : error
          );
          // Continue with next profile even if one fails
        }

        // TODO M2: Add rate limiting delay between profiles
        // await new Promise(resolve => setTimeout(resolve, 5000));
      }

      logger.info("Scheduled AliExpress sync completed");
    } catch (error: unknown) {
      logger.error(
        "Failed to run scheduled AliExpress sync:",
        error instanceof Error ? error.message : error
      );
      throw error; // Re-throw to mark function as failed
    }
  }
);
