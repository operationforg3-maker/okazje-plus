import { getTopProductsByCategory, getRecommendedProducts, createCategory, createSubcategory, createSubSubcategory, createProduct } from '@/lib/data';

/**
 * Wyszukuje produkty dla kategorii przez AliExpress API
 */
async function fetchProductsForCategory(categoryName: string, count: number = 5): Promise<any[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: categoryName, 
        limit: count,
        sort: 'bestMatch'
      })
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.products || [];
  } catch (e) {
    console.warn(`Nie udało się pobrać produktów dla ${categoryName}:`, e);
    return [];
  }
}

/**
 * Automatycznie wypełnia katalog kategoriami, podkategoriami, pod-podkategoriami
 * i przypisuje do nich produkty pobrane z AliExpress API
 * Struktura zbliżona do Pepper.pl, zoptymalizowana pod wygodę klienta.
 */
export async function fillCategoriesWithProducts() {
  try {
    console.log('[fillCategoriesWithProducts] Starting...');
    
    // Rozbudowana struktura kategorii
    const categories = [
    { name: 'Elektronika', slug: 'elektronika', subs: [
      { name: 'Telefony i smartfony', slug: 'telefony-smartfony', subs: [
        { name: 'Smartfony', slug: 'smartfony' },
        { name: 'Telefony klasyczne', slug: 'telefony-klasyczne' },
        { name: 'Akcesoria do telefonów', slug: 'akcesoria-telefonow' },
        { name: 'Smartwatche', slug: 'smartwatche' },
        { name: 'Powerbanki', slug: 'powerbanki' }
      ] },
      { name: 'Laptopy i komputery', slug: 'laptopy-komputery', subs: [
        { name: 'Laptopy', slug: 'laptopy' },
        { name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne' },
        { name: 'Monitory', slug: 'monitory' },
        { name: 'Akcesoria komputerowe', slug: 'akcesoria-komputerowe' },
        { name: 'Drukarki i skanery', slug: 'drukarki-skanery' }
      ] },
      { name: 'Audio i wideo', slug: 'audio-wideo', subs: [
        { name: 'Słuchawki', slug: 'sluchawki' },
        { name: 'Głośniki', slug: 'glosniki' },
        { name: 'Telewizory', slug: 'telewizory' },
        { name: 'Soundbary', slug: 'soundbary' },
        { name: 'Projektory', slug: 'projektory' }
      ] },
      { name: 'Foto i kamery', slug: 'foto-kamery', subs: [
        { name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe' },
        { name: 'Kamery sportowe', slug: 'kamery-sportowe' },
        { name: 'Akcesoria foto', slug: 'akcesoria-foto' }
      ] }
    ] },
    { name: 'Dom i ogród', slug: 'dom-ogrod', subs: [
      { name: 'AGD', slug: 'agd', subs: [
        { name: 'Odkurzacze', slug: 'odkurzacze' },
        { name: 'Ekspresy do kawy', slug: 'ekspresy' },
        { name: 'Miksery i blendery', slug: 'miksery-blendery' },
        { name: 'Lodówki', slug: 'lodowki' },
        { name: 'Pralki', slug: 'pralki' }
      ] },
      { name: 'Wyposażenie wnętrz', slug: 'wyposazenie-wnetrz', subs: [
        { name: 'Meble', slug: 'meble' },
        { name: 'Oświetlenie', slug: 'oswietlenie' },
        { name: 'Dekoracje', slug: 'dekoracje' }
      ] },
      { name: 'Ogród', slug: 'ogrod', subs: [
        { name: 'Narzędzia ogrodowe', slug: 'narzedzia-ogrodowe' },
        { name: 'Grille', slug: 'grille' },
        { name: 'Rośliny', slug: 'rosliny' }
      ] }
    ] },
    { name: 'Moda', slug: 'moda', subs: [
      { name: 'Odzież damska', slug: 'odziez-damska', subs: [
        { name: 'Sukienki', slug: 'sukienki' },
        { name: 'Bluzki', slug: 'bluzki' },
        { name: 'Spodnie', slug: 'spodnie-damskie' }
      ] },
      { name: 'Odzież męska', slug: 'odziez-meska', subs: [
        { name: 'Koszule', slug: 'koszule' },
        { name: 'Spodnie', slug: 'spodnie-meskie' },
        { name: 'Marynarki', slug: 'marynarki' }
      ] },
      { name: 'Obuwie', slug: 'obuwie', subs: [
        { name: 'Buty sportowe', slug: 'buty-sportowe' },
        { name: 'Buty eleganckie', slug: 'buty-eleganckie' },
        { name: 'Sandały', slug: 'sandaly' }
      ] },
      { name: 'Akcesoria', slug: 'akcesoria-moda', subs: [
        { name: 'Torebki', slug: 'torebki' },
        { name: 'Paski', slug: 'paski' },
        { name: 'Czapki', slug: 'czapki' }
      ] }
    ] },
    { name: 'Dziecko', slug: 'dziecko', subs: [
      { name: 'Zabawki', slug: 'zabawki', subs: [
        { name: 'Klocki', slug: 'klocki' },
        { name: 'Lalki', slug: 'lalki' },
        { name: 'Puzzle', slug: 'puzzle' }
      ] },
      { name: 'Wózki i foteliki', slug: 'wozki-foteliki', subs: [
        { name: 'Wózki dziecięce', slug: 'wozki-dzieciece' },
        { name: 'Foteliki samochodowe', slug: 'foteliki-samochodowe' }
      ] }
    ] },
    { name: 'Sport i turystyka', slug: 'sport-turystyka', subs: [
      { name: 'Rowery', slug: 'rowery', subs: [
        { name: 'Górskie', slug: 'rowery-gorskie' },
        { name: 'Miejskie', slug: 'rowery-miejskie' }
      ] },
      { name: 'Fitness', slug: 'fitness', subs: [
        { name: 'Bieżnie', slug: 'bieznie' },
        { name: 'Hantle', slug: 'hantle' }
      ] },
      { name: 'Turystyka', slug: 'turystyka', subs: [
        { name: 'Namioty', slug: 'namioty' },
        { name: 'Śpiwory', slug: 'spiwory' }
      ] }
    ] },
    { name: 'Supermarket', slug: 'supermarket', subs: [
      { name: 'Artykuły spożywcze', slug: 'artykuly-spozywcze', subs: [
        { name: 'Słodycze', slug: 'slodycze' },
        { name: 'Napoje', slug: 'napoje' },
        { name: 'Przekąski', slug: 'przekaski' }
      ] },
      { name: 'Chemia domowa', slug: 'chemia-domowa', subs: [
        { name: 'Środki czystości', slug: 'srodki-czystosci' },
        { name: 'Kosmetyki', slug: 'kosmetyki' }
      ] }
    ] }
  ];

  let totalProducts = 0;
  let totalCategories = 0;
  let totalSubcategories = 0;
  let totalSubSubcategories = 0;
  
  console.log(`[fillCategoriesWithProducts] Processing ${categories.length} main categories...`);
  
  for (const cat of categories) {
    try {
      console.log(`[fillCategoriesWithProducts] Creating category: ${cat.name}`);
      const catId = await createCategory(cat);
      totalCategories++;
      
      for (const sub of cat.subs) {
        try {
          console.log(`[fillCategoriesWithProducts] Creating subcategory: ${sub.name}`);
          const subId = await createSubcategory(catId, sub);
          totalSubcategories++;
          
          for (const subsub of sub.subs) {
            try {
              console.log(`[fillCategoriesWithProducts] Creating sub-subcategory: ${subsub.name}`);
              const subsubId = await createSubSubcategory(catId, subId, subsub);
              totalSubSubcategories++;
              
              // Pobierz produkty z AliExpress dla tej kategorii
              console.log(`[fillCategoriesWithProducts] Fetching products for: ${cat.name} ${sub.name} ${subsub.name}`);
              const aliProducts = await fetchProductsForCategory(`${cat.name} ${sub.name} ${subsub.name}`, 5);
              console.log(`[fillCategoriesWithProducts] Found ${aliProducts.length} products`);
              
              for (const aliProduct of aliProducts) {
                try {
                  await createProduct({
                    name: aliProduct.title || aliProduct.name,
                    description: aliProduct.description || `Produkt z kategorii ${subsub.name}`,
                    longDescription: aliProduct.description || `Produkt z kategorii ${subsub.name}`,
                    price: aliProduct.price?.value || aliProduct.price || 0,
                    image: aliProduct.image || aliProduct.imageUrl || '',
                    imageHint: '',
                    affiliateUrl: aliProduct.link || aliProduct.productUrl || aliProduct.url || '#',
                    mainCategorySlug: cat.slug,
                    subCategorySlug: sub.slug,
                    subSubCategorySlug: subsub.slug,
                    status: 'approved',
                    ratingCard: {
                      average: aliProduct.rating || 4.5,
                      count: aliProduct.orders || 0,
                      durability: 4.5,
                      easeOfUse: 4.5,
                      valueForMoney: 4.5,
                      versatility: 4.5,
                    },
                    metadata: {
                      source: 'aliexpress',
                      originalId: aliProduct.id || aliProduct.itemId || '',
                      importedAt: new Date().toISOString(),
                    }
                  });
                  totalProducts++;
                } catch (e: any) {
                  console.warn(`[fillCategoriesWithProducts] Failed to create product ${aliProduct.title}:`, e.message);
                }
              }
            } catch (e: any) {
              console.error(`[fillCategoriesWithProducts] Failed to create sub-subcategory ${subsub.name}:`, e.message);
            }
          }
        } catch (e: any) {
          console.error(`[fillCategoriesWithProducts] Failed to create subcategory ${sub.name}:`, e.message);
        }
      }
    } catch (e: any) {
      console.error(`[fillCategoriesWithProducts] Failed to create category ${cat.name}:`, e.message);
    }
  }
  
  const summary = `✅ Katalog wypełniony!\n\n` +
    `📊 Statystyki:\n` +
    `- Kategorii głównych: ${totalCategories}/${categories.length}\n` +
    `- Podkategorii: ${totalSubcategories}\n` +
    `- Pod-podkategorii: ${totalSubSubcategories}\n` +
    `- Produktów: ${totalProducts}\n\n` +
    `Źródło: AliExpress API`;
  
  console.log('[fillCategoriesWithProducts] Done:', summary);
  return summary;
  } catch (error: any) {
    console.error('[fillCategoriesWithProducts] Fatal error:', error);
    return `❌ Błąd podczas wypełniania katalogu: ${error.message || 'Nieznany błąd'}`;
  }
}
