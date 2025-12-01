import { createCategory, createSubcategory, createSubSubcategory } from '@/lib/data-admin';
import { CATEGORY_SEEDS } from '@/lib/category-seeds';

/**
 * Tworzy tylko strukturę kategorii (3 poziomy) bez pobierania produktów
 * Wykorzystuje CATEGORY_SEEDS z src/lib/category-seeds.ts
 */
export async function createCategoryStructure() {
  try {
    console.log('[createCategoryStructure] ===== STARTING =====');
    
    let createdMain = 0;
    let createdSub = 0;
    let createdSubSub = 0;
    let totalMain = 0;
    let totalSub = 0;
    let totalSubSub = 0;
    
    for (const mainCat of CATEGORY_SEEDS) {
      totalMain++;
      console.log(`\n[Main Category] Processing: ${mainCat.name}`);
      
      // Walidacja: slug jest wymagany
      if (!mainCat.slug) {
        console.error(`❌ Missing slug for category: ${mainCat.name}`);
        continue;
      }
      
      // Utwórz kategorię główną (zwraca ID)
      const mainCatId = await createCategory({
        name: mainCat.name,
        slug: mainCat.slug,
        icon: mainCat.icon,
        description: mainCat.description,
        sortOrder: mainCat.sortOrder,
      });
      
      if (mainCatId) {
        createdMain++;
        console.log(`✅ Main category ready: ${mainCat.name} (${mainCatId})`);
      }
      
      // Utwórz podkategorie
      if (mainCat.subcategories && mainCat.subcategories.length > 0) {
        for (const subCat of mainCat.subcategories) {
          totalSub++;
          console.log(`  [Subcategory] Processing: ${subCat.name}`);
          
          const subCatId = await createSubcategory(mainCatId, {
            name: subCat.name,
            slug: subCat.slug,
            icon: subCat.icon,
            description: subCat.description,
            sortOrder: subCat.sortOrder,
          });
          
          if (subCatId) {
            createdSub++;
            console.log(`  ✅ Subcategory ready: ${subCat.name} (${subCatId})`);
          }
          
          // Utwórz sub-podkategorie (trzeci poziom)
          if (subCat.subcategories && subCat.subcategories.length > 0) {
            for (const subSubCat of subCat.subcategories) {
              totalSubSub++;
              console.log(`    [Sub-subcategory] Processing: ${subSubCat.name}`);
              
              const subSubCatId = await createSubSubcategory(mainCatId, subCatId, {
                name: subSubCat.name,
                slug: subSubCat.slug,
                icon: subSubCat.icon,
                description: subSubCat.description,
                sortOrder: subSubCat.sortOrder,
              });
              
              if (subSubCatId) {
                createdSubSub++;
                console.log(`    ✅ Sub-subcategory ready: ${subSubCat.name} (${subSubCatId})`);
              }
            }
          }
        }
      }
    }
    
    console.log('\n[createCategoryStructure] ===== COMPLETED =====');
    
    const summary = `
✅ Utworzono strukturę kategorii!

📊 Podsumowanie:
• Kategorie główne: ${totalMain} przetworzonych
• Podkategorie: ${totalSub} przetworzonych
• Sub-podkategorie: ${totalSubSub} przetworzonych

📁 Łącznie w bazie:
• Razem kategorii: ${totalMain + totalSub + totalSubSub}

🎯 Następny krok: Użyj "Wypełnij Produktami" aby dodać produkty do kategorii

💡 Uwaga: Funkcje są idempotentne - istniejące kategorie nie zostały duplikowane
`;
    
    console.log(summary);
    return summary;
    
  } catch (error: any) {
    console.error('[createCategoryStructure] Fatal error:', error);
    throw new Error(`Błąd tworzenia struktury kategorii: ${error.message}`);
  }
}
