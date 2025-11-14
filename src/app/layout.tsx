import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { AuthProvider } from '@/lib/auth';

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
        url: '/og-image.png',
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
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
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
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
