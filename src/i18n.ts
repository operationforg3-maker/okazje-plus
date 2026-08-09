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
  'savedSearch',
];

async function loadMessagesForLocale(locale: string) {
  const messages: Record<string, any> = {};

  for (const ns of namespaces) {
    let baseMod: any = {};
    let localeMod: any = {};

    try {
      const mod = await import(`../messages/${ns}.json`);
      baseMod = mod.default || {};
    } catch {}

    if (locale !== 'pl') {
      try {
        const mod = await import(`../messages/${ns}.${locale}.json`);
        localeMod = mod.default || {};
      } catch {}
    } else {
      try {
        const mod = await import(`../messages/${ns}.pl.json`);
        localeMod = mod.default || {};
      } catch {}
    }

    messages[ns] = { ...baseMod, ...localeMod };
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
