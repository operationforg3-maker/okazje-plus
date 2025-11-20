import createMiddleware from 'next-intl/middleware';
import {locales, defaultLocale} from './i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Use 'always' - all locales require prefix
  // Polish: /pl/, English: /en/, German: /de/
  localePrefix: 'always',
  
  // Force Polish for now regardless of Accept-Language
  localeDetection: false,
});

export const config = {
  // Match all pathnames except for
  // - API routes (/api/...)
  // - Static files (/_next/static/...)
  // - Image optimization files (/_next/image/...)
  // - Favicon, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
