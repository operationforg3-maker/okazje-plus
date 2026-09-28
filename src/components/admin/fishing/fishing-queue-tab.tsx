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
  ShieldAlert,
  Loader2,
  RefreshCw,
  Filter,
  Eye,
  Globe,
  Layers
} from 'lucide-react';
import type { FishingPostQueueItem } from '@/lib/types';
import {
  publishFishingPostAction,
  updateFishingQueueItemAction,
  deleteFishingQueueItemAction,
} from '@/app/actions/fishing-autopilot';

interface FishingQueueTabProps {
  queueItems: FishingPostQueueItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function FishingQueueTab({
  queueItems,
  loading,
  onRefresh,
}: FishingQueueTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit dialog state
  const [editingItem, setEditingItem] = useState<FishingPostQueueItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAlibi, setEditAlibi] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const filteredItems = queueItems.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const handlePublish = async (id: string, targets: { fb: boolean; portal: boolean }) => {
    try {
      setPublishingId(id);
      const res = await publishFishingPostAction(id, {
        publishToFb: targets.fb,
        publishToPortal: targets.portal,
      });

      if (res.success) {
        toast.success(
          targets.fb && targets.portal
            ? '🚀 Opublikowano na Facebooku i w Portalu!'
            : targets.fb
              ? '🚀 Opublikowano na Facebooku!'
              : '✅ Opublikowano w Portalu Okazje Plus!'
        );
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd publikacji');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd publikacji');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten post z kolejki?')) return;
    try {
      setDeletingId(id);
      const res = await deleteFishingQueueItemAction(id);
      if (res.success) {
        toast.success('Post usunięty z kolejki');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd usuwania');
      }
    } catch {
      toast.error('Błąd usuwania posta');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditDialog = (item: FishingPostQueueItem) => {
    setEditingItem(item);
    setEditContent(item.content);
    setEditAlibi(item.wifeAlibi || '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const res = await updateFishingQueueItemAction(editingItem.id, {
        content: editContent,
        wifeAlibi: editAlibi || undefined,
      });
      if (res.success) {
        toast.success('Zapisano zmiany w poście');
        setEditingItem(null);
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd zapisu zmian');
      }
    } catch {
      toast.error('Błąd zapisu');
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusBadge = (status: FishingPostQueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-500 border-amber-500/40 bg-amber-500/10">Oczekuje na zatwierdzenie</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/40 bg-blue-500/10">Zatwierdzony (w kolejce)</Badge>;
      case 'posted':
        return <Badge variant="default" className="bg-emerald-600 text-white">Opublikowany</Badge>;
      case 'failed':
        return <Badge variant="destructive">Błąd publikacji</Badge>;
      case 'rejected':
        return <Badge variant="secondary">Odrzucony</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Filter & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base">Kolejka Moderacji Postów Wędkarskich</h3>
            <p className="text-xs text-muted-foreground">
              Przeglądaj, edytuj i zatwierdzaj posty przed publikacją na grupie FB i portalu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] text-xs">
              <SelectValue placeholder="Filtruj wg statusu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="pending">Oczekujące (Pending)</SelectItem>
              <SelectItem value="approved">Zatwierdzone (Approved)</SelectItem>
              <SelectItem value="posted">Opublikowane (Posted)</SelectItem>
              <SelectItem value="failed">Błędy (Failed)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
        </div>
      </div>

      {/* Queue Items List */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Ładowanie kolejki postów...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-2">
            <span className="text-4xl">🎣</span>
            <h4 className="font-semibold text-base">Brak postów w wybranym filtrze</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Użyj zakładki <strong>Centrum Dowodzenia</strong>, aby wygenerować post przez AI lub dodaj okazję ręcznie.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isPublishing = publishingId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <Card key={item.id} className="overflow-hidden border-border/80 hover:border-border transition-all">
                <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {item.botName}
                    </span>
                    <span>•</span>
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString('pl-PL')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {item.targets.facebook && (
                      <Badge variant="outline" className="text-[11px] text-blue-500 border-blue-500/30">
                        Facebook
                      </Badge>
                    )}
                    {item.targets.portal && (
                      <Badge variant="outline" className="text-[11px] text-amber-500 border-amber-500/30">
                        Portal Okazje+
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Text & Details Column */}
                  <div className="lg:col-span-8 space-y-3">
                    <h4 className="font-bold text-sm leading-tight">
                      {item.title}
                    </h4>

                    {/* Wife Alibi Box if exists */}
                    {item.wifeAlibi && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Oficjalne Alibi dla Żony:</strong> {item.wifeAlibi}
                        </div>
                      </div>
                    )}

                    {/* Content Preview */}
                    <div className="p-3 bg-muted/40 rounded-lg text-xs font-sans whitespace-pre-line leading-relaxed border">
                      {item.content}
                    </div>

                    {/* First comment */}
                    {item.firstComment && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <span className="font-sans font-semibold">1. komentarz:</span> {item.firstComment}
                      </p>
                    )}

                    {/* Error message if failed */}
                    {item.errorMessage && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Błąd publikacji: {item.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail & Meta Column */}
                  <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
                    {item.imageUrl ? (
                      <div className="rounded-lg overflow-hidden border bg-muted/30 aspect-video relative max-h-44">
                        <img
                          src={item.imageUrl}
                          alt="Miniaturka"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        {item.realPrice && (
                          <Badge className="absolute top-2 right-2 bg-emerald-600 text-white font-mono text-xs">
                            {item.realPrice}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/20 p-4 text-center text-muted-foreground text-xs aspect-video flex items-center justify-center">
                        Brak zdjęcia (post tekstowy)
                      </div>
                    )}

                    {/* Published links if available */}
                    <div className="space-y-1 text-xs">
                      {item.fbPostUrl && (
                        <a
                          href={item.fbPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:underline font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Otwórz post na Facebooku
                        </a>
                      )}
                      {item.portalDealId && (
                        <a
                          href={`https://okazjeplus.pl/pl/deals/${item.portalDealId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-amber-500 hover:underline font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Otwórz ofertę na Okazje Plus
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="py-2.5 px-4 bg-muted/10 border-t flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                      className="text-xs h-8"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      Edytuj
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      disabled={isDeleting}
                      className="text-xs h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Usuń
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handlePublish(item.id, { fb: true, portal: false })}
                      disabled={isPublishing}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1"
                    >
                      {isPublishing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Publikuj na FB
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handlePublish(item.id, { fb: true, portal: true })}
                      disabled={isPublishing}
                      className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-xs h-8 gap-1 font-semibold"
                    >
                      {isPublishing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      Publikuj Wszędzie
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edycja Posta przed Publikacją</DialogTitle>
            <DialogDescription>
              Wprowadź poprawki w treści lub alibi przed zatwierdzeniem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Treść posta</Label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[180px] text-xs font-sans mt-1 leading-relaxed"
              />
            </div>

            {editingItem?.wifeAlibi && (
              <div>
                <Label className="text-xs font-semibold text-amber-500">Oficjalne Alibi dla Żony</Label>
                <Input
                  value={editAlibi}
                  onChange={(e) => setEditAlibi(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingItem(null)}
              disabled={savingEdit}
            >
              Anuluj
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Zapisz Zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
