import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategories } from '@/lib/data';
import { buildCategoryPath, getCategoryDisplayName, resolveCategoryRoute } from '@/lib/category-routes';
import { ProductsPageContent } from '../../../../products/page';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
    subSlug: string;
    subSubSlug: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const categories = await getCategories();
  const route = resolveCategoryRoute(categories, resolvedParams.mainSlug, resolvedParams.subSlug, resolvedParams.subSubSlug);

  if (!route) {
    return {
      title: 'Kategoria nie znaleziona | Okazje Plus',
      robots: { index: false, follow: false },
    };
  }

  const mainName = getCategoryDisplayName(route.mainCategory.name) || route.mainSlug;
  const subName = getCategoryDisplayName(route.subCategory?.name) || route.subSlug || '';
  const subSubName = getCategoryDisplayName(route.subSubCategory?.name) || route.subSubSlug || '';
  return {
    title: `${subSubName} | ${subName} | ${mainName} | Okazje Plus`,
    description: `Przeglądaj produkty w kategorii ${subSubName}.`,
    alternates: {
      canonical: `https://okazjeplus.pl${buildCategoryPath('pl', route.mainSlug, route.subSlug, route.subSubSlug)}`,
    },
    robots: {
      index: resolvedParams.locale === 'pl',
      follow: true,
    },
  };
}

/**
 * Category page for 3-level navigation: main/sub/subsub
 * Renders the existing products listing with full category path preselected.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const categories = await getCategories();
  const route = resolveCategoryRoute(categories, resolvedParams.mainSlug, resolvedParams.subSlug, resolvedParams.subSubSlug);

  if (!route) {
    notFound();
  }

  return (
    <ProductsPageContent
      initialMainCategoryParam={route.mainSlug}
      initialSubCategoryParam={route.subSlug}
      initialSubSubCategoryParam={route.subSubSlug}
    />
  );
}
