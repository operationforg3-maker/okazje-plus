'use client';

import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

interface IntlProviderProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

export function IntlProvider({
  children,
  locale,
  messages,
}: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
