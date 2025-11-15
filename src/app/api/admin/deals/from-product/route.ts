import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

// Tworzy okazję (deal) na podstawie istniejącego produktu
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, overrides } = body as { productId?: string; overrides?: Partial<Record<string, any>> };

    if (!productId) {
      return NextResponse.json({ error: 'Brak parametru productId' }, { status: 400 });
    }

    const productRef = doc(db, 'products', productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Produkt nie istnieje' }, { status: 404 });
    }

    const product = { id: snap.id, ...snap.data() } as any;

    // Mapowanie pól produktu na strukturę Deal
    const now = new Date().toISOString();
    const title = product.name || product.title || 'Oferta';
    const description = product.description || product.longDescription || '';
    const price = Number(overrides?.price ?? product.price ?? 0);
    const originalPrice = overrides?.originalPrice ?? product.originalPrice ?? null;
    const link = overrides?.link ?? product.affiliateUrl ?? product.link ?? null;
    const image = overrides?.image ?? product.image ?? '';
    const imageHint = product.imageHint || '';
    const mainCategorySlug = overrides?.mainCategorySlug ?? product.mainCategorySlug ?? product.category ?? null;
    const subCategorySlug = overrides?.subCategorySlug ?? product.subCategorySlug ?? null;

    if (!mainCategorySlug || !subCategorySlug) {
      return NextResponse.json({ error: 'Produkt nie ma pełnej kategoryzacji (mainCategorySlug/subCategorySlug)' }, { status: 422 });
    }

    const dealData = {
      title,
      description,
      price,
      originalPrice,
      link,
      image,
      imageHint,
      postedBy: 'admin',
      postedAt: now,
      voteCount: 0,
      commentsCount: 0,
      temperature: 0,
      category: mainCategorySlug,
      mainCategorySlug,
      subCategorySlug,
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Źródło i powiązanie z produktem (opcjonalnie)
      sourceProductId: product.id,
      source: product.metadata?.source || 'manual',
    } as Record<string, any>;

    const ref = await addDoc(collection(db, 'deals'), dealData);

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    console.error('from-product create deal error:', error);
    return NextResponse.json({ error: 'Błąd tworzenia okazji z produktu' }, { status: 500 });
  }
}
