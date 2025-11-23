'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { addComment, getComments } from '@/lib/data';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { Comment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Reply, ChevronDown, ChevronUp } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DOMPurify from 'isomorphic-dompurify';

interface CommentSectionProps {
  collectionName: 'products' | 'deals';
  docId: string;
}

export default function CommentSectionV2({ collectionName, docId }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Sprawdź czy user jest adminem (prawdziwa rola z User doc)
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  // Optymistyczne podbijanie licznika komentarzy
  const commentsCount = useCommentsCount(collectionName === 'deals' ? 'deals' : 'products', docId, undefined);

  useEffect(() => {
    async function fetchComments() {
      setComments(await getComments(collectionName, docId, 100));
    }
    fetchComments();
  }, [collectionName, docId]);

  // Organizuj komentarze w strukturę parent-child
  const organizeComments = (allComments: Comment[]) => {
    const topLevel = allComments.filter(c => !c.parentId);
    const replies = allComments.filter(c => c.parentId);
    
    const commentMap = new Map<string, Comment & { replies: Comment[] }>();
    
    topLevel.forEach(c => {
      commentMap.set(c.id, { ...c, replies: [] });
    });
    
    replies.forEach(r => {
      const parent = commentMap.get(r.parentId!);
      if (parent) {
        parent.replies.push(r);
      }
    });
    
    return Array.from(commentMap.values());
  };

  const handleSubmitComment = async () => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby dodać komentarz.");
      return;
    }
    if (!newComment.trim()) {
      return;
    }
    try {
      // OPTIMISTIC UI: pokaż lokalnie komentarz i podbij licznik
      const tempComment: Comment = {
        id: `tmp-${Date.now()}`,
        dealId: collectionName === 'deals' ? docId : '',
        userId: user.uid,
        userDisplayName: user.displayName || 'Ty',
        userPhotoURL: user.photoURL || undefined,
        content: newComment,
        createdAt: new Date().toISOString(),
        parentId: null,
        repliesCount: 0,
      };
      setComments((prev) => [tempComment, ...prev]);
      commentsCount.increment?.(1);
      setNewComment('');

      await addComment(collectionName, docId, user.uid, newComment);
      void trackFirestoreComment(collectionName === 'deals' ? 'deal' : 'product', docId, user.uid, newComment.length);

      // Po zapisie pobierz odświeżone komentarze z serwera
      setComments(await getComments(collectionName, docId, 100));
      toast.success("Komentarz został dodany.");
    } catch (error) {
      // rollback optimistic update
      commentsCount.decrement?.(1);
      setComments(await getComments(collectionName, docId, 100));
      toast.error("Wystąpił błąd podczas dodawania komentarza.");
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby odpowiedzieć.");
      return;
    }
    
    const content = replyContent[parentId];
    if (!content?.trim()) {
      return;
    }
    
    try {
      await addComment(collectionName, docId, user.uid, content, parentId);
      void trackFirestoreComment(collectionName === 'deals' ? 'deal' : 'product', docId, user.uid, content.length);

      // Pobierz odświeżone komentarze
      setComments(await getComments(collectionName, docId, 100));
      
      // Wyczyść pole odpowiedzi
      setReplyContent(prev => {
        const updated = { ...prev };
        delete updated[parentId];
        return updated;
      });
      setReplyingTo(null);
      
      // Automatycznie rozwiń odpowiedzi
      setExpandedReplies(prev => new Set(prev).add(parentId));
      
      toast.success("Odpowiedź została dodana.");
    } catch (error) {
      toast.error("Wystąpił błąd podczas dodawania odpowiedzi.");
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
      setComments(await getComments(collectionName, docId, 100));
    } catch (error: any) {
      toast.error(error.message || 'Wystąpił błąd podczas usuwania komentarza');
      console.error('Delete comment error:', error);
    } finally {
      setIsDeleting(false);
      setDeletingComment(null);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const updated = new Set(prev);
      if (updated.has(commentId)) {
        updated.delete(commentId);
      } else {
        updated.add(commentId);
      }
      return updated;
    });
  };

  const renderComment = (comment: Comment & { replies?: Comment[] }, level: number = 0) => {
    const hasReplies = (comment.repliesCount || 0) > 0 || (comment.replies && comment.replies.length > 0);
    const isExpanded = expandedReplies.has(comment.id);
    const isReplying = replyingTo === comment.id;

    return (
      <div key={comment.id} className={level > 0 ? 'ml-8 mt-4' : ''}>
        <div className="border-l-4 border-primary pl-4 py-2 relative group">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <Avatar className="h-8 w-8 mt-1">
              <AvatarImage src={comment.userPhotoURL} alt={comment.userDisplayName} />
              <AvatarFallback>{comment.userDisplayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground">
                  {comment.userDisplayName || `Użytkownik ${comment.userId.substring(0, 6)}...`}
                </p>
                <span className="text-xs text-muted-foreground">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('pl-PL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'niedawno'}
                </span>
                {comment.edited && (
                  <span className="text-xs text-muted-foreground italic">(edytowany)</span>
                )}
              </div>
              <div 
                className="text-foreground mt-1 whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(comment.content, {
                    ALLOWED_TAGS: [], // Usuń wszystkie HTML tagi
                    KEEP_CONTENT: true // Zachowaj text content
                  })
                }}
              />
              
              {/* Actions */}
              <div className="flex items-center gap-3 mt-2">
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Odpowiedz
                  </Button>
                )}
                
                {hasReplies && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReplies(comment.id)}
                    className="h-7 px-2 text-xs"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Ukryj odpowiedzi ({comment.repliesCount || comment.replies?.length || 0})
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Pokaż odpowiedzi ({comment.repliesCount || comment.replies?.length || 0})
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* Reply form */}
              {isReplying && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Napisz odpowiedź..."
                    value={replyContent[comment.id] || ''}
                    onChange={(e) => setReplyContent(prev => ({ ...prev, [comment.id]: e.target.value }))}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSubmitReply(comment.id)}>
                      Wyślij odpowiedź
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                      Anuluj
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Delete button (tylko dla adminów) */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingComment(comment)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Render replies */}
        {isExpanded && comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(reply => renderComment(reply, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const organizedComments = organizeComments(comments);

  return (
    <div className="mt-8">
      <h3 className="font-headline text-2xl font-bold mb-4">
        Komentarze ({comments.length})
      </h3>
      
      {user && (
        <div className="mb-6 space-y-2">
          <Textarea 
            placeholder="Dodaj swój komentarz..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="mb-2 min-h-[100px]"
          />
          <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
            Dodaj komentarz
          </Button>
        </div>
      )}
      
      <div className="space-y-6">
        {organizedComments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Brak komentarzy. Bądź pierwszy!
          </p>
        ) : (
          organizedComments.map(comment => renderComment(comment))
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
              {deletingComment && (deletingComment.repliesCount || 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  UWAGA: Ten komentarz ma {deletingComment.repliesCount} odpowiedzi, które również zostaną usunięte.
                </span>
              )}
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
