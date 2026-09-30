'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Filter,
  Eye,
  Globe,
  Layers,
  Baby,
  Share2,
  MessageSquare,
} from 'lucide-react';
import type { BabyAutopilotConfig, BabyPostQueueItem } from '@/lib/types';
import { GroupShareModal } from '@/components/admin/social/group-share-modal';
import { CommentsModerationModal } from '@/components/admin/social/comments-moderation-modal';
import {
  publishBabyPostAction,
  updateBabyQueueItemAction,
  deleteBabyPostAction,
  approveBabyPostAction,
  rejectBabyPostAction,
} from '@/app/actions/baby-autopilot';

interface BabyQueueTabProps {
  queueItems: BabyPostQueueItem[];
  loading: boolean;
  onRefresh: () => void;
  config?: BabyAutopilotConfig;
}

export function BabyQueueTab({
  queueItems,
  loading,
  onRefresh,
  config,
}: BabyQueueTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareModalPost, setShareModalPost] = useState<BabyPostQueueItem | null>(null);
  const [commentsModalPost, setCommentsModalPost] = useState<BabyPostQueueItem | null>(null);

  // Edit dialog state
  const [editingItem, setEditingItem] = useState<BabyPostQueueItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editMomTip, setEditMomTip] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const filteredItems = queueItems.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const handlePublish = async (id: string) => {
    try {
      setPublishingId(id);
      const res = await publishBabyPostAction(id);

      if (res.success) {
        toast.success('🚀 Opublikowano na Facebooku!');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd publikacji posta');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd procesu publikacji');
    } finally {
      setPublishingId(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await approveBabyPostAction(id);
      if (res.success) {
        toast.success('Post zatwierdzony do publikacji');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd zatwierdzania');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd akcji');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await rejectBabyPostAction(id);
      if (res.success) {
        toast.info('Post odrzucony');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd odrzucania');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd akcji');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz bezpowrotnie usunąć ten post z kolejki?')) return;
    try {
      setDeletingId(id);
      const res = await deleteBabyPostAction(id);
      if (res.success) {
        toast.success('Post usunięty z kolejki');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd usuwania');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd usuwania');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (item: BabyPostQueueItem) => {
    setEditingItem(item);
    setEditContent(item.content);
    setEditMomTip(item.momTip || '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const res = await updateBabyQueueItemAction(editingItem.id, {
        content: editContent,
        momTip: editMomTip || undefined,
      });

      if (res.success) {
        toast.success('Zapisano zmiany w poście');
        setEditingItem(null);
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd zapisu edycji');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd zapisu');
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusBadge = (status: BabyPostQueueItem['status']) => {
    switch (status) {
      case 'posted':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Opublikowany
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> Zatwierdzony (w kolejce)
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1 text-[11px]">
            <AlertCircle className="w-3 h-3" /> Oczekuje na akceptację
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <XCircle className="w-3 h-3" /> Błąd publikacji
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] text-muted-foreground">
            Odrzucony
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Pasek filtrowania i odświeżania */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie posty ({queueItems.length})</SelectItem>
              <SelectItem value="pending">Oczekujące ({queueItems.filter(i => i.status === 'pending').length})</SelectItem>
              <SelectItem value="approved">Zatwierdzone ({queueItems.filter(i => i.status === 'approved').length})</SelectItem>
              <SelectItem value="posted">Opublikowane ({queueItems.filter(i => i.status === 'posted').length})</SelectItem>
              <SelectItem value="failed">Błędy ({queueItems.filter(i => i.status === 'failed').length})</SelectItem>
              <SelectItem value="rejected">Odrzucone ({queueItems.filter(i => i.status === 'rejected').length})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Odśwież kolejkę
        </Button>
      </div>

      {/* Lista postów w kolejce */}
      {filteredItems.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Baby className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-muted-foreground">Brak postów w wybranej kategorii</p>
          <p className="text-xs text-muted-foreground mt-1">
            Użyj zakładki "Pulpit & Generator", aby wygenerować nowe posty AI dla społeczności.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(item => (
            <Card key={item.id} className="overflow-hidden border border-border/80 hover:border-pink-300 transition-colors">
              <CardHeader className="p-4 pb-2 bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {item.botRole === 'bargain_mom' && '🛍️'}
                      {item.botRole === 'safety_expert' && '🩺'}
                      {item.botRole === 'mom_community' && '☕'}
                      {item.botRole === 'montessori_play' && '🎨'}
                    </span>
                    <div>
                      <p className="text-xs font-bold leading-none">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Bot: <span className="font-semibold text-foreground">{item.botName}</span> ·{' '}
                        {new Date(item.createdAt).toLocaleString('pl-PL')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Zdjęcie (jeśli jest) */}
                  {item.imageUrl && (
                    <div className="md:col-span-3 flex-shrink-0">
                      <img
                        src={item.imageUrl}
                        alt="Foto okazji"
                        className="w-full h-32 object-cover rounded-md border"
                      />
                      {item.realPrice && (
                        <p className="text-[11px] font-bold text-center mt-1.5 text-pink-600 dark:text-pink-400">
                          {item.realPrice}{' '}
                          {item.discountStr && (
                            <span className="text-red-500 font-semibold">({item.discountStr})</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Treść posta */}
                  <div className={item.imageUrl ? 'md:col-span-9' : 'md:col-span-12'}>
                    <p className="text-muted-foreground whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto pr-2">
                      {item.content}
                    </p>

                    {/* Pierwszy komentarz */}
                    {item.firstComment && (
                      <div className="mt-2 p-2 rounded bg-pink-50/60 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900 text-[11px]">
                        <span className="font-semibold text-pink-700 dark:text-pink-300">1. Komentarz: </span>
                        <span className="text-muted-foreground break-all">{item.firstComment}</span>
                      </div>
                    )}

                    {/* Informacja o błędzie */}
                    {item.errorMessage && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Błąd: {item.errorMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-3 bg-muted/10 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.fbPostUrl && (
                    <a
                      href={item.fbPostUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Zobacz na FB
                    </a>
                  )}
                  {item.linkUrl && (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Link z trackingiem
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openEditModal(item)}
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edytuj
                  </Button>

                  {item.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-emerald-600 hover:text-emerald-700 border-emerald-300"
                        onClick={() => handleApprove(item.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Zatwierdź
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-red-600 hover:text-red-700 border-red-200"
                        onClick={() => handleReject(item.id)}
                      >
                        Odrzuć
                      </Button>
                    </>
                  )}

                  {item.status === 'posted' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShareModalPost(item)}
                        className="h-8 text-xs bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-medium"
                      >
                        <Share2 className="w-3.5 h-3.5 mr-1" />
                        Udostępnij w grupach
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCommentsModalPost(item)}
                        className="h-8 text-xs bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 font-medium"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                        Komentarze & AI
                      </Button>
                    </>
                  )}

                  {item.status !== 'posted' && (
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-pink-600 hover:bg-pink-700 text-white"
                      disabled={publishingId === item.id}
                      onClick={() => handlePublish(item.id)}
                    >
                      {publishingId === item.id ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Publikacja...
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3 mr-1" />
                          Publikuj na FB
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Modal edycji posta */}
      {editingItem && (
        <Dialog open={Boolean(editingItem)} onOpenChange={open => !open && setEditingItem(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-pink-500" />
                Edycja posta dla Malucha i Mamy
              </DialogTitle>
              <DialogDescription className="text-xs">
                Zmodyfikuj treść posta lub wskazówkę przed publikacją na Facebooku.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tytuł w kolejce:</Label>
                <Input value={editingItem.title} disabled className="text-xs h-8 bg-muted" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Główna treść posta:</Label>
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={10}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Wskazówka od mamy (opcjonalnie):</Label>
                <Input
                  value={editMomTip}
                  onChange={e => setEditMomTip(e.target.value)}
                  className="text-xs h-8"
                  placeholder="np. Sprawdzone, służyło nam przez 2 lata!"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
                Anuluj
              </Button>
              <Button
                size="sm"
                className="bg-pink-600 hover:bg-pink-700 text-white"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  'Zapisz zmiany'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Udostępniania w Grupach i Telegramie */}
      {shareModalPost && (
        <GroupShareModal
          isOpen={Boolean(shareModalPost)}
          onClose={() => setShareModalPost(null)}
          niche="baby"
          post={shareModalPost}
          targetGroups={config?.fb?.targetGroups}
          hasLinkedGroup={Boolean(config?.fb?.linkedGroupId || config?.fb?.groupId)}
          hasTelegram={Boolean(config?.fb?.telegram?.enabled && config?.fb?.telegram?.botToken)}
        />
      )}

      {/* Modal Komentarzy i AI Auto-Reply */}
      {commentsModalPost && (
        <CommentsModerationModal
          isOpen={Boolean(commentsModalPost)}
          onClose={() => setCommentsModalPost(null)}
          niche="baby"
          post={commentsModalPost}
        />
      )}
    </div>
  );
}
