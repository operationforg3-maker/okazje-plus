import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {locales, defaultLocale} from './i18n';

const intlMiddleware = createMiddleware({
  // Supported locales
  locales,
  // Default when no locale matches
  defaultLocale,
  // Require locale prefix always
  localePrefix: 'always',
});

export default function middleware(request: NextRequest) {
  const {nextUrl} = request;
  const {pathname, search} = nextUrl;

  // Redirect non-PL locales to PL equivalent path (temporary 302)
  if (/^\/(en|de)(\/|$)/.test(pathname)) {
    const plPath = pathname.replace(/^\/(en|de)/, '/pl');
    const url = new URL(plPath + search, nextUrl.origin);
    return NextResponse.redirect(url, 302);
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - API routes (/api/...)
  // - Static files (/_next/static/...)
  // - Image optimization files (/_next/image/...)
  // - Favicon, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
