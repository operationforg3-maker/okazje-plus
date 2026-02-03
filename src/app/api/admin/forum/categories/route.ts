import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/forum/categories
 * Utwórz nową kategorię forum
 */
export async function POST(req: NextRequest) {
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
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generuj slug
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Sprawdź czy slug już istnieje
    const existingSnap = await adminDb
      .collection('forum_categories')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'Kategoria o takiej nazwie już istnieje' }, { status: 409 });
    }

    // Pobierz maksymalny sortOrder
    const categoriesSnap = await adminDb.collection('forum_categories').get();
    const maxSortOrder = categoriesSnap.docs.reduce((max, doc) => {
      const data = doc.data();
      return Math.max(max, data.sortOrder || 0);
    }, 0);

    // Utwórz kategorię
    const categoryData = {
      name: name.trim(),
      slug,
      description: description?.trim() || '',
      sortOrder: maxSortOrder + 1,
      createdAt: new Date().toISOString(),
      createdBy: decodedToken.uid,
    };

    const docRef = await adminDb.collection('forum_categories').add(categoryData);

    return NextResponse.json({ 
      success: true, 
      categoryId: docRef.id,
      category: { id: docRef.id, ...categoryData }
    });

  } catch (error: any) {
    console.error("Forum category creation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/admin/forum/categories
 * Pobierz wszystkie kategorie (z możliwością edycji)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    if (!decodedToken.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snap = await adminDb
      .collection('forum_categories')
      .orderBy('sortOrder', 'asc')
      .get();

    const categories = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, categories });

  } catch (error: any) {
    console.error("Forum categories fetch error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
