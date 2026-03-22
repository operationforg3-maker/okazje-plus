import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildCategoryPath, getCategoryDisplayName } from '@/lib/category-routes';
import { getResolvedProductCategoryRoute } from '@/lib/category-page-data';
import { ProductsPageContent } from '../../products/page';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
  }>;
}

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const effectiveLocale = SUPPORTED_LOCALES.includes(resolvedParams.locale as (typeof SUPPORTED_LOCALES)[number])
    ? resolvedParams.locale
    : 'pl';
  const { route } = await getResolvedProductCategoryRoute(resolvedParams.mainSlug);

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
      canonical: `https://okazjeplus.pl${buildCategoryPath(effectiveLocale, route.mainSlug)}`,
    },
    robots: {
      index: true,
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
  const { categories, route } = await getResolvedProductCategoryRoute(resolvedParams.mainSlug);

  if (!route) {
    notFound();
  }

  return (
    <ProductsPageContent
      initialMainCategoryParam={route.mainSlug}
      initialCategories={categories}
    />
  );
}
