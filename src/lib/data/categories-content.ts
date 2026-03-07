import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category } from '@/lib/types';

type ContentType = 'deals' | 'products';

interface CategoryContentIndex {
  main: Set<string>;
  sub: Set<string>;
}

async function buildCategoryContentIndex(contentType: ContentType): Promise<CategoryContentIndex> {
  const main = new Set<string>();
  const sub = new Set<string>();

  // M6 migration: products content comes from product_cores.
  const collectionName = contentType === 'deals' ? 'deals' : 'product_cores';

  // One batched read avoids per-category N+1 checks.
  const sampleLimit = 2500;
  const q = query(
    collection(db, collectionName),
    where('status', '==', 'approved'),
    limit(sampleLimit)
  );

  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const mainSlug = String(data?.mainCategorySlug || '').trim();
    const subSlug = String(data?.subCategorySlug || '').trim();

    if (mainSlug) main.add(mainSlug);
    if (subSlug) sub.add(subSlug);
  });

  if (snapshot.size >= sampleLimit) {
    console.warn(
      `[categories-content] Reached sample limit (${sampleLimit}) for ${collectionName}. ` +
        'Consider paginated aggregation for very large datasets.'
    );
  }

  return { main, sub };
}

export async function filterCategoriesByContent(
  allCategories: Category[],
  contentType: ContentType
): Promise<Category[]> {
  const contentIndex = await buildCategoryContentIndex(contentType);

  return allCategories
    .map((category) => {
      const categorySlug = String(category.slug || category.id || '').trim();
      const hasCategoryContent = categorySlug ? contentIndex.main.has(categorySlug) : false;

      const categorySubcategories = Array.isArray(category.subcategories)
        ? category.subcategories
        : [];

      const filteredSubcategories = categorySubcategories.filter((subcategory) => {
        const subSlug = String(subcategory.slug || subcategory.id || '').trim();
        const hasSubContent = subSlug ? contentIndex.sub.has(subSlug) : false;
        const hasChildren = Array.isArray(subcategory.subcategories) && subcategory.subcategories.length > 0;

        // Keep subcategory if it has direct content OR has L3 children to preserve navigation tree.
        return hasSubContent || hasChildren;
      });

      if (!hasCategoryContent && filteredSubcategories.length === 0) {
        return null;
      }

      return {
        ...category,
        subcategories: filteredSubcategories,
      };
    })
    .filter(Boolean) as Category[];
}
