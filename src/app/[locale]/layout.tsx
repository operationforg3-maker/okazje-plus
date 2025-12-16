import type { Metadata } from 'next';
import '../globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import { ConditionalNav } from '@/components/layout/conditional-nav';
import { AuthProvider } from '@/lib/auth';
import { SmartCartProvider } from '@/lib/cart-context';
import { CurrencyProvider } from '@/context/currency-context';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { ComparisonListener } from '@/components/deal-comparison-tool';
import { ExtensionWarningBanner } from '@/components/extension-warning-banner';
import { CashbackWarningModal } from '@/components/cashback-warning-modal';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://okazje-plus.web.app'),
  title: {
    default: 'Okazje+ - Najlepsze okazje zakupowe w Polsce',
    template: '%s | Okazje+'
  },
  description: 'Odkryj najlepsze okazje zakupowe, promocje i wyprzedaże. Społeczność Okazje+ dzieli się najgorętszymi ofertami i cenami produktów.',
  keywords: ['okazje', 'promocje', 'wyprzedaże', 'zakupy online', 'najlepsze ceny', 'rabaty', 'kupony'],
  authors: [{ name: 'Okazje+' }],
  creator: 'Okazje+',
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://okazje.plus',
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
    types: {
      'application/rss+xml': 'https://okazjeplus.pl/rss.xml',
    },
  },
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  // Use locale from params (PL/EN/DE from routing)
  const effectiveLocale = locale || 'pl';
  const messages = await getMessages();
  
  return (
    <html lang={effectiveLocale} suppressHydrationWarning>
      <head>
                {/* Instant theme init to avoid flash */}
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      (function(){
                        try {
                          const storageKey = 'okp_theme';
                          const theme = localStorage.getItem(storageKey) || 'system';
                          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                          const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
                          document.documentElement.classList.toggle('dark', isDark);
                          document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                        } catch(e) {}
                      })();
                    `,
                  }}
                />
        <meta name="convertiser-verification" content="3bc0a4fd6e7289720f9c2784de4b87f345bcca47" />
        {/* SEO Verification Tags */}
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
          <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION} />
        )}
        {process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION && (
          <meta name="msvalidate.01" content={process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION} />
        )}
        {/* WebSite Schema with Search Action for Google Rich Results */}
        <script
          type="application/ld+json"
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
        {/* Organization Schema */}
        <script
          type="application/ld+json"
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
        {/* Google Tag Manager */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');
              `,
            }}
          />
        )}
        {/* Facebook Pixel */}
        {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');
                fbq('track', 'PageView');
              `,
            }}
          />
        )}
        {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_FB_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {/* hreflang alternate links (only PL live) */}
        <link rel="alternate" href="https://okazjeplus.pl/pl/" hrefLang="pl" />
        <link rel="alternate" href="https://okazjeplus.pl/pl/" hrefLang="x-default" />
        {/* Minimal fallback styles in case global CSS fails to load on hosting */}
        <style
          id="critical-fallback"
          dangerouslySetInnerHTML={{
            __html: `
              :root { color-scheme: light; }
              body { margin: 0; font-family: 'Roboto', system-ui, -apple-system, sans-serif; background: #f9f7f3; color: #0f172a; }
              a { color: #0f766e; text-decoration: none; }
              a:hover { text-decoration: underline; }
              .container { max-width: 1200px; margin: 0 auto; padding: 0 12px; }
              button { font-family: inherit; }
            `,
          }}
        />
      </head>
      <body 
        suppressHydrationWarning
        className={cn('min-h-screen bg-background font-body antialiased')}
        style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Google Tag Manager (noscript) */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <NextIntlClientProvider locale={effectiveLocale} messages={messages}>
          <AuthProvider>
            <CurrencyProvider>
              <SmartCartProvider>
                <div className="flex flex-col min-h-screen w-full">
                  <ConditionalNav>
                    <main className="flex-1 w-full">
                      {children}
                    </main>
                  </ConditionalNav>
                  <ComparisonListener />
                  <ExtensionWarningBanner />
                  <CashbackWarningModal />
                  <Toaster />
                </div>
              </SmartCartProvider>
            </CurrencyProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
