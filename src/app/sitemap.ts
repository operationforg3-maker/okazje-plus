import type { MetadataRoute } from 'next';
import { getRecommendedProducts, getCategories } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';

// Sitemap builds only Polish canonical URLs.
// Polish is the sole indexed locale (other locales are noindex).
// All URLs use the /pl/ prefix matching localePrefix: 'always' config.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl').replace(/\/$/, '');
  const plBase = `${baseUrl}/pl`;
  
  // Static pages — all under /pl/ (canonical locale)
  const staticPages: { route: string; changeFrequency: 'hourly' | 'daily' | 'weekly'; priority: number }[] = [
    { route: '', changeFrequency: 'hourly', priority: 1 },
    { route: '/deals', changeFrequency: 'hourly', priority: 0.9 },
    { route: '/products', changeFrequency: 'daily', priority: 0.9 },
    { route: '/leaderboard', changeFrequency: 'daily', priority: 0.6 },
    { route: '/forum', changeFrequency: 'daily', priority: 0.7 },
    { route: '/regulamin', changeFrequency: 'weekly', priority: 0.3 },
    { route: '/polityka-prywatnosci', changeFrequency: 'weekly', priority: 0.3 },
  ];

  const staticUrls = staticPages.map((page) => ({
    url: `${plBase}${page.route}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Category pages
  let categoryUrls: MetadataRoute.Sitemap = [];
  try {
    const categories = await getCategories();
    for (const cat of categories) {
      categoryUrls.push({
        url: `${plBase}/categories/${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      });
      for (const sub of cat.subcategories ?? []) {
        categoryUrls.push({
          url: `${plBase}/categories/${cat.slug}/${sub.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.55,
        });
      }
    }
  } catch (error) {
    console.error('Error fetching categories for sitemap:', error);
  }

  // Dynamic deals — top 1000 hottest
  let dealUrls: MetadataRoute.Sitemap = [];
  try {
    const deals = await searchDealsTypesense('*', {
      limit: 1000,
      sortBy: 'hot',
      statusFilter: 'approved',
    });
    dealUrls = deals.map((deal) => ({
      url: `${plBase}/deals/${deal.id}`,
      lastModified: deal.updatedAt ? new Date(deal.updatedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Error fetching deals for sitemap:', error);
  }

  // Dynamic products — top 1000 recommended
  let productUrls: MetadataRoute.Sitemap = [];
  try {
    const products = await getRecommendedProducts(1000);
    productUrls = products.map((product) => ({
      url: `${plBase}/products/${product.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  return [...staticUrls, ...categoryUrls, ...dealUrls, ...productUrls];
}
