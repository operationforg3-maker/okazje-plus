'use client';

import Link from 'next/link';
import {
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Settings,
  Heart,
  Bell,
  ArrowRight,
  Globe
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import ErrorBoundary from './error-boundary';
import { useNotifications } from '@/hooks/use-notifications';
import { useLocale, useTranslations } from 'next-intl';

export function UserNav() {
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const locale = useLocale();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('[UserNav] Component mounted');
    }
    
    // Check if we should keep dropdown open after language change
    if (typeof window !== 'undefined' && sessionStorage.getItem('keepDropdownOpen')) {
      sessionStorage.removeItem('keepDropdownOpen');
      setOpen(true);
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        console.log('[UserNav] Reopening dropdown after language change');
      }
    }
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('[UserNav] Auth state changed:', { 
        loading, 
        hasUser: !!user, 
        userEmail: user?.email,
        userRole: user?.role 
      });
    }
  }, [loading, user]);

  const handleLogout = async () => {
    await auth.signOut();
  };

  if (loading) {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('[UserNav] Loading - showing skeleton');
    }
    return <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />;
  }

  if (!user) {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('[UserNav] No user - rendering login button & settings dropdown');
    }
    return (
      <ErrorBoundary>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full bg-background/50 border-border/60 hover:bg-muted/50 hover:border-primary/60 transition-all font-semibold" asChild>
            <Link href={`/${locale}/login`}>{t('login')}</Link>
          </Button>
          
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full p-0 ring-1 ring-border/40 hover:ring-primary/60 hover:bg-muted/50"
                aria-label="Ustawienia strony"
              >
                <Globe className="h-5 w-5" />
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
              <ErrorBoundary>
                <AccountMenuPanel
                  user={null}
                  loading={loading}
                  onLogout={handleLogout}
                  onNavigate={() => setOpen(false)}
                />
              </ErrorBoundary>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ErrorBoundary>
    );
  }

  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    console.log('[UserNav] Rendering avatar for user:', user.email, 'role:', user.role);
  }

  // Always render avatar even if user object is incomplete - ENSURE STRING OUTPUT
  let userInitial = 'U'; // Default fallback
  try {
    if (user?.displayName && typeof user.displayName === 'string' && user.displayName.length > 0) {
      userInitial = user.displayName.charAt(0).toUpperCase();
    } else if (user?.email && typeof user.email === 'string' && user.email.length > 0) {
      userInitial = user.email.charAt(0).toUpperCase();
    }
  } catch (error) {
    console.error('[UserNav] Error computing userInitial:', error);
    userInitial = 'U';
  }

  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    console.log('[UserNav] User initial (validated string):', JSON.stringify(userInitial), 'photoURL:', user.photoURL);
  }

  return (
    <ErrorBoundary>
      <div className="flex items-center gap-2">
        {/* TEMPORARILY DISABLED FOR DEBUGGING: <NotificationBell /> */}
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0 ring-1 ring-border/40 hover:ring-primary/60 hover:bg-muted/50"
              aria-label="Menu użytkownika"
            >
              <Avatar className="h-10 w-10">
                {user?.photoURL ? (
                  <AvatarImage src={user.photoURL} alt={user?.displayName || 'User'} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {open && (
                <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary shadow-md" />
              )}
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  aria-label={`${unreadCount} nowych powiadomień`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="p-0 border border-border/60 bg-transparent shadow-none w-auto"
          >
            <ErrorBoundary>
              <AccountMenuPanel
                user={user}
                loading={loading}
                onLogout={handleLogout}
                onNavigate={() => setOpen(false)}
                unreadCount={unreadCount}
              />
            </ErrorBoundary>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ErrorBoundary>
  );
}
