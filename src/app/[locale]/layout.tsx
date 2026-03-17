import type { Metadata } from 'next';
import Script from 'next/script';
import '../globals.css';
import { ConditionalNav } from '@/components/layout/conditional-nav';
import { AuthProvider } from '@/lib/auth';
import { SmartCartProvider } from '@/lib/cart-context';
import { CurrencyProvider } from '@/context/currency-context';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import ErrorBoundary from '@/components/auth/error-boundary';
import { generateOrganizationJsonLd, generateWebSiteJsonLd } from '@/lib/json-ld-generators';
import { DeferredClientWidgets } from '@/components/layout/deferred-client-widgets';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';

const LOCALE_CONFIG: Record<string, { path: string; ogLocale: string }> = {
  pl: { path: '/pl/', ogLocale: 'pl_PL' },
  en: { path: '/en/', ogLocale: 'en_US' },
  de: { path: '/de/', ogLocale: 'de_DE' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const finalLocale = locale || 'pl';
  const config = LOCALE_CONFIG[finalLocale] ?? LOCALE_CONFIG.pl;
  const canonical = `${SITE_URL}${config.path}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: 'Okazje+ - Najlepsze okazje zakupowe w Polsce',
      template: '%s | Okazje+'
    },
    description: 'Odkryj najlepsze okazje zakupowe, promocje i wyprzedaże. Społeczność Okazje+ dzieli się najgorętszymi ofertami i cenami produktów.',
    keywords: ['okazje', 'promocje', 'wyprzedaże', 'zakupy online', 'najlepsze ceny', 'rabaty', 'kupony'],
    authors: [{ name: 'Okazje+' }],
    creator: 'Okazje+',
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      other: {
        'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || '',
        'convertiser-verification': '3bc0a4fd6e7289720f9c2784de4b87f345bcca47',
      },
    },
    openGraph: {
      type: 'website',
      locale: config.ogLocale,
      url: canonical,
      siteName: 'Okazje+',
      title: 'Okazje+ - Najlepsze okazje zakupowe w Polsce',
      description: 'Odkryj najlepsze okazje zakupowe, promocje i wyprzedaże. Społeczność Okazje+ dzieli się najgorętszymi ofertami i cenami produktów.',
      images: [
        {
          url: '/Logotyp_okazjePlus.png',
          width: 1200,
          height: 630,
          alt: 'Okazje+ - Najlepsze okazje zakupowe',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Okazje+ - Najlepsze okazje zakupowe w Polsce',
      description: 'Odkryj najlepsze okazje zakupowe, promocje i wyprzedaże',
      images: ['/Logotyp_okazjePlus.png'],
    },
    icons: {
      icon: '/icon_okazjeplus.svg',
      apple: '/icon_okazjeplus.png',
    },
    robots: {
      index: finalLocale === 'pl',
      follow: true,
    },
    alternates: {
      canonical,
      // Only declare x-default; individual language alternates are omitted
      // because non-pl locales serve duplicate Polish content — exposing them
      // as hreflang targets causes Google to crawl & duplicate-flag those pages.
      languages: {
        'x-default': `${SITE_URL}/pl/`,
      },
      types: {
        'application/rss+xml': `${SITE_URL}/rss.xml`,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const effectiveLocale = locale || 'pl';
  const messages = await getMessages();
  const websiteJsonLd = generateWebSiteJsonLd();
  const organizationJsonLd = generateOrganizationJsonLd();
  
  return (
    <>
      {/* Structured Data - WebSite Schema - beforeInteractive for better indexing */}
      <Script
        id="schema-website"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd)
        }}
      />

      {/* Structured Data - Organization Schema - beforeInteractive for better indexing */}
      <Script
        id="schema-organization"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd)
        }}
      />

      {/* Google Analytics 4 - Lazy loaded to avoid blocking main thread */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-FT6DRFR25D"
        strategy="lazyOnload"
      />
      <Script
        id="google-analytics"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-FT6DRFR25D', {
              page_path: window.location.pathname,
              send_page_view: true
            });
            gtag('config', 'GT-T9WXFDLK');
          `,
        }}
      />

      <NextIntlClientProvider locale={effectiveLocale} messages={messages}>
        <ErrorBoundary fallback={<div className="min-h-screen w-full flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-4">Coś poszło nie tak</h1><p className="text-muted-foreground">Błąd aplikacji. Spróbuj odświeżyć stronę.</p></div></div>}>
          <AuthProvider>
            <CurrencyProvider>
              <SmartCartProvider>
                <div className="flex flex-col min-h-screen w-full">
                  <ConditionalNav>
                      {children}
                  </ConditionalNav>
                  <DeferredClientWidgets />
                </div>
              </SmartCartProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ErrorBoundary>
      </NextIntlClientProvider>
    </>
  );
}
