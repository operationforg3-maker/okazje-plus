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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body { background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          a { color: inherit; text-decoration: none; }
          button { cursor: pointer; border: none; background: none; font-family: inherit; }
        `}} />
      </head>
      <body suppressHydrationWarning className={cn('min-h-screen bg-background font-body antialiased')} style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </body>
    </html>
  );
}
