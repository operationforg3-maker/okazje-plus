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
        
        // Get the current category document
        const categoryRef = adminDb.collection('categories').doc(categoryId);
        const categoryDoc = await categoryRef.get();
        
        if (!categoryDoc.exists) {
          console.warn(`[POST /api/admin/categories/generate-context] Category ${categoryId} not found`);
        } else {
          const categoryData = categoryDoc.data() || {};
          const subcategories = categoryData.subcategories || [];
          
          // Find and update the subcategory
          const updatedSubcategories = subcategories.map((sub: any) => {
            if (sub.slug !== subcategoryId) return sub;
            
            // Found the right subcategory, now update its nested subcategories
            const subSubcategories = sub.subcategories || [];
            const updatedSubSubs = subSubcategories.map((subsub: any) => {
              if (subsub.slug !== subsubcategoryId) return subsub;
              
              // Found the right sub-subcategory, update it
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
          
          // Update the entire category with the updated subcategories
          await categoryRef.update({
            subcategories: updatedSubcategories,
            updatedAt: new Date().toISOString(),
          });
          
          console.log('[POST /api/admin/categories/generate-context] ✅ Saved to Firestore');
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
