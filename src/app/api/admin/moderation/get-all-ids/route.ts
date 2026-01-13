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

    // M6: product -> product_cores, pending -> pending_approval
    const collectionName = type === "deal" ? "deals" : "product_cores";
    
    // Pobierz WSZYSTKIE statusy dla moderacji (approved, pending, draft, rejected)
    const statuses = type === "product" 
      ? ["draft", "pending_approval", "approved", "rejected"]
      : ["draft", "pending", "approved", "rejected"];
    
    const snapshots = await Promise.all(
      statuses.map(status =>
        adminDb.collection(collectionName)
          .where("status", "==", status)
          .select() // Pobierz tylko IDs, nie całe dokumenty
          .get()
      )
    );

    // Zbierz wszystkie IDs
    const ids: string[] = [];
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => ids.push(doc.id));
    });

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
