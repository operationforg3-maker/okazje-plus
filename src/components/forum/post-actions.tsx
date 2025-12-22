"use client";

import { useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Edit, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface PostActionsProps {
  postId: string;
  authorUid: string;
  content: string;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function PostActions({
  postId,
  authorUid,
  content,
  onUpdate,
  onDelete,
}: PostActionsProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sprawdź, czy użytkownik może edytować/usuwać
  const canEdit = user && (user.uid === authorUid || user.role === "admin" || user.role === "moderator");

  if (!canEdit) return null;

  const handleSaveEdit = async () => {
    if (!editedContent.trim()) {
      toast.error("Treść nie może być pusta");
      return;
    }

    setLoading(true);

    try {
      const postRef = doc(db, "forum_posts", postId);
      
      await updateDoc(postRef, {
        content: editedContent,
        isEdited: true,
        editedAt: new Date().toISOString(),
      });

      toast.success("Post zaktualizowany");
      setIsEditing(false);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Błąd podczas edycji posta");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      const postRef = doc(db, "forum_posts", postId);
      
      // Soft delete - oznacz jako usunięty zamiast kasować
      await updateDoc(postRef, {
        status: "deleted",
        deletedBy: user?.uid || "unknown",
        deletedAt: new Date().toISOString(),
      });

      toast.success("Post usunięty");
      setShowDeleteDialog(false);
      
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Błąd podczas usuwania posta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {!isEditing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="gap-1"
            >
              <Edit className="h-4 w-4" />
              <span className="text-xs">Edytuj</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-xs">Usuń</span>
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveEdit}
              disabled={loading}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              <span className="text-xs">Zapisz</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setEditedContent(content);
              }}
              disabled={loading}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              <span className="text-xs">Anuluj</span>
            </Button>
          </>
        )}
      </div>

      {/* Dialog edycji */}
      {isEditing && (
        <div className="mt-4 space-y-2">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[120px]"
            placeholder="Wpisz treść posta..."
            disabled={loading}
          />
        </div>
      )}

      {/* Dialog potwierdzenia usunięcia */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potwierdź usunięcie</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">Okno dialogowe potwierdzenia usunięcia posta</DialogDescription>
          <p className="text-sm text-muted-foreground">
            Czy na pewno chcesz usunąć ten post? Ta akcja nie może być cofnięta.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
