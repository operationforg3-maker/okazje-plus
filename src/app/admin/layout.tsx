'use client'

import React from 'react';
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
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  Flame,
  Users,
  BrainCircuit,
  ShoppingBag,
  PanelLeft,
} from 'lucide-react';
import { UserNav } from '@/components/auth/user-nav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Link href="/" className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="font-bold font-headline text-lg group-data-[collapsible=icon]:hidden">
                Okazje+
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/admin')}
                  tooltip={{ children: 'Dashboard' }}
                >
                  <Link href="/admin">
                    <LayoutDashboard />
                    <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/admin/products')}
                  tooltip={{ children: 'Produkty' }}
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
                  isActive={isActive('/admin/users')}
                  tooltip={{ children: 'Użytkownicy' }}
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
                  isActive={isActive('/admin/trending-prediction')}
                  tooltip={{ children: 'Predykcja AI' }}
                >
                  <Link href="/admin/trending-prediction">
                    <BrainCircuit />
                    <span className="group-data-[collapsible=icon]:hidden">Predykcja AI</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden">
                <PanelLeft />
              </SidebarTrigger>
              <h1 className="font-headline text-xl font-semibold">Panel Administratora</h1>
            </div>
            <div className="ml-auto">
              <UserNav />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/40">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
