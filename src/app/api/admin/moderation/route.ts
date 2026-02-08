import { NextRequest, NextResponse } from "next/server";
import { requestDealIndexing } from "@/lib/google-indexing";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth-server";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    // Weryfikacja tokena i uprawnień admina
    const session = await requireAdmin();
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
    const itemRef = adminDb.collection(collectionName).doc(itemId);

    // Pobierz obecny status przed aktualizacją
    const beforeSnap = await itemRef.get();
    const previousStatus = beforeSnap.exists ? beforeSnap.data()?.status : 'unknown';

    // Zaktualizuj status
    const newStatus = action === "approve" ? "approved" : "rejected";
    await itemRef.update({
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Log moderation action
    try {
      await adminDb.collection('moderation_log').add({
        action,
        targetType: itemType,
        targetId: itemId,
        moderatorId: session.uid,
        moderatorEmail: session.email || 'unknown',
        timestamp: new Date().toISOString(),
        metadata: {
          previousStatus,
        },
      });
    } catch (err: any) {
      console.error('Failed to log moderation:', err);
    }

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
  } catch (error: any) {
    console.error("Błąd podczas moderacji:", error);
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: "Brak uprawnień admina" }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, message: "Wystąpił błąd podczas przetwarzania żądania" },
      { status: 500 }
    );
  }
}
