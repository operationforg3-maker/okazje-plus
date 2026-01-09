export const locales = ['pl', 'en', 'de'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pl';

export const config = {
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  defaultNS: 'common',
  namespaces: ['common', 'home', 'auth', 'admin'],
} as const;
