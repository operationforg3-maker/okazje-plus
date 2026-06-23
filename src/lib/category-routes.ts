import { Category, Subcategory } from '@/lib/types';

export interface ResolvedCategoryRoute {
  mainCategory: Category;
  subCategory?: Subcategory;
  subSubCategory?: Subcategory;
  mainSlug: string;
  subSlug?: string;
  subSubSlug?: string;
}

const getSlug = (value: { slug?: string; id?: string } | null | undefined): string =>
  String(value?.slug || value?.id || '').trim();

export const getCategoryDisplayName = (value: unknown, lang?: string): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const localesToTry = lang ? [lang, 'pl', 'en', 'de', 'fr', 'es', 'uk'] : ['pl', 'en', 'de', 'fr', 'es', 'uk'];
    const preferred = localesToTry
      .map((l) => localized[l])
      .find((entry) => typeof entry === 'string' && entry.trim().length > 0);
    if (typeof preferred === 'string') return preferred;
  }
  return '';
};

export const humanizeCategorySlug = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  return normalized
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export const buildCategoryPath = (
  locale: string,
  mainSlug: string,
  subSlug?: string,
  subSubSlug?: string
): string => {
  const segments = [mainSlug, subSlug, subSubSlug]
    .filter((segment): segment is string => Boolean(segment && segment.trim().length > 0))
    .map((segment) => encodeURIComponent(segment));

  return `/${locale}/categories/${segments.join('/')}`;
};

export function resolveCategoryRoute(
  categories: Category[],
  mainSlug: string,
  subSlug?: string,
  subSubSlug?: string
): ResolvedCategoryRoute | null {
  const mainCategory = categories.find((category) => getSlug(category) === mainSlug);
  if (!mainCategory) return null;

  if (!subSlug) {
    return {
      mainCategory,
      mainSlug,
    };
  }

  const subCategory = (mainCategory.subcategories || []).find((subcategory) => getSlug(subcategory) === subSlug);
  if (!subCategory) return null;

  if (!subSubSlug) {
    return {
      mainCategory,
      subCategory,
      mainSlug,
      subSlug,
    };
  }

  const subSubCategory = (subCategory.subcategories || []).find((subcategory) => getSlug(subcategory) === subSubSlug);
  if (!subSubCategory) return null;

  return {
    mainCategory,
    subCategory,
    subSubCategory,
    mainSlug,
    subSlug,
    subSubSlug,
  };
}