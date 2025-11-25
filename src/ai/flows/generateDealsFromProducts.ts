import { getProductsForAdmin, createDeal } from '@/lib/data';

/**
 * Generuje deale z istniejących produktów
 * - Wybiera losowe produkty
 * - Tworzy dla nich kuszące deale z obniżoną ceną
 */
export async function generateDealsFromProducts(count: number = 50) {
  const products = await getProductsForAdmin('approved', 200);
  
  if (products.length === 0) {
    return 'Brak produktów w bazie. Najpierw wypełnij katalog produktami.';
  }
  
  // Wybierz losowe produkty
  const shuffled = products.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, products.length));
  
  let dealsCreated = 0;
  
  for (const product of selected) {
    try {
      // Wygeneruj dane deala
      const discount = Math.floor(Math.random() * 40) + 10; // 10-50% zniżki
      const originalPrice = product.price || 100;
      const dealPrice = originalPrice * (1 - discount / 100);
      
      await createDeal({
        title: `🔥 ${product.name} -${discount}%`,
        description: `Super okazja! ${product.name} w promocyjnej cenie. Oszczędzasz ${discount}%!`,
        link: product.affiliateUrl || '#',
        image: product.image,
        imageHint: '',
        price: dealPrice,
        originalPrice: originalPrice,
        mainCategorySlug: product.mainCategorySlug,
        subCategorySlug: product.subCategorySlug,
        subSubCategorySlug: product.subSubCategorySlug,
        category: product.mainCategorySlug,
        postedBy: 'system',
        commentsCount: 0,
        source: 'other',
        status: 'approved',
        temperature: Math.floor(Math.random() * 50) + 10, // 10-60 temperatura
        voteCount: Math.floor(Math.random() * 20),
      });
      
      dealsCreated++;
    } catch (e) {
      console.warn(`Nie udało się utworzyć deala dla ${product.name}:`, e);
    }
  }
  
  return `Wygenerowano ${dealsCreated} deali z ${selected.length} produktów.`;
}
