"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard, LogOut, Settings, User as UserIcon, Heart, Bell } from "lucide-react";
import { User } from "@/lib/types";

interface AccountMenuPanelProps {
  user: User | null;
  loading?: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}

export function AccountMenuPanel({ user, loading, onLogout, onNavigate }: AccountMenuPanelProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm w-72">
        <div className="space-y-3">
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
          <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm w-72">
      {user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {user.photoURL ? <AvatarImage src={user.photoURL} alt={user.displayName ?? "Użytkownik"} /> : null}
              <AvatarFallback>{(user.displayName ?? user.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                {user.displayName ?? "Użytkownik"}
              </p>
              {user.email ? (
                <p className="text-xs text-muted-foreground line-clamp-1">{user.email}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Link href="/profile" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Profil</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile?tab=favorites" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Ulubione</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile?tab=notifications" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Powiadomienia</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/profile/settings" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
              <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Ustawienia</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {user.role === "admin" ? (
              <Link href="/admin" onClick={onNavigate} className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                <span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Panel admina</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ) : null}
            <button type="button" onClick={() => { onLogout(); onNavigate?.(); }} className="flex w-full items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-destructive/60 hover:text-destructive">
              <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> Wyloguj się</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Zaloguj się, aby zapisywać okazje i śledzić ulubione kategorie.
          </p>
          <Button asChild className="w-full" onClick={onNavigate}>
            <Link href="/login" className="flex items-center justify-center gap-2">
              <UserIcon className="h-4 w-4" />
              Zaloguj się
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
