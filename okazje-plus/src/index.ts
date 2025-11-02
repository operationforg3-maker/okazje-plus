
import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onDocumentWritten} from "firebase-functions/v2/firestore";

// --- Interfaces --- //

interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  imageHint: string;
  postedBy: string;
  postedAt: string; // ISO String
  voteCount: number;
  commentsCount: number;
  mainCategorySlug: string;
  subCategorySlug: string;
}

interface ImportDealData {
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  link: string;
  image?: string;
  imageHint?: string;
  mainCategorySlug: string;
  subCategorySlug: string;
}

interface BatchImportData {
  deals: ImportDealData[];
}

initializeApp();
const db = getFirestore();

// --- Cloud Functions --- //

export const batchImportDeals = onCall<BatchImportData>(async (request) => {
  logger.info("Rozpoczęto import wsadowy", {uid: request.auth?.uid});

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
  }

  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  if (userDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Tylko administratorzy mogą importować okazje.",
    );
  }

  const {deals: dealsToImport} = request.data;
  if (!Array.isArray(dealsToImport) || dealsToImport.length === 0) {
    throw new HttpsError("invalid-argument", "Brak danych do importu.");
  }

  const batch = db.batch();
  let successCount = 0;
  const errors: string[] = [];

  for (const [index, deal] of dealsToImport.entries()) {
    try {
      if (!deal.title || !deal.link || !deal.mainCategorySlug) {
        throw new Error(`Brak kluczowych danych w wierszu ${index + 1}.`);
      }
      const newDealRef = db.collection("deals").doc();
      const newDealData: Omit<Deal, "id"> = {
        title: deal.title,
        description: deal.description || "",
        price: typeof deal.price === "number" ? deal.price : 0,
        originalPrice: deal.originalPrice,
        link: deal.link,
        image: deal.image || "",
        imageHint: deal.imageHint || "",
        mainCategorySlug: deal.mainCategorySlug,
        subCategorySlug: deal.subCategorySlug || "ogolne",
        postedBy: request.auth.uid,
        postedAt: Timestamp.now().toDate().toISOString(),
        voteCount: 0,
        commentsCount: 0,
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
    successCount,
    errorCount: errors.length,
    errors,
  };
});

export const updateVoteCount = onDocumentWritten(
  "/deals/{dealId}/votes/{userId}",
  async (event) => {
    const dealId = event.params.dealId;
    const dealRef = db.doc(`deals/${dealId}`);
    const votesColRef = dealRef.collection("votes");

    return db.runTransaction(async (transaction) => {
      const votesSnapshot = await transaction.get(votesColRef);
      let newCount = 0;
      votesSnapshot.docs.forEach((doc) => {
        const voteData = doc.data();
        if (voteData.direction === "up") newCount++;
        else if (voteData.direction === "down") newCount--;
      });
      transaction.update(dealRef, {voteCount: newCount});
      return newCount;
    });
  },
);

export const updateCommentCount = onDocumentWritten(
  "/deals/{dealId}/comments/{commentId}",
  async (event) => {
    const dealId = event.params.dealId;
    const dealRef = db.doc(`deals/${dealId}`);
    const commentsColRef = dealRef.collection("comments");

    const commentsSnapshot = await commentsColRef.get();
    const newCount = commentsSnapshot.size;

    return dealRef.update({commentCount: newCount});
  },
);
