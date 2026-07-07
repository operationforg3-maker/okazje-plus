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
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var stored = localStorage.getItem('uxSettings');
                var themeFamily = 'classic';
                var themeMode = 'dark';
                if (stored) {
                  var parsed = JSON.parse(stored);
                  if (parsed.themeFamily) themeFamily = parsed.themeFamily;
                  if (parsed.themeMode) themeMode = parsed.themeMode;
                } else {
                  var legacyFamily = localStorage.getItem('okp_theme_variant');
                  if (legacyFamily) themeFamily = legacyFamily;
                  var legacyTheme = localStorage.getItem('okp_theme');
                  if (legacyTheme) themeMode = legacyTheme;
                }
                var root = document.documentElement;
                root.setAttribute('data-theme', themeFamily === 'classic' ? 'default' : themeFamily);
                root.setAttribute('data-mode', themeMode);
                root.style.colorScheme = themeMode;
                if (themeMode === 'dark') {
                  root.classList.add('dark');
                } else {
                  root.classList.remove('dark');
                }
                var classesToRemove = [];
                for (var i = 0; i < root.classList.length; i++) {
                  var cls = root.classList[i];
                  if (cls.startsWith('theme-')) classesToRemove.push(cls);
                }
                for (var i = 0; i < classesToRemove.length; i++) {
                  root.classList.remove(classesToRemove[i]);
                }
                if (themeFamily !== 'classic') {
                  root.classList.add('theme-' + themeFamily);
                }
              } catch (e) {}
            })();
          `
        }} />
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
