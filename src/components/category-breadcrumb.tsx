'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

interface CategoryBreadcrumbProps {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  className?: string;
  contextType?: 'products' | 'deals';
}

interface CategoryLabel {
  pl: string;
  en: string;
  de: string;
}

/**
 * Renders a 3-level category breadcrumb with translations
 * Fetches labels from Firestore categories collection on client
 */
export function CategoryBreadcrumb({
  mainCategorySlug,
  subCategorySlug,
  subSubCategorySlug,
  className = '',
  contextType = 'deals',
}: CategoryBreadcrumbProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  
  // Determine route prefix based on context
  const routePrefix = contextType === 'products' ? 'products' : 'deals';
  
  const [labels, setLabels] = useState<{
    main?: CategoryLabel;
    sub?: CategoryLabel;
    subsub?: CategoryLabel;
  }>({});
  
  const [isLoading, setIsLoading] = useState(!!mainCategorySlug);

  useEffect(() => {
    if (!mainCategorySlug) return;

    const loadLabels = async () => {
      try {
        setIsLoading(true);
        const newLabels: typeof labels = {};

        // Load main category
        if (mainCategorySlug) {
          const mainDoc = await getDoc(doc(db, 'categories', mainCategorySlug));
          if (mainDoc.exists()) {
            const data = mainDoc.data();
            newLabels.main = {
              pl: data.name || mainCategorySlug,
              en: data.translations?.en?.name || data.name || mainCategorySlug,
              de: data.translations?.de?.name || data.name || mainCategorySlug,
            };
          }
        }

        // Load sub category
        if (mainCategorySlug && subCategorySlug) {
          const subDoc = await getDoc(
            doc(db, 'categories', mainCategorySlug, 'subcategories', subCategorySlug)
          );
          if (subDoc.exists()) {
            const data = subDoc.data();
            newLabels.sub = {
              pl: data.name || subCategorySlug,
              en: data.translations?.en?.name || data.name || subCategorySlug,
              de: data.translations?.de?.name || data.name || subCategorySlug,
            };
          }
        }

        // Load sub-sub category
        if (mainCategorySlug && subCategorySlug && subSubCategorySlug) {
          const subSubDoc = await getDoc(
            doc(
              db,
              'categories',
              mainCategorySlug,
              'subcategories',
              subCategorySlug,
              'subcategories',
              subSubCategorySlug
            )
          );
          if (subSubDoc.exists()) {
            const data = subSubDoc.data();
            newLabels.subsub = {
              pl: data.name || subSubCategorySlug,
              en: data.translations?.en?.name || data.name || subSubCategorySlug,
              de: data.translations?.de?.name || data.name || subSubCategorySlug,
            };
          }
        }

        setLabels(newLabels);
      } catch (error) {
        console.error('Failed to load category labels:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLabels();
  }, [mainCategorySlug, subCategorySlug, subSubCategorySlug]);

  if (!mainCategorySlug) return null;

  // Get text for current locale
  const getText = (label?: CategoryLabel) => {
    if (!label) return '';
    return label[locale as keyof CategoryLabel] || label.pl;
  };

  return (
    <div
      className={`flex items-center gap-1 text-xs sm:text-sm text-muted-foreground ${className}`}
      role="navigation"
      aria-label="Category breadcrumb"
    >
      {/* Main category */}
      <Link
        href={`/${locale}/${routePrefix}?category=${mainCategorySlug}`}
        className="hover:text-foreground transition-colors truncate"
        title={getText(labels.main)}
      >
        {getText(labels.main) || mainCategorySlug}
      </Link>

      {/* Sub category */}
      {subCategorySlug && (
        <>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <Link
            href={`/${locale}/${routePrefix}?category=${mainCategorySlug}&sub=${subCategorySlug}`}
            className="hover:text-foreground transition-colors truncate"
            title={getText(labels.sub)}
          >
            {getText(labels.sub) || subCategorySlug}
          </Link>
        </>
      )}

      {/* Sub-sub category */}
      {subSubCategorySlug && (
        <>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <Link
            href={`/${locale}/${routePrefix}?category=${mainCategorySlug}&sub=${subCategorySlug}&subsub=${subSubCategorySlug}`}
            className="hover:text-foreground transition-colors truncate"
            title={getText(labels.subsub)}
          >
            {getText(labels.subsub) || subSubCategorySlug}
          </Link>
        </>
      )}
    </div>
  );
}
