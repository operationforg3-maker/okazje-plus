import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { cn } from '@/lib/utils';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';

export const metadata: Metadata = {
  title: 'Okazje+',
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout MUSI zawierać html i body dla Next.js 15
  return (
    <html lang="pl" suppressHydrationWarning>
      {/* Critical CSS inline for better LCP */}
      <head>
        {/* Preconnect do domen zewnętrznych — skraca FCP/LCP */}
        <link rel="preconnect" href="https://ae-pic-a1.aliexpress-media.com" />
        <link rel="preconnect" href="https://imgproxy.convertiser.com" />
        <link rel="dns-prefetch" href="https://ae-pic-a1.aliexpress-media.com" />
        <link rel="dns-prefetch" href="https://imgproxy.convertiser.com" />
        <style dangerouslySetInnerHTML={{__html: `
          html { scroll-behavior: smooth; }
        `}} />
      </head>
      <body suppressHydrationWarning className={cn('min-h-screen bg-background font-body antialiased')} style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </body>
    </html>
  );
}
