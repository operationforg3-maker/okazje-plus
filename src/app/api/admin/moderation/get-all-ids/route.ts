import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

/**
 * Get all IDs for moderation with optional status filter
 * Query params:
 * - type: 'deal' | 'product' (required)
 * - statuses: comma-separated status values (optional, defaults to pending/draft for moderation)
 * - limit: max results to return (optional, default unlimited)
 * 
 * ✅ Features:
 * - Efficient by fetching only document IDs (not full docs)
 * - Customizable status filtering
 * - Supports both 'pending' (deals) and 'pending_approval' (products) semantics
 */
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

    // Pobierz parametry z query string
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'deal' lub 'product'
    const statusParam = searchParams.get("statuses"); // comma-separated statuses
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam), 10000) : 10000;

    if (!type || !["deal", "product"].includes(type)) {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }

    // M6: product -> product_cores
    const collectionName = type === "deal" ? "deals" : "product_cores";
    
    // Determine statuses to query
    let statuses: string[];
    if (statusParam) {
      // Custom statuses provided (e.g., "approved,pending")
      statuses = statusParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      
      // Validate statuses
      const validStatuses = type === "product"
        ? ["draft", "pending_approval", "rejected", "approved"]
        : ["draft", "pending", "poczekalnia", "rejected", "approved"];
      
      statuses = statuses.filter(s => validStatuses.includes(s));
      
      if (statuses.length === 0) {
        return NextResponse.json({ 
          error: "No valid statuses provided",
          validStatuses 
        }, { status: 400 });
      }
    } else {
      // Default: only pending/draft/poczekalnia (for moderation queue)
      statuses = type === "product"
        ? ["draft", "pending_approval"]
        : ["draft", "pending", "poczekalnia"];
    }

    console.log(`[get-all-ids] Fetching ${type} with statuses: ${statuses.join(', ')}`);

    // Fetch all matching documents (only IDs)
    const snapshots = await Promise.all(
      statuses.slice(0, 10).map(status => // Max 10 queries per request to avoid request bloat
        adminDb
          .collection(collectionName)
          .where("status", "==", status)
          .select() // Only fetch document IDs
          .limit(limit)
          .get()
      )
    );

    // Collect all IDs
    const ids: string[] = [];
    const totalCount: Record<string, number> = {};
    
    statuses.forEach((status, idx) => {
      if (snapshots[idx]) {
        const count = snapshots[idx].docs.length;
        totalCount[status] = count;
        snapshots[idx].docs.forEach(doc => ids.push(doc.id));
      }
    });

    // Remove duplicates
    const uniqueIds = [...new Set(ids)];

    return NextResponse.json({
      success: true,
      type,
      statuses,
      total: uniqueIds.length,
      countByStatus: totalCount,
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
