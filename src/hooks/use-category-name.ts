'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface CategoryLabel {
  pl: string;
  en: string;
  de: string;
}

/**
 * Hook to fetch and display localized category name from slug
 * Handles main, sub, and sub-sub category slugs
 */
export function useCategoryName(
  mainCategorySlug?: string | null,
  subCategorySlug?: string | null,
  subSubCategorySlug?: string | null
) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  
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

  // Get text for current locale
  const getText = (label?: CategoryLabel) => {
    if (!label) return '';
    return label[locale as keyof CategoryLabel] || label.pl;
  };

  // Return localized names with fallback to slugs
  return {
    mainName: getText(labels.main) || mainCategorySlug || '',
    subName: getText(labels.sub) || subCategorySlug || '',
    subSubName: getText(labels.subsub) || subSubCategorySlug || '',
    isLoading,
    getText,
    labels,
  };
}
