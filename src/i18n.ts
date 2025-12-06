import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './i18n/routing';
import path from 'path';
import { readFileSync } from 'fs';

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
    const filename = locale === 'pl'
      ? `${ns}.json`
      : `${ns}.${locale}.json`;
    
    const filepath = path.join(process.cwd(), 'messages', filename);

    try {
      const fileContent = readFileSync(filepath, 'utf-8');
      messages[ns] = JSON.parse(fileContent);
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
