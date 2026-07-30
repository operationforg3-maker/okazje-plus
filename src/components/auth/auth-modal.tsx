'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flame, Heart, Bell, MessageSquare, ShieldCheck, Sparkles, LogIn, UserPlus } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actionType?: 'vote' | 'favorite' | 'alert' | 'comment' | 'general';
}

export function AuthModal({
  isOpen,
  onClose,
  title,
  description,
  actionType = 'general',
}: AuthModalProps) {
  const locale = useLocale();

  const actionIcons = {
    vote: <Flame className="h-10 w-10 text-orange-500 animate-pulse" />,
    favorite: <Heart className="h-10 w-10 text-rose-500 animate-bounce" />,
    alert: <Bell className="h-10 w-10 text-amber-500 animate-bounce" />,
    comment: <MessageSquare className="h-10 w-10 text-blue-500" />,
    general: <Sparkles className="h-10 w-10 text-primary" />,
  };

  const defaultTitles = {
    vote: 'Głosuj na okazję',
    favorite: 'Zapisz okazję w ulubionych',
    alert: 'Ustaw alert cenowy',
    comment: 'Dołącz do dyskusji',
    general: 'Wymagane zalogowanie',
  };

  const defaultDescriptions = {
    vote: 'Zaloguj się, aby oceniać temperaturę okazji i pomagać społeczności wyłaniać najlepsze promocje!',
    favorite: 'Zaloguj się, aby dodawać najlepsze okazje do swoich ulubionych i mieć do nich stały dostęp.',
    alert: 'Zaloguj się, aby otrzymywać natychmiastowe powiadomienia, gdy cena spadnie!',
    comment: 'Zaloguj się, aby dodawać opinie i dzielić się spostrzeżeniami z innymi łowcami okazji.',
    general: 'Ta funkcja jest dostępna wyłącznie dla zarejestrowanych członków społeczności Okazje Plus.',
  };

  const modalTitle = title || defaultTitles[actionType];
  const modalDescription = description || defaultDescriptions[actionType];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border border-border shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="p-4 bg-muted/60 rounded-2xl border border-border/50 shadow-inner flex items-center justify-center">
            {actionIcons[actionType]}
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed px-2">
            {modalDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">
              Rejestracja w Okazje Plus jest w 100% bezpłatna i zajmuje mniej niż 30 sekund!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              asChild
              variant="default"
              className="w-full h-11 rounded-xl font-semibold gap-2 shadow-md shadow-primary/20"
              onClick={onClose}
            >
              <Link href={`/${locale}/login`}>
                <LogIn className="h-4 w-4" />
                Zaloguj się
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full h-11 rounded-xl font-semibold gap-2 border-border/80"
              onClick={onClose}
            >
              <Link href={`/${locale}/login?tab=register`}>
                <UserPlus className="h-4 w-4" />
                Załóż konto
              </Link>
            </Button>
          </div>

          <div className="text-center pt-1">
            <button
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Kontynuuj jako gość
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
