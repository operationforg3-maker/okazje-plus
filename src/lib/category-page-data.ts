import 'server-only';

import { cache } from 'react';
import type { Category } from '@/lib/types';
import { getCategoriesWithContent } from '@/lib/data';
import { resolveCategoryRoute } from '@/lib/category-routes';

const getProductCategories = cache(async (): Promise<Category[]> => {
  return getCategoriesWithContent('products');
});

export const getResolvedProductCategoryRoute = cache(
  async (mainSlug: string, subSlug?: string, subSubSlug?: string) => {
    const categories = await getProductCategories();

    return {
      categories,
      route: resolveCategoryRoute(categories, mainSlug, subSlug, subSubSlug),
    };
  }
);