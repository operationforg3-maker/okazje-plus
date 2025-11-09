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
import { useState } from 'react';
import { AccountMenuPanel } from '@/components/layout/account-menu-panel';

export function UserNav() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
  };

  if (loading) {
    return <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />;
  }

  if (!user) {
    return (
      <Button asChild>
        <Link href="/login">Zaloguj się</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full ring-1 ring-border/40 hover:ring-primary/60"
            aria-label="Menu użytkownika"
          >
            <Avatar className="h-10 w-10">
              {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />}
              <AvatarFallback>{user.displayName ? user.displayName.charAt(0) : 'U'}</AvatarFallback>
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
