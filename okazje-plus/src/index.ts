// Plik: /functions/src/index.ts

import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {onDocumentWritten} from "firebase-functions/v2/firestore";

// Typ danych wejściowych dla funkcji
interface NewDealData {
  title: string;
  description?: string;
  price: number;
  dealUrl: string;
  imageUrl?: string;
}

interface ProductRatingCard {
    average: number;
    count: number;
    durability: number;
    easeOfUse: number;
    valueForMoney: number;
    versatility: number;
}

interface NewProductData {
    name: string;
    description: string;
    longDescription: string;
    image: string;
    imageHint: string;
    affiliateUrl: string;
    category: string;
    price: number;
    ratingCard: ProductRatingCard;
}

initializeApp();
const db = getFirestore();

export const createDeal = onCall<NewDealData>(async (request) => {
  logger.info("Rozpoczęto wywołanie createDeal", {uid: request.auth?.uid});

  // 1. Sprawdzenie uwierzytelnienia
  if (!request.auth) {
    logger.error("Brak uwierzytelnienia", {data: request.data});
    throw new HttpsError(
      "unauthenticated",
      "Musisz być zalogowany, aby dodać okazję.",
    );
  }

  const {uid, token} = request.auth;
  const data = request.data;

  // 2. Walidacja serwerowa
  if (!data.title || !data.price || !data.dealUrl) {
    logger.error("Brakujące dane", {data});
    throw new HttpsError(
      "invalid-argument",
      "Tytuł, cena i link są wymagane.",
    );
  }

  // 3. Stworzenie obiektu Deal
  const newDeal = {
    title: data.title,
    description: data.description || "",
    price: data.price,
    dealUrl: data.dealUrl,
    imageUrl: data.imageUrl || "",
    authorId: uid,
    // Pobierz 'name' z tokena auth, z wartością domyślną
    authorName: token.name || "Anonimowy Użytkownik",
    createdAt: FieldValue.serverTimestamp(),
    voteCount: 0,
    commentCount: 0,
  };

  // 4. Zapis do Firestore
  try {
    const dealRef = await db.collection("deals").add(newDeal);
    logger.info(`Pomyślnie utworzono okazję: ${dealRef.id}`, {uid});

    // 5. Zwrócenie ID
    return {dealId: dealRef.id};
  } catch (error) {
    logger.error("Błąd zapisu do Firestore", {error});
    throw new HttpsError(
      "internal",
      "Nie udało się zapisać okazji w bazie danych.",
    );
  }
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
        if (voteData.direction === "up") {
          newCount++;
        } else if (voteData.direction === "down") {
          newCount--;
        }
      });

      transaction.update(dealRef, {voteCount: newCount});
      logger.info(
        `Zaktualizowano licznik głosów dla okazji ${dealId} do ${newCount}`,
      );
      return newCount;
    });
  },
);

export const updateCommentCount = onDocumentWritten(
  "/deals/{dealId}/comments/{commentId}",
  async (event) => {
    const dealId = event.params.dealId;
    const dealRef = db.doc(`deals/${dealId}`);

    return db.runTransaction(async (transaction) => {
      const commentsColRef = dealRef.collection("comments");
      const commentsSnapshot = await transaction.get(commentsColRef);
      const newCount = commentsSnapshot.size;

      transaction.update(dealRef, { commentCount: newCount });
      logger.info(
        `Zaktualizowano licznik komentarzy dla okazji ${dealId} do ${newCount}`,
      );
      return newCount;
    });
  },
);

export const createProduct = onCall<NewProductData>(async (request) => {
    // 1. Sprawdzenie uwierzytelnienia
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Musisz być zalogowany, aby dodać produkt.');
    }

    // 2. Weryfikacja uprawnień administratora
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Tylko administratorzy mogą dodawać produkty.');
    }

    const data = request.data;

    // 3. Walidacja danych wejściowych
    if (!data.name || !data.description || !data.price || !data.affiliateUrl) {
        throw new HttpsError('invalid-argument', 'Brakuje wymaganych pól: nazwa, opis, cena lub link afiliacyjny.');
    }

    try {
        const productRef = await db.collection("products").add(data);
        logger.info(`Pomyślnie utworzono produkt: ${productRef.id}`);
        return { productId: productRef.id };
    } catch (error) {
        logger.error("Błąd zapisu produktu do Firestore", { error });
        throw new HttpsError('internal', 'Nie udało się zapisać produktu w bazie danych.');
    }
});
