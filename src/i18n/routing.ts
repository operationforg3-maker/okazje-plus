import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { config } from '../../i18n.config';

export const routing = defineRouting({
  locales: config.locales,
  defaultLocale: config.defaultLocale,
  localePrefix: 'always', // Always include locale in URL
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(
  routing
);
