import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategories } from '@/lib/data';
import { buildCategoryPath, getCategoryDisplayName, resolveCategoryRoute } from '@/lib/category-routes';
import { ProductsPageContent } from '../../products/page';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const categories = await getCategories();
  const route = resolveCategoryRoute(categories, resolvedParams.mainSlug);

  if (!route) {
    return {
      title: 'Kategoria nie znaleziona | Okazje Plus',
      robots: { index: false, follow: false },
    };
  }

  const name = getCategoryDisplayName(route.mainCategory.name) || route.mainSlug;
  return {
    title: `${name} | Produkty | Okazje Plus`,
    description: `Przeglądaj produkty w kategorii ${name} na Okazje Plus.`,
    alternates: {
      canonical: `https://okazjeplus.pl${buildCategoryPath('pl', route.mainSlug)}`,
    },
    robots: {
      index: resolvedParams.locale === 'pl',
      follow: true,
    },
  };
}

/**
 * Category page for main category
 * Renders the existing products listing with an initial category selection.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const categories = await getCategories();
  const route = resolveCategoryRoute(categories, resolvedParams.mainSlug);

  if (!route) {
    notFound();
  }

  return <ProductsPageContent initialMainCategoryParam={route.mainSlug} />;
}
