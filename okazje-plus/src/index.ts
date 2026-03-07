// W pliku: okazje-plus/src/index.ts
// Updated: 2025-12-28 - Added scheduled price update for currency handling
import {initializeApp} from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  DocumentSnapshot,
} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  onDocumentWritten,
  onDocumentCreated,
  FirestoreEvent,
  Change,
} from "firebase-functions/v2/firestore";
import {
  onSchedule,
} from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import * as https from "https";
import * as jwt from "jsonwebtoken";
import * as sgMail from "@sendgrid/mail";

// KROK 1: Importuj typy z JEDNEGO źródła prawdy
import {
  Deal,
  Product,
  User,
  ProductRatingCard,
} from "../../src/lib/types";

// Import price update functions
import { updatePricesDaily, manualPriceUpdate } from "./scheduled-price-update";

// Import user stats Cloud Functions
import * as userStats from "./user-stats";

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
    logger.warn(
      `Failed to download/upload image from ${remoteUrl}:`,
      e
    );
    return null;
  }
}

/**
 * Importuje wsadowo listę OKAZJI (Deals) do kolekcji 'deals'.
 * Wymaga uprawnień administratora.
 */
export const batchImportDeals = onCall(
  {
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request: CallableRequest<{deals: ImportDealData[]}>) => {
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
          description: typeof deal.description === 'string' 
            ? { pl: deal.description, en: deal.description, de: deal.description || "" } 
            : (deal.description || { pl: "", en: "", de: "" }),
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
export const batchImportProducts = onCall(
  {
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (
    request: CallableRequest<{products: ImportProductData[]}>
  ) => {
    await ensureAdmin(request.auth ?? null);

    const productsToImport =
      request.data.products as ImportProductData[];
    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Tablica 'products' jest pusta."
      );
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
        if (!product.name || !product.affiliateUrl ||
            !product.mainCategorySlug || !product.subCategorySlug) {
          throw new Error(
            `Wiersz ${index + 1}: Brak nazwy, linku afiliacyjnego` +
          " lub pełnej kategoryzacji."
          );
        }

        const newProductRef = db.collection("products").doc();

        // Poprawny obiekt zgodny z interfejsem Product
        const name = product.name || (product as any).title || "Bez nazwy";
        const description = product.description || "";
        const newProductData: Omit<Product, "id"> = {
          name,
          description,
          longDescription: product.longDescription || description,
          title: { pl: name, en: name },
          shortDescription: { pl: description, en: description },
          fullDescription: { pl: description, en: description },
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
      `Import Products: ${successCount}/` +
      `${productsToImport.length} pomyślnie.`,
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
export const importAliProduct = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
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
export const bulkImportAliProducts = onCall(
  async (
    request: CallableRequest<{products: Record<string, unknown>[]}>
  ) => {
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
            logger.warn(
              `Bulk image upload failed for row ${i + 1}:`,
              uploadErr
            );
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
  async (event: FirestoreEvent<any>) => {
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
  async (event: FirestoreEvent<any>) => {
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

export const updateCommentsCount = onDocumentWritten(
  "/products/{productId}/comments/{commentId}",
  async (
    event: FirestoreEvent<
      Change<DocumentSnapshot> | undefined,
      {commentId: string; productId: string}
    >
  ) => {
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
export const enrichProductBatch = onCall(
  async (request: CallableRequest<{productIds: string[]}>) => {
    await ensureAdmin(request.auth ?? null);
    const productIds = (request.data?.productIds as string[]) || [];
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "productIds: [] jest wymagane"
      );
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
  }
);

/**
 * Tworzy zadania AI typu expand_category dla wskazanych kategorii.
 */
export const autoFillCategories = onCall(
  async (
    request: CallableRequest<{
      collection: string;
      categories?: string[];
    }>
  ) => {
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
export const scheduleAudit = onCall(async (request: CallableRequest) => {
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
 * Near-real-time AliExpress sync trigger.
 *
 * Runs every 5 minutes and forwards request to Next.js cron endpoint
 * which performs actual importFromAliExpress on enabled profiles.
 */
export const scheduleAliExpressSync = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "Europe/Warsaw",
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const siteUrl = process.env.SITE_URL || "https://okazjeplus.pl";
    const cronSecret = process.env.CRON_SECRET || "";
    const adminToken = process.env.IMPORT_ADMIN_TOKEN || process.env.ADMIN_BEARER || "";
    const maxItems = Number(process.env.ALIEXPRESS_SYNC_MAX_ITEMS || "20");

    const query = new URLSearchParams();
    if (cronSecret) {
      query.set("secret", cronSecret);
    }
    query.set("maxItems", String(Number.isFinite(maxItems) ? Math.max(5, Math.min(maxItems, 200)) : 20));

    const url = `${siteUrl.replace(/\/$/, "")}/api/cron/aliexpress-sync?${query.toString()}`;

    logger.info("Starting scheduled AliExpress sync trigger", {
      url,
      hasSecret: Boolean(cronSecret),
      hasAdminToken: Boolean(adminToken),
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cronSecret ? {"x-cron-secret": cronSecret} : {}),
          ...(adminToken ? {Authorization: `Bearer ${adminToken}`} : {}),
        },
      });

      const text = await response.text();
      logger.info("AliExpress sync trigger response", {
        status: response.status,
        ok: response.ok,
        bodyPreview: text.slice(0, 300),
      });

      if (!response.ok) {
        throw new Error(`AliExpress sync failed with status ${response.status}`);
      }
    } catch (error: unknown) {
      logger.error(
        "Failed to run scheduled AliExpress sync trigger:",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }
);

// ============================================
// Import Jobs Trigger (bridge to Next.js cron)
// ============================================

/**
 * HTTP trigger to start processing import jobs via Next.js route.
 * It forwards a POST to `/api/cron/process-jobs` on the public site.
 * Requires env `SITE_URL` and optional `IMPORT_ADMIN_TOKEN` for auth.
 */
export const processImportJobsTrigger = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "256MiB",
    // Removed secrets: ["CRON_SECRET"] to avoid Secret Manager billing requirement
  },
  async (req, res) => {
    const siteUrl = process.env.SITE_URL || "https://okazjeplus.pl";
    const adminToken = process.env.IMPORT_ADMIN_TOKEN || process.env.ADMIN_BEARER || "";
    const incomingSecret =
      (req.query?.secret as string | undefined) ||
      (req.headers["x-cron-secret"] as string | undefined) ||
      "";
    const cronSecret = process.env.CRON_SECRET || incomingSecret;

    try {
      const url = cronSecret
        ? `${siteUrl}/api/cron/process-jobs?secret=${encodeURIComponent(cronSecret)}`
        : `${siteUrl}/api/cron/process-jobs`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
        },
      });

      const text = await response.text();
      const ok = response.ok;
      logger.info("Forwarded process-jobs POST", { status: response.status, ok });
      res.status(ok ? 200 : response.status).send(text);
    } catch (error) {
      logger.error("processImportJobsTrigger failed", error as any);
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  }
);

// ============================================
// Affiliate Purchases Sync (Scheduled)
// ============================================

const AFFILIATE_PURCHASES_COLLECTION = "affiliate_purchases_aliexpress";
const AFFILIATE_PURCHASES_META_DOC = "aliexpress-affiliate-purchases";
const convertiserApiTokenParam = defineString("CONVERTISER_API_TOKEN");

type AffiliatePurchaseRecord = {
  id: string;
  transactionId: string;
  orderId: string | null;
  advertiser: string;
  status: string;
  purchaseAmount: number;
  commissionAmount: number;
  currency: string;
  purchaseDate: string;
  purchaseDateMs: number;
  website: string | null;
  clickId: string | null;
  source: "convertiser";
  updatedAt: string;
};

const parseSyncNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const firstSyncString = (raw: Record<string, any>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const toSyncIsoDate = (value: unknown): string => {
  if (!value) return new Date(0).toISOString();

  if (typeof value === "number") {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  }

  return new Date(0).toISOString();
};

const hasAliExpressMarker = (raw: Record<string, any>): boolean => {
  const candidates = [
    raw.advertiser,
    raw.advertiser_name,
    raw.offer_name,
    raw.campaign_name,
    raw.merchant,
    raw.merchant_name,
    raw.store_name,
    raw.program_name,
    raw.offer?.advertiser,
    raw.offer?.advertiser_name,
  ]
    .filter((item) => typeof item === "string")
    .map((item) => String(item).toLowerCase());

  if (candidates.some((value) => value.includes("aliexpress"))) {
    return true;
  }

  try {
    return JSON.stringify(raw).toLowerCase().includes("aliexpress");
  } catch {
    return false;
  }
};

const isCompletedAffiliatePurchase = (raw: Record<string, any>): boolean => {
  const statusRaw = firstSyncString(
    raw,
    ["status", "transaction_status", "order_status", "state"]
  ) || "";
  const status = statusRaw.toLowerCase();

  if (!status) return true;

  const failedMarkers = ["cancel", "reject", "denied", "failed", "fraud", "void"];
  if (failedMarkers.some((marker) => status.includes(marker))) return false;

  const pendingMarkers = ["pending", "processing", "new", "open", "hold", "waiting"];
  if (pendingMarkers.some((marker) => status.includes(marker))) return false;

  const completedMarkers = ["complete", "approved", "accepted", "confirm", "paid", "settled", "done"];
  if (completedMarkers.some((marker) => status.includes(marker))) return true;

  return true;
};

const normalizeAffiliatePurchase = (
  raw: Record<string, any>,
  index: number
): AffiliatePurchaseRecord => {
  const transactionId = String(
    raw.id ?? raw.uuid ?? raw.transaction_id ?? raw.transactionId ?? `unknown-${Date.now()}-${index}`
  );

  const orderId = firstSyncString(raw, ["order_id", "orderId", "sale_id", "external_order_id"]);
  const advertiser =
    firstSyncString(raw, ["advertiser_name", "advertiser", "merchant_name", "merchant", "offer_name"]) ||
    "AliExpress";
  const status = firstSyncString(raw, ["status", "transaction_status", "order_status", "state"]) ||
    "unknown";

  const purchaseAmount = parseSyncNumber(
    raw.order_amount ?? raw.sale_amount ?? raw.transaction_amount ?? raw.purchase_amount ?? raw.amount
  );

  const commissionAmount = parseSyncNumber(
    raw.commission ?? raw.commission_amount ?? raw.publisher_commission ?? 0
  );

  const currency =
    firstSyncString(raw, ["currency", "currency_code", "order_currency", "sale_currency"]) ||
    "PLN";

  const purchaseDate = toSyncIsoDate(
    raw.date ?? raw.transaction_date ?? raw.created_at ?? raw.createdAt ?? raw.event_time
  );

  const purchaseDateMs = new Date(purchaseDate).getTime();
  const nowIso = new Date().toISOString();

  return {
    id: transactionId.replace(/[^a-zA-Z0-9_-]/g, "_"),
    transactionId,
    orderId,
    advertiser,
    status,
    purchaseAmount,
    commissionAmount,
    currency,
    purchaseDate,
    purchaseDateMs: Number.isFinite(purchaseDateMs) ? purchaseDateMs : 0,
    website: firstSyncString(raw, ["website_name", "website", "publisher_website"]),
    clickId: firstSyncString(raw, ["click_id", "clickId", "subid", "sub_id"]),
    source: "convertiser",
    updatedAt: nowIso,
  };
};

const fetchConvertiserTransactionsPage = async (
  token: string,
  page: number,
  pageSize: number
): Promise<Record<string, any>[]> => {
  const endpoint = new URL("https://api.convertiser.com/publisher/transactions/");
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("page_size", String(pageSize));

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Convertiser error ${response.status}: ${bodyText}`);
  }

  const payload = await response.json() as { results?: Record<string, any>[] };
  return Array.isArray(payload?.results) ? payload.results : [];
};

const saveAffiliatePurchasesBatch = async (
  purchases: AffiliatePurchaseRecord[]
): Promise<void> => {
  if (!purchases.length) return;

  const chunkSize = 400;
  for (let start = 0; start < purchases.length; start += chunkSize) {
    const chunk = purchases.slice(start, start + chunkSize);
    const batch = db.batch();

    for (const purchase of chunk) {
      const docRef = db.collection(AFFILIATE_PURCHASES_COLLECTION).doc(purchase.id);
      batch.set(docRef, purchase, {merge: true});
    }

    await batch.commit();
  }
};

export const syncAliExpressAffiliatePurchases = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "Europe/Warsaw",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const token = convertiserApiTokenParam.value();
    if (!token) {
      logger.warn("[AffiliatePurchasesSync] Missing CONVERTISER_API_TOKEN, skipping run");
      return;
    }

    const scanPages = Math.max(1, Math.min(10, Number(process.env.AFFILIATE_SYNC_SCAN_PAGES || "3")));
    const scanPageSize = Math.max(10, Math.min(100, Number(process.env.AFFILIATE_SYNC_SCAN_PAGE_SIZE || "100")));

    logger.info("[AffiliatePurchasesSync] Starting scheduled sync", {
      scanPages,
      scanPageSize,
    });

    try {
      const rawRows: Record<string, any>[] = [];

      for (let page = 1; page <= scanPages; page += 1) {
        const rows = await fetchConvertiserTransactionsPage(token, page, scanPageSize);
        rawRows.push(...rows);

        if (rows.length < scanPageSize) {
          break;
        }
      }

      const normalized = rawRows
        .filter((row) => hasAliExpressMarker(row))
        .filter((row) => isCompletedAffiliatePurchase(row))
        .map((row, index) => normalizeAffiliatePurchase(row, index))
        .sort((a, b) => b.purchaseDateMs - a.purchaseDateMs);

      const deduped = new Map<string, AffiliatePurchaseRecord>();
      for (const item of normalized) {
        deduped.set(item.id, item);
      }
      const uniquePurchases = Array.from(deduped.values());

      await saveAffiliatePurchasesBatch(uniquePurchases);

      const totalPurchaseAmount = uniquePurchases.reduce(
        (sum, item) => sum + item.purchaseAmount,
        0
      );
      const totalCommissionAmount = uniquePurchases.reduce(
        (sum, item) => sum + item.commissionAmount,
        0
      );

      await db.collection("admin_meta").doc(AFFILIATE_PURCHASES_META_DOC).set(
        {
          lastSyncAt: new Date().toISOString(),
          records: uniquePurchases.length,
          source: "convertiser-scheduler",
          schedule: "*/15 * * * *",
          totals: {
            purchaseAmount: totalPurchaseAmount,
            commissionAmount: totalCommissionAmount,
          },
        },
        {merge: true}
      );

      logger.info("[AffiliatePurchasesSync] Sync completed", {
        scannedRows: rawRows.length,
        savedRows: uniquePurchases.length,
        totalPurchaseAmount,
        totalCommissionAmount,
      });
    } catch (error: unknown) {
      logger.error(
        "[AffiliatePurchasesSync] Scheduled sync failed",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }
);

// ============================================
// Price Alerts Monitor (Scheduled)
// ============================================

/**
 * Scheduled function to monitor price alerts and send notifications
 * Runs every hour in Europe/Warsaw timezone
 */
export const priceMonitor = onSchedule(
  {
    schedule: "0 * * * *", // co godzinę
    timeZone: "Europe/Warsaw",
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    logger.info("Running priceMonitor schedule");
    const nowIso = new Date().toISOString();

    // Pobierz aktywne alerty (nieprzeterminowane)
    const alertsSnap = await db
      .collection("price_alerts")
      .where("status", "==", "active")
      .get();

    if (alertsSnap.empty) {
      logger.info("No active price alerts");
      return;
    }

    let processed = 0;
    let triggered = 0;

    for (const docSnap of alertsSnap.docs) {
      try {
        const alert = docSnap.data() as any;

        // Pomiń wygasłe
        if (alert.expiresAt && alert.expiresAt < nowIso) {
          continue;
        }

        const itemId: string = alert.itemId;
        const itemType: "product" | "deal" = alert.itemType;
        const alertType: string = alert.alertType;

        // Pobierz bieżącą cenę z zasobu (products/deals)
        const collName = itemType === "product" ?
          "products" :
          "deals";
        const itemRef = db.collection(collName).doc(itemId);
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) continue;
        const item = itemDoc.data() as any;
        const currentPrice: number | undefined = item?.price;
        if (typeof currentPrice !== "number") continue;

        let shouldTrigger = false;

        if (
          alertType === "target_price" &&
          typeof alert.targetPrice === "number"
        ) {
          shouldTrigger = currentPrice <= alert.targetPrice;
        } else if (
          alertType === "price_drop" &&
          typeof alert.dropPercentage === "number"
        ) {
          const base =
            alert.metadata?.currentPrice ??
            item?.originalPrice ??
            currentPrice;
          if (typeof base === "number" && base > 0) {
            const drop = ((base - currentPrice) / base) * 100;
            shouldTrigger = drop >= alert.dropPercentage;
          }
        } else if (alertType === "back_in_stock") {
          // Minimalna obsługa: jeśli availability != 'out_of_stock'
          const availability =
            item?.availability || alert?.metadata?.availability;
          shouldTrigger =
            availability && availability !== "out_of_stock";
        }

        if (!shouldTrigger) {
          processed++;
          continue;
        }

        // Oznacz alert jako wyzwolony
        await docSnap.ref.update({
          status: "triggered",
          triggeredAt: nowIso,
          notificationSent: true,
        });

        // Utwórz notyfikację do kolekcji 'notifications'
        const link = `/${itemType}s/${itemId}`;
        const msgTpl =
          alertType === "target_price" ?
            `Cena spadła do ${currentPrice} PLN ` +
            `(cel: ${alert.targetPrice} PLN)` :
            `Cena spadła do ${currentPrice} PLN`;

        await db.collection("notifications").add({
          userId: alert.userId,
          type: "system",
          title: "Alert cenowy",
          message: msgTpl,
          link,
          itemId,
          itemType,
          read: false,
          createdAt: Timestamp.now(),
          metadata: {
            alertType,
            currentPrice,
            targetPrice: alert.targetPrice ?? null,
          },
        });

        // Opcjonalnie e-mail (SendGrid) jeśli dostępny klucz
        const apiKey = process.env.SENDGRID_API_KEY;
        if (apiKey) {
          try {
            sgMail.setApiKey(apiKey);
            const userDoc =
              await db.collection("users").doc(alert.userId).get();
            const email = (userDoc.data() as any)?.email;
            if (email) {
              const fromEmail =
                process.env.SENDGRID_FROM_EMAIL ||
                "no-reply@okazjeplus.pl";
              await sgMail.send({
                to: email,
                from: fromEmail,
                subject: "Alert cenowy – cena spadła",
                text: `${msgTpl}. Zobacz: ${link}`,
                html:
                  `<p>${msgTpl}</p>` +
                  `<p><a href="${link}">Przejdź do oferty</a></p>`,
              } as any);
            }
          } catch (e) {
            logger.warn("SendGrid email failed", {
              error: (e as Error).message,
            });
          }
        }

        triggered++;
        processed++;
      } catch (e) {
        logger.error("priceMonitor item failed", {error: (e as Error).message});
      }
    }

    logger.info("priceMonitor completed", {processed, triggered});
  }
);

// ============================================
// Notifications: comment replies
// ============================================

// Deals: reply notification
export const notifyOnDealCommentReply = onDocumentCreated(
  "deals/{dealId}/comments/{commentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as any;
    if (!data?.parentId) return; // tylko odpowiedzi

    const dealId = (event.params as any).dealId as string;
    const parentRef = db
      .collection("deals")
      .doc(dealId)
      .collection("comments")
      .doc(data.parentId);
    const parentDoc = await parentRef.get();
    if (!parentDoc.exists) return;
    const parent = parentDoc.data() as any;
    const recipientUserId = parent.userId;
    if (!recipientUserId || recipientUserId === data.userId) return;

    const link = `/deals/${dealId}`;
    const msg = data.content ||
      "Ktoś odpowiedział na Twój komentarz";
    await db.collection("notifications").add({
      userId: recipientUserId,
      type: "comment_reply",
      title: "Nowa odpowiedź na Twój komentarz",
      message: msg.slice(0, 140),
      link,
      itemId: dealId,
      itemType: "deal",
      read: false,
      createdAt: Timestamp.now(),
      metadata: {
        commentId: snap.id,
        parentId: data.parentId,
      },
    });
  }
);

// Products: reply notification
export const notifyOnProductCommentReply = onDocumentCreated(
  "products/{productId}/comments/{commentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as any;
    if (!data?.parentId) return; // tylko odpowiedzi

    const productId = (event.params as any).productId as string;
    const parentRef = db
      .collection("products")
      .doc(productId)
      .collection("comments")
      .doc(data.parentId);
    const parentDoc = await parentRef.get();
    if (!parentDoc.exists) return;
    const parent = parentDoc.data() as any;
    const recipientUserId = parent.userId;
    if (!recipientUserId || recipientUserId === data.userId) return;

    const link = `/products/${productId}`;
    const msg = data.content ||
      "Ktoś odpowiedział na Twój komentarz";
    await db.collection("notifications").add({
      userId: recipientUserId,
      type: "comment_reply",
      title: "Nowa odpowiedź na Twój komentarz",
      message: msg.slice(0, 140),
      link,
      itemId: productId,
      itemType: "product",
      read: false,
      createdAt: Timestamp.now(),
      metadata: {
        commentId: snap.id,
        parentId: data.parentId,
      },
    });
  }
);

// Forum: mention notifications
export const notifyOnForumPostMention = onDocumentCreated(
  "forum_threads/{threadId}/posts/{postId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as any;
    const threadId = (event.params as any).threadId as string;
    const postId = snap.id;

    // Parse @user:uid mentions from post content
    const mentionRegex = /@user:([a-zA-Z0-9_-]+)/g;
    const mentions = Array.from(data.content?.matchAll(mentionRegex) || []);
    
    if (mentions.length === 0) return;

    // Get thread details for link
    const threadRef = db.collection("forum_threads").doc(threadId);
    const threadDoc = await threadRef.get();
    if (!threadDoc.exists) return;
    const threadData = threadDoc.data() as any;
    const threadTitle = threadData?.title || "Wątek forum";

    // Get author info
    const authorId = data.authorUid;
    const authorName = data.authorDisplayName || "Użytkownik";

    // Send notifications for each mentioned user
    const notifiedUserIds = new Set<string>();
    
    for (const match of mentions) {
      const mentionedUid = match[1];
      
      // Don't notify the same user twice
      if (notifiedUserIds.has(mentionedUid)) continue;
      // Don't notify author of themselves
      if (mentionedUid === authorId) continue;
      
      notifiedUserIds.add(mentionedUid);

      // Create notification
      await db.collection("notifications").add({
        userId: mentionedUid,
        type: "forum_mention",
        title: `${authorName} oznaczył Cię na forum`,
        message: `W wątku "${threadTitle}" - ${data.content?.slice(0, 100)}...`,
        link: `/forum/${threadId}#post-${postId}`,
        itemId: threadId,
        itemType: "forum_thread",
        read: false,
        createdAt: Timestamp.now(),
        metadata: {
          threadId,
          postId,
          authorId,
          authorName,
          mentionedUid,
        },
      });

      logger.info("Forum mention notification created", {
        mentionedUserId: mentionedUid,
        authorId,
        threadId,
        postId,
      });
    }
  }
);

// ============================================
// Notifications: email dispatcher (onCreate)
// ============================================

/**
 * Gdy w kolekcji `notifications` pojawi się nowy dokument,
 * wyślij e-mail (jeśli SENDGRID_API_KEY i SENDGRID_FROM_EMAIL).
 * Mapujemy typy: comment_reply, system, deal_approved/rejected.
 */
export const sendEmailOnNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail =
      process.env.SENDGRID_FROM_EMAIL || "no-reply@okazjeplus.pl";
    if (!apiKey) return; // brak integracji

    const snap = event.data;
    if (!snap) return;
    const notif = snap.data() as any;

    try {
      // Pobierz e-mail użytkownika
      const userDoc =
        await db.collection("users").doc(notif.userId).get();
      const email = (userDoc.data() as any)?.email;
      if (!email) return;

      const subjectMap: Record<string, string> = {
        comment_reply: "Nowa odpowiedź na Twój komentarz",
        forum_mention: "Zostałeś oznaczony na forum",
        system: "Powiadomienie systemowe",
        new_deal: "Nowa okazja",
        deal_approved: "Twoja okazja została zaakceptowana",
        deal_rejected: "Twoja okazja została odrzucona",
      };

      const subject = subjectMap[notif.type] || "Powiadomienie";
      const linkDef =
        notif.link ||
        (notif.itemId && notif.itemType ?
          `/${notif.itemType}s/${notif.itemId}` :
          "https://okazjeplus.pl");
      const msgText = notif.message || "Masz nowe powiadomienie.";
      const titleText = notif.title || subject;
      const text =
        `${titleText}\n\n${msgText}\n\nPrzejdź: ${linkDef}`;
      const html =
        `<h2>${titleText}</h2>` +
        `<p>${msgText}</p>` +
        `<p><a href="${linkDef}">Zobacz więcej</a></p>`;

      sgMail.setApiKey(apiKey);
      await sgMail.send({
        to: email,
        from: fromEmail,
        subject,
        text,
        html,
      } as any);
    } catch (e) {
      logger.warn("sendEmailOnNotification failed", {
        error: (e as Error).message,
      });
    }
  }
);

// =============================================================================
// SOCIAL SHARING STATS TRACKING
// =============================================================================

/**
 * Callable function do trackowania udostępnień społecznościowych.
 * Inkrementuje shareCount w dokumencie deal/product.
 * Wywołanie: trackShare(itemType, itemId, platform)
 * @param {CallableRequest} request - Request with itemType, itemId, platform
 * @return {Promise} Success status and new shareCount
 */
export const trackShareStats = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request: CallableRequest<{
    itemType: "deal" | "product";
    itemId: string;
    platform: "facebook" | "twitter" | "copy_link" | "whatsapp" | "telegram";
  }>) => {
    const {itemType, itemId, platform} = request.data;

    if (!itemType || !itemId || !platform) {
      throw new HttpsError(
        "invalid-argument",
        "itemType, itemId i platform są wymagane"
      );
    }

    try {
      const collection = itemType === "deal" ? "deals" : "product_cores";
      const docRef = db.collection(collection).doc(itemId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new HttpsError(
          "not-found",
          `${itemType} o id ${itemId} nie istnieje`
        );
      }

      // Inkrementuj shareCount
      await docRef.update({
        shareCount: (doc.data()?.shareCount || 0) + 1,
      });

      // Opcjonalnie: zapisz szczegółową analitykę (dla przyszłych statystyk)
      await db.collection("share_events").add({
        itemType,
        itemId,
        platform,
        userId: request.auth?.uid || null,
        timestamp: Timestamp.now(),
        userAgent: request.rawRequest?.headers?.["user-agent"] || null,
      });

      logger.info(`Share tracked: ${itemType}/${itemId} on ${platform}`);

      return {
        success: true,
        newShareCount: (doc.data()?.shareCount || 0) + 1,
      };
    } catch (error) {
      logger.error("Error tracking share", error);
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

// =============================================================================
// SAVED SEARCHES & NOTIFICATIONS
// =============================================================================

/**
 * Trigger function when new deal is created.
 * Checks all active saved searches and sends notifications to matching users.
 */
export const checkSavedSearches = onDocumentCreated(
  {
    document: "deals/{dealId}",
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const deal = snap.data() as Deal;

    // Only check approved deals
    if (deal.status !== "approved") return;

    try {
      // Get all active saved searches with notifications enabled
      const searchesSnapshot = await db
        .collection("saved_searches")
        .where("notificationsEnabled", "==", true)
        .get();

      if (searchesSnapshot.empty) {
        logger.info("No active saved searches found");
        return;
      }

      const notifications: any[] = [];

      for (const searchDoc of searchesSnapshot.docs) {
        const search = searchDoc.data();

        // Check if deal matches the saved search filters
        const matches = matchesSavedSearchFilters(deal, search.filters);

        if (matches) {
          // Create notification based on frequency
          if (search.notificationFrequency === "instant") {
            notifications.push({
              userId: search.userId,
              type: "saved_search_match",
              title: "Nowa okazja pasuje do Twojego wyszukiwania",
              message: `"${deal.title}" pasuje do wyszukiwania: ${search.name}`,
              itemType: "deal",
              itemId: deal.id,
              link: `/deals/${deal.id}`,
              createdAt: new Date().toISOString(),
              read: false,
              metadata: {
                searchId: searchDoc.id,
                searchName: search.name,
              },
            });

            // Update match count
            await searchDoc.ref.update({
              matchCount: (search.matchCount || 0) + 1,
              lastMatchedAt: new Date().toISOString(),
            });
          } else {
            // For daily/weekly, store in pending notifications
            await db.collection("pending_notifications").add({
              userId: search.userId,
              searchId: searchDoc.id,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
              frequency: search.notificationFrequency,
            });
          }
        }
      }

      // Batch create instant notifications
      if (notifications.length > 0) {
        const batch = db.batch();
        notifications.forEach((notif) => {
          const ref = db.collection("notifications").doc();
          batch.set(ref, notif);
        });
        await batch.commit();
        logger.info(
          `Created ${notifications.length} saved search notifications`
        );
      }
    } catch (error) {
      logger.error("Error checking saved searches", error);
    }
  }
);

/**
 * Helper function to check if deal matches saved search filters
 * @param {Deal} deal - The deal to check
 * @param {any} filters - Saved search filters
 * @return {boolean} True if deal matches filters
 */
function matchesSavedSearchFilters(deal: Deal, filters: any): boolean {
  // Price range
  const priceVal = typeof deal.price === 'object' ? deal.price.amount : deal.price;
  if (filters.minPrice && priceVal < filters.minPrice) return false;
  if (filters.maxPrice && priceVal > filters.maxPrice) return false;

  // Temperature
  if (
    filters.minTemperature &&
    deal.temperature < filters.minTemperature
  ) {
    return false;
  }

  // Free shipping
  if (filters.freeShipping && !deal.freeShipping) return false;

  // Verified
  if (filters.verified && !deal.verified) return false;

  // Categories
  if (filters.mainCategories?.length > 0) {
    if (!filters.mainCategories.includes(deal.mainCategorySlug)) return false;
  }

  if (filters.subCategories?.length > 0) {
    if (!filters.subCategories.includes(deal.subCategorySlug)) return false;
  }

  // Keywords
  if (filters.keywords) {
    const keywords = filters.keywords.toLowerCase();
    const searchText = `${deal.title} ${deal.description}`.toLowerCase();
    if (!searchText.includes(keywords)) return false;
  }

  // Tags
  if (filters.tags?.length > 0) {
    const dealTags = deal.tags || [];
    const hasMatchingTag = filters.tags.some(
      (tag: string) => dealTags.includes(tag)
    );
    if (!hasMatchingTag) return false;
  }

  // Merchants
  if (filters.merchants?.length > 0) {
    if (
      !deal.merchant ||
      !filters.merchants.includes(deal.merchant)
    ) {
      return false;
    }
  }

  if (filters.excludeMerchants?.length > 0) {
    if (
      deal.merchant &&
      filters.excludeMerchants.includes(deal.merchant)
    ) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// WEEKLY DIGEST EMAIL
// =============================================================================

/**
 * Scheduled function to send weekly digest emails every Sunday at 9 AM.
 * Sends personalized top deals to users who have opted in.
 */
export const sendWeeklyDigest = onSchedule(
  {
    schedule: "0 9 * * 0", // Every Sunday at 9 AM
    timeZone: "Europe/Warsaw",
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    logger.info("Starting weekly digest email send");

    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@okazje.plus";

    if (!apiKey) {
      logger.warn("SENDGRID_API_KEY not set, skipping weekly digest");
      return;
    }

    try {
      sgMail.setApiKey(apiKey);

      // Get users who have weekly digest enabled
      const usersSnapshot = await db
        .collection("users")
        .where("settings.weeklyDigest", "==", true)
        .where("settings.emailNotifications", "==", true)
        .get();

      if (usersSnapshot.empty) {
        logger.info("No users with weekly digest enabled");
        return;
      }

      logger.info(`Found ${usersSnapshot.size} users for weekly digest`);

      // Get top deals from last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const dealsSnapshot = await db
        .collection("deals")
        .where("status", "==", "approved")
        .where("postedAt", ">=", oneWeekAgo.toISOString())
        .orderBy("postedAt", "desc")
        .orderBy("temperature", "desc")
        .limit(50)
        .get();

      const allDeals = dealsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Deal[];

      if (allDeals.length === 0) {
        logger.info("No deals found for weekly digest");
        return;
      }

      // Send emails
      let sent = 0;
      let errors = 0;

      for (const userDoc of usersSnapshot.docs) {
        try {
          const userData = userDoc.data();
          const email = userData.email;

          if (!email) continue;

          // Get user's favorite categories for personalization
          const favoritesSnapshot = await db
            .collection("favorites")
            .where("userId", "==", userDoc.id)
            .where("type", "==", "deal")
            .limit(10)
            .get();

          const favoriteCategories = new Set<string>();
          favoritesSnapshot.forEach((fav) => {
            const deal = fav.data() as any;
            if (deal.mainCategorySlug) {
              favoriteCategories.add(deal.mainCategorySlug);
            }
          });

          // Filter deals - top 10 overall + 5 personalized
          const topDeals = allDeals
            .sort((a, b) => b.temperature - a.temperature)
            .slice(0, 10);

          const personalizedDeals = favoriteCategories.size > 0 ?
            allDeals
              .filter(
                (deal) => favoriteCategories.has(deal.mainCategorySlug)
              )
              .sort((a, b) => b.temperature - a.temperature)
              .slice(0, 5) :
            [];

          // Generate HTML email
          const html = generateWeeklyDigestHTML(
            userData.displayName || userData.email,
            topDeals,
            personalizedDeals
          );

          await sgMail.send({
            to: email,
            from: fromEmail,
            subject: "📧 Twoje cotygodniowe podsumowanie najlepszych okazji",
            html,
          } as any);

          sent++;
          logger.info(`Weekly digest sent to ${email}`);
        } catch (error) {
          errors++;
          logger.error(`Failed to send weekly digest to ${userDoc.id}`, error);
        }
      }

      logger.info(
        `Weekly digest complete: ${sent} sent, ${errors} errors`
      );
    } catch (error) {
      logger.error("Error in weekly digest", error);
    }
  }
);

/**
 * Generate HTML template for weekly digest email
 * @param {string} userName - User's name
 * @param {Deal[]} topDeals - Top deals of the week
 * @param {Deal[]} personalizedDeals - Personalized deals for user
 * @return {string} HTML email content
 */
function generateWeeklyDigestHTML(
  userName: string,
  topDeals: Deal[],
  personalizedDeals: Deal[]
): string {
  /* eslint-disable max-len */
  /**
   * Format price to PLN currency
   * @param {number} price - Price to format
   * @return {string} Formatted price string
   */
  const formatPrice = (price: number | { amount: number } | null | undefined) => {
    if (price === null || price === undefined) return "";
    const amount = typeof price === 'object' ? price.amount : price;
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  };

  /**
   * Generate HTML for single deal
   * @param {Deal} deal - Deal object
   * @return {string} HTML string for deal
   */
  const dealHTML = (deal: Deal) => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: white;">
      <div style="display: flex; gap: 16px;">
        ${
  deal.image ?
    `<img src="${deal.image}" alt="${deal.title}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;" />` :
    ""
}
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">
            ${deal.title}
          </h3>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <span style="font-size: 20px; font-weight: bold; color: #ef4444;">
              ${formatPrice(deal.price)}
            </span>
            ${
  deal.originalPrice ?
    `<span style="font-size: 14px; color: #6b7280; text-decoration: line-through;">
                  ${formatPrice(deal.originalPrice)}
                </span>` :
    ""
}
            ${
  deal.temperature >= 100 ?
    `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                  🔥 ${deal.temperature}°
                </span>` :
    ""
}
          </div>
          <a href="https://okazje.plus/deals/${deal.id}" style="display: inline-block; background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">
            Zobacz okazję →
          </a>
        </div>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cotygodniowe podsumowanie - Okazje Plus</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">
            🛍️ Okazje Plus
          </h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
            Twoje cotygodniowe podsumowanie najlepszych okazji
          </p>
        </div>

        <!-- Content -->
        <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
            Cześć <strong>${userName}</strong>! 👋
          </p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">
            Oto najgorętsze okazje z ostatniego tygodnia, które wybraliśmy specjalnie dla Ciebie.
          </p>

          <!-- Top Deals -->
          <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px 0; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">
            🔥 Najgorętsze okazje tygodnia
          </h2>
          ${topDeals.map(dealHTML).join("")}

          ${
  personalizedDeals.length > 0 ?
    `
          <!-- Personalized Deals -->
          <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 32px 0 16px 0; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">
            ⭐ Wybrane dla Ciebie
          </h2>
          ${personalizedDeals.map(dealHTML).join("")}
          ` :
    ""
}

          <!-- CTA -->
          <div style="text-align: center; margin-top: 32px; padding-top: 32px; border-top: 1px solid #e5e7eb;">
            <a href="https://okazje.plus" style="display: inline-block; background: #ef4444; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
              Zobacz wszystkie okazje
            </a>
          </div>

          <!-- Unsubscribe -->
          <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
            Nie chcesz otrzymywać tych wiadomości? 
            <a href="https://okazje.plus/profile/settings" style="color: #ef4444; text-decoration: underline;">
              Zmień ustawienia
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
/* eslint-enable max-len */

// =============================================================================
// PRE-REGISTRATION INVITATION SYSTEM
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || "changeme-in-production";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@okazje.plus";
const SITE_URL = process.env.SITE_URL || "https://okazje.plus";

// =============================================================================
// GOOGLE INDEXING API INTEGRATION
// =============================================================================

// Export triggers from autoIndexDeals module
export * from "./triggers/autoIndexDeals";

// =============================================================================
// AI AUTO-FILL DRAFT DEALS INTEGRATION
// =============================================================================

// Export triggers from autofillDraftDeal module
export * from "./triggers/autofillDraftDeal";

// =============================================================================
// TELEGRAM HOT DEAL BROADCASTER
// =============================================================================

// Export triggers from telegramBroadcaster module
export * from "./triggers/telegramBroadcaster";

// =============================================================================
// SEO ZOMBIE CLEANER CRON JOB
// =============================================================================

// Export triggers from seoZombieCleanerCron module
export * from "./triggers/seoZombieCleanerCron";

// =============================================================================
// SMART IMAGE OPTIMIZER
// =============================================================================

// Export triggers from smartImageOptimizer module
export * from "./triggers/smartImageOptimizer";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface ActivationTokenPayload {
  preRegId: string;
  email: string;
  registrationNumber: number;
  role: "pioneer" | "beta";
  exp: number; // Unix timestamp (sekundy)
}

/**
 * Generuje JWT token aktywacyjny ważny 7 dni
 * @param {string} preRegId - ID dokumentu pre-rejestracji
 * @param {string} email - Email użytkownika
 * @param {number} registrationNumber - Numer rejestracji (1-5000)
 * @param {"pioneer"|"beta"} role - Rola użytkownika
 * @return {string} JWT token
 */
function generateActivationToken(
  preRegId: string,
  email: string,
  registrationNumber: number,
  role: "pioneer" | "beta"
): string {
  const payload: ActivationTokenPayload = {
    preRegId,
    email,
    registrationNumber,
    role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 dni
  };
  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Weryfikuje JWT token i zwraca payload
 * @param {string} token - JWT token do weryfikacji
 * @return {ActivationTokenPayload|null} Payload lub null jeśli błąd
 */
export function verifyActivationToken(
  token: string
): ActivationTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as ActivationTokenPayload;
  } catch (error) {
    logger.error("Token verification failed", error);
    return null;
  }
}

/**
 * Wysyła email z zaproszeniem beta
 * @param {string} email - Adres email odbiorcy
 * @param {string} name - Imię/nick użytkownika
 * @param {number} registrationNumber - Numer rejestracji
 * @param {"pioneer"|"beta"} role - Rola
 * @param {string} activationToken - Token aktywacyjny JWT
 * @return {Promise<void>}
 */
async function sendInvitationEmail(
  email: string,
  name: string,
  registrationNumber: number,
  role: "pioneer" | "beta",
  activationToken: string
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    logger.warn("SENDGRID_API_KEY not set, skipping email");
    return;
  }

  const isPioneer = role === "pioneer";
  const roleLabel = isPioneer ? "🏆 Pionier" : "🚀 Beta Tester";
  const activationUrl = `${SITE_URL}/activate/${activationToken}`;

  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject: `${isPioneer ? "🏆" : "🚀"} Zaproszenie do Okazje+ Beta ${
      isPioneer ? `(Pionier #${registrationNumber})` : ""
    }`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont,
        'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #fff;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #666;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: ${isPioneer ? "#fbbf24" : "#3b82f6"};
      color: white;
      border-radius: 4px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">🎉 Okazje+</h1>
      <p style="margin:5px 0 0 0;">Witamy w Beta Release!</p>
    </div>
    <div class="content">
      <h2>Witaj ${name}!</h2>
      <p>Gratulacje! Zostałeś zaakceptowany jako 
      <span class="badge">${roleLabel} #${registrationNumber}</span> 
      na platformie <strong>Okazje+</strong>.</p>
      
      ${
  isPioneer ?
    `
        <p style="background:#fef3c7;padding:15px;
        border-left:4px solid #fbbf24;border-radius:4px;">
          <strong>🏆 Jesteś jednym z pierwszych 100 
          pionierów!</strong><br>
          Jako pionier otrzymujesz specjalny dostęp 
          i wyróżnienie na platformie.
        </p>
      ` :
    ""
}
      
      <h3>Co dalej?</h3>
      <ol>
        <li>Kliknij przycisk poniżej aby aktywować konto</li>
        <li>Ustaw hasło i dokończ profil</li>
        <li>Zacznij odkrywać najlepsze okazje!</li>
      </ol>
      
      <div style="text-align:center;">
        <a href="${activationUrl}" class="button">Aktywuj konto</a>
      </div>
      
      <p style="font-size:12px;color:#666;margin-top:20px;">
        Link aktywacyjny ważny przez 7 dni.<br>
        Jeśli przycisk nie działa, skopiuj link: 
        <a href="${activationUrl}">${activationUrl}</a>
      </p>
      
      <hr style="margin:30px 0;border:none;
      border-top:1px solid #e0e0e0;">
      
      <p><strong>Potrzebujesz pomocy?</strong><br>
  Skontaktuj się z nami: 
  <a href="mailto:business@okazjeplus.pl">
  business@okazjeplus.pl</a></p>
    </div>
    <div class="footer">
      <p>Okazje+ © 2025 · Najlepsze okazje w jednym miejscu</p>
      <p>Nie odpowiadaj na tego maila – to automatyczna wiadomość.</p>
    </div>
  </div>
</body>
</html>
    `,
  };

  await sgMail.send(msg);
  logger.info(`Invitation email sent to ${email}`);
}

/**
 * Cloud Function: Wysyła zaproszenia beta do wszystkich pre-rejestracji
 * Wywołanie: POST https://region-project.cloudfunctions.net/sendBetaInvitations
 * Auth: wymaga admina
 */
export const sendBetaInvitations = onCall(
  {
    region: "europe-west1",
    cors: true, // Włącz CORS dla wszystkich origin
  },
  async (request: CallableRequest) => {
    await ensureAdmin(request.auth || null);

    try {
      const preRegsSnapshot = await db
        .collection("pre_registrations")
        .where("status", "==", "pending")
        .orderBy("registrationNumber", "asc")
        .get();

      if (preRegsSnapshot.empty) {
        return {
          success: true,
          message: "Brak oczekujących rejestracji",
          sent: 0,
        };
      }

      let sent = 0;
      let errors = 0;

      for (const doc of preRegsSnapshot.docs) {
        try {
          const data = doc.data();
          const {email, name, registrationNumber, role} = data;

          // Generuj token
          const token = generateActivationToken(
            doc.id,
            email,
            registrationNumber,
            role
          );

          // Wyślij email
          await sendInvitationEmail(
            email,
            name,
            registrationNumber,
            role,
            token
          );

          // Zaktualizuj status
          await doc.ref.update({
            status: "invited",
            invitedAt: new Date().toISOString(),
            activationToken: token, // Opcjonalnie dla debugowania
          });

          sent++;
          logger.info(
            `Invitation sent to ${email} (${role} #${registrationNumber})`
          );
        } catch (error) {
          errors++;
          logger.error(`Failed to send invitation to ${doc.id}`, error);
        }
      }

      return {
        success: true,
        message: `Wysłano ${sent} zaproszeń (${errors} błędów)`,
        sent,
        errors,
      };
    } catch (error) {
      logger.error("Error sending beta invitations", error);
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

/**
 * Cloud Function: Weryfikuje token aktywacyjny i tworzy użytkownika
 * Wywołanie: POST https://region-project.cloudfunctions.net/activatePreRegistration
 * Body: { token: string, password: string }
 */
export const activatePreRegistration = onCall(
  {
    region: "europe-west1",
    cors: true, // Włącz CORS
  },
  async (request: CallableRequest<{token: string; password: string}>) => {
    const {token, password} = request.data;

    if (!token || !password) {
      throw new HttpsError(
        "invalid-argument",
        "Token i hasło są wymagane"
      );
    }

    // Weryfikuj token
    const payload = verifyActivationToken(token);
    if (!payload) {
      throw new HttpsError(
        "invalid-argument",
        "Nieprawidłowy lub wygasły token"
      );
    }

    const {preRegId, email, registrationNumber, role} = payload;

    try {
      // Sprawdź status pre-rejestracji
      const preRegDoc = await db
        .collection("pre_registrations")
        .doc(preRegId)
        .get();
      if (!preRegDoc.exists) {
        throw new HttpsError(
          "not-found",
          "Pre-rejestracja nie istnieje"
        );
      }

      const preRegData = preRegDoc.data();
      if (preRegData?.status === "confirmed") {
        throw new HttpsError("already-exists", "Konto już aktywowane");
      }

      // Utwórz użytkownika w Firebase Auth
      const {getAuth} = await import("firebase-admin/auth");
      const auth = getAuth();

      const userRecord = await auth.createUser({
        email,
        password,
        emailVerified: true, // Beta testers są automatycznie weryfikowani
        displayName: preRegData?.name || email.split("@")[0],
      });

      // Utwórz dokument użytkownika w Firestore
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName: preRegData?.name || email.split("@")[0],
        photoURL: null,
        role: "user",
        betaRole: role, // Zachowaj informację o roli beta
        betaNumber: registrationNumber,
        createdAt: new Date().toISOString(),
      });

      // Zaktualizuj status pre-rejestracji
      await preRegDoc.ref.update({
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        userId: userRecord.uid,
      });

      logger.info(
        `User ${userRecord.uid} activated from ` +
        `pre-registration ${preRegId}`
      );

      return {
        success: true,
        message: "Konto aktywowane pomyślnie",
        uid: userRecord.uid,
      };
    } catch (error) {
      logger.error("Error activating pre-registration", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

// ============================================
// Test: Create Import Job directly in Firestore (debug only)
// ============================================
export const testCreateImportJob = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req, res) => {
    try {
      logger.info("[testCreateImportJob] Creating test job...");

      const jobRef = db.collection("import_jobs").doc();
      const jobId = jobRef.id;
      const now = new Date().toISOString();

      // Stwórz batch dla 1 subkategorii tylko
      const batches = [
        {
          categoryId: "elektronika",
          categoryName: "Elektronika",
          categorySlug: "elektronika",
          subcategoryId: "smartfony-telefony",
          subcategoryName: "Smartfony i telefony",
          subcategorySlug: "smartfony-telefony",
          subsubcategoryId: "smartfony",
          subsubcategoryName: "Smartfony",
          subsubcategorySlug: "smartfony",
        },
      ];

      const jobData = {
        id: jobId,
        type: "products",
        importerType: "keyword-search",
        sources: ["keyword-search"],
        status: "queued",
        progress: {
          total: batches.length,
          completed: 0,
          failed: 0,
          current: 0,
        },
        batches,
        maxItemsPerSubcategory: 3,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        logs: [
          {
            timestamp: now,
            message: "Job created by testCreateImportJob function",
          },
        ],
        itemsCreated: [],
        itemsUpdated: [],
      };

      logger.info(`[testCreateImportJob] Setting job data to Firestore: ${jobId}`);
      await jobRef.set(jobData);

      logger.info(
        `[testCreateImportJob] Job created successfully: ${jobId}`
      );

      res.json({
        success: true,
        jobId,
        message: `Test job created: ${jobId}. Processing will start in next cron cycle.`,
      });
    } catch (error: any) {
      logger.error("[testCreateImportJob] Failed", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// =============================================================================
// FORUM THREAD CREATION VIA CLOUD FUNCTION
// =============================================================================

/**
 * Cloud Function: Creates a forum thread with first post
 * Uses Admin SDK for server-side Firestore writes (bypasses client restrictions)
 * 
 * @param {CallableRequest} request - Request with forum thread data
 * @return {Promise} Success status and thread ID
 */
export const createForumThreadCloudFunction = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request: CallableRequest<{
    title: string;
    content: string;
    categoryId?: string;
    attachments?: Array<{type: string; id: string}>;
  }>) => {
    // Verify authentication
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to create forum thread"
      );
    }

    const {title, content, categoryId, attachments} = request.data;

    // Validate input
    if (!title || !content) {
      throw new HttpsError(
        "invalid-argument",
        "Title and content are required"
      );
    }

    try {
      const now = Timestamp.now();
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      const userData = userDoc.data();
      const authorDisplayName = userData?.displayName || userData?.email || "Anonymous";

      // Create thread document
      const threadData = {
        title,
        authorUid: request.auth.uid,
        authorDisplayName,
        categoryId: categoryId || null,
        tags: [],
        summary: content.slice(0, 200),
        postsCount: 1,
        createdAt: now,
        updatedAt: now,
        lastPostAt: now,
        status: "approved",
        ...(attachments && attachments.length > 0 ? {attachments} : {}),
      };

      const threadRef = await db.collection("forum_threads").add(threadData);

      // Create first post in subcollection
      const post = {
        threadId: threadRef.id,
        authorUid: request.auth.uid,
        authorDisplayName,
        content,
        parentId: null,
        upvotes: 0,
        downvotes: 0,
        createdAt: now,
        updatedAt: now,
        status: "approved",
        ...(attachments && attachments.length > 0 ? {attachments} : {}),
      };

      await db
        .collection("forum_threads")
        .doc(threadRef.id)
        .collection("posts")
        .add(post);

      logger.info(`Forum thread created: ${threadRef.id}`, {
        author: request.auth.uid,
        category: categoryId,
      });

      return {
        success: true,
        threadId: threadRef.id,
        message: "Forum thread created successfully",
      };
    } catch (error) {
      logger.error(
        "[createForumThreadCloudFunction] Error:",
        error instanceof Error ? error.message : error
      );
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to create forum thread"
      );
    }
  }
);

// ============================================================================
// EXPORT USER STATS CLOUD FUNCTIONS
// ============================================================================
export const onVoteCreated = userStats.onVoteCreated;
export const onVoteDeleted = userStats.onVoteDeleted;
export const onCommentCreated = userStats.onCommentCreated;
export const onCommentDeleted = userStats.onCommentDeleted;
export const onCommentLikeCreated = userStats.onCommentLikeCreated;
export const onCommentLikeDeleted = userStats.onCommentLikeDeleted;
export const onForumPostCreated = userStats.onForumPostCreated;
export const onForumPostDeleted = userStats.onForumPostDeleted;

