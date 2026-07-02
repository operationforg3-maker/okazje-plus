'use client';

import React from 'react';
import { PreviewHeader } from '@/components/ux-redesign/preview-header';

export default function UXPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Accent blobs in background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <PreviewHeader />
      
      <main className="flex-grow z-10 relative">
        {children}
      </main>

      <footer className="border-t border-border/40 py-8 bg-muted/20 text-center text-xs text-muted-foreground z-10">
        <div className="container mx-auto px-4">
          <p>© 2026 Okazje+ UX Redesign. Prezentacja nowej szaty graficznej i doświadczenia użytkownika.</p>
          <p className="mt-1 text-[10px] opacity-75">Zbudowano z dbałością o mobile-first, SEO oraz optymalizację CLS/LCP.</p>
        </div>
      </footer>
    </div>
  );
}
