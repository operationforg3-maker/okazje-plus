"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
      const voteRef = doc(db, "deals", dealId, "votes", user.uid);
      await setDoc(voteRef, { direction });
      // Opcjonalnie: można dodać toast.success("Głos został oddany!");
      // Aktualizacja licznika głosów w UI w czasie rzeczywistym wymagałaby subskrypcji
      // do kolekcji głosów, co jest bardziej zaawansowane. Na razie licznik
      // zaktualizuje się po odświeżeniu strony.
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
