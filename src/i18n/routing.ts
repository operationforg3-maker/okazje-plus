import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['pl', 'en', 'de', 'fr', 'es', 'uk'],
  defaultLocale: 'pl',
  localePrefix: 'always',
  localeDetection: false,
});

export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);
