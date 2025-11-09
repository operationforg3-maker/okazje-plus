'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { addComment, getComments } from '@/lib/data';
import { Comment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Trash2, AlertTriangle } from 'lucide-react';
import { trackFirestoreComment } from '@/lib/analytics';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CommentSectionProps {
  collectionName: 'products' | 'deals';
  docId: string;
}

export default function CommentSection({ collectionName, docId }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sprawdź czy user jest adminem
  const isAdmin = user?.email?.includes('@admin') || false; // Uproszczone - w produkcji sprawdź role w user doc

  useEffect(() => {
    async function fetchComments() {
      setComments(await getComments(collectionName, docId));
    }
    fetchComments();
  }, [collectionName, docId]);

  const handleSubmitComment = async () => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby dodać komentarz.");
      return;
    }
    if (!newComment.trim()) {
      return;
    }
    try {
      await addComment(collectionName, docId, user.uid, newComment);
      void trackFirestoreComment(collectionName === 'deals' ? 'deal' : 'product', docId, user.uid, newComment.length);
      setNewComment('');
      // Refresh comments
      setComments(await getComments(collectionName, docId));
      toast.success("Komentarz został dodany.");
    } catch (error) {
      toast.error("Wystąpił błąd podczas dodawania komentarza.");
    }
  };

  const handleDeleteComment = async () => {
    if (!deletingComment) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/comments/${deletingComment.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName, docId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Błąd podczas usuwania');
      }

      toast.success('Komentarz został usunięty');
      
      // Refresh comments
      setComments(await getComments(collectionName, docId));
    } catch (error: any) {
      toast.error(error.message || 'Wystąpił błąd podczas usuwania komentarza');
      console.error('Delete comment error:', error);
    } finally {
      setIsDeleting(false);
      setDeletingComment(null);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="font-headline text-2xl font-bold mb-4">Komentarze</h3>
      {user && (
        <div className="mb-6">
          <Textarea 
            placeholder="Dodaj swój komentarz..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="mb-2"
          />
          <Button onClick={handleSubmitComment}>Dodaj komentarz</Button>
        </div>
      )}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Brak komentarzy. Bądź pierwszy!
          </p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="border-l-4 border-primary pl-4 py-2 relative group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    {comment.userDisplayName || `Użytkownik ${comment.userId.substring(0, 6)}...`}
                    <span className="mx-2">•</span>
                    <span className="text-xs">
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('pl-PL') : 'niedawno'}
                    </span>
                  </p>
                  <p className="text-foreground">{comment.content}</p>
                </div>
                
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingComment(comment)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog open={!!deletingComment} onOpenChange={(open) => !open && setDeletingComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Usuń komentarz
            </AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten komentarz? Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Usuwam...' : 'Usuń komentarz'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
