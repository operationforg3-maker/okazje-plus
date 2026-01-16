import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    mainSlug: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, mainSlug } = await params;
  
  return {
    title: `${mainSlug} - Okazje`,
    description: `Przeglądaj oferty w kategorii ${mainSlug}`,
  };
}

/**
 * Category page for main category
 * Redirects to /deals with appropriate query params
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, mainSlug } = await params;
  
  // Redirect to deals page with category filters
  redirect(`/${locale}/deals?mainCategory=${mainSlug}`);
}
