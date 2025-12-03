'use client'

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  ShoppingCart,
  Flame,
  Users,
  Sparkles,
  PanelLeft,
  FolderTree,
  Settings,
  FileUp,
  CheckSquare,
  BarChart3,
  Home,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Zap,
  Database,
  MessageSquare,
  Bell,
  Wrench,
  ShoppingBag,
} from 'lucide-react';
import { SidebarCategoryTree } from '@/components/admin/sidebar-category-tree';
import { AdminAuthGuard } from '@/components/auth/admin-auth-guard';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const pathNames: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/setup': 'Konfiguracja i Seeding',
  '/admin/products': 'Produkty',
  '/admin/deals': 'Okazje',
  '/admin/forum/moderation': 'Moderacja Forum',
  '/admin/deals-import': 'Import Okazji',
  '/admin/categories': 'Kategorie',
  '/admin/navigation': 'Nawigacja',
  '/admin/moderation': 'Moderacja',
  '/admin/imports/aliexpress': 'Import AliExpress',
  '/admin/bulk-import': 'Bulk AI Import',
  '/admin/ai-tools': 'AI Tools',
  '/admin/analytics': 'Analityka',
  '/admin/stats': 'Statystyki',
  '/admin/users': 'Użytkownicy',
  '/admin/secret-pages': 'Tajne strony',
  '/admin/settings': 'Ustawienia',
  '/admin/duplicates': 'Duplikaty (M2)',
  '/admin/settings/oauth': 'OAuth Tokens (M2)',
  '/admin/marketplaces': 'Marketplace (M4)',
  '/admin/comparison': 'Porównanie cen (M4)',
  '/admin/category-mappings': 'Mapowanie kategorii (M4)',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [contentOpen, setContentOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [forumOpen, setForumOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(path);
  };
  
  const currentPageName = pathNames[pathname] || 'Panel Administratora';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <AdminAuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar className="border-r border-border/60 h-screen sticky top-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <SidebarContent className="p-2 pb-8">
              <SidebarMenu>
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin') && pathname === '/admin'}
                    tooltip={{ children: 'Dashboard' }}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary data-[active=true]:to-purple-600 data-[active=true]:text-white hover:bg-muted/80 transition-all"
                  >
                    <Link href="/admin">
                      <LayoutDashboard />
                      <span className="group-data-[collapsible=icon]:hidden font-medium">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Setup & Seeding */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/setup')}
                    tooltip={{ children: 'Konfiguracja i Seeding' }}
                  >
                    <Link href="/admin/setup">
                      <Wrench />
                      <span className="group-data-[collapsible=icon]:hidden font-medium">Setup & Seeding</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Treści - COLLAPSIBLE */}
                <Collapsible open={contentOpen} onOpenChange={setContentOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80">
                        <FolderTree className="h-4 w-4" />
                        <span className="flex-1 text-left font-semibold group-data-[collapsible=icon]:hidden">
                          Treści
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden",
                          contentOpen && "rotate-180"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/products')}>
                            <Link href="/admin/products">
                              <ShoppingCart className="h-4 w-4" />
                              <span>Produkty</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/deals')}>
                            <Link href="/admin/deals">
                              <Flame className="h-4 w-4" />
                              <span>Okazje</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/categories')}>
                            <Link href="/admin/categories">
                              <FolderTree className="h-4 w-4" />
                              <span>Kategorie</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/moderation')}>
                            <Link href="/admin/moderation">
                              <CheckSquare className="h-4 w-4" />
                              <span>Moderacja</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                {/* Category Tree - minimalized */}
                <Collapsible defaultOpen={false} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80 opacity-70">
                        <FolderTree className="h-4 w-4" />
                        <span className="flex-1 text-left text-sm group-data-[collapsible=icon]:hidden">
                          Katalog kategorii
                        </span>
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-2 py-2">
                        <SidebarCategoryTree />
                      </div>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                <Separator className="my-2" />
                {/* Import Danych - COLLAPSIBLE */}
                <Collapsible open={importOpen} onOpenChange={setImportOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80">
                        <FileUp className="h-4 w-4" />
                        <span className="flex-1 text-left font-semibold group-data-[collapsible=icon]:hidden">
                          Import Danych
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden",
                          importOpen && "rotate-180"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/imports/aliexpress')}>
                            <Link href="/admin/imports/aliexpress">
                              <ShoppingBag className="h-4 w-4" />
                              <span>AliExpress</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/deals-import')}>
                            <Link href="/admin/deals-import">
                              <Flame className="h-4 w-4" />
                              <span>Import Okazji</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/bulk-import')}>
                            <Link href="/admin/bulk-import">
                              <Sparkles className="h-4 w-4" />
                              <span>Bulk AI Import</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/import')}>
                            <Link href="/admin/import">
                              <FileUp className="h-4 w-4" />
                              <span>Import CSV</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                {/* AI Tools */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/ai-tools')}
                    tooltip={{ children: 'AI Tools' }}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-600 data-[active=true]:to-pink-600 data-[active=true]:text-white hover:bg-muted/80 border-l-4 border-transparent data-[active=true]:border-pink-400 transition-all"
                  >
                    <Link href="/admin/ai-tools">
                      <Sparkles />
                      <span className="group-data-[collapsible=icon]:hidden font-medium">AI Tools</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <Separator className="my-3" />
                {/* Forum - COLLAPSIBLE */}
                <Collapsible open={forumOpen} onOpenChange={setForumOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80">
                        <MessageSquare className="h-4 w-4" />
                        <span className="flex-1 text-left font-semibold group-data-[collapsible=icon]:hidden">
                          Forum
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden",
                          forumOpen && "rotate-180"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/forum/moderation')}>
                            <Link href="/admin/forum/moderation">
                              <CheckSquare className="h-4 w-4" />
                              <span>Moderacja forum</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                <Separator className="my-3" />
                {/* Analityka - COLLAPSIBLE */}
                <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80">
                        <BarChart3 className="h-4 w-4" />
                        <span className="flex-1 text-left font-semibold group-data-[collapsible=icon]:hidden">
                          Analityka
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden",
                          analyticsOpen && "rotate-180"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/analytics')}>
                            <Link href="/admin/analytics">
                              <BarChart3 className="h-4 w-4" />
                              <span>Analityka</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/stats')}>
                            <Link href="/admin/stats">
                              <TrendingUp className="h-4 w-4" />
                              <span>Statystyki</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                <Separator className="my-3" />
                {/* Zaawansowane - COLLAPSIBLE */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80 opacity-70">
                        <Settings className="h-4 w-4" />
                        <span className="flex-1 text-left text-sm group-data-[collapsible=icon]:hidden">
                          Zaawansowane
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden",
                          advancedOpen && "rotate-180"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/navigation')}>
                            <Link href="/admin/navigation">
                              <span>Nawigacja</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/import')}>
                            <Link href="/admin/import">
                              <span>Import CSV</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/trending-prediction')}>
                            <Link href="/admin/trending-prediction">
                              <span>Predykcja AI</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/m3-tools')}>
                            <Link href="/admin/m3-tools">
                              <span>M3 Tools</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/duplicates')}>
                            <Link href="/admin/duplicates">
                              <span>Duplikaty (M2)</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/settings/oauth')}>
                            <Link href="/admin/settings/oauth">
                              <span>OAuth Tokens (M2)</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/marketplaces')}>
                            <Link href="/admin/marketplaces">
                              <span>Marketplaces (M4)</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/comparison')}>
                            <Link href="/admin/comparison">
                              <span>Porównanie cen (M4)</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive('/admin/category-mappings')}>
                            <Link href="/admin/category-mappings">
                              <span>Mapowanie kategorii (M4)</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                <Separator className="my-3" />
                {/* System */}
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
                    isActive={isActive('/admin/secret-pages')}
                    tooltip={{ children: 'Tajne strony' }}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-600 data-[active=true]:to-pink-600 data-[active=true]:text-white hover:bg-muted/80 transition-all"
                  >
                    <Link href="/admin/secret-pages">
                      <Zap />
                      <span className="group-data-[collapsible=icon]:hidden">Tajne strony</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/pre-registrations')}
                    tooltip={{ children: 'Pre-rejestracje' }}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-orange-600 data-[active=true]:to-amber-600 data-[active=true]:text-white hover:bg-muted/80 transition-all"
                  >
                    <Link href="/admin/pre-registrations">
                      <Users />
                      <span className="group-data-[collapsible=icon]:hidden">Pre-rejestracje</span>
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
          <SidebarInset className="flex flex-1 flex-col w-full">
            <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 md:px-6 shrink-0 shadow-sm">
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
                  {pathname !== '/admin' && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground/50 shrink-0" />
                      <span className="font-semibold text-foreground truncate">{currentPageName}</span>
                    </>
                  )}
                </div>
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
