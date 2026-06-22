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
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);

  useEffect(() => {
    setVoteCount(initialVoteCount);
  }, [initialVoteCount]);

  const handleVote = useCallback(async (direction: 'up' | 'down') => {
    if (!user) {
      toast.error(t('auth.loginToVote'));
      return;
    }

    const prevVote = userVote;
    const nextVote: 1 | -1 = direction === 'up' ? 1 : -1;
    const delta = prevVote === nextVote ? 0 : prevVote === null ? nextVote : nextVote - prevVote;

    // Optimistic update for instant feedback on mobile and desktop.
    setUserVote(nextVote);
    if (delta !== 0) setVoteCount((prev) => prev + delta);
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
        // Rollback optimistic update on API-level failure.
        setUserVote(prevVote);
        if (delta !== 0) setVoteCount((prev) => prev - delta);
        if (res.status === 429) {
          toast.error(t('errors.voteError'));
        } else if (res.status === 401) {
          toast.error(t('auth.loginToVote'));
        } else {
          toast.error(json.message || t('errors.voteError'));
        }
        return;
      }

      // Update UI based on server response
      setIsLoading(false);
      if (typeof json.voteCount === 'number') {
        setVoteCount(json.voteCount);
      }
      if (json.userVote === 1 || json.userVote === -1 || json.userVote === null) {
        setUserVote(json.userVote);
      }
      
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
      toast.success(t('messages.thankYouForVote'));
      
    } catch (error) {
      // Rollback optimistic update on network/runtime errors.
      setUserVote(prevVote);
      if (delta !== 0) setVoteCount((prev) => prev - delta);
      console.error("Błąd podczas głosowania:", error);
      toast.error(t('errors.voteError'));
    } finally {
      setIsLoading(false);
    }
  }, [dealId, t, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onSwipeUpvote = (event: Event) => {
      const custom = event as CustomEvent<{ dealId?: string }>;
      if (custom.detail?.dealId !== dealId) return;
      void handleVote('up');
    };

    const onSwipeDownvote = (event: Event) => {
      const custom = event as CustomEvent<{ dealId?: string }>;
      if (custom.detail?.dealId !== dealId) return;
      void handleVote('down');
    };

    window.addEventListener('deal-swipe-upvote', onSwipeUpvote as EventListener);
    window.addEventListener('deal-swipe-downvote', onSwipeDownvote as EventListener);
    return () => {
      window.removeEventListener('deal-swipe-upvote', onSwipeUpvote as EventListener);
      window.removeEventListener('deal-swipe-downvote', onSwipeDownvote as EventListener);
    };
  }, [dealId, handleVote]);

  return (
    <div className="flex items-center space-sm">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('auth.voteUp')}
        onClick={() => handleVote('up')}
        disabled={isLoading}
        className={userVote === 1 ? 'text-green-600 bg-green-100/80 hover:bg-green-100' : undefined}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
      <span className="font-bold text-lg">{voteCount}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('auth.voteDown')}
        onClick={() => handleVote('down')}
        disabled={isLoading}
        className={userVote === -1 ? 'text-red-600 bg-red-100/80 hover:bg-red-100' : undefined}
      >
        <ArrowDown className="h-5 w-5" />
      </Button>
    </div>
  );
}
