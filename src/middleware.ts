import createMiddleware from 'next-intl/middleware';
import {locales, defaultLocale} from './i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Use 'as-needed' - show prefix only for non-default locales
  // Polish (pl) will be accessible at / and /pl
  // English and German require /en and /de
  localePrefix: 'as-needed',
  
  // Automatically detect user locale from Accept-Language header
  localeDetection: true,
});

export const config = {
  // Match all pathnames except for
  // - API routes (/api/...)
  // - Static files (/_next/static/...)
  // - Image optimization files (/_next/image/...)
  // - Favicon, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
