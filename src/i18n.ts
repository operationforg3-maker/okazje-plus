import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './i18n/routing';

export default getRequestConfig(async ({requestLocale}) => {
  // Wait for the promise to resolve
  const requested = await requestLocale;
  
  // Validate and provide a fallback locale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
