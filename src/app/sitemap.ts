import type { MetadataRoute } from 'next';
import { getRecommendedProducts, getCategories, getAllProductCores } from '@/lib/data';
import { searchDeals } from '@/lib/search-server';
import { getGoogleProductPublicationState } from '@/lib/google-product-publication';
import { getAllApprovedProductsForSitemap } from '@/lib/data-admin';

// Sitemap fetches up to ~3000 records from Firebase/Typesense — must be dynamic (not statically generated at build time)
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl').replace(/\/$/, '');
  
  // Static pages — all under /pl/ (canonical locale)
  const staticPages: { route: string; changeFrequency: 'hourly' | 'daily' | 'weekly'; priority: number }[] = [
    { route: '', changeFrequency: 'hourly', priority: 1 },
    { route: '/deals', changeFrequency: 'hourly', priority: 0.9 },
    { route: '/products', changeFrequency: 'daily', priority: 0.9 },
    { route: '/leaderboard', changeFrequency: 'daily', priority: 0.6 },
    { route: '/forum', changeFrequency: 'daily', priority: 0.7 },
    { route: '/regulamin', changeFrequency: 'weekly', priority: 0.3 },
    { route: '/polityka-prywatnosci', changeFrequency: 'weekly', priority: 0.3 },
    { route: '/polityka-zwrotow', changeFrequency: 'weekly', priority: 0.3 },
  ];

  const staticUrls = SUPPORTED_LOCALES.flatMap((locale) => {
    const localizedBase = `${baseUrl}/${locale}`;
    return staticPages.map((page) => ({
      url: `${localizedBase}${page.route}`,
      lastModified: new Date(),
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
        categoryUrls.push({
          url: `${baseUrl}/${locale}/categories/${cat.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        });

        for (const sub of cat.subcategories ?? []) {
          categoryUrls.push({
            url: `${baseUrl}/${locale}/categories/${cat.slug}/${sub.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.55,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching categories for sitemap:', error);
  }

  // Dynamic deals — top 1000 hottest
  let dealUrls: MetadataRoute.Sitemap = [];
  try {
    const deals = await searchDeals('*', {
      limit: 1000,
      sortBy: 'hot',
      statusFilter: 'approved',
    });
    dealUrls = SUPPORTED_LOCALES.flatMap((locale) =>
      deals.map((deal) => ({
        url: `${baseUrl}/${locale}/deals/${deal.id}`,
        lastModified: deal.updatedAt ? new Date(deal.updatedAt) : new Date(),
        changeFrequency: 'hourly' as const,                             // ← zmiana z 'daily'
        priority: 0.8,
      }))
    );
  } catch (error) {
    console.error('Error fetching deals for sitemap:', error);
  }

  // Dynamic products — all approved up to 50000
  let productUrls: MetadataRoute.Sitemap = [];
  try {
    const products = await getAllApprovedProductsForSitemap(50000);
    const eligibleProducts = products.filter((product) =>
      getGoogleProductPublicationState({
        product,
        isM6: true,
        deals: [],
      }).eligible
    );
    productUrls = SUPPORTED_LOCALES.flatMap((locale) =>
      eligibleProducts.map((product) => ({
        url: `${baseUrl}/${locale}/products/${product.id}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
        changeFrequency: 'hourly' as const,                             // ← zmiana z 'weekly'
        priority: 0.7,
      }))
    );
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  // Dedicated watch pages for products with video
  let productWatchUrls: MetadataRoute.Sitemap = [];
  try {
    const productCores = await getAllProductCores('approved', 1000);
    const withVideo = productCores.filter((product: any) => {
      const publicationState = getGoogleProductPublicationState({
        product,
        isM6: true,
        deals: [],
      });

      if (!publicationState.eligible) {
        return false;
      }

      if (typeof product?.videoUrl === 'string' && product.videoUrl.trim().length > 0) {
        return true;
      }

      if (Array.isArray(product?.gallery)) {
        return product.gallery.some((item: any) => item?.type === 'VIDEO' && typeof item?.url === 'string' && item.url.trim().length > 0);
      }

      return false;
    });

    productWatchUrls = SUPPORTED_LOCALES.flatMap((locale) =>
      withVideo.map((product: any) => ({
        url: `${baseUrl}/${locale}/watch/products/${product.id}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
        changeFrequency: 'hourly' as const,                             // ← zmiana z 'weekly'
        priority: 0.65,
      }))
    );
  } catch (error) {
    console.error('Error fetching product watch pages for sitemap:', error);
  }

  return [...staticUrls, ...categoryUrls, ...dealUrls, ...productUrls, ...productWatchUrls];
}
