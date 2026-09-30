'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Share2,
  Copy,
  ExternalLink,
  Send,
  MessageSquare,
  CheckCircle,
  Users,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  sharePostToLinkedGroupAction,
  sendPostToTelegramAction,
  postEngagementStarterCommentAction,
} from '@/app/actions/social-growth';
import { SocialNiche, TargetGroupItem, buildFacebookShareDialogUrl } from '@/lib/social-growth-types';

interface GroupShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  niche: SocialNiche;
  post: {
    id: string;
    title: string;
    content: string;
    realPrice?: string;
    linkUrl: string;
    fbPostId?: string;
    fbPostUrl?: string;
    firstComment?: string;
    engagementCommentText?: string;
    engagementCommentPosted?: boolean;
  } | null;
  targetGroups?: TargetGroupItem[];
  hasLinkedGroup?: boolean;
  hasTelegram?: boolean;
}

export function GroupShareModal({
  isOpen,
  onClose,
  niche,
  post,
  targetGroups = [],
  hasLinkedGroup = false,
  hasTelegram = false,
}: GroupShareModalProps) {
  const { toast } = useToast();
  const [isSharingLinked, setIsSharingLinked] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [isPostingEngagement, setIsPostingEngagement] = useState(false);
  const [customEngagement, setCustomEngagement] = useState('');
  const [copied, setCopied] = useState(false);

  if (!post) return null;

  const postUrl = post.fbPostUrl || (post.fbPostId ? `https://www.facebook.com/${post.fbPostId}` : post.linkUrl);

  const shareTeaser = `🔥 ${post.title}\n` +
    (post.realPrice ? `💰 Cena promocyjna: ${post.realPrice}\n` : '') +
    `👉 Zobacz pełną ofertę i szczegóły: ${postUrl}`;

  const handleCopyTeaser = async () => {
    try {
      await navigator.clipboard.writeText(shareTeaser);
      setCopied(true);
      toast({
        title: 'Skopiowano zajawkę!',
        description: 'Tekst z linkiem jest gotowy do wklejenia na dowolnej grupie.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Błąd kopiowania',
        description: 'Nie udało się skopiować do schowka.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenFbShare = () => {
    const dialogUrl = buildFacebookShareDialogUrl(postUrl, post.title);
    window.open(dialogUrl, '_blank', 'width=650,height=550,menubar=no,toolbar=no');
  };

  const handleShareLinkedGroup = async () => {
    setIsSharingLinked(true);
    try {
      const res = await sharePostToLinkedGroupAction(niche, post.id);
      if (res.success) {
        toast({
          title: 'Udostępniono w grupie!',
          description: res.message || 'Post trafił do Twojej połączonej grupy FB.',
        });
      } else {
        toast({
          title: 'Błąd udostępniania',
          description: res.error || 'Nie udało się opublikować w grupie.',
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
      setIsSharingLinked(false);
    }
  };

  const handleSendTelegram = async () => {
    setIsSendingTelegram(true);
    try {
      const res = await sendPostToTelegramAction(niche, post.id);
      if (res.success) {
        toast({
          title: 'Wysłano na Telegram!',
          description: res.message || 'Powiadomienie trafiło na kanał Telegram.',
        });
      } else {
        toast({
          title: 'Błąd wysyłki Telegram',
          description: res.error || 'Nie udało się wysłać powiadomienia.',
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
      setIsSendingTelegram(false);
    }
  };

  const handlePostEngagementComment = async () => {
    setIsPostingEngagement(true);
    try {
      const res = await postEngagementStarterCommentAction(
        niche,
        post.id,
        customEngagement.trim() || undefined
      );
      if (res.success) {
        toast({
          title: 'Dodano komentarz rozkręcający dyskusję!',
          description: res.message || 'AI bot opublikował pytanie na Facebooku.',
        });
      } else {
        toast({
          title: 'Błąd dodawania komentarza',
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
      setIsPostingEngagement(false);
    }
  };

  const defaultGroups: TargetGroupItem[] = targetGroups.length > 0 ? targetGroups : [
    {
      id: 'dg-1',
      name: niche === 'fishing' ? 'Wędkarstwo Polska - Sprzęt i Okazje' : niche === 'baby' ? 'Mamy z Polski - Promocje i Porady' : 'Łowcy Promocji i Okazji PL',
      url: 'https://www.facebook.com/groups',
      category: 'Główna',
    },
    {
      id: 'dg-2',
      name: niche === 'fishing' ? 'Karpie i Spławik - Giełda Sprzętu' : niche === 'baby' ? 'Wyprawka dla Malucha - Oceny i Rabaty' : 'Elektronika i Gadżety Wyprzedaże',
      url: 'https://www.facebook.com/groups',
      category: 'Tematyczna',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            <DialogTitle>Centrum Dystrybucji i Zasięgów: Udostępnij Post</DialogTitle>
          </div>
          <DialogDescription>
            Rozszerz zasięgi posta na grupy Facebooka, podbij algorytm starterem dyskusji lub wyślij powiadomienie Push na Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Karta Posta */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
              {post.title}
            </div>
            {post.realPrice && (
              <div className="text-xs text-emerald-600 font-medium mt-0.5">
                Cena: {post.realPrice}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 break-all">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span>{postUrl}</span>
            </div>
          </div>

          {/* Szybkie Akcje 1-Click */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleCopyTeaser}
              className="flex items-center justify-center gap-2 h-11"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Skopiowano zajawkę!' : 'Kopiuj treść i link'}</span>
            </Button>

            <Button
              onClick={handleOpenFbShare}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 h-11"
            >
              <Share2 className="h-4 w-4" />
              <span>Otwórz udostępnianie na FB</span>
            </Button>
          </div>

          {/* Crossposting do Połączonej Grupy */}
          {hasLinkedGroup && (
            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-sm">Połączona Grupa Fanpage'a</span>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Własna</Badge>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleShareLinkedGroup}
                  disabled={isSharingLinked}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSharingLinked ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Udostępnianie...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5 mr-1.5" />
                      Udostępnij w grupie
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatycznie publikuje wpis w Twojej grupie połączonej z Fanpage bez konieczności ręcznego wklejania.
              </p>
            </div>
          )}

          {/* Kanał Telegram */}
          {hasTelegram && (
            <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-sky-600" />
                  <span className="font-semibold text-sm">Kanał Telegram (Push Alert)</span>
                  <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700">100% Zasięg</Badge>
                </div>
                <Button
                  size="sm"
                  onClick={handleSendTelegram}
                  disabled={isSendingTelegram}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {isSendingTelegram ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Wysyłanie...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Wyślij na Telegram
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dostarcza powiadomienie push z bezpośrednim linkiem afiliacyjnym do wszystkich subskrybentów na telefonie.
              </p>
            </div>
          )}

          {/* AI Starter Dyskusji pod postem */}
          <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-sm">AI Starter Dyskusji (Podbijanie Algorytmu FB)</span>
              </div>
              {post.engagementCommentPosted && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  <CheckCircle className="h-3 w-3 mr-1" /> Opublikowano
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Dodaje pod postem angażujące pytanie otwarte od AI bota, zachęcające społeczność do komentowania.
            </p>

            <div className="flex items-center gap-2">
              <Input
                placeholder={post.engagementCommentText || 'Wpisz treść komentarza lub pozostaw puste, aby wygenerować przez AI...'}
                value={customEngagement}
                onChange={(e) => setCustomEngagement(e.target.value)}
                className="text-xs h-9"
              />
              <Button
                size="sm"
                onClick={handlePostEngagementComment}
                disabled={isPostingEngagement || !post.fbPostId}
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                {isPostingEngagement ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Dodaj komentarz
                  </>
                )}
              </Button>
            </div>
            {!post.fbPostId && (
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Post musi być najpierw opublikowany na Facebooku, aby dodać komentarz.
              </div>
            )}
          </div>

          {/* Lista Grup Docelowych */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Grupy docelowe do ręcznego udostępnienia</span>
              <span>1-Click Deep Links</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {defaultGroups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-md hover:bg-slate-100 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-xs">{g.name}</span>
                    {g.category && (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                        {g.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        handleCopyTeaser();
                        window.open(g.url, '_blank');
                      }}
                      className="h-7 text-xs px-2 flex items-center gap-1"
                    >
                      <span>Kopiuj i Otwórz grupę</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
