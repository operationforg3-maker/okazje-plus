import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
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

    // Określ nazwę kolekcji
    const collectionName = itemType === "deal" ? "deals" : "products";
    const itemRef = doc(db, collectionName, itemId);

    // Zaktualizuj status
    const newStatus = action === "approve" ? "approved" : "rejected";
    await updateDoc(itemRef, {
      status: newStatus,
      updatedAt: Timestamp.now(),
    });

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
