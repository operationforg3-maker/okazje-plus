"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { trackVote } from "@/lib/analytics";

interface VoteControlsProps {
  dealId: string;
  initialVoteCount: number;
}

export function VoteControls({ dealId, initialVoteCount }: VoteControlsProps) {
  const { user } = useAuth();
  const t = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);
  // Stan dla licznika głosów będzie potrzebny, jeśli będziemy go aktualizować w czasie rzeczywistym
  // Na razie polegamy na initialVoteCount

  const handleVote = useCallback(async (direction: 'up' | 'down') => {
    if (!user) {
      toast.error(t('auth.loginToVote'));
      return;
    }

    setIsLoading(true);
    try {
      // Pobierz Firebase Auth token z aktualnego użytkownika Firebase
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        toast.error(t('auth.sessionExpired'));
        return;
      }
      
      const token = await firebaseUser.getIdToken();
      
      const action = direction === 'up' ? 'up' : 'down';
      const res = await fetch(`/api/deals/${dealId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Wyślij zweryfikowany token
        },
        body: JSON.stringify({ action }),
      });
      
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        if (res.status === 429) {
          toast.error('Zbyt wiele głosów - poczekaj chwilę');
        } else if (res.status === 401) {
          toast.error('Musisz być zalogowany aby głosować');
        } else {
          toast.error(json.message || 'Błąd podczas głosowania');
        }
        return;
      }

      // Update UI based on server response
      setIsLoading(false);
      
      // Notify other components to refresh deal data
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('deal-voted', { detail: { dealId, ...json } }));
        }
      } catch (e) {
        // noop
      }
      
      trackVote('deal', dealId, direction);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([50]);
      }
      toast.success(`Głos ${direction === 'up' ? 'za' : 'przeciw'} został zapisany`);
      
    } catch (error) {
      console.error("Błąd podczas głosowania:", error);
      toast.error(t('errors.voteError'));
    } finally {
      setIsLoading(false);
    }
  }, [dealId, t, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onSwipeDownvote = (event: Event) => {
      const custom = event as CustomEvent<{ dealId?: string }>;
      if (custom.detail?.dealId !== dealId) return;
      void handleVote('down');
    };

    window.addEventListener('deal-swipe-downvote', onSwipeDownvote as EventListener);
    return () => {
      window.removeEventListener('deal-swipe-downvote', onSwipeDownvote as EventListener);
    };
  }, [dealId, handleVote]);

  return (
    <div className="flex items-center space-sm">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Głosuj za"
        onClick={() => handleVote('up')}
        disabled={isLoading}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
      <span className="font-bold text-lg">{initialVoteCount}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Głosuj przeciw"
        onClick={() => handleVote('down')}
        disabled={isLoading}
      >
        <ArrowDown className="h-5 w-5" />
      </Button>
    </div>
  );
}
