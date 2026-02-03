"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, increment, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoteControlsProps {
  postId: string;
  threadId: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
  className?: string;
}

export function VoteControls({
  postId,
  threadId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  className,
}: VoteControlsProps) {
  const { user } = useAuth();
  const [voteState, setVoteState] = useState({
    upvotes: initialUpvotes,
    downvotes: initialDownvotes,
    userVote: null as "up" | "down" | null,
    loading: false,
  });

  // Załaduj preferencje głosowania użytkownika
  useEffect(() => {
    if (!user) return;

    const loadUserVote = async () => {
      try {
        const voteRef = doc(db, 'forum_threads', threadId, 'posts', postId, 'votes', user.uid);
        const voteSnap = await getDoc(voteRef);
        
        if (voteSnap.exists()) {
          setVoteState(prev => ({ ...prev, userVote: voteSnap.data().vote as "up" | "down" }));
        }
      } catch (error) {
        console.error("Error loading user vote:", error);
      }
    };

    loadUserVote();
  }, [user, postId]);

  const handleVote = async (voteType: "up" | "down") => {
    if (!user) {
      toast.error("Zaloguj się, aby głosować");
      return;
    }

    if (voteState.loading) return;

    setVoteState(prev => ({ ...prev, loading: true }));

    try {
      const postRef = doc(db, 'forum_threads', threadId, 'posts', postId);
      const voteRef = doc(db, 'forum_threads', threadId, 'posts', postId, 'votes', user.uid);

      // Jeśli użytkownik już głosował
      if (voteState.userVote) {
        // Jeśli kliknął ten sam głos, usuń głos
        if (voteState.userVote === voteType) {
          await deleteDoc(voteRef);
          
          // Zmniejsz licznik
          if (voteType === "up") {
            await updateDoc(postRef, { upvotes: increment(-1) });
            setVoteState(prev => ({ ...prev, upvotes: Math.max(0, prev.upvotes - 1), userVote: null }));
          } else {
            await updateDoc(postRef, { downvotes: increment(-1) });
            setVoteState(prev => ({ ...prev, downvotes: Math.max(0, prev.downvotes - 1), userVote: null }));
          }

          toast.success("Głos usunięty");
        } else {
          // Jeśli kliknął inny głos, zamień głos
          await setDoc(voteRef, {
            vote: voteType,
            userId: user.uid,
            createdAt: new Date().toISOString(),
          });

          // Zmniejsz stary licznik i zwiększ nowy
          if (voteState.userVote === "up") {
            await updateDoc(postRef, {
              upvotes: increment(-1),
              downvotes: increment(1),
            });
            setVoteState(prev => ({ ...prev, upvotes: Math.max(0, prev.upvotes - 1), downvotes: prev.downvotes + 1, userVote: voteType }));
          } else {
            await updateDoc(postRef, {
              upvotes: increment(1),
              downvotes: increment(-1),
            });
            setVoteState(prev => ({ ...prev, upvotes: prev.upvotes + 1, downvotes: Math.max(0, prev.downvotes - 1), userVote: voteType }));
          }

          toast.success("Głos zmieniony");
        }
      } else {
        // Nowy głos
        await setDoc(voteRef, {
          vote: voteType,
          userId: user.uid,
          createdAt: new Date().toISOString(),
        });

        // Zwiększ licznik
        if (voteType === "up") {
          await updateDoc(postRef, { upvotes: increment(1) });
          setVoteState(prev => ({ ...prev, upvotes: prev.upvotes + 1, userVote: voteType }));
        } else {
          await updateDoc(postRef, { downvotes: increment(1) });
          setVoteState(prev => ({ ...prev, downvotes: prev.downvotes + 1, userVote: voteType }));
        }

        toast.success("Głos dodany");
      }
    } catch (error) {
      console.error("Error voting:", error);
      toast.error("Błąd podczas głosowania");
    } finally {
      setVoteState(prev => ({ ...prev, loading: false }));
    }
  };

  const score = voteState.upvotes - voteState.downvotes;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Upvote */}
      <Button
        variant={voteState.userVote === "up" ? "default" : "outline"}
        size="icon"
        className={cn(
          "h-8 w-8 rounded-full",
          voteState.userVote === "up" && "bg-green-600 hover:bg-green-700 text-white"
        )}
        onClick={() => handleVote("up")}
        disabled={voteState.loading}
        title={`Głosuj pozytywnie (${voteState.upvotes})`}
        aria-label={`Głosuj pozytywnie (${voteState.upvotes})`}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium hidden sm:inline">{voteState.upvotes}</span>

      {/* Score */}
      <div className={cn(
        "px-2 py-1 rounded-md font-semibold text-xs sm:text-sm ml-1",
        score > 0 && "text-green-600",
        score < 0 && "text-red-600",
        score === 0 && "text-muted-foreground"
      )}>
        {score > 0 ? "+" : ""}{score}
      </div>

      {/* Downvote */}
      <Button
        variant={voteState.userVote === "down" ? "default" : "outline"}
        size="icon"
        className={cn(
          "h-8 w-8 rounded-full ml-1",
          voteState.userVote === "down" && "bg-red-600 hover:bg-red-700 text-white"
        )}
        onClick={() => handleVote("down")}
        disabled={voteState.loading}
        title={`Głosuj negatywnie (${voteState.downvotes})`}
        aria-label={`Głosuj negatywnie (${voteState.downvotes})`}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium hidden sm:inline">{voteState.downvotes}</span>
    </div>
  );
}
