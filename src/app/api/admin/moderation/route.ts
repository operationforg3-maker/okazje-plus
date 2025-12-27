import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, Timestamp, getDoc } from "firebase/firestore";
import { requestDealIndexing } from "@/lib/google-indexing";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

export async function POST(request: NextRequest) {
  // Weryfikacja tokena i uprawnień admina
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Brak nagłówka autoryzacji" }, { status: 401 });
  }
  const idToken = authHeader.substring("Bearer ".length);
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch (e) {
    return NextResponse.json({ error: "Nieprawidłowy token" }, { status: 401 });
  }
  if (!decoded.admin) {
    return NextResponse.json({ error: "Brak uprawnień admina" }, { status: 403 });
  }
  try {
    const { itemId, itemType, action } = await request.json();

    if (!itemId || !itemType || !action) {
      return NextResponse.json(
        { success: false, message: "Brak wymaganych danych" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Nieprawidłowa akcja" },
        { status: 400 }
      );
    }

    if (!["deal", "product"].includes(itemType)) {
      return NextResponse.json(
        { success: false, message: "Nieprawidłowy typ elementu" },
        { status: 400 }
      );
    }

    // M6: Określ nazwę kolekcji (product -> product_cores)
    const collectionName = itemType === "deal" ? "deals" : "product_cores";
    const itemRef = doc(db, collectionName, itemId);

    // Zaktualizuj status
    const newStatus = action === "approve" ? "approved" : "rejected";
    await updateDoc(itemRef, {
      status: newStatus,
      updatedAt: Timestamp.now(),
    });

    // Jeśli to deal i akcja to approval, spróbuj indeksować w Google
    if (itemType === "deal" && action === "approve") {
      try {
        console.log(`[Moderation] Submitting deal ${itemId} to Google Indexing API...`);
        const indexingResult = await requestDealIndexing(itemId, "URL_UPDATED");
        console.log(`[Moderation] Google Indexing result:`, indexingResult);
      } catch (indexingError) {
        // Nie przerywa moderacji jeśli indexing nie powiódł się
        console.error(`[Moderation] Warning: Google Indexing failed for deal ${itemId}:`, indexingError);
      }
    }

    // Jeśli to deal i akcja to rejection, usuń z indeksu Google
    if (itemType === "deal" && action === "reject") {
      try {
        console.log(`[Moderation] Removing deal ${itemId} from Google Indexing API...`);
        const indexingResult = await requestDealIndexing(itemId, "URL_DELETED");
        console.log(`[Moderation] Google Indexing removal result:`, indexingResult);
      } catch (indexingError) {
        console.error(`[Moderation] Warning: Google Indexing removal failed for deal ${itemId}:`, indexingError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `${itemType === "deal" ? "Okazja" : "Produkt"} został ${
          action === "approve" ? "zatwierdzony" : "odrzucony"
        }`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Błąd podczas moderacji:", error);
    return NextResponse.json(
      { success: false, message: "Wystąpił błąd podczas przetwarzania żądania" },
      { status: 500 }
    );
  }
}
