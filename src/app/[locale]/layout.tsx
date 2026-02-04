import type { Metadata } from 'next';
import Script from 'next/script';
import '../globals.css';
import { Toaster } from 'sonner';
import { ConditionalNav } from '@/components/layout/conditional-nav';
import { AuthProvider } from '@/lib/auth';
import { SmartCartProvider } from '@/lib/cart-context';
import { CurrencyProvider } from '@/context/currency-context';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import ErrorBoundary from '@/components/auth/error-boundary';
import ComingSoonLanding from '@/components/coming-soon-landing';
import { ComparisonListener } from '@/components/deal-comparison-tool';
import { ExtensionWarningBanner } from '@/components/extension-warning-banner';
import { CashbackWarningModal } from '@/components/cashback-warning-modal';
import { AnalyticsProvider } from '@/components/analytics/provider';
import { CookieConsentBanner } from '@/components/cookie-consent';

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
      index: true,
      follow: true,
    },
    alternates: {
      canonical,
      languages: {
        pl: `${SITE_URL}/pl/`,
        en: `${SITE_URL}/en/`,
        de: `${SITE_URL}/de/`,
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
  
  return (
    <>
      {/* Structured Data - WebSite Schema - beforeInteractive for better indexing */}
      <Script
        id="schema-website"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Okazje+',
            alternateName: 'OkazjePlus',
            url: 'https://okazjeplus.pl',
            description: 'Najlepsze okazje zakupowe, promocje i wyprzedaże w Polsce. Społeczność dzieląca się najgorętszymi ofertami i cenami produktów.',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://okazjeplus.pl/search?q={search_term_string}'
              },
              'query-input': 'required name=search_term_string'
            }
          })
        }}
      />

      {/* Structured Data - Organization Schema - beforeInteractive for better indexing */}
      <Script
        id="schema-organization"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Okazje+',
            url: 'https://okazjeplus.pl',
            logo: 'https://okazjeplus.pl/Logotyp_okazjePlus.png',
            sameAs: [
              'https://www.facebook.com/okazjeplus',
              'https://twitter.com/okazjeplus'
            ],
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'customer service',
              availableLanguage: ['Polish', 'English', 'German']
            }
          })
        }}
      />

      {/* Font Preload for better LCP */}
      <link rel="preload" as="font" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" crossOrigin="anonymous" />

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
                  <ComparisonListener />
                  <ExtensionWarningBanner />
                  <CashbackWarningModal />
                  <CookieConsentBanner />
                  <Toaster />
                </div>
              </SmartCartProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ErrorBoundary>
      </NextIntlClientProvider>
    </>
  );
}
