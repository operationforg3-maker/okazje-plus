import type { Metadata } from 'next';
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
  // Locale-specific attributes są ustawiane w [locale]/layout
  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning className={cn('min-h-screen bg-background font-body antialiased')} style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </body>
    </html>
  );
}
