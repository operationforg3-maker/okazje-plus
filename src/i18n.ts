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
];

async function loadMessagesForLocale(locale: string) {
  const messages: Record<string, any> = {};

  for (const ns of namespaces) {
    const path = locale === 'pl'
      ? `../messages/${ns}.json`
      : `../messages/${ns}.${locale}.json`;

    try {
      messages[ns] = (await import(path)).default;
    } catch (error) {
      // If a namespace is missing, skip it to avoid breaking the whole app.
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing messages for ${ns} (${locale}) at ${path}`);
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
