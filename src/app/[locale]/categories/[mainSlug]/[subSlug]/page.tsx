import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
    subSlug: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, mainSlug, subSlug } = await params;
  
  return {
    title: `${subSlug} - Okazje`,
    description: `Przeglądaj oferty w kategorii ${mainSlug}/${subSlug}`,
  };
}

/**
 * Category page for 2-level navigation: main/sub
 * Redirects to /deals with appropriate query params
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, mainSlug, subSlug } = await params;
  
  // Redirect to deals page with category filters
  redirect(`/${locale}/deals?mainCategory=${mainSlug}&subCategory=${subSlug}`);
}
