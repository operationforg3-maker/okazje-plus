import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './i18n/routing';

const namespaces = [
  'home',
  'adminSetup',
  'cart',
  'search',
  'deals',
  'products',
  'login',
  'forum',
  'profile',
  'addDeal',
  'leaderboard',
  'admin',
  'adminImports',
  'common',
  'nav',
  'filters',
  'footer',
];

async function loadMessagesForLocale(locale: string) {
  const messages: Record<string, any> = {};

  for (const ns of namespaces) {
    const filename = locale === 'pl'
      ? `${ns}.json`
      : `${ns}.${locale}.json`;

    try {
      // Dynamic import keeps us compatible with the Edge runtime (no fs/path/process)
      const mod = await import(`../messages/${filename}`);
      messages[ns] = mod.default;
    } catch (error) {
      // If a namespace is missing, skip it to avoid breaking the whole app.
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing messages for ${ns} (${locale}) at messages/${filename}`);
      }
    }
  }

  return messages;
}

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;

  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = await loadMessagesForLocale(locale);

  return {
    locale,
    messages,
  };
});
