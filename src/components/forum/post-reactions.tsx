"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile, Heart, ThumbsUp, Flame, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PostReactionsProps {
  postId: string;
  threadId: string;
  initialReactions?: Record<string, string[]>; // emoji -> array of userIds
  className?: string;
}

const AVAILABLE_REACTIONS = [
  { emoji: "👍", name: "Lubię to", icon: ThumbsUp },
  { emoji: "❤️", name: "Kocham to", icon: Heart },
  { emoji: "🔥", name: "Gorące", icon: Flame },
  { emoji: "⭐", name: "Świetne", icon: Star },
  { emoji: "🏆", name: "Najlepsze", icon: Trophy },
  { emoji: "😂", name: "Zabawne", icon: Smile },
];

export function PostReactions({
  postId,
  threadId,
  initialReactions = {},
  className,
}: PostReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Record<string, string[]>>(initialReactions);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Synchronizuj reakcje z Firebase
  useEffect(() => {
    const loadReactions = async () => {
      try {
        const postRef = doc(db, 'forum_threads', threadId, 'posts', postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
          const data = postSnap.data();
          if (data.reactions) {
            setReactions(data.reactions);
          }
        }
      } catch (error) {
        console.error("Error loading reactions:", error);
      }
    };

    loadReactions();
  }, [postId, threadId]);

  const handleReaction = async (emoji: string) => {
    if (!user) {
      toast.error("Zaloguj się, aby reagować");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const postRef = doc(db, 'forum_threads', threadId, 'posts', postId);
      const usersWithThisReaction = reactions[emoji] || [];
      const userAlreadyReacted = usersWithThisReaction.includes(user.uid);

      // Optimistic update
      if (userAlreadyReacted) {
        // Usuń reakcję
        setReactions((prev) => ({
          ...prev,
          [emoji]: prev[emoji].filter((uid) => uid !== user.uid),
        }));

        await updateDoc(postRef, {
          [`reactions.${emoji}`]: arrayRemove(user.uid),
        });

        toast.success("Reakcja usunięta");
      } else {
        // Dodaj reakcję
        setReactions((prev) => ({
          ...prev,
          [emoji]: [...(prev[emoji] || []), user.uid],
        }));

        await updateDoc(postRef, {
          [`reactions.${emoji}`]: arrayUnion(user.uid),
        });

        toast.success("Reakcja dodana");
      }

      setOpen(false);
    } catch (error) {
      console.error("Error reacting:", error);
      toast.error("Błąd podczas dodawania reakcji");
      
      // Revert optimistic update
      setReactions(initialReactions);
    } finally {
      setLoading(false);
    }
  };

  // Filtruj puste reakcje
  const displayedReactions = Object.entries(reactions).filter(
    ([_, userIds]) => userIds && userIds.length > 0
  );

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {/* Wyświetl istniejące reakcje */}
      {displayedReactions.map(([emoji, userIds]) => {
        const userReacted = user && userIds.includes(user.uid);
        
        return (
          <Button
            key={emoji}
            variant={userReacted ? "default" : "outline"}
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full",
              userReacted && "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
            )}
            onClick={() => handleReaction(emoji)}
            disabled={loading}
            title={`${emoji} - ${userIds.length}`}
            aria-label={`${emoji} - ${userIds.length}`}
          >
            <span className="text-base">{emoji}</span>
          </Button>
        );
      })}
      {displayedReactions.length > 0 && (
        <span className="text-xs text-muted-foreground hidden sm:inline ml-1">
          ({displayedReactions.reduce((sum, [_, userIds]) => sum + userIds.length, 0)})
        </span>
      )}

      {/* Przycisk dodaj reakcję */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!user}
            title="Dodaj reakcję"
            aria-label="Dodaj reakcję"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-3 gap-2">
            {AVAILABLE_REACTIONS.map((reaction) => {
              const Icon = reaction.icon;
              const userIds = reactions[reaction.emoji] || [];
              const userReacted = user && userIds.includes(user.uid);

              return (
                <Button
                  key={reaction.emoji}
                  variant={userReacted ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleReaction(reaction.emoji)}
                  disabled={loading}
                  className={cn(
                    "flex-col h-auto py-2 gap-1",
                    userReacted && "bg-blue-100 hover:bg-blue-200"
                  )}
                  title={reaction.name}
                >
                  <span className="text-2xl">{reaction.emoji}</span>
                  <span className="text-xs text-muted-foreground">
                    {userIds.length > 0 ? userIds.length : ""}
                  </span>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
