import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Okazje+',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout MUSI zawierać html i body dla Next.js 15
  return (
    <html suppressHydrationWarning>
      <head>
        {/* Theme init - musi być przed hydration */}
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
      </head>
      <body suppressHydrationWarning className={cn('min-h-screen bg-background font-body antialiased')} style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </body>
    </html>
  );
}
