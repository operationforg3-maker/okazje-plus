import { NextRequest, NextResponse } from 'next/server';
import { fillCategoriesWithDeals } from '@/ai/flows/fillCategoriesWithDeals';
import { createCategoryStructure } from '@/ai/flows/createCategoryStructure';
import generateCategoriesAI from '@/ai/flows/generateCategoriesAI';
import { fillSubSubcategoryProducts } from '@/ai/flows/fillSubSubcategoryProducts';
import { logAiCommand } from '@/lib/data-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command } = body;
    
    console.log('[AI Command] Received:', command);
    
    if (!command) {
      return NextResponse.json({ 
        error: 'Brak polecenia',
        result: 'Błąd: Nie podano polecenia do wykonania' 
      }, { status: 400 });
    }
    
    let result: string;
    
    // Rozpoznaj polecenie i wywołaj odpowiedni flow
    if (command === 'createCategoryStructure' || command.includes('utwórz kategorie')) {
      console.log('[AI Command] Executing createCategoryStructure...');
      result = await createCategoryStructure();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'createCategoryStructure',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else if (command === 'generateCategoriesAI' || command.includes('generuj kategorie')) {
      console.log('[AI Command] Executing generateCategoriesAI...');
      const params = body?.params ?? { mode: 'seeds-only' };
      const aiRes = await generateCategoriesAI(params);
      result = `OK: Utworzono ${aiRes.createdCount} kategorii (mode: ${aiRes.mode})`;
      console.log('[AI Command] Result:', result);
      try {
        await logAiCommand({ command: 'generateCategoriesAI', status: 'success', result });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else if (command === 'fillCategoriesWithProducts' || command.includes('wypełnij katalog')) {
      console.log('[AI Command] Executing fillCategoriesWithProducts (async background job)...');
      
      // Uruchom w tle bez czekania — zwróć 202 Accepted
      (async () => {
        try {
          const categories = await getAllCategories();
          let totalProductsAdded = 0;
          let totalProductsUpdated = 0;
          let preferredCurrency = 'USD';
          
          // Pobierz preferencję waluty
          try {
            const { adminDb } = await import('@/lib/firebase-admin');
            const currencyDoc = await adminDb.collection('config').doc('currencyPreference').get();
            if (currencyDoc.exists) {
              preferredCurrency = currencyDoc.data()?.currency || 'USD';
            }
          } catch (e) {
            console.warn('[fillCategoriesWithProducts Background] Failed to load currency', e);
          }

          console.log(`[fillCategoriesWithProducts Background] Processing ${categories.length} categories...`);

          // Iteruj po wszystkich pod-podkategoriach
          for (const cat of categories) {
            const subcategories = await getSubcategories(cat.id);
            for (const sub of subcategories) {
              const subsubcategories = await getSubSubcategories(cat.id, sub.id);
              
              if (subsubcategories.length > 0) {
                for (const subsub of subsubcategories) {
                  try {
                    console.log(`[fillCategoriesWithProducts Background] Processing: ${cat.name}/${sub.name}/${subsub.name}`);
                    const res = await fillSubSubcategoryProducts({
                      categoryId: cat.id,
                      categoryName: cat.name,
                      categorySlug: cat.slug,
                      subcategoryId: sub.id,
                      subcategoryName: sub.name,
                      subcategorySlug: sub.slug,
                      subsubcategoryId: subsub.id,
                      subsubcategoryName: subsub.name,
                      subsubcategorySlug: subsub.slug,
                      preferredCurrency,
                      maxProducts: 20,
                    });
                    totalProductsAdded += res.productsAdded;
                    totalProductsUpdated += res.productsUpdated;
                  } catch (e: any) {
                    console.error(`[fillCategoriesWithProducts Background] Error processing ${cat.name}/${sub.name}/${subsub.name}:`, e.message);
                    // Continue to next even if one fails
                  }
                  // Sleep between subcategories to avoid rate limiting
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } else {
                // Jeśli brak pod-podkategorii, przetwórz bezpośrednio subcategorię
                try {
                  console.log(`[fillCategoriesWithProducts Background] No sub-subcategories, processing: ${cat.name}/${sub.name}`);
                  const subsub = { id: sub.id, name: sub.name, slug: sub.slug };
                  const res = await fillSubSubcategoryProducts({
                    categoryId: cat.id,
                    categoryName: cat.name,
                    categorySlug: cat.slug,
                    subcategoryId: sub.id,
                    subcategoryName: sub.name,
                    subcategorySlug: sub.slug,
                    subsubcategoryId: subsub.id,
                    subsubcategoryName: subsub.name,
                    subsubcategorySlug: subsub.slug,
                    preferredCurrency,
                    maxProducts: 20,
                  });
                  totalProductsAdded += res.productsAdded;
                  totalProductsUpdated += res.productsUpdated;
                } catch (e: any) {
                  console.error(`[fillCategoriesWithProducts Background] Error processing ${cat.name}/${sub.name}:`, e.message);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }

          const finalResult = `✅ Background job completed: ${totalProductsAdded} products added, ${totalProductsUpdated} updated`;
          console.log(`[fillCategoriesWithProducts Background] ${finalResult}`);
          
          try {
            await logAiCommand({
              command: 'fillCategoriesWithProducts',
              status: 'success',
              result: finalResult,
            });
          } catch (logError) {
            console.error('[fillCategoriesWithProducts Background] Failed to log command:', logError);
          }
        } catch (e: any) {
          console.error('[fillCategoriesWithProducts Background] Fatal error:', e.message);
          try {
            await logAiCommand({
              command: 'fillCategoriesWithProducts',
              status: 'error',
              result: `Background job error: ${e.message}`,
            });
          } catch (logError) {
            console.error('[fillCategoriesWithProducts Background] Failed to log error:', logError);
          }
        }
      })(); // IIFE - run in background

      result = '⏳ Wypełnianie katalog zaraz się zacznie w tle. Sprawdź status w historii.';
      return NextResponse.json({ result, success: true, jobStatus: 'pending' }, { status: 202 });
    } else if (command === 'fillCategoriesWithDeals' || command.includes('pobierz deale')) {
      console.log('[AI Command] Executing fillCategoriesWithDeals...');
      result = await fillCategoriesWithDeals();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'fillCategoriesWithDeals',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else {
      result = `Nieznane polecenie: "${command}". Dostępne: createCategoryStructure, generateCategoriesAI, fillCategoriesWithProducts, fillCategoriesWithDeals`;
      return NextResponse.json({ result }, { status: 400 });
    }
    
    return NextResponse.json({ result, success: true });
  } catch (error: any) {
    console.error('[AI Command] Error:', error);
    
    const errorMessage = error?.message || 'Nieznany błąd';
    const errorStack = error?.stack || '';
    
    // Zaloguj błąd
    try {
      await logAiCommand({
        command: 'error',
        status: 'error',
        result: `${errorMessage}\n\nStack: ${errorStack}`,
      });
    } catch (logError) {
      console.error('[AI Command] Failed to log error:', logError);
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      result: `Błąd: ${errorMessage}`,
      success: false
    }, { status: 500 });
  }
}
