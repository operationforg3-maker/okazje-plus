import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
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

  return staticPages.map((page) => ({
    url: `${baseUrl}${page.route}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
