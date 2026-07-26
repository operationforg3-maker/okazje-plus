import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Legacy admin routes (/admin/*) are outdated and must be served from locale-aware panel.
  // Force redirect so users always land on current, maintained admin UI.
  const { pathname, search } = request.nextUrl;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const target = request.nextUrl.clone();
    target.pathname = `/pl${pathname}`;
    target.search = search;
    return NextResponse.redirect(target);
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - API routes (/api/...)
  // - Static files (/_next/static/...)
  // - Image optimization files (/_next/image/...)
  // - Favicon, robots, sitemap, etc.
  matcher: ['/((?!api|_next|_vercel|favicon|robots|sitemap|.*\\..*).*)'],
};
