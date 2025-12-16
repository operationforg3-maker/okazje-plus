import type { MetadataRoute } from 'next';
import { getHotDeals } from '@/lib/data';
import { getRecommendedProducts } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';
  
  // Static pages
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
    url: `${baseUrl}${page.route}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Dynamic deals - top 1000 hottest
  let dealUrls: MetadataRoute.Sitemap = [];
  try {
    const deals = await getHotDeals(1000);
    dealUrls = deals.map((deal) => ({
      url: `${baseUrl}/deals/${deal.id}`,
      lastModified: deal.updatedAt ? new Date(deal.updatedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Error fetching deals for sitemap:', error);
  }

  // Dynamic products - top 1000 recommended
  let productUrls: MetadataRoute.Sitemap = [];
  try {
    const products = await getRecommendedProducts(1000);
    productUrls = products.map((product) => ({
      url: `${baseUrl}/products/${product.id}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  return [...staticUrls, ...dealUrls, ...productUrls];
}
