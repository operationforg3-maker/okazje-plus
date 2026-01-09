import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMessages } from 'next-intl/server';
import { config } from '../../../i18n.config';
import { IntlProvider } from '@/components/intl-provider';
import '../globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const isValidLocale = config.locales.includes(locale as any);

  const titles: Record<string, string> = {
    pl: 'Okazje Plus - Odkryj najlepsze oferty',
    en: 'Okazje Plus - Discover the best deals',
    de: 'Okazje Plus - Entdecken Sie die besten Angebote',
  };

  const descriptions: Record<string, string> = {
    pl: 'Platforma porównywania cen produktów z AI-powered wyszukiwaniem i analizą ofert ze sklepów online na całym świecie.',
    en: 'Product price comparison platform with AI-powered search and analysis of online store offers from around the world.',
    de: 'Produktpreisvergleichsplattform mit KI-gestützter Suche und Analyse von Online-Shop-Angeboten weltweit.',
  };

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    metadataBase: new URL('https://okazje-plus.web.app'),
    openGraph: {
      title: titles[locale] || titles.en,
      description: descriptions[locale] || descriptions.en,
      url: `https://okazje-plus.web.app/${locale}`,
      siteName: 'Okazje Plus',
      type: 'website',
    },
  };
}

export function generateStaticParams() {
  return config.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!config.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
        <meta name="theme-color" content="#357D58" />
      </head>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors">
        <IntlProvider locale={locale} messages={messages}>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
