import { getTopProductsByCategory, getRecommendedProducts, createCategory, createSubcategory, createSubSubcategory, createProduct } from '@/lib/data';

/**
 * Automatycznie wypełnia katalog kategoriami, podkategoriami, pod-podkategoriami
 * i przypisuje do nich produkty (najpopularniejsze, najlepsze, średnie, przekrojowe)
 * Struktura zbliżona do Pepper.pl, zoptymalizowana pod wygodę klienta.
 */
export async function fillCategoriesWithProducts() {
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

  for (const cat of categories) {
    const catId = await createCategory(cat);
    for (const sub of cat.subs) {
      const subId = await createSubcategory(catId, sub);
      for (const subsub of sub.subs) {
        const subsubId = await createSubSubcategory(catId, subId, subsub);
        // Dodaj przykładowe produkty do pod-podkategorii (możesz rozbudować logikę generowania)
        const products = await getRecommendedProducts(20);
        for (const p of products) {
          await createProduct({
            ...p,
            mainCategorySlug: cat.slug,
            subCategorySlug: sub.slug,
            subSubCategorySlug: subsub.slug,
            status: 'approved',
          });
        }
      }
    }
  }
  return 'Katalog został automatycznie wypełniony rozbudowanymi kategoriami i produktami.';
}
