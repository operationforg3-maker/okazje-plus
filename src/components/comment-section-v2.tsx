'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { addComment, getComments, updateComment } from '@/lib/data';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { Comment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Reply, ChevronDown, ChevronUp, Heart } from 'lucide-react';
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
import { useTranslations } from 'next-intl';
import { likeComment, unlikeComment, hasUserLikedComment } from '@/app/[locale]/profile/actions';

interface CommentSectionProps {
  collectionName: 'products' | 'deals';
  docId: string;
}

export default function CommentSectionV2({ collectionName, docId }: CommentSectionProps) {
  const t = useTranslations('common');
  const { user } = useAuth();
  const [commentState, setCommentState] = useState({
    comments: [] as Comment[],
    newComment: '',
    deletingComment: null as Comment | null,
    isDeleting: false,
    cooldownUntil: 0,
  });
  const [replyState, setReplyState] = useState({
    replyingTo: null as string | null,
    replyContent: {} as Record<string, string>,
    expandedReplies: new Set<string>(),
  });
  const [editState, setEditState] = useState({
    editingId: null as string | null,
    editContent: {} as Record<string, string>,
  });
  // Track likes state: { "commentId": { liked: boolean, count: number } }
  const [likesState, setLikesState] = useState<Record<string, { liked: boolean; count: number }>>({});

  // Sprawdź czy user jest adminem (prawdziwa rola z User doc)
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  // Optymistyczne podbijanie licznika komentarzy
  const commentsCount = useCommentsCount(collectionName === 'deals' ? 'deals' : 'products', docId, undefined);

  useEffect(() => {
    async function fetchComments() {
      const comments = await getComments(collectionName, docId, 100);
      setCommentState(prev => ({ ...prev, comments }));
      
      // Load like status for all comments
      if (user) {
        for (const comment of comments) {
          try {
            const likeStatus = await hasUserLikedComment(docId, comment.id, user.uid);
            setLikesState(prev => ({
              ...prev,
              [comment.id]: likeStatus,
            }));
          } catch (err) {
            console.error('Error loading like status:', err);
          }
        }
      }
    }
    fetchComments();
  }, [collectionName, docId, user]);

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
      toast.error(t('comments.mustBeLoggedIn'));
      return;
    }
    const now = Date.now();
    if (now < commentState.cooldownUntil) {
      const wait = Math.ceil((commentState.cooldownUntil - now) / 1000);
      toast.error(t('comments.waitBeforeNext', { seconds: wait }));
      return;
    }
    if (!commentState.newComment.trim()) {
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
        content: commentState.newComment,
        createdAt: new Date().toISOString(),
        parentId: null,
        repliesCount: 0,
      };
      setCommentState(prev => ({ 
        ...prev, 
        comments: [tempComment, ...prev.comments],
        newComment: ''
      }));
      commentsCount.increment?.(1);

      await addComment(collectionName, docId, user.uid, commentState.newComment);
      void trackFirestoreComment(collectionName === 'deals' ? 'deal' : 'product', docId, user.uid, commentState.newComment.length);
      
      // 5 sekundowy cooldown + pobierz odświeżone komentarze
      const comments = await getComments(collectionName, docId, 100);
      setCommentState(prev => ({ 
        ...prev, 
        comments,
        cooldownUntil: Date.now() + 5000
      }));
      toast.success(t('comments.commentAdded'));
    } catch (error) {
      // rollback optimistic update
      commentsCount.decrement?.(1);
      const comments = await getComments(collectionName, docId, 100);
      setCommentState(prev => ({ ...prev, comments }));
      toast.error(t('comments.commentAddError'));
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby odpowiedzieć.");
      return;
    }
    const now = Date.now();
    if (now < commentState.cooldownUntil) {
      const wait = Math.ceil((commentState.cooldownUntil - now) / 1000);
      toast.error(`Zaczekaj ${wait}s przed dodaniem odpowiedzi.`);
      return;
    }
    
    const content = replyState.replyContent[parentId];
    if (!content?.trim()) {
      return;
    }
    
    try {
      await addComment(collectionName, docId, user.uid, content, parentId);
      void trackFirestoreComment(collectionName === 'deals' ? 'deal' : 'product', docId, user.uid, content.length);

      // Pobierz odświeżone komentarze, wyczyść pole odpowiedzi i podbij cooldown
      const comments = await getComments(collectionName, docId, 100);
      const updatedReplyContent = { ...replyState.replyContent };
      delete updatedReplyContent[parentId];
      const expandedReplies = new Set(replyState.expandedReplies);
      expandedReplies.add(parentId);
      
      setCommentState(prev => ({ 
        ...prev, 
        comments,
        cooldownUntil: Date.now() + 5000
      }));
      setReplyState(prev => ({
        ...prev,
        replyingTo: null,
        replyContent: updatedReplyContent,
        expandedReplies
      }));
      
      toast.success("Odpowiedź została dodana.");
    } catch (error) {
      toast.error("Wystąpił błąd podczas dodawania odpowiedzi.");
    }
  };

  const handleDeleteComment = async () => {
    if (!commentState.deletingComment) return;

    try {
      const response = await fetch(`/api/admin/comments/${commentState.deletingComment.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName, docId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Błąd podczas usuwania');
      }

      toast.success(t('comments.commentDeleted'));
      
      // Refresh comments and clear state in single setState
      const comments = await getComments(collectionName, docId, 100);
      setCommentState(prev => ({ 
        ...prev,
        comments,
        deletingComment: null,
        isDeleting: false
      }));
    } catch (error: any) {
      toast.error(error.message || t('comments.commentDeleteError'));
      console.error('Delete comment error:', error);
      // Still reset deleting state on error
      setCommentState(prev => ({ 
        ...prev,
        isDeleting: false
      }));
    }
  };

  const toggleReplies = (commentId: string) => {
    setReplyState(prev => {
      const updated = new Set(prev.expandedReplies);
      if (updated.has(commentId)) {
        updated.delete(commentId);
      } else {
        updated.add(commentId);
      }
      return { ...prev, expandedReplies: updated };
    });
  };

  const handleToggleLike = async (commentId: string) => {
    if (!user) {
      toast.error(t('comments.mustBeLoggedIn'));
      return;
    }

    const currentLikeState = likesState[commentId];
    const isCurrentlyLiked = currentLikeState?.liked || false;
    const currentCount = currentLikeState?.count || 0;

    // Optimistic update
    setLikesState(prev => ({
      ...prev,
      [commentId]: {
        liked: !isCurrentlyLiked,
        count: isCurrentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
      },
    }));

    try {
      let result;
      if (isCurrentlyLiked) {
        result = await unlikeComment(docId, commentId, user.uid);
      } else {
        result = await likeComment(docId, commentId, user.uid);
      }

      if (result.success && result.likeCount !== undefined) {
        setLikesState(prev => ({
          ...prev,
          [commentId]: {
            liked: !isCurrentlyLiked,
            count: result.likeCount || 0,
          },
        }));
        toast.success(isCurrentlyLiked ? 'Usunięty like' : 'Polubiono!');
      } else {
        // Rollback on error
        setLikesState(prev => ({
          ...prev,
          [commentId]: {
            liked: isCurrentlyLiked,
            count: currentCount,
          },
        }));
        toast.error(result.error || 'Błąd podczas obsługi like\'a');
      }
    } catch (error: any) {
      // Rollback on error
      setLikesState(prev => ({
        ...prev,
        [commentId]: {
          liked: isCurrentlyLiked,
          count: currentCount,
        },
      }));
      toast.error('Błąd podczas obsługi like\'a');
      console.error('Like toggle error:', error);
    }
  };

  const renderComment = (comment: Comment & { replies?: Comment[] }, level: number = 0) => {
    const hasReplies = (comment.repliesCount || 0) > 0 || (comment.replies && comment.replies.length > 0);
    const isExpanded = replyState.expandedReplies.has(comment.id);
    const isReplying = replyState.replyingTo === comment.id;
    const isEditing = editState.editingId === comment.id;

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
              {!isEditing ? (
                <div 
                  className="text-foreground mt-1 whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(comment.content, {
                      ALLOWED_TAGS: [],
                      KEEP_CONTENT: true
                    })
                  }}
                />
              ) : (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={editState.editContent[comment.id] ?? comment.content}
                    onChange={(e) => setEditState(prev => ({...prev, editContent: {...prev.editContent, [comment.id]: e.target.value}}))}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        const newVal = (editState.editContent[comment.id] ?? '').trim();
                        if (!newVal) return;
                        try {
                          await updateComment(collectionName, docId, comment.id, user.uid, newVal);
                          const comments = await getComments(collectionName, docId, 100);
                          setEditState(prev => ({ ...prev, editingId: null }));
                          setCommentState(prev => ({ ...prev, comments }));
                          toast.success(t('comments.commentUpdated'));
                        } catch (e) {
                          toast.error(t('comments.commentUpdateError'));
                        }
                      }}
                    >Zapisz</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditState(prev => ({ ...prev, editingId: null }))}>Anuluj</Button>
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleLike(comment.id)}
                    className={`h-7 px-2 text-xs transition-colors ${
                      likesState[comment.id]?.liked 
                        ? 'text-red-500 hover:text-red-600' 
                        : 'text-muted-foreground hover:text-red-500'
                    }`}
                  >
                    <Heart 
                      className={`h-3 w-3 mr-1 ${likesState[comment.id]?.liked ? 'fill-current' : ''}`}
                    />
                    {likesState[comment.id]?.count || 0}
                  </Button>
                )}

                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyState(prev => ({ ...prev, replyingTo: isReplying ? null : comment.id }))}
                    className="h-7 px-2 text-xs"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Odpowiedz
                  </Button>
                )}

                {user && user.uid === comment.userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditState(prev => ({ ...prev, editingId: isEditing ? null : comment.id }))}
                    className="h-7 px-2 text-xs"
                  >
                    Edytuj
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
                    value={replyState.replyContent[comment.id] || ''}
                    onChange={(e) => setReplyState(prev => ({ ...prev, replyContent: { ...prev.replyContent, [comment.id]: e.target.value } }))}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSubmitReply(comment.id)}>
                      Wyślij odpowiedź
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReplyState(prev => ({ ...prev, replyingTo: null }))}>
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
                onClick={() => setCommentState(prev => ({ ...prev, deletingComment: comment }))}
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

  const organizedComments = organizeComments(commentState.comments);

  return (
    <div className="mt-8">
      <h3 className="font-headline text-2xl font-bold mb-4">
        {t('comments.title')} ({commentState.comments.length})
      </h3>
      
      {user && (
        <div className="mb-6 space-y-2">
          <Textarea 
            placeholder={t('comments.addCommentPlaceholder')}
            value={commentState.newComment}
            onChange={(e) => setCommentState(prev => ({ ...prev, newComment: e.target.value }))}
            className="mb-2 min-h-[100px]"
          />
          <Button onClick={handleSubmitComment} disabled={!commentState.newComment.trim()}>
            {t('comments.addComment')}
          </Button>
        </div>
      )}
      
      <div className="space-y-6">
        {organizedComments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {t('comments.noComments')}
          </p>
        ) : (
          organizedComments.map(comment => renderComment(comment))
        )}
      </div>

      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog open={!!commentState.deletingComment} onOpenChange={(open) => !open && setCommentState(prev => ({ ...prev, deletingComment: null }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('comments.deleteComment')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('comments.confirmDelete')}
              {commentState.deletingComment && (commentState.deletingComment.repliesCount || 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  {t('comments.withReplies', { count: commentState.deletingComment.repliesCount })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commentState.isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              disabled={commentState.isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {commentState.isDeleting ? t('comments.deleting') : t('comments.deleteComment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
