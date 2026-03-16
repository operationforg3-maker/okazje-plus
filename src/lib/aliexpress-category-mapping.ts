/**
 * Mapping naszych pod-podkategorii → AliExpress Category IDs
 * 
 * Umożliwia pobieranie hot products bezpośrednio z kategorii AliExpress
 * zamiast używania keyword search
 * 
 * AliExpress Category IDs from: https://developers.aliexpress.com/en/doc.htm?docId=45801
 */

export interface AliExpressCategoryMapping {
  ourCategorySlug: string;
  ourSubcategorySlug: string;
  ourSubSubcategorySlug?: string;
  aliexpressCategoryId: string;
  aliexpressCategoryName: string;
  confidence: number; // 0-1, jak bardzo jesteśmy pewni mappingu
}

/**
 * Static mapping table (można później przenieść do Firestore dla dynamicznej edycji)
 */
export const ALIEXPRESS_CATEGORY_MAPPINGS: AliExpressCategoryMapping[] = [
  // Elektronika
  {
    ourCategorySlug: 'elektronika',
    ourSubcategorySlug: 'smartfony-telefony',
    aliexpressCategoryId: '509',
    aliexpressCategoryName: 'Phones & Telecommunications',
    confidence: 0.95,
  },
  {
    ourCategorySlug: 'elektronika',
    ourSubcategorySlug: 'komputery-laptopy',
    aliexpressCategoryId: '7',
    aliexpressCategoryName: 'Computer & Office',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'elektronika',
    ourSubcategorySlug: 'audio-wideo',
    aliexpressCategoryId: '18',
    aliexpressCategoryName: 'Consumer Electronics',
    confidence: 0.85,
  },

  // Dom i Ogród
  {
    ourCategorySlug: 'dom-ogrod',
    ourSubcategorySlug: 'meble',
    aliexpressCategoryId: '15',
    aliexpressCategoryName: 'Home & Garden',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'dom-ogrod',
    ourSubcategorySlug: 'oswietlenie',
    aliexpressCategoryId: '15',
    aliexpressCategoryName: 'Home & Garden',
    confidence: 0.85,
  },
  {
    ourCategorySlug: 'dom-ogrod',
    ourSubcategorySlug: 'agd-male',
    aliexpressCategoryId: '15',
    aliexpressCategoryName: 'Home & Garden',
    confidence: 0.8,
  },
  {
    ourCategorySlug: 'dom-ogrod',
    ourSubcategorySlug: 'agd-duze',
    aliexpressCategoryId: '15',
    aliexpressCategoryName: 'Home & Garden',
    confidence: 0.8,
  },

  // Moda i Uroda
  {
    ourCategorySlug: 'moda-uroda',
    ourSubcategorySlug: 'odziez-damska',
    aliexpressCategoryId: '200000297',
    aliexpressCategoryName: "Women's Clothing",
    confidence: 0.95,
  },
  {
    ourCategorySlug: 'moda-uroda',
    ourSubcategorySlug: 'odziez-meska',
    aliexpressCategoryId: '200000343',
    aliexpressCategoryName: "Men's Clothing",
    confidence: 0.95,
  },
  {
    ourCategorySlug: 'moda-uroda',
    ourSubcategorySlug: 'obuwie',
    aliexpressCategoryId: '200000345',
    aliexpressCategoryName: 'Shoes',
    confidence: 0.95,
  },
  {
    ourCategorySlug: 'moda-uroda',
    ourSubcategorySlug: 'kosmetyki',
    aliexpressCategoryId: '66',
    aliexpressCategoryName: 'Beauty & Health',
    confidence: 0.9,
  },

  // Sport i Rekreacja
  {
    ourCategorySlug: 'sport-rekreacja',
    ourSubcategorySlug: 'fitness-silownia',
    aliexpressCategoryId: '18',
    aliexpressCategoryName: 'Sports & Entertainment',
    confidence: 0.85,
  },

  // Zdrowie i Uroda
  {
    ourCategorySlug: 'zdrowie-uroda',
    ourSubcategorySlug: 'pielegnacja-uroda',
    aliexpressCategoryId: '66',
    aliexpressCategoryName: 'Beauty & Health',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'zdrowie-uroda',
    ourSubcategorySlug: 'suplementy-diety',
    aliexpressCategoryId: '66',
    aliexpressCategoryName: 'Beauty & Health',
    confidence: 0.8,
  },

  // Dziecko i Zabawki
  {
    ourCategorySlug: 'dziecko-zabawki',
    ourSubcategorySlug: 'zabawki',
    aliexpressCategoryId: '26',
    aliexpressCategoryName: 'Toys & Hobbies',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'dziecko-zabawki',
    ourSubcategorySlug: 'wozki',
    aliexpressCategoryId: '26',
    aliexpressCategoryName: 'Toys & Hobbies',
    confidence: 0.8,
  },

  // Motoryzacja
  {
    ourCategorySlug: 'motoryzacja',
    ourSubcategorySlug: 'akcesoria-samochodowe',
    aliexpressCategoryId: '34',
    aliexpressCategoryName: 'Automobiles & Motorcycles',
    confidence: 0.95,
  },
  {
    ourCategorySlug: 'motoryzacja',
    ourSubcategorySlug: 'motocykle-skutery',
    aliexpressCategoryId: '34',
    aliexpressCategoryName: 'Automobiles & Motorcycles',
    confidence: 0.85,
  },
  {
    ourCategorySlug: 'motoryzacja',
    ourSubcategorySlug: 'czesci-samochodowe',
    aliexpressCategoryId: '34',
    aliexpressCategoryName: 'Automobiles & Motorcycles',
    confidence: 0.85,
  },
];

/**
 * Znajdź mapping dla danej kategorii
 */
export function findAliExpressCategory(
  categorySlug: string,
  subcategorySlug: string,
  subsubcategorySlug?: string
): AliExpressCategoryMapping | null {
  // Try exact match with subsubcategory
  if (subsubcategorySlug) {
    const exact = ALIEXPRESS_CATEGORY_MAPPINGS.find(
      m => m.ourCategorySlug === categorySlug &&
           m.ourSubcategorySlug === subcategorySlug &&
           m.ourSubSubcategorySlug === subsubcategorySlug
    );
    if (exact) return exact;
  }
  
  // Fallback: match category + subcategory
  const fallback = ALIEXPRESS_CATEGORY_MAPPINGS.find(
    m => m.ourCategorySlug === categorySlug &&
         m.ourSubcategorySlug === subcategorySlug &&
         !m.ourSubSubcategorySlug
  );
  
  return fallback || null;
}

/**
 * Pobierz wszystkie AliExpress category IDs dla danej kategorii
 */
export function getAliExpressCategoryIds(
  categorySlug: string,
  subcategorySlug: string,
  subsubcategorySlug?: string
): string[] {
  const mapping = findAliExpressCategory(categorySlug, subcategorySlug, subsubcategorySlug);
  return mapping ? [mapping.aliexpressCategoryId] : [];
}
