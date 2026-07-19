import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // API & framework internals
          '/api/',
          '/_next/',
          // Admin panel
          '/*/admin/',
          // Internal/preview routes — noindex via meta, but save crawl budget too
          '/*/preview/',
          '/*/new-ux/',
          '/*/test-products2/',
          // User-specific pages (no SEO value)
          '/*/login/',
          '/*/activate/',
          '/*/profile/',
          '/*/cart/',
          '/*/add-deal/',
          '/*/analytics/',
          // Search pages (noindex via layout, but also block crawl)
          '/*/search/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
