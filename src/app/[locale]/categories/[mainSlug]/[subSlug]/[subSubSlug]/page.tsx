import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
    subSlug: string;
    subSubSlug: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, mainSlug, subSlug, subSubSlug } = await params;
  
  return {
    title: `${subSubSlug} - Okazje`,
    description: `Przeglądaj oferty w kategorii ${mainSlug}/${subSlug}/${subSubSlug}`,
  };
}

/**
 * Category page for 3-level navigation: main/sub/subsub
 * Redirects to /deals with appropriate query params
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, mainSlug, subSlug, subSubSlug } = await params;
  
  // Redirect to deals page with category filters
  redirect(`/${locale}/deals?mainCategory=${mainSlug}&subCategory=${subSlug}&subSubCategory=${subSubSlug}`);
}
