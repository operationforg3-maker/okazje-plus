import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildCategoryPath, getCategoryDisplayName } from '@/lib/category-routes';
import { getResolvedProductCategoryRoute } from '@/lib/category-page-data';
import { ProductsPageContent } from '../../../products/page';
import { generateCategoryBreadcrumbJsonLd } from '@/lib/json-ld-generators';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
    subSlug: string;
  }>;
}

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const effectiveLocale = SUPPORTED_LOCALES.includes(resolvedParams.locale as (typeof SUPPORTED_LOCALES)[number])
    ? resolvedParams.locale
    : 'pl';
  const { route } = await getResolvedProductCategoryRoute(resolvedParams.mainSlug, resolvedParams.subSlug);

  if (!route) {
    return {
      title: 'Podkategoria nie znaleziona | Okazje Plus',
      robots: { index: false, follow: false },
    };
  }

  const mainName = getCategoryDisplayName(route.mainCategory.name, effectiveLocale) || route.mainSlug;
  const subName = getCategoryDisplayName(route.subCategory?.name, effectiveLocale) || route.subSlug || '';
  return {
    title: `${subName} | ${mainName} | Okazje Plus`,
    description: `Przeglądaj produkty w podkategorii ${subName} w sekcji ${mainName}.`,
    alternates: {
      canonical: `https://okazjeplus.pl${buildCategoryPath(effectiveLocale, route.mainSlug, route.subSlug)}`,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LOCALES.map((localeCode) => [
            localeCode,
            `https://okazjeplus.pl${buildCategoryPath(localeCode, route.mainSlug, route.subSlug)}`,
          ])
        ),
        'x-default': `https://okazjeplus.pl${buildCategoryPath('pl', route.mainSlug, route.subSlug)}`,
      },
    },
    robots: {
      index: true,
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
  const effectiveLocale = SUPPORTED_LOCALES.includes(resolvedParams.locale as (typeof SUPPORTED_LOCALES)[number])
    ? resolvedParams.locale
    : 'pl';
  const { categories, route } = await getResolvedProductCategoryRoute(resolvedParams.mainSlug, resolvedParams.subSlug);

  if (!route) {
    notFound();
  }

  const mainName = getCategoryDisplayName(route.mainCategory.name, effectiveLocale) || route.mainSlug;
  const subName = getCategoryDisplayName(route.subCategory?.name, effectiveLocale) || route.subSlug || '';
  const breadcrumbJsonLd = generateCategoryBreadcrumbJsonLd({
    locale: effectiveLocale,
    mainSlug: route.mainSlug,
    mainName,
    subSlug: route.subSlug,
    subName,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductsPageContent
        initialMainCategoryParam={route.mainSlug}
        initialSubCategoryParam={route.subSlug}
        initialCategories={categories}
      />
    </>
  );
}
