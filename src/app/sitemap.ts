import type { MetadataRoute } from 'next';
import { getCategories } from '@/lib/data';
import { adminDb } from '@/lib/firebase-admin';
import { getGoogleProductPublicationState } from '@/lib/google-product-publication';
import { getAllApprovedProductsForSitemap } from '@/lib/data-admin';

// Sitemap must be dynamic — fetches live data from Firestore
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl').replace(/\/$/, '');

// All supported locales
const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

/**
 * Generate sitemap index with multiple sitemaps.
 * Next.js will call sitemap() for each id returned here,
 * producing /sitemap/0.xml, /sitemap/1.xml, etc.
 */
export async function generateSitemaps() {
  return [
    { id: 0 }, // static pages + categories
    { id: 1 }, // deals
    { id: 2 }, // products
  ];
}

// Fixed date for truly static pages (legal, etc.) — avoids signaling false freshness to Google
const STATIC_PAGES_LAST_MODIFIED = new Date('2026-06-01');

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 0:
      return generateStaticAndCategorySitemap();
    case 1:
      return generateDealsSitemap();
    case 2:
      return generateProductsSitemap();
    default:
      return [];
  }
}

/**
 * Sitemap 0: Static pages + category pages
 */
async function generateStaticAndCategorySitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: {
    route: string;
    changeFrequency: 'hourly' | 'daily' | 'weekly';
    priority: number;
    lastModified: Date;
  }[] = [
    { route: '', changeFrequency: 'hourly', priority: 1, lastModified: new Date() },
    { route: '/deals', changeFrequency: 'hourly', priority: 0.9, lastModified: new Date() },
    { route: '/products', changeFrequency: 'daily', priority: 0.9, lastModified: new Date() },
    { route: '/leaderboard', changeFrequency: 'daily', priority: 0.6, lastModified: new Date() },
    { route: '/forum', changeFrequency: 'daily', priority: 0.7, lastModified: new Date() },
    { route: '/regulamin', changeFrequency: 'weekly', priority: 0.3, lastModified: STATIC_PAGES_LAST_MODIFIED },
    { route: '/polityka-prywatnosci', changeFrequency: 'weekly', priority: 0.3, lastModified: STATIC_PAGES_LAST_MODIFIED },
    { route: '/polityka-zwrotow', changeFrequency: 'weekly', priority: 0.3, lastModified: STATIC_PAGES_LAST_MODIFIED },
  ];

  const staticUrls: MetadataRoute.Sitemap = SUPPORTED_LOCALES.flatMap(locale => {
    const localizedBase = `${BASE_URL}/${locale}`;
    return staticPages.map((page) => ({
      url: `${localizedBase}${page.route}`,
      lastModified: page.lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }));
  });

  // Category pages
  let categoryUrls: MetadataRoute.Sitemap = [];
  try {
    const categories = await getCategories();
    for (const cat of categories) {
      for (const locale of SUPPORTED_LOCALES) {
        const localizedBase = `${BASE_URL}/${locale}`;
        categoryUrls.push({
          url: `${localizedBase}/categories/${cat.slug}`,
          lastModified: STATIC_PAGES_LAST_MODIFIED,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        });

        for (const sub of cat.subcategories ?? []) {
          categoryUrls.push({
            url: `${localizedBase}/categories/${cat.slug}/${sub.slug}`,
            lastModified: STATIC_PAGES_LAST_MODIFIED,
            changeFrequency: 'weekly' as const,
            priority: 0.55,
          });
        }
      }
    }
  } catch (error) {
    console.error('[sitemap:0] Error fetching categories:', error);
  }

  return [...staticUrls, ...categoryUrls];
}

function parseLastModified(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val === 'object' && typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  return new Date();
}

/**
 * Sitemap 1: Deal pages — top 5000 hottest approved deals
 */
async function generateDealsSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    let dealsSnap;
    try {
      dealsSnap = await adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .orderBy('temperature', 'desc')
        .limit(5000)
        .get();
    } catch (e) {
      dealsSnap = await adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .limit(5000)
        .get();
    }

    const deals = dealsSnap.docs.map((doc) => ({
      id: doc.id,
      updatedAt: doc.data().updatedAt,
    }));

    return SUPPORTED_LOCALES.flatMap(locale => {
      const localizedBase = `${BASE_URL}/${locale}`;
      return deals.map((deal) => ({
        url: `${localizedBase}/deals/${deal.id}`,
        lastModified: parseLastModified(deal.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }));
    });
  } catch (error) {
    console.error('[sitemap:1] Error fetching deals:', error);
    return [];
  }
}

/**
 * Sitemap 2: Product pages — all approved products eligible for Google
 */
async function generateProductsSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const products = await getAllApprovedProductsForSitemap(5000);

    return SUPPORTED_LOCALES.flatMap(locale => {
      const localizedBase = `${BASE_URL}/${locale}`;
      return products.map((product) => ({
        url: `${localizedBase}/products/${product.id}`,
        lastModified: parseLastModified(product.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    });
  } catch (error) {
    console.error('[sitemap:2] Error fetching products:', error);
    return [];
  }
}
