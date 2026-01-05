'use client';

import Link from 'next/link';
import {
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Settings,
  Heart,
  Bell,
  ArrowRight
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { NotificationBell } from './notification-bell';
import { useState, useEffect } from 'react';
import { AccountMenuPanel } from '@/components/layout/account-menu-panel';

export function UserNav() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    console.log('[UserNav] Component mounted');
  }, []);

  useEffect(() => {
    console.log('[UserNav] Auth state changed:', { 
      isMounted, 
      loading, 
      hasUser: !!user, 
      userEmail: user?.email,
      userRole: user?.role 
    });
  }, [isMounted, loading, user]);

  const handleLogout = async () => {
    await auth.signOut();
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    console.log('[UserNav] Not mounted yet - showing skeleton');
    return <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />;
  }

  if (loading) {
    console.log('[UserNav] Loading - showing skeleton');
    return <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />;
  }

  if (!user) {
    console.log('[UserNav] No user - showing login button');
    return (
      <Button variant="outline" className="rounded-full" asChild>
        <Link href="/login">Zaloguj się</Link>
      </Button>
    );
  }

  console.log('[UserNav] Rendering avatar for user:', user.email, 'role:', user.role);

  // Always render avatar even if user object is incomplete
  const userInitial = user?.displayName 
    ? user.displayName.charAt(0).toUpperCase() 
    : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full p-0 ring-1 ring-border/40 hover:ring-primary/60 hover:bg-muted/50"
            aria-label="Menu użytkownika"
          >
            <Avatar className="h-10 w-10">
              {user?.photoURL && <AvatarImage src={user.photoURL} alt={user?.displayName || 'User'} />}
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            {open && (
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary shadow-md" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="p-0 border border-border/60 bg-transparent shadow-none w-auto"
        >
          <AccountMenuPanel
            user={user}
            loading={loading}
            onLogout={handleLogout}
            onNavigate={() => setOpen(false)}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
