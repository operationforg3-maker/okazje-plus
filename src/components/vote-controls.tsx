"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trackVote } from "@/lib/analytics";

interface VoteControlsProps {
  dealId: string;
  initialVoteCount: number;
}

export function VoteControls({ dealId, initialVoteCount }: VoteControlsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  // Stan dla licznika głosów będzie potrzebny, jeśli będziemy go aktualizować w czasie rzeczywistym
  // Na razie polegamy na initialVoteCount

  const handleVote = async (direction: 'up' | 'down') => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby głosować.");
      return;
    }

    setIsLoading(true);
    try {
      // Use server API to handle voting (transactional, idempotent)
      const action = direction === 'up' ? 'up' : 'down';
      const res = await fetch(`/api/deals/${dealId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId: user.uid }), // temporary userId for dev
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Vote failed');
      }

      // Update UI based on server response
      if (typeof json.temperature === 'number') setIsLoading(false);
      // We don't have direct deal object here; consumer can re-fetch to update values.
      trackVote('deal', dealId, direction);
    } catch (error) {
      console.error("Błąd podczas głosowania:", error);
      toast.error("Wystąpił błąd podczas głosowania.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleVote('up')}
        disabled={isLoading}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
      <span className="font-bold text-lg">{initialVoteCount}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleVote('down')}
        disabled={isLoading}
      >
        <ArrowDown className="h-5 w-5" />
      </Button>
    </div>
  );
}
