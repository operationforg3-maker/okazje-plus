"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Edit, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface PostActionsProps {
  postId: string;
  threadId: string;
  authorUid: string;
  content: string;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function PostActions({
  postId,
  threadId,
  authorUid,
  content,
  onUpdate,
  onDelete,
}: PostActionsProps) {
  const { user, getIdToken } = useAuth();
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
      const token = await getIdToken();
      if (!token) throw new Error('Brak autoryzacji');

      const response = await fetch(`/api/forum/threads/${threadId}/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editedContent }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Błąd podczas edycji posta');
      }

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
      const token = await getIdToken();
      if (!token) throw new Error('Brak autoryzacji');

      const response = await fetch(`/api/forum/threads/${threadId}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Błąd podczas usuwania posta');
      }

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
      <div className="flex items-center gap-1">
        {!isEditing ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setIsEditing(true)}
              title="Edytuj post"
              aria-label="Edytuj post"
            >
              <Edit className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              title="Usuń post"
              aria-label="Usuń post"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleSaveEdit}
              disabled={loading}
              title="Zapisz zmiany"
              aria-label="Zapisz zmiany"
            >
              <Save className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => {
                setIsEditing(false);
                setEditedContent(content);
              }}
              disabled={loading}
              title="Anuluj edycję"
              aria-label="Anuluj edycję"
            >
              <X className="h-4 w-4" />
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
