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
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [loading, setLoading] = useState(false);

  // Załaduj preferencje głosowania użytkownika
  useEffect(() => {
    if (!user) return;

    const loadUserVote = async () => {
      try {
        const voteRef = doc(db, `forum_posts/${postId}/votes`, user.uid);
        const voteSnap = await getDoc(voteRef);
        
        if (voteSnap.exists()) {
          setUserVote(voteSnap.data().vote as "up" | "down");
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

    if (loading) return;

    setLoading(true);

    try {
      const postRef = doc(db, "forum_posts", postId);
      const voteRef = doc(db, `forum_posts/${postId}/votes`, user.uid);

      // Jeśli użytkownik już głosował
      if (userVote) {
        // Jeśli kliknął ten sam głos, usuń głos
        if (userVote === voteType) {
          await deleteDoc(voteRef);
          
          // Zmniejsz licznik
          if (voteType === "up") {
            await updateDoc(postRef, { upvotes: increment(-1) });
            setUpvotes((prev) => Math.max(0, prev - 1));
          } else {
            await updateDoc(postRef, { downvotes: increment(-1) });
            setDownvotes((prev) => Math.max(0, prev - 1));
          }

          setUserVote(null);
          toast.success("Głos usunięty");
        } else {
          // Jeśli kliknął inny głos, zamień głos
          await setDoc(voteRef, {
            vote: voteType,
            userId: user.uid,
            createdAt: new Date().toISOString(),
          });

          // Zmniejsz stary licznik i zwiększ nowy
          if (userVote === "up") {
            await updateDoc(postRef, {
              upvotes: increment(-1),
              downvotes: increment(1),
            });
            setUpvotes((prev) => Math.max(0, prev - 1));
            setDownvotes((prev) => prev + 1);
          } else {
            await updateDoc(postRef, {
              upvotes: increment(1),
              downvotes: increment(-1),
            });
            setUpvotes((prev) => prev + 1);
            setDownvotes((prev) => Math.max(0, prev - 1));
          }

          setUserVote(voteType);
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
          setUpvotes((prev) => prev + 1);
        } else {
          await updateDoc(postRef, { downvotes: increment(1) });
          setDownvotes((prev) => prev + 1);
        }

        setUserVote(voteType);
        toast.success("Głos dodany");
      }
    } catch (error) {
      console.error("Error voting:", error);
      toast.error("Błąd podczas głosowania");
    } finally {
      setLoading(false);
    }
  };

  const score = upvotes - downvotes;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Upvote */}
      <Button
        variant={userVote === "up" ? "default" : "outline"}
        size="sm"
        onClick={() => handleVote("up")}
        disabled={loading}
        className={cn(
          "gap-1",
          userVote === "up" && "bg-green-600 hover:bg-green-700 text-white"
        )}
      >
        <ThumbsUp className="h-4 w-4" />
        <span className="text-xs font-medium">{upvotes}</span>
      </Button>

      {/* Score */}
      <div className={cn(
        "px-3 py-1 rounded-md font-semibold text-sm",
        score > 0 && "text-green-600",
        score < 0 && "text-red-600",
        score === 0 && "text-muted-foreground"
      )}>
        {score > 0 ? "+" : ""}{score}
      </div>

      {/* Downvote */}
      <Button
        variant={userVote === "down" ? "default" : "outline"}
        size="sm"
        onClick={() => handleVote("down")}
        disabled={loading}
        className={cn(
          "gap-1",
          userVote === "down" && "bg-red-600 hover:bg-red-700 text-white"
        )}
      >
        <ThumbsDown className="h-4 w-4" />
        <span className="text-xs font-medium">{downvotes}</span>
      </Button>
    </div>
  );
}
