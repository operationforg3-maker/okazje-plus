'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  CornerDownRight,
  User,
  Heart,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getFacebookCommentsAction,
  generateAiReplyAction,
  postFacebookReplyAction,
} from '@/app/actions/social-growth';
import { SocialNiche, FbCommentItem } from '@/lib/social-growth-types';

interface CommentsModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  niche: SocialNiche;
  post: {
    id: string;
    title: string;
    fbPostId?: string;
    linkUrl?: string;
  } | null;
}

export function CommentsModerationModal({
  isOpen,
  onClose,
  niche,
  post,
}: CommentsModerationModalProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<FbCommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null);
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  const fetchComments = async () => {
    if (!post?.fbPostId) return;
    setLoading(true);
    try {
      const res = await getFacebookCommentsAction(niche, post.fbPostId);
      if (res.success) {
        setComments(res.comments);
      } else {
        toast({
          title: 'Błąd pobierania komentarzy',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Błąd',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && post?.fbPostId) {
      fetchComments();
    } else {
      setComments([]);
      setReplyingCommentId(null);
      setReplyDraft('');
    }
  }, [isOpen, post?.fbPostId]);

  const handleGenerateAiReply = async (comment: FbCommentItem) => {
    setGeneratingAiId(comment.id);
    setReplyingCommentId(comment.id);
    try {
      const res = await generateAiReplyAction(
        niche,
        post?.title || '',
        comment.message,
        post?.linkUrl
      );
      if (res.success && res.replyText) {
        setReplyDraft(res.replyText);
      } else {
        toast({
          title: 'Błąd generatora AI',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Błąd',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingAiId(null);
    }
  };

  const handleSendReply = async (commentId: string) => {
    if (!replyDraft.trim()) return;
    setSendingReplyId(commentId);
    try {
      const res = await postFacebookReplyAction(niche, commentId, replyDraft.trim());
      if (res.success) {
        toast({
          title: 'Odpowiedź opublikowana!',
          description: 'Komentarz z odpowiedzią został dodany na Facebooku.',
        });
        setReplyingCommentId(null);
        setReplyDraft('');
        fetchComments();
      } else {
        toast({
          title: 'Błąd publikacji odpowiedzi',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Błąd',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSendingReplyId(false as any);
    }
  };

  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <DialogTitle>Komentarze na Facebooku & AI Auto-Reply</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchComments}
              disabled={loading || !post.fbPostId}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Odśwież
            </Button>
          </div>
          <DialogDescription className="line-clamp-1">
            Zarządzaj dyskusją pod postem: <span className="font-semibold text-slate-800 dark:text-slate-200">{post.title}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!post.fbPostId ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <p className="font-medium">Post nie jest jeszcze opublikowany na Facebooku.</p>
              <p className="text-xs">Opublikuj post na Fanpage, aby przeglądać komentarze czytelników.</p>
            </div>
          ) : loading && comments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm">Pobieranie komentarzy z Facebook Graph API...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-lg">
              <MessageSquare className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="font-medium text-sm">Brak komentarzy pod tym postem</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gdy fani skomentują ofertę, pojawią się tutaj i będziesz mógł odpowiedzieć im za pomocą AI!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {comment.from?.name || 'Użytkownik Facebooka'}
                        </span>
                        {comment.createdTime && (
                          <span className="text-[10px] text-muted-foreground ml-2">
                            {new Date(comment.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {comment.likeCount ? (
                        <span className="text-xs text-rose-500 flex items-center gap-1 font-medium">
                          <Heart className="h-3 w-3 fill-rose-500" /> {comment.likeCount}
                        </span>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateAiReply(comment)}
                        disabled={generatingAiId === comment.id}
                        className="h-7 text-xs px-2 gap-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                      >
                        {generatingAiId === comment.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Odpowiedz AI
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 pl-9">
                    {comment.message}
                  </p>

                  {/* Edytor odpowiedzi */}
                  {replyingCommentId === comment.id && (
                    <div className="mt-3 pl-9 space-y-2 border-t pt-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                        <CornerDownRight className="h-3.5 w-3.5" />
                        Twoja odpowiedź w imieniu Strony:
                      </div>

                      <Textarea
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Napisz odpowiedź lub użyj generatora AI..."
                        className="text-xs min-h-[60px]"
                      />

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReplyingCommentId(null);
                            setReplyDraft('');
                          }}
                          className="h-7 text-xs"
                        >
                          Anuluj
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSendReply(comment.id)}
                          disabled={sendingReplyId === comment.id || !replyDraft.trim()}
                          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                        >
                          {sendingReplyId === comment.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Wyślij na Facebooka
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
