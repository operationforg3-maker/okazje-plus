import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * PATCH /api/admin/forum/categories/reorder
 * Zmień kolejność kategorii (bulk update sortOrder)
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    if (!decodedToken.admin) {
      return NextResponse.json({ error: "Forbidden - admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const { categories } = body; // Array of { id, sortOrder }

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: "Invalid categories array" }, { status: 400 });
    }

    // Batch update
    const batch = adminDb.batch();
    
    for (const cat of categories) {
      if (!cat.id || typeof cat.sortOrder !== 'number') {
        continue;
      }
      
      const docRef = adminDb.collection('forum_categories').doc(cat.id);
      batch.update(docRef, { 
        sortOrder: cat.sortOrder,
        updatedAt: new Date().toISOString(),
        updatedBy: decodedToken.uid,
      });
    }

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Reordered ${categories.length} categories` 
    });

  } catch (error: any) {
    console.error("Forum categories reorder error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
