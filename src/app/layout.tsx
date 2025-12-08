import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import { ConditionalNav } from '@/components/layout/conditional-nav';
import { AuthProvider } from '@/lib/auth';
import { SmartCartProvider } from '@/lib/cart-context';
import { CurrencyProvider } from '@/context/currency-context';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
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
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerList = headers();
  const locale = headerList.get('x-next-intl-locale') ?? 'pl';
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="convertiser-verification" content="3bc0a4fd6e7289720f9c2784de4b87f345bcca47" />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-4M4NQB0PQD"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-4M4NQB0PQD');
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {/* hreflang alternate links (only PL live) */}
        <link rel="alternate" href="https://okazjeplus.pl/pl/" hrefLang="pl" />
        <link rel="alternate" href="https://okazjeplus.pl/pl/" hrefLang="x-default" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')} style={{ WebkitOverflowScrolling: 'touch' }}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <CurrencyProvider>
              <SmartCartProvider>
                <div className="flex flex-col min-h-screen w-full max-w-screen-2xl mx-auto px-0 sm:px-2 md:px-4 lg:px-8 xl:px-0">
                  <ConditionalNav>
                    <main className="flex-1 w-full max-w-full px-0 sm:px-2 md:px-4 lg:px-8 xl:px-0">
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
