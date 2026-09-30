'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Send,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Edit3,
  Clock,
  RefreshCw,
  AlertTriangle,
  Layers,
  Sparkles,
  Share2,
  MessageSquare,
} from 'lucide-react';
import type { GeneralAutopilotConfig, GeneralPostQueueItem } from '@/lib/types';
import { GroupShareModal } from '@/components/admin/social/group-share-modal';
import { CommentsModerationModal } from '@/components/admin/social/comments-moderation-modal';
import {
  approveGeneralPostAction,
  rejectGeneralPostAction,
  deleteGeneralPostAction,
  publishGeneralPostAction,
  updateGeneralQueueItemAction,
} from '@/app/actions/general-autopilot';

interface GeneralQueueTabProps {
  queueItems: GeneralPostQueueItem[];
  loading: boolean;
  onRefresh: () => void;
  config?: GeneralAutopilotConfig;
}

export function GeneralQueueTab({
  queueItems,
  loading,
  onRefresh,
  config,
}: GeneralQueueTabProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'posted' | 'failed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [shareModalPost, setShareModalPost] = useState<GeneralPostQueueItem | null>(null);
  const [commentsModalPost, setCommentsModalPost] = useState<GeneralPostQueueItem | null>(null);

  const filteredItems = queueItems.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await approveGeneralPostAction(id);
      if (res.success) {
        toast.success('Post został zatwierdzony');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd zatwierdzania');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await rejectGeneralPostAction(id);
      if (res.success) {
        toast.info('Post został odrzucony');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd odrzucania');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz trwale usunąć ten post z kolejki?')) return;
    try {
      setActionLoading(id);
      const res = await deleteGeneralPostAction(id);
      if (res.success) {
        toast.success('Post usunięty z kolejki');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd usuwania');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await publishGeneralPostAction(id);
      if (res.success) {
        toast.success('🎉 Post opublikowany na Facebooku!');
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd publikacji na Facebooku');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const startEditing = (item: GeneralPostQueueItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const saveEdit = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await updateGeneralQueueItemAction(id, { content: editContent });
      if (res.success) {
        toast.success('Zapisano zaktualizowaną treść');
        setEditingId(null);
        onRefresh();
      } else {
        toast.error(res.error || 'Błąd zapisu');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: GeneralPostQueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Oczekuje na akceptację</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Zatwierdzony (w kolejce)</Badge>;
      case 'posted':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Opublikowany</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Błąd</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Odrzucony</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Kolejka Postów Okazje Plus ({queueItems.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Przeglądaj wygenerowane posty, moderuj treść i decyduj o publikacji na Facebooku.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs h-7"
          >
            Wszystkie ({queueItems.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
            className="text-xs h-7"
          >
            Oczekujące ({queueItems.filter(i => i.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'approved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('approved')}
            className="text-xs h-7"
          >
            Zatwierdzone ({queueItems.filter(i => i.status === 'approved').length})
          </Button>
          <Button
            variant={filter === 'posted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('posted')}
            className="text-xs h-7"
          >
            Opublikowane ({queueItems.filter(i => i.status === 'posted').length})
          </Button>
        </div>
      </div>

      {/* Queue Items List */}
      {filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-sm font-semibold">Brak postów w tej kategorii</p>
            <p className="text-xs text-muted-foreground">
              Skorzystaj z zakładki <strong>"Centrum Dowodzenia"</strong>, aby wygenerować nowy post.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(item => (
            <Card key={item.id} className="border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{item.title}</span>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Autor: <strong>{item.botName}</strong></span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleString('pl-PL')}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 sm:px-6 py-2 space-y-3">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={8}
                      className="text-xs font-mono leading-relaxed"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-xs h-7">
                        Anuluj
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(item.id)} disabled={actionLoading === item.id} className="text-xs h-7">
                        {actionLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Zapisz zmiany
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded border">
                    {item.content}
                  </p>
                )}

                {/* Comment Link Preview */}
                {item.firstComment && (
                  <div className="bg-muted/40 p-2.5 rounded text-xs border border-border/50 text-muted-foreground font-mono break-all">
                    💬 {item.firstComment}
                  </div>
                )}

                {/* Error message if failed */}
                {item.errorMessage && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Błąd publikacji: {item.errorMessage}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="px-4 sm:px-6 py-3 bg-muted/20 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.fbPostUrl && (
                    <Button variant="outline" size="sm" asChild className="text-xs h-7">
                      <a href={item.fbPostUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Zobacz na FB
                      </a>
                    </Button>
                  )}
                  {item.status === 'posted' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShareModalPost(item)}
                        className="text-xs h-7 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-medium"
                      >
                        <Share2 className="w-3 h-3 mr-1" />
                        Udostępnij w grupach
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCommentsModalPost(item)}
                        className="text-xs h-7 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 font-medium"
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Komentarze & AI
                      </Button>
                    </>
                  )}
                  {editingId !== item.id && (
                    <Button variant="ghost" size="sm" onClick={() => startEditing(item)} className="text-xs h-7">
                      <Edit3 className="w-3 h-3 mr-1" />
                      Edytuj
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    disabled={actionLoading === item.id}
                    className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Usuń
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(item.id)}
                        disabled={actionLoading === item.id}
                        className="text-xs h-7 text-muted-foreground"
                      >
                        Odrzuć
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoading === item.id}
                        className="text-xs h-7"
                      >
                        Zatwierdź
                      </Button>
                    </>
                  )}

                  {item.status !== 'posted' && (
                    <Button
                      size="sm"
                      onClick={() => handlePublishNow(item.id)}
                      disabled={actionLoading === item.id}
                      className="text-xs h-7 gap-1 font-semibold bg-primary hover:bg-primary/90"
                    >
                      {actionLoading === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Opublikuj na FB
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Udostępniania w Grupach i Telegramie */}
      {shareModalPost && (
        <GroupShareModal
          isOpen={Boolean(shareModalPost)}
          onClose={() => setShareModalPost(null)}
          niche="general"
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
          niche="general"
          post={commentsModalPost}
        />
      )}
    </div>
  );
}
