// Plik: /functions/src/index.ts

import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Typ danych wejściowych dla funkcji
interface NewDealData {
  title: string;
  description?: string;
  price: number;
  dealUrl: string;
  imageUrl?: string;
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
