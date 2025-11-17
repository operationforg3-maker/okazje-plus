'use client'

import React, { useEffect, useState } from 'react';
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
  ChevronDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { UserNav } from '@/components/auth/user-nav';
import { AdminAuthGuard } from '@/components/auth/admin-auth-guard';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const pathNames: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/products': 'Produkty',
  '/admin/deals': 'Okazje',
  '/admin/categories': 'Kategorie',
  '/admin/navigation': 'Nawigacja',
  '/admin/moderation': 'Moderacja',
  '/admin/aliexpress-import': 'Import AliExpress',
  '/admin/analytics': 'Analityka',
  '/admin/stats': 'Statystyki',
  '/admin/users': 'Użytkownicy',
  '/admin/secret-pages': 'Tajne strony',
  '/admin/settings': 'Ustawienia',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [contentOpen, setContentOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
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
        <div className="flex min-h-screen">
          <Sidebar className="border-r border-border/60">
            <SidebarHeader className="border-b border-border/60 bg-gradient-to-r from-primary/10 to-purple-500/10">
              <Link href="/" className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-all group">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div className="group-data-[collapsible=icon]:hidden">
                  <span className="font-bold font-headline text-lg block">Okazje+</span>
                  <span className="text-xs text-muted-foreground">Panel Admina</span>
                </div>
              </Link>
            </SidebarHeader>
            
            <SidebarContent className="p-2">
              <SidebarMenu>
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin')}
                    tooltip={{ children: 'Dashboard' }}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary data-[active=true]:to-purple-600 data-[active=true]:text-white hover:bg-muted/80 transition-all"
                  >
                    <Link href="/admin">
                      <LayoutDashboard />
                      <span className="group-data-[collapsible=icon]:hidden font-medium">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <Separator className="my-3" />
                
                {/* Zarządzanie treścią - COLLAPSIBLE */}
                <Collapsible open={contentOpen} onOpenChange={setContentOpen} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-muted/80">
                        <Zap className="h-4 w-4" />
                        <span className="flex-1 text-left font-semibold group-data-[collapsible=icon]:hidden">
                          Zarządzanie
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
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/products')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
                            <Link href="/admin/products">
                              <ShoppingCart className="h-4 w-4" />
                              <span>Produkty</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/deals')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
                            <Link href="/admin/deals">
                              <Flame className="h-4 w-4" />
                              <span>Okazje</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/categories')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
                            <Link href="/admin/categories">
                              <FolderTree className="h-4 w-4" />
                              <span>Kategorie</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/moderation')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
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

                {/* Import - pojedynczy najważniejszy */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin/aliexpress-import')}
                    tooltip={{ children: 'Import AliExpress' }}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-green-600 data-[active=true]:to-emerald-600 data-[active=true]:text-white hover:bg-muted/80 border-l-4 border-transparent data-[active=true]:border-green-400 transition-all"
                  >
                    <Link href="/admin/aliexpress-import">
                      <ShoppingBag />
                      <span className="group-data-[collapsible=icon]:hidden font-medium">Import AliExpress</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

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
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/analytics')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
                            <Link href="/admin/analytics">
                              <BarChart3 className="h-4 w-4" />
                              <span>Analityka</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/stats')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                          >
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

                {/* Zaawansowane - COLLAPSIBLE (mało używane funkcje) */}
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
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/navigation')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground text-sm"
                          >
                            <Link href="/admin/navigation">
                              <span>Nawigacja</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/import')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground text-sm"
                          >
                            <Link href="/admin/import">
                              <span>Import CSV</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/trending-prediction')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground text-sm"
                          >
                            <Link href="/admin/trending-prediction">
                              <span>Predykcja AI</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive('/admin/m3-tools')}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground text-sm"
                          >
                            <Link href="/admin/m3-tools">
                              <span>M3 Tools</span>
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
          
          <SidebarInset className="flex flex-1 flex-col">
            <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 sticky top-0 z-30 shadow-sm">
              <div className="flex items-center gap-4 flex-1">
                <SidebarTrigger className="md:hidden">
                  <PanelLeft />
                </SidebarTrigger>
                
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1.5 group">
                    <Home className="h-4 w-4 group-hover:scale-110 transition-transform" />
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

              <UserNav />
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="container mx-auto p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AdminAuthGuard>
  );
}
