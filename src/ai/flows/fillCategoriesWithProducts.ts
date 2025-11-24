import { getPopularProducts, getBestProducts, getAverageProducts } from '@/lib/data';
import { addCategory, addSubcategory, addSubSubcategory, addProduct } from '@/lib/data';

/**
 * Automatycznie wypełnia katalog kategoriami, podkategoriami, pod-podkategoriami
 * i przypisuje do nich produkty (najpopularniejsze, najlepsze, średnie, przekrojowe)
 */
export async function fillCategoriesWithProducts() {
  // Przykład: pobierz listę kategorii (możesz rozwinąć na podstawie własnych danych)
  const categories = [
    { name: 'Elektronika', slug: 'elektronika', subs: [
      { name: 'Telefony', slug: 'telefony', subs: [
        { name: 'Smartfony', slug: 'smartfony' },
        { name: 'Akcesoria', slug: 'akcesoria' }
      ] },
      { name: 'Laptopy', slug: 'laptopy', subs: [
        { name: 'Ultrabooki', slug: 'ultrabooki' },
        { name: 'Gamingowe', slug: 'gamingowe' }
      ] }
    ] },
    { name: 'Dom', slug: 'dom', subs: [
      { name: 'AGD', slug: 'agd', subs: [
        { name: 'Odkurzacze', slug: 'odkurzacze' },
        { name: 'Ekspresy do kawy', slug: 'ekspresy' }
      ] }
    ] }
  ];

  for (const cat of categories) {
    const catId = await addCategory(cat);
    for (const sub of cat.subs) {
      const subId = await addSubcategory(catId, sub);
      for (const subsub of sub.subs) {
        const subsubId = await addSubSubcategory(subId, subsub);
        // Dodaj produkty do pod-podkategorii
        const best = await getBestProducts(subsub.slug, 5);
        const popular = await getPopularProducts(subsub.slug, 10);
        const average = await getAverageProducts(subsub.slug, 5);
        for (const p of [...best, ...popular, ...average]) {
          await addProduct(subsubId, p);
        }
      }
    }
  }
  return 'Katalog został automatycznie wypełniony przykładowymi kategoriami i produktami.';
}
