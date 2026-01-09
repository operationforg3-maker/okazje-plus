import { getRequestConfig } from 'next-intl/server';
import { config } from '../i18n.config';
import { messagesByLocale } from './lib/messages-loader';
import type { Locale } from '../i18n.config';

export default getRequestConfig(async ({ locale }: { locale: string }) => {
  // During static generation, locale might be undefined - provide defaults
  const safeLocale = locale || config.defaultLocale;

  if (!config.locales.includes(safeLocale as Locale)) {
    throw new Error(`Invalid locale: ${safeLocale}`);
  }

  const messages = (messagesByLocale[safeLocale as keyof typeof messagesByLocale] || messagesByLocale.pl) as Record<string, Record<string, string>>;

  const mergedMessages: Record<string, Record<string, unknown>> = {};
  for (const namespace of config.namespaces) {
    mergedMessages[namespace] = messages[namespace as keyof typeof messages] || {};
  }

  return {
    locale: safeLocale,
    messages: mergedMessages,
    timeZone: 'Europe/Warsaw',
    now: new Date(),
  };
});
