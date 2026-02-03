import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * PATCH /api/admin/forum/categories/[id]
 * Edytuj kategorię forum
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: categoryId } = await params;
    const body = await req.json();
    const { name, description, sortOrder } = body;

    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: decodedToken.uid,
    };

    if (name?.trim()) {
      updateData.name = name.trim();
      // Zaktualizuj slug jeśli zmieniono nazwę
      updateData.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    if (typeof sortOrder === 'number') {
      updateData.sortOrder = sortOrder;
    }

    const docRef = adminDb.collection('forum_categories').doc(categoryId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await docRef.update(updateData);

    return NextResponse.json({ 
      success: true, 
      category: { id: categoryId, ...docSnap.data(), ...updateData }
    });

  } catch (error: any) {
    console.error("Forum category update error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/forum/categories/[id]
 * Usuń kategorię forum
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: categoryId } = await params;

    // Sprawdź czy są wątki używające tej kategorii
    const threadsSnap = await adminDb
      .collection('forum_threads')
      .where('categoryId', '==', categoryId)
      .limit(1)
      .get();

    if (!threadsSnap.empty) {
      return NextResponse.json({ 
        error: 'Nie można usunąć kategorii, która ma przypisane wątki' 
      }, { status: 400 });
    }

    const docRef = adminDb.collection('forum_categories').doc(categoryId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({ success: true, message: 'Category deleted' });

  } catch (error: any) {
    console.error("Forum category deletion error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
