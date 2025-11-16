'use client'

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  Flame,
  Users,
  BrainCircuit,
  ShoppingBag,
  PanelLeft,
  FolderTree,
  Settings,
  FileUp,
  CheckSquare,
  BarChart3,
  Home,
  ChevronRight,
  Store,
  Scale,
  GitBranch,
  Copy,
  Navigation,
  Wrench
} from 'lucide-react';
import { UserNav } from '@/components/auth/user-nav';
import { AdminAuthGuard } from '@/components/auth/admin-auth-guard';
import { Separator } from '@/components/ui/separator';

const pathNames: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/products': 'Produkty',
  '/admin/deals': 'Okazje',
  '/admin/categories': 'Kategorie',
  '/admin/navigation': 'Nawigacja',
  '/admin/moderation': 'Moderacja',
  '/admin/import': 'Import danych',
  '/admin/aliexpress-import': 'AliExpress Import',
  '/admin/imports/aliexpress': 'Import AliExpress (stary)',
  '/admin/marketplaces': 'Marketplace',
  '/admin/comparison': 'Porównanie cen',
  '/admin/category-mappings': 'Mapowanie kategorii',
  '/admin/duplicates': 'Duplikaty',
  '/admin/analytics': 'Analityka',
  '/admin/trending-prediction': 'Predykcja AI',
  '/admin/m3-tools': 'M3 Tools',
  '/admin/users': 'Użytkownicy',
  '/admin/settings': 'Ustawienia',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Ulepszony isActive - sprawdza również nested routes
  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(path);
  };
  
  const currentPageName = pathNames[pathname] || 'Panel Administratora';

  // Auto-scroll do góry przy zmianie strony
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <AdminAuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <Sidebar className="border-r border-border/60">
            <SidebarHeader className="border-b border-border/60 bg-card/50">
              <Link href="/" className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <span className="font-bold font-headline text-lg group-data-[collapsible=icon]:hidden">
                  Okazje+
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent className="p-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin')}
                    tooltip={{ children: 'Dashboard' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin">
                      <LayoutDashboard />
                      <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Separator */}
                <Separator className="my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                  Zarządzanie treścią
                </div>
                
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/products')}
                    tooltip={{ children: 'Produkty' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/products">
                      <ShoppingCart />
                      <span className="group-data-[collapsible=icon]:hidden">Produkty</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/deals')}
                    tooltip={{ children: 'Okazje' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/deals">
                      <Flame />
                      <span className="group-data-[collapsible=icon]:hidden">Okazje</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/categories')}
                    tooltip={{ children: 'Kategorie' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/categories">
                      <FolderTree />
                      <span className="group-data-[collapsible=icon]:hidden">Kategorie</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/navigation')}
                    tooltip={{ children: 'Nawigacja' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/navigation">
                      <Navigation />
                      <span className="group-data-[collapsible=icon]:hidden">Nawigacja</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/moderation')}
                    tooltip={{ children: 'Moderacja' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/moderation">
                      <CheckSquare />
                      <span className="group-data-[collapsible=icon]:hidden">Moderacja</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <Separator className="my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                  Marketplace
                </div>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/marketplaces')}
                    tooltip={{ children: 'Marketplace' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/marketplaces">
                      <Store />
                      <span className="group-data-[collapsible=icon]:hidden">Marketplace</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/comparison')}
                    tooltip={{ children: 'Porównanie cen' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/comparison">
                      <Scale />
                      <span className="group-data-[collapsible=icon]:hidden">Porównanie cen</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/category-mappings')}
                    tooltip={{ children: 'Mapowanie kategorii' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/category-mappings">
                      <GitBranch />
                      <span className="group-data-[collapsible=icon]:hidden">Mapowanie kategorii</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/duplicates')}
                    tooltip={{ children: 'Duplikaty' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/duplicates">
                      <Copy />
                      <span className="group-data-[collapsible=icon]:hidden">Duplikaty</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Separator */}
                <Separator className="my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                  Import
                </div>
                
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/import')}
                    tooltip={{ children: 'Import danych' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/import">
                      <FileUp />
                      <span className="group-data-[collapsible=icon]:hidden">Import danych</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/aliexpress-import')}
                    tooltip={{ children: 'AliExpress Import' }}
                    className="data-[active=true]:bg-green-600 data-[active=true]:text-primary-foreground hover:bg-green-600/80 border-l-4 border-transparent data-[active=true]:border-green-400"
                  >
                    <Link href="/admin/aliexpress-import">
                      <ShoppingBag className={isActive('/admin/aliexpress-import') ? 'text-white' : ''} />
                      <span className="group-data-[collapsible=icon]:hidden">AliExpress Import</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/imports/aliexpress')}
                    tooltip={{ children: 'Import AliExpress (stary)' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/imports/aliexpress">
                      <ShoppingBag />
                      <span className="group-data-[collapsible=icon]:hidden">Import AliExpress (stary)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Separator */}
                <Separator className="my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                  Analityka
                </div>
                
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/analytics')}
                    tooltip={{ children: 'Analityka' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/analytics">
                      <BarChart3 />
                      <span className="group-data-[collapsible=icon]:hidden">Analityka</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/trending-prediction')}
                    tooltip={{ children: 'Predykcja AI' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/trending-prediction">
                      <BrainCircuit />
                      <span className="group-data-[collapsible=icon]:hidden">Predykcja AI</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/m3-tools')}
                    tooltip={{ children: 'M3 Tools' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/m3-tools">
                      <Wrench />
                      <span className="group-data-[collapsible=icon]:hidden">M3 Tools</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Separator */}
                <Separator className="my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                  System
                </div>
                
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/users')}
                    tooltip={{ children: 'Użytkownicy' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/users">
                      <Users />
                      <span className="group-data-[collapsible=icon]:hidden">Użytkownicy</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/settings')}
                    tooltip={{ children: 'Ustawienia' }}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/80"
                  >
                    <Link href="/admin/settings">
                      <Settings />
                      <span className="group-data-[collapsible=icon]:hidden">Ustawienia</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="flex flex-1 flex-col">
            <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-background/95 backdrop-blur px-4 md:px-6 sticky top-0 z-30">
              <div className="flex items-center gap-4 flex-1">
                <SidebarTrigger className="md:hidden">
                  <PanelLeft />
                </SidebarTrigger>
                
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    <span className="hidden sm:inline">Strona główna</span>
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <Link href="/admin" className="hover:text-primary transition-colors">
                    Panel
                  </Link>
                  {pathname !== '/admin' && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <span className="font-medium text-foreground">{currentPageName}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="ml-auto">
                <UserNav />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/30">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AdminAuthGuard>
  );
}
