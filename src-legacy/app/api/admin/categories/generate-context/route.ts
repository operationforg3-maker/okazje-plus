/**
 * POST /api/admin/categories/generate-context
 * 
 * Generates descriptions and example products for a sub-subcategory
 * using AI to improve import keyword matching.
 * 
 * Automatically saves the generated context to Firestore so the import
 * pipeline can use it for better product searches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { generateSubcategoryContext } from '@/ai/flows/generateSubcategoryContext';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { mainCategoryName, subcategoryName, subsubcategoryName, categoryId, subcategoryId, subsubcategoryId } = body;

    if (!mainCategoryName || !subcategoryName || !subsubcategoryName) {
      return NextResponse.json(
        { error: 'Missing required fields: mainCategoryName, subcategoryName, subsubcategoryName' },
        { status: 400 }
      );
    }

    console.log('[POST /api/admin/categories/generate-context] Generating context for:', {
      mainCategoryName,
      subcategoryName,
      subsubcategoryName,
      categoryId,
      subcategoryId,
      subsubcategoryId,
    });

    const result = await generateSubcategoryContext({
      mainCategoryName,
      subcategoryName,
      subsubcategoryName,
    });

    console.log('[POST /api/admin/categories/generate-context] ✅ Generated:', result);

    // Save to Firestore if IDs are provided
    if (categoryId && subcategoryId && subsubcategoryId) {
      try {
        console.log('[POST /api/admin/categories/generate-context] Saving to Firestore...');

        // --- Primary path: subcollections (CategoryBuilder + import pipeline) ---
        const subSubRef = adminDb
          .collection('categories')
          .doc(categoryId)
          .collection('subcategories')
          .doc(subcategoryId)
          .collection('subcategories')
          .doc(subsubcategoryId);

        const subSubSnap = await subSubRef.get();
        if (subSubSnap.exists) {
          await subSubRef.set({
            description: result.descriptionPl,
            searchKeywords: result.searchKeywords,
            exampleProducts: result.exampleProducts,
            updatedAt: new Date().toISOString(),
            translations: {
              ...(subSubSnap.data()?.translations || {}),
              en: {
                ...(subSubSnap.data()?.translations?.en || {}),
                description: result.descriptionEn,
              },
            },
          }, { merge: true });
          console.log('[POST /api/admin/categories/generate-context] ✅ Saved to subcollection');
        } else {
          // If doc missing, create it
          await subSubRef.set({
            slug: subsubcategoryId,
            name: subsubcategoryName,
            description: result.descriptionPl,
            searchKeywords: result.searchKeywords,
            exampleProducts: result.exampleProducts,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            translations: {
              en: { description: result.descriptionEn },
            },
          });
          console.log('[POST /api/admin/categories/generate-context] ✅ Created subcollection doc');
        }

        // --- Fallback path: embedded arrays (AdminCategoriesPage editor) ---
        const categoryRef = adminDb.collection('categories').doc(categoryId);
        const categoryDoc = await categoryRef.get();
        if (categoryDoc.exists) {
          const categoryData = categoryDoc.data() || {};
          const subcategories = categoryData.subcategories || [];

          const updatedSubcategories = subcategories.map((sub: any) => {
            if (sub.slug !== subcategoryId) return sub;

            const subSubcategories = sub.subcategories || [];
            const updatedSubSubs = subSubcategories.map((subsub: any) => {
              if (subsub.slug !== subsubcategoryId) return subsub;

              return {
                ...subsub,
                description: result.descriptionPl,
                searchKeywords: result.searchKeywords,
                exampleProducts: result.exampleProducts,
                translations: {
                  ...(subsub.translations || {}),
                  en: {
                    ...(subsub.translations?.en || {}),
                    description: result.descriptionEn,
                  },
                },
              };
            });

            return {
              ...sub,
              subcategories: updatedSubSubs,
            };
          });

          await categoryRef.update({
            subcategories: updatedSubcategories,
            updatedAt: new Date().toISOString(),
          });
          console.log('[POST /api/admin/categories/generate-context] ✅ Saved to embedded array');
        }
      } catch (firestoreError: any) {
        console.error('[POST /api/admin/categories/generate-context] Failed to save to Firestore:', firestoreError);
        // Don't fail the response - return the generated data anyway
      }
    } else {
      console.warn('[POST /api/admin/categories/generate-context] No IDs provided, skipping Firestore save');
    }

    return NextResponse.json({
      success: true,
      ...result,
      saved: !!categoryId && !!subcategoryId && !!subsubcategoryId,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/categories/generate-context] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate category context' },
      { status: 500 }
    );
  }
}
