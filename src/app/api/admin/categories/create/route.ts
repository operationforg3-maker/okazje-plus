import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth-middleware';
import type { Category } from '@/lib/types';

async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { categories } = await req.json() as { categories: Category[] };

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json({ error: 'Invalid categories data' }, { status: 400 });
    }

    const app = getFirebaseAdminApp();
    const db = app.firestore();

    let docCount = 0;

    for (const category of categories) {
      // Save main category
      const mainCatRef = db.collection('categories').doc(category.slug);
      await mainCatRef.set({
        id: category.slug,
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        updatedAt: new Date(),
      });
      docCount++;

      // Save subcategories
      if (category.subcategories && category.subcategories.length > 0) {
        const subCatsRef = mainCatRef.collection('subcategories');
        for (const subCat of category.subcategories) {
          const subDocRef = subCatsRef.doc(subCat.slug);
          await subDocRef.set({
            slug: subCat.slug,
            name: subCat.name,
            description: subCat.description,
            updatedAt: new Date(),
          });
          docCount++;

          // Save sub-subcategories
          if (subCat.subcategories && subCat.subcategories.length > 0) {
            const subSubCatsRef = subDocRef.collection('subcategories');
            for (const subSubCat of subCat.subcategories) {
              await subSubCatsRef.doc(subSubCat.slug).set({
                slug: subSubCat.slug,
                name: subSubCat.name,
                description: subSubCat.description,
                updatedAt: new Date(),
              });
              docCount++;
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, count: docCount });
  } catch (error) {
    console.error('Category creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create categories' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler, { requiredRole: 'admin' });
