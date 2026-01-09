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
    ourSubcategorySlug: 'telefony',
    ourSubSubcategorySlug: 'smartfony',
    aliexpressCategoryId: '509',
    aliexpressCategoryName: 'Phones & Telecommunications',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'elektronika',
    ourSubcategorySlug: 'komputery',
    ourSubSubcategorySlug: 'laptopy',
    aliexpressCategoryId: '7',
    aliexpressCategoryName: 'Computer & Office',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'elektronika',
    ourSubcategorySlug: 'audio',
    aliexpressCategoryId: '18',
    aliexpressCategoryName: 'Consumer Electronics',
    confidence: 0.8,
  },
  
  // Dom i Ogród
  {
    ourCategorySlug: 'dom-i-ogrod',
    ourSubcategorySlug: 'meble',
    aliexpressCategoryId: '15',
    aliexpressCategoryName: 'Home & Garden',
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'dom-i-ogrod',
    ourSubcategorySlug: 'kuchnia',
    aliexpressCategoryId: '15',
    aliexpressCategoryName: 'Home & Garden',
    confidence: 0.8,
  },
  
  // Moda
  {
    ourCategorySlug: 'moda',
    ourSubcategorySlug: 'odziez-damska',
    aliexpressCategoryId: '200000297',
    aliexpressCategoryName: "Women's Clothing",
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'moda',
    ourSubcategorySlug: 'odziez-meska',
    aliexpressCategoryId: '200000343',
    aliexpressCategoryName: "Men's Clothing",
    confidence: 0.9,
  },
  {
    ourCategorySlug: 'moda',
    ourSubcategorySlug: 'obuwie',
    aliexpressCategoryId: '200000345',
    aliexpressCategoryName: 'Shoes',
    confidence: 0.9,
  },
  
  // Sport
  {
    ourCategorySlug: 'sport',
    ourSubcategorySlug: 'fitness',
    aliexpressCategoryId: '18',
    aliexpressCategoryName: 'Sports & Entertainment',
    confidence: 0.8,
  },
  
  // Zdrowie i Uroda
  {
    ourCategorySlug: 'zdrowie-uroda',
    ourSubcategorySlug: 'kosmetyki',
    aliexpressCategoryId: '66',
    aliexpressCategoryName: 'Beauty & Health',
    confidence: 0.9,
  },
  
  // Zabawki i Hobby
  {
    ourCategorySlug: 'zabawki',
    ourSubcategorySlug: 'zabawki-dla-dzieci',
    aliexpressCategoryId: '26',
    aliexpressCategoryName: 'Toys & Hobbies',
    confidence: 0.9,
  },
  
  // Motoryzacja
  {
    ourCategorySlug: 'motoryzacja',
    ourSubcategorySlug: 'akcesoria-samochodowe',
    aliexpressCategoryId: '34',
    aliexpressCategoryName: 'Automobiles & Motorcycles',
    confidence: 0.9,
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
