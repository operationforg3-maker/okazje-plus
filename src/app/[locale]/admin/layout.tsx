'use client'

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { PanelLeft, Home, ChevronRight } from 'lucide-react';
import { AdminAuthGuard } from '@/components/auth/admin-auth-guard';
import { AdminNav } from '@/components/admin/admin-nav';
import { CurrencySwitcher } from '@/components/currency-switcher';

const pathNames: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/setup': 'Setup & Seeding',
  '/admin/products': 'Produkty',
  '/admin/deals': 'Okazje',
  '/admin/categories': 'Kategorie',
  '/admin/forum/moderation': 'Moderacja Forum',
  '/admin/forum/categories': 'Kategorie Forum',
  '/admin/moderation': 'Panel Moderacji',
  '/admin/duplicates': 'Duplikaty',
  '/admin/users': 'Użytkownicy',
  '/admin/pre-registrations': 'Pre-rejestracje',
  '/admin/analytics': 'Analytics Dashboard',
  '/admin/stats': 'Statystyki',
  '/admin/aliexpress-purchases': 'Zakupy AliExpress',
  '/admin/settings': 'Ustawienia',
  '/admin/harvester': 'Kombajn',
  '/admin/imports': 'Import Monitor',
  '/admin/imports/aliexpress': 'Import AliExpress',
  '/admin/aliexpress-import': 'AliExpress Import',
  '/admin/import-export': 'Import/Export Console',
  '/admin/social-media': 'Automatyzacja social mediów',
  '/admin/tools-inventory': 'Inwentarz Narzędzi',
  '/admin/database': 'Zarządzanie Bazą Danych',
  '/admin/m6-import-dashboard': 'M6 Import Dashboard',
  '/admin/m6-pipeline-visualizer': 'M6 Pipeline Visualizer',
  '/admin/m6-ui-guide': 'M6 UI Guide',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const normalizedPathname = pathname.replace(/^\/(pl|en|de)(?=\/)/, '');
  const currentPageName = pathNames[normalizedPathname] || 'Panel Administratora';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <AdminAuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AdminNav />
          <SidebarInset className="flex flex-1 flex-col w-full">
            <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b border-border/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 px-3 md:px-6 shrink-0 shadow-none">
              <div className="flex items-center gap-4 flex-1">
                <SidebarTrigger className="md:hidden">
                  <PanelLeft />
                </SidebarTrigger>
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm overflow-x-auto">
                  <Link href="/" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 md:gap-1.5 group shrink-0">
                    <Home className="h-3.5 w-3.5 md:h-4 md:w-4 group-hover:scale-110 transition-transform" />
                    <span className="hidden md:inline">Strona główna</span>
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground/50 shrink-0" />
                  <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors font-medium shrink-0">
                    <span className="hidden sm:inline">Panel Admina</span>
                    <span className="sm:hidden">Admin</span>
                  </Link>
                  {normalizedPathname !== '/admin' && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground/50 shrink-0" />
                      <span className="font-semibold text-foreground truncate">{currentPageName}</span>
                    </>
                  )}
                </div>
              </div>
              {/* Currency Switcher */}
              <div className="flex items-center gap-2">
                <CurrencySwitcher />
              </div>
            </header>
            <main className="flex-1 w-full">
              <div className="w-full max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-16 md:pb-20">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AdminAuthGuard>
  );
}
