import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';

// Supported locales
export const locales = ['pl', 'en', 'de'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'pl';

export default getRequestConfig(async ({requestLocale}) => {
  // Wait for the promise to resolve
  let locale = await requestLocale;
  
  // Provide a fallback locale if needed
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
    locale,
  };
});
