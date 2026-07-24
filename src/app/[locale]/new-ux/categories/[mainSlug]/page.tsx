import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildCategoryPath, getCategoryDisplayName, buildCategoryPathNewUx } from '@/lib/category-routes';
import { getResolvedProductCategoryRoute } from '@/lib/category-page-data';
import { ProductsPageContent } from '@/app/[locale]/products/page';
import { generateCategoryBreadcrumbJsonLd } from '@/lib/json-ld-generators';

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

  const name = getCategoryDisplayName(route.mainCategory.name, effectiveLocale) || route.mainSlug;
  return {
    title: `${name} | Produkty | Okazje Plus`,
    description: `Przeglądaj produkty w kategorii ${name} na Okazje Plus.`,
    alternates: {
      canonical: `https://okazjeplus.pl${buildCategoryPathNewUx(effectiveLocale, route.mainSlug)}`,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LOCALES.map((localeCode) => [
            localeCode,
            `https://okazjeplus.pl${buildCategoryPath(localeCode, route.mainSlug)}`,
          ])
        ),
        'x-default': `https://okazjeplus.pl${buildCategoryPath('pl', route.mainSlug)}`,
      },
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
  const effectiveLocale = SUPPORTED_LOCALES.includes(resolvedParams.locale as (typeof SUPPORTED_LOCALES)[number])
    ? resolvedParams.locale
    : 'pl';
  const { categories, route } = await getResolvedProductCategoryRoute(resolvedParams.mainSlug);

  if (!route) {
    notFound();
  }

  const mainName = getCategoryDisplayName(route.mainCategory.name, effectiveLocale) || route.mainSlug;
  const breadcrumbJsonLd = generateCategoryBreadcrumbJsonLd({
    locale: effectiveLocale,
    mainSlug: route.mainSlug,
    mainName,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductsPageContent
        initialMainCategoryParam={route.mainSlug}
        initialCategories={categories}
      />
    </>
  );
}
