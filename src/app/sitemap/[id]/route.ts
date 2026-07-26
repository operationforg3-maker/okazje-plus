import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCategories } from '@/lib/data';
import { getAllApprovedProductsForSitemap } from '@/lib/data-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const BASE_URL = 'https://okazjeplus.pl';
const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

function parseLastModified(val: any): string {
  let d: Date;
  if (!val) d = new Date();
  else if (val instanceof Date) d = val;
  else if (typeof val === 'string' || typeof val === 'number') {
    d = new Date(val);
    if (isNaN(d.getTime())) d = new Date();
  } else if (typeof val === 'object' && typeof val.toDate === 'function') {
    d = val.toDate();
  } else if (typeof val === 'object' && typeof val._seconds === 'number') {
    d = new Date(val._seconds * 1000);
  } else {
    d = new Date();
  }
  return d.toISOString();
}

function buildSitemapXml(urls: { url: string; lastmod?: string; changefreq?: string; priority?: number }[]): string {
  const urlEntries = urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastmod || new Date().toISOString()}</lastmod>
    <changefreq>${u.changefreq || 'daily'}</changefreq>
    <priority>${u.priority ?? 0.7}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sitemapId = id.replace(/\.xml$/, '');

  let urls: { url: string; lastmod?: string; changefreq?: string; priority?: number }[] = [];

  if (sitemapId === '0') {
    // Static pages
    const staticPages = ['', '/deals', '/products', '/leaderboard', '/forum', '/regulamin', '/polityka-prywatnosci', '/polityka-zwrotow'];
    for (const locale of SUPPORTED_LOCALES) {
      for (const route of staticPages) {
        urls.push({
          url: `${BASE_URL}/${locale}${route}`,
          priority: route === '' ? 1.0 : 0.8,
          changefreq: 'daily',
        });
      }
    }

    // Categories
    try {
      const categories = await getCategories();
      for (const cat of categories) {
        for (const locale of SUPPORTED_LOCALES) {
          urls.push({
            url: `${BASE_URL}/${locale}/categories/${cat.slug}`,
            priority: 0.6,
            changefreq: 'weekly',
          });
          for (const sub of cat.subcategories ?? []) {
            urls.push({
              url: `${BASE_URL}/${locale}/categories/${cat.slug}/${sub.slug}`,
              priority: 0.55,
              changefreq: 'weekly',
            });
          }
        }
      }
    } catch (e) {
      console.error('Error fetching categories for sitemap 0:', e);
    }

  } else if (sitemapId === '1') {
    // Deals
    try {
      let snap;
      try {
        snap = await adminDb.collection('deals').where('status', '==', 'approved').orderBy('temperature', 'desc').limit(5000).get();
      } catch (e) {
        snap = await adminDb.collection('deals').where('status', '==', 'approved').limit(5000).get();
      }
      for (const doc of snap.docs) {
        const d = doc.data();
        const lm = parseLastModified(d.updatedAt);
        for (const locale of SUPPORTED_LOCALES) {
          urls.push({
            url: `${BASE_URL}/${locale}/deals/${doc.id}`,
            lastmod: lm,
            priority: 0.8,
            changefreq: 'daily',
          });
        }
      }
    } catch (e) {
      console.error('Error fetching deals for sitemap 1:', e);
    }

  } else if (sitemapId === '2') {
    // Products
    try {
      const products = await getAllApprovedProductsForSitemap(5000);
      for (const p of products) {
        const lm = parseLastModified(p.updatedAt);
        for (const locale of SUPPORTED_LOCALES) {
          urls.push({
            url: `${BASE_URL}/${locale}/products/${p.id}`,
            lastmod: lm,
            priority: 0.7,
            changefreq: 'daily',
          });
        }
      }
    } catch (e) {
      console.error('Error fetching products for sitemap 2:', e);
    }
  }

  const xml = buildSitemapXml(urls);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
