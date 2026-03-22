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
  fr: { path: '/fr/', ogLocale: 'fr_FR' },
  es: { path: '/es/', ogLocale: 'es_ES' },
  uk: { path: '/uk/', ogLocale: 'uk_UA' },
};

const SEO_BY_LOCALE: Record<string, {
  title: string;
  description: string;
  keywords: string[];
}> = {
  pl: {
    title: 'Okazje+ - Najlepsze okazje zakupowe w internecie',
    description: 'Odkrywaj najlepsze okazje, promocje i wyprzedaże w internecie. Społeczność Okazje+ codziennie publikuje sprawdzone oferty i oszczędności.',
    keywords: ['okazje', 'promocje', 'wyprzedaże', 'zakupy online', 'rabaty', 'kupony', 'najlepsze ceny'],
  },
  en: {
    title: 'Okazje+ - Best online shopping deals',
    description: 'Discover the best online deals, promotions and discounts. The Okazje+ community shares verified offers and smart savings every day.',
    keywords: ['deals', 'promotions', 'discounts', 'online shopping', 'coupons', 'best prices', 'hot deals'],
  },
  de: {
    title: 'Okazje+ - Die besten Online-Angebote',
    description: 'Entdecke die besten Online-Angebote, Rabatte und Aktionen. Die Okazje+ Community teilt täglich geprüfte Deals und echte Sparmöglichkeiten.',
    keywords: ['angebote', 'rabatte', 'aktionen', 'online shopping', 'gutscheine', 'beste preise', 'deals'],
  },
  fr: {
    title: 'Okazje+ - Les meilleures offres en ligne',
    description: 'Découvrez les meilleures offres, promotions et réductions en ligne. La communauté Okazje+ partage chaque jour des bons plans vérifiés.',
    keywords: ['offres', 'promotions', 'réductions', 'achats en ligne', 'codes promo', 'meilleurs prix', 'bons plans'],
  },
  es: {
    title: 'Okazje+ - Las mejores ofertas en internet',
    description: 'Descubre las mejores ofertas, promociones y descuentos en internet. La comunidad Okazje+ comparte oportunidades verificadas cada día.',
    keywords: ['ofertas', 'promociones', 'descuentos', 'compras online', 'cupones', 'mejores precios', 'chollos'],
  },
  uk: {
    title: 'Okazje+ - Найкращі онлайн-пропозиції',
    description: 'Відкривайте найкращі онлайн-акції, знижки та розпродажі. Спільнота Okazje+ щодня ділиться перевіреними вигідними пропозиціями.',
    keywords: ['акції', 'знижки', 'розпродаж', 'онлайн покупки', 'купони', 'кращі ціни', 'вигідні пропозиції'],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const finalLocale = locale || 'pl';
  const config = LOCALE_CONFIG[finalLocale] ?? LOCALE_CONFIG.pl;
  const seo = SEO_BY_LOCALE[finalLocale] ?? SEO_BY_LOCALE.pl;
  const canonical = `${SITE_URL}${config.path}`;
  const languageAlternates = Object.entries(LOCALE_CONFIG).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = `${SITE_URL}${value.path}`;
    return acc;
  }, {});
  const isIndexedLocale = Boolean(LOCALE_CONFIG[finalLocale]);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.title,
      template: '%s | Okazje+'
    },
    description: seo.description,
    keywords: seo.keywords,
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
      title: seo.title,
      description: seo.description,
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
      title: seo.title,
      description: seo.description,
      images: ['/Logotyp_okazjePlus.png'],
    },
    icons: {
      icon: '/icon_okazjeplus.svg',
      apple: '/icon_okazjeplus.png',
    },
    robots: {
      index: isIndexedLocale,
      follow: true,
    },
    alternates: {
      canonical,
      languages: {
        ...languageAlternates,
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
