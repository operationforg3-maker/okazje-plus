import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCategories } from '@/lib/data';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const BASE_URL = 'https://okazjeplus.pl';
const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;
const CHUNK_SIZE = 2500;
const SITEMAP_CACHE_TTL = 3600; // 1 hour

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

interface SitemapUrlItem {
  path: string; // e.g. "/deals/123" or "/products/456" or "/categories/elektronika"
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

function buildSitemapXmlWithAlternates(items: SitemapUrlItem[]): string {
  const urlEntries = items.map((item) => {
    const loc = `${BASE_URL}/pl${item.path}`;
    const alternates = [
      ...SUPPORTED_LOCALES.map(
        (locCode) => `    <xhtml:link rel="alternate" hreflang="${locCode}" href="${BASE_URL}/${locCode}${item.path}"/>`
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/pl${item.path}"/>`,
    ].join('\n');

    return `  <url>
    <loc>${loc}</loc>
${alternates}
    <lastmod>${item.lastmod || new Date().toISOString()}</lastmod>
    <changefreq>${item.changefreq || 'daily'}</changefreq>
    <priority>${item.priority ?? 0.7}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sitemapId = id.replace(/\.xml$/, '');

  const cacheKey = `sitemap:sub:${sitemapId}:v2`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  let items: SitemapUrlItem[] = [];

  try {
    if (sitemapId === '0') {
      // 1. Static pages
      const staticPages = [
        { path: '', priority: 1.0 },
        { path: '/deals', priority: 0.9 },
        { path: '/products', priority: 0.9 },
        { path: '/leaderboard', priority: 0.7 },
        { path: '/forum', priority: 0.7 },
        { path: '/regulamin', priority: 0.4 },
        { path: '/polityka-prywatnosci', priority: 0.4 },
        { path: '/polityka-zwrotow', priority: 0.4 },
      ];

      for (const p of staticPages) {
        items.push({
          path: p.path,
          priority: p.priority,
          changefreq: 'daily',
        });
      }

      // 2. Categories & Subcategories
      try {
        const categories = await getCategories();
        for (const cat of categories) {
          items.push({
            path: `/categories/${cat.slug}`,
            priority: 0.8,
            changefreq: 'daily',
          });
          for (const sub of cat.subcategories ?? []) {
            items.push({
              path: `/categories/${cat.slug}/${sub.slug}`,
              priority: 0.75,
              changefreq: 'daily',
            });
            for (const subSub of (sub as any).subcategories ?? []) {
              items.push({
                path: `/categories/${cat.slug}/${sub.slug}/${subSub.slug}`,
                priority: 0.7,
                changefreq: 'weekly',
              });
            }
          }
        }
      } catch (e) {
        console.error('Error fetching categories for sitemap 0:', e);
      }

    } else if (sitemapId.startsWith('deals') || sitemapId === '1') {
      // Deals chunk: deals-1, deals-2, ... or legacy 1
      const pageNumber = sitemapId === '1' ? 1 : parseInt(sitemapId.replace('deals-', ''), 10) || 1;
      const offset = (pageNumber - 1) * CHUNK_SIZE;

      let query = adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .select('updatedAt');

      if (offset > 0) {
        query = query.offset(offset);
      }

      const snap = await query.limit(CHUNK_SIZE).get();

      for (const doc of snap.docs) {
        const d = doc.data();
        items.push({
          path: `/deals/${doc.id}`,
          lastmod: parseLastModified(d.updatedAt),
          priority: 0.8,
          changefreq: 'daily',
        });
      }

    } else if (sitemapId.startsWith('products') || sitemapId === '2') {
      // Products chunk: products-1, products-2, ... or legacy 2
      const pageNumber = sitemapId === '2' ? 1 : parseInt(sitemapId.replace('products-', ''), 10) || 1;
      const offset = (pageNumber - 1) * CHUNK_SIZE;

      let query = adminDb
        .collection('product_cores')
        .where('status', '==', 'approved')
        .select('updatedAt');

      if (offset > 0) {
        query = query.offset(offset);
      }

      const snap = await query.limit(CHUNK_SIZE).get();

      for (const doc of snap.docs) {
        const p = doc.data();
        items.push({
          path: `/products/${doc.id}`,
          lastmod: parseLastModified(p.updatedAt),
          priority: 0.85,
          changefreq: 'daily',
        });
      }
    }

    const xml = buildSitemapXmlWithAlternates(items);
    await cacheSet(cacheKey, xml, SITEMAP_CACHE_TTL);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error(`Error generating sitemap for ${id}:`, error);
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}
