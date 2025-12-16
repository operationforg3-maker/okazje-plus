import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    // Weryfikacja tokenu admina
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Sprawdź czy użytkownik jest adminem
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - admin access required" }, { status: 403 });
    }

    // Pobierz parametr type z query string
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'deal' lub 'product'

    if (!type || !["deal", "product"].includes(type)) {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }

    const collectionName = type === "deal" ? "deals" : "products";
    
    // Pobierz wszystkie dokumenty ze statusem draft lub pending
    const [draftSnapshot, pendingSnapshot] = await Promise.all([
      adminDb.collection(collectionName)
        .where("status", "==", "draft")
        .select() // Pobierz tylko IDs, nie całe dokumenty
        .get(),
      adminDb.collection(collectionName)
        .where("status", "==", "pending")
        .select()
        .get()
    ]);

    // Zbierz wszystkie IDs
    const ids: string[] = [];
    draftSnapshot.docs.forEach(doc => ids.push(doc.id));
    pendingSnapshot.docs.forEach(doc => ids.push(doc.id));

    // Usuń duplikaty (gdyby jakieś były)
    const uniqueIds = [...new Set(ids)];

    return NextResponse.json({
      success: true,
      type,
      total: uniqueIds.length,
      ids: uniqueIds
    });

  } catch (error: any) {
    console.error("Error in get-all-ids API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
