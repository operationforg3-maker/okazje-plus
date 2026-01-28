import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Since only PL is active, next-intl middleware handles all routing
  // No need for manual redirects
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - API routes (/api/...)
  // - Static files (/_next/static/...)
  // - Image optimization files (/_next/image/...)
  // - Favicon, etc.
  matcher: ['/((?!api|_next|_vercel|favicon|robots|.*\\..*).*)'],
};
