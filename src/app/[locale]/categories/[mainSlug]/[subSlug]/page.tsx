import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategories } from '@/lib/data';
import { buildCategoryPath, getCategoryDisplayName, resolveCategoryRoute } from '@/lib/category-routes';
import { ProductsPageContent } from '../../../products/page';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
    subSlug: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const categories = await getCategories();
  const route = resolveCategoryRoute(categories, resolvedParams.mainSlug, resolvedParams.subSlug);

  if (!route) {
    return {
      title: 'Podkategoria nie znaleziona | Okazje Plus',
      robots: { index: false, follow: false },
    };
  }

  const mainName = getCategoryDisplayName(route.mainCategory.name) || route.mainSlug;
  const subName = getCategoryDisplayName(route.subCategory?.name) || route.subSlug || '';
  return {
    title: `${subName} | ${mainName} | Okazje Plus`,
    description: `Przeglądaj produkty w podkategorii ${subName} w sekcji ${mainName}.`,
    alternates: {
      canonical: `https://okazjeplus.pl${buildCategoryPath('pl', route.mainSlug, route.subSlug)}`,
    },
    robots: {
      index: resolvedParams.locale === 'pl',
      follow: true,
    },
  };
}

/**
 * Category page for 2-level navigation: main/sub
 * Renders the existing products listing with initial category and subcategory selections.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const categories = await getCategories();
  const route = resolveCategoryRoute(categories, resolvedParams.mainSlug, resolvedParams.subSlug);

  if (!route) {
    notFound();
  }

  return (
    <ProductsPageContent
      initialMainCategoryParam={route.mainSlug}
      initialSubCategoryParam={route.subSlug}
    />
  );
}
