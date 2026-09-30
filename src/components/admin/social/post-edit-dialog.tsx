'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  saveScheduledPostEditsAction,
  getNicheAvailableDealsAction,
  deleteCalendarPostAction,
  getDiverseAiDealRecommendationAction,
  regeneratePostContentAction,
  type CandidateDealSummary,
} from '@/app/actions/calendar-schedule';
import { sanitizeSocialPostText } from '@/lib/social-growth-types';
import {
  Loader2,
  Sparkles,
  Save,
  Eraser,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Check,
  Calendar,
  Trash2,
  Dices,
  Wand2,
  RefreshCw,
  Tag,
} from 'lucide-react';

export interface EditablePostItem {
  id: string;
  title: string;
  content: string;
  firstComment?: string;
  imageUrl?: string;
  linkUrl?: string;
  scheduledFor?: string;
  status: 'pending' | 'approved' | 'posted' | 'scheduled_slot' | 'failed';
  dealId?: string;
  wifeAlibi?: string;
}

interface PostEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  niche: 'general' | 'fishing' | 'baby';
  item: EditablePostItem | null;
  onSaved: () => void;
}

export function PostEditDialog({
  open,
  onOpenChange,
  niche,
  item,
  onSaved,
}: PostEditDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved'>('approved');
  const [wifeAlibi, setWifeAlibi] = useState('');
  const [saving, setSaving] = useState(false);
  const [recommendingAi, setRecommendingAi] = useState(false);
  const [regeneratingText, setRegeneratingText] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentDealId, setCurrentDealId] = useState<string | undefined>(item?.dealId);

  // Deal selector state
  const [showDealPicker, setShowDealPicker] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [dealsList, setDealsList] = useState<CandidateDealSummary[]>([]);
  const [dealSearchQuery, setDealSearchQuery] = useState('');

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setContent(sanitizeSocialPostText(item.content || ''));
      setFirstComment(item.firstComment || '');
      setImageUrl(item.imageUrl || '');
      setLinkUrl(item.linkUrl || '');
      setScheduledFor(item.scheduledFor ? item.scheduledFor.slice(0, 16) : '');
      setStatus(item.status === 'pending' ? 'pending' : 'approved');
      setWifeAlibi(item.wifeAlibi || '');
      setCurrentDealId(item.dealId);
    }
  }, [item]);

  const loadDeals = async () => {
    try {
      setLoadingDeals(true);
      const res = await getNicheAvailableDealsAction({
        niche,
        searchQuery: dealSearchQuery || undefined,
        limit: 40,
      });
      if (res.success) {
        setDealsList(res.deals);
      } else {
        toast.error('Nie udało się pobrać listy okazji');
      }
    } catch {
      toast.error('Błąd pobierania okazji');
    } finally {
      setLoadingDeals(false);
    }
  };

  const handleSelectDeal = (d: CandidateDealSummary) => {
    setCurrentDealId(d.id);
    setTitle(d.title);
    if (d.imageUrl) setImageUrl(d.imageUrl);
    if (d.dealUrl) setLinkUrl(d.dealUrl);
    setShowDealPicker(false);
    toast.success(`Wybrano okazję: ${d.title.slice(0, 40)}...`);
  };

  const handleAiSuggestDeal = async () => {
    try {
      setRecommendingAi(true);
      toast.info('AI dobiera zróżnicowaną okazję z innej kategorii...');
      const res = await getDiverseAiDealRecommendationAction({
        niche,
        excludeDealIds: currentDealId ? [currentDealId] : [],
      });

      if (res.success && res.deal) {
        handleSelectDeal(res.deal);
        toast.success(`AI wybrało: ${res.deal.title.slice(0, 35)}... (${res.categoryLabel || 'Urozmaicona'})`);
      } else {
        toast.error(res.error || 'Nie udało się dobrać okazji przez AI');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd rekomendacji AI');
    } finally {
      setRecommendingAi(false);
    }
  };

  const handleRegenerateContent = async () => {
    const activeDealId = currentDealId || item?.dealId;
    if (!activeDealId) {
      toast.error('Wybierz najpierw okazję z bazy, aby AI mogło napisać dla niej treść!');
      return;
    }

    try {
      setRegeneratingText(true);
      toast.info('AI generuje nową treść posta dla wybranej okazji...');
      const res = await regeneratePostContentAction({
        niche,
        dealId: activeDealId,
      });

      if (res.success && res.content) {
        setContent(res.content);
        if (res.title) setTitle(res.title);
        if (res.firstComment) setFirstComment(res.firstComment);
        if (res.imageUrl) setImageUrl(res.imageUrl);
        if (res.linkUrl) setLinkUrl(res.linkUrl);
        if (res.wifeAlibi) setWifeAlibi(res.wifeAlibi);
        toast.success('Treść posta wygenerowana pomyślnie przez AI!');
      } else {
        toast.error(res.error || 'Błąd generowania treści');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd generowania');
    } finally {
      setRegeneratingText(false);
    }
  };

  const handleDeletePost = async () => {
    if (!item) return;
    if (!window.confirm('Czy na pewno chcesz usunąć ten post z kolejki publikacji?')) return;

    try {
      setDeleting(true);
      const res = await deleteCalendarPostAction({
        niche,
        queueItemId: item.id,
      });

      if (res.success) {
        toast.success('Post został trwale usunięty z kolejki!');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(res.error || 'Nie udało się usunąć posta');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania');
    } finally {
      setDeleting(false);
    }
  };

  const handleCleanMarkdown = () => {
    setContent(prev => sanitizeSocialPostText(prev));
    toast.success('Usunięto gwiazdki ** oraz formatowanie Markdown!');
  };

  const handleSave = async () => {
    if (!item) return;

    try {
      setSaving(true);
      const cleanContent = sanitizeSocialPostText(content);

      const res = await saveScheduledPostEditsAction({
        niche,
        queueItemId: item.id,
        updates: {
          title,
          content: cleanContent,
          firstComment: firstComment || undefined,
          imageUrl: imageUrl || undefined,
          linkUrl: linkUrl || undefined,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
          status,
          wifeAlibi: niche === 'fishing' ? wifeAlibi : undefined,
        },
      });

      if (res.success) {
        toast.success('Zapisano zmiany w poście!');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(res.error || 'Błąd zapisu posta');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              ✏️ Edycja Posta i Promowanej Okazji
            </DialogTitle>
            <Badge variant="outline" className="text-xs">
              {niche === 'fishing' ? '🎣 Wędkarskie' : niche === 'baby' ? '👶 Maluch & Mama' : '🎯 Okazje Plus'}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Dostosuj treść, link afiliacyjny, zdjęcie i zaplanowaną datę przed publikacją.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tytuł / Nagłówek okazji */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-title" className="text-xs font-semibold">
                Tytuł okazji / Nagłówek posta
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDealPicker(!showDealPicker);
                  if (!showDealPicker && dealsList.length === 0) loadDeals();
                }}
                className="text-xs h-6 px-2 text-primary"
              >
                {showDealPicker ? 'Ukryj listę okazji' : 'Wybierz inną okazję z bazy'}
              </Button>
            </div>
            <Input
              id="post-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="np. Kołowrotek Shimano Sedona FJ 4000 w promocji"
              className="text-xs"
            />
          </div>

          {/* Deal Picker Accordion */}
          {showDealPicker && (
            <div className="p-3 border rounded-lg bg-muted/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={dealSearchQuery}
                    onChange={e => setDealSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadDeals()}
                    placeholder="Wyszukaj produkt w bazie okazji..."
                    className="text-xs pl-8 h-8"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={loadDeals} disabled={loadingDeals} className="h-8 text-xs">
                    {loadingDeals ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Szukaj'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAiSuggestDeal}
                    disabled={recommendingAi}
                    className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/5 gap-1 shrink-0"
                    title="AI wybiera okazję z innej kategorii niż ostatnio publikowane posty"
                  >
                    {recommendingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>AI: Urozmaicona okazja</span>
                  </Button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {dealsList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {loadingDeals ? 'Pobieranie okazji...' : 'Brak wyników wyszukiwania'}
                  </p>
                ) : (
                  dealsList.map(d => (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDeal(d)}
                      className="p-2 border rounded bg-card hover:bg-accent/40 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {d.imageUrl && (
                          <img src={d.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        )}
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="font-semibold truncate">{d.title}</p>
                            {d.categoryLabel && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0 font-normal">
                                {d.categoryLabel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {d.price} {d.merchant && `• ${d.merchant}`}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2 shrink-0">
                        Wybierz <Check className="w-3 h-3 ml-1 text-emerald-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Treść posta */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-content" className="text-xs font-semibold">
                Treść posta na Facebooka
              </Label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-mono mr-1">
                  {wordCount} słów • {charCount} znaków
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateContent}
                  disabled={regeneratingText || saving}
                  className="text-xs h-6 px-2 text-primary border-primary/30 hover:bg-primary/5"
                  title="Przepisz treść posta i komentarza dla wybranej okazji za pomocą AI"
                >
                  {regeneratingText ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                  Przepisz przez AI
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCleanMarkdown}
                  className="text-xs h-6 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  title="Usuwa podwójne gwiazdki **pogrubienie** i formatowanie Markdown"
                >
                  <Eraser className="w-3 h-3 mr-1" />
                  Wyczyść '**'
                </Button>
              </div>
            </div>
            <Textarea
              id="post-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder="Treść posta (bez formatowania Markdown **)..."
              className="text-xs font-sans leading-relaxed"
            />
          </div>

          {/* Pierwszy komentarz (link afiliacyjny) */}
          <div className="space-y-1.5">
            <Label htmlFor="post-comment" className="text-xs font-semibold">
              💬 Pierwszy komentarz (link afiliacyjny & wezwanie)
            </Label>
            <Textarea
              id="post-comment"
              value={firstComment}
              onChange={e => setFirstComment(e.target.value)}
              rows={2}
              placeholder="👉 Bezpośredni link do okazji: https://..."
              className="text-xs font-mono"
            />
          </div>

          {/* Wife Alibi (jeśli nisza wędkarska) */}
          {niche === 'fishing' && (
            <div className="space-y-1.5">
              <Label htmlFor="post-alibi" className="text-xs font-semibold">
                🤫 Alibi dla żony / Wymówka cenowa
              </Label>
              <Input
                id="post-alibi"
                value={wifeAlibi}
                onChange={e => setWifeAlibi(e.target.value)}
                placeholder="Oficjalna wersja dla żony (np. kupione za 20 zł od kumpla)"
                className="text-xs"
              />
            </div>
          )}

          {/* URL zdjęcia i Link docelowy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-link" className="text-xs font-semibold">
                Link do okazji (Afiliacyjny)
              </Label>
              <Input
                id="post-link"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-image" className="text-xs font-semibold">
                URL zdjęcia produktu
              </Label>
              <Input
                id="post-image"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Podgląd miniatury */}
          {imageUrl && (
            <div className="p-2 border rounded-lg bg-muted/20 flex items-center gap-3">
              <img
                src={imageUrl}
                alt="Podgląd"
                className="w-16 h-16 rounded object-cover border shrink-0 bg-background"
                onError={e => {
                  (e.target as any).style.display = 'none';
                }}
              />
              <div className="text-xs text-muted-foreground truncate">
                <p className="font-semibold text-foreground truncate">{title || 'Podgląd zdjęcia'}</p>
                <p className="text-[11px] truncate">{imageUrl}</p>
              </div>
            </div>
          )}

          {/* Data planowanej publikacji i Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-schedule" className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Planowana data i godzina
              </Label>
              <Input
                id="post-schedule"
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-status" className="text-xs font-semibold">
                Status w kolejce
              </Label>
              <select
                id="post-status"
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="approved">Zatwierdzony (Autopilot opublikuje automatycznie)</option>
                <option value="pending">Oczekuje na akceptację (Wymaga kliknięcia publikuj)</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
          {item?.status !== 'posted' ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeletePost}
              disabled={deleting || saving}
              className="text-xs gap-1.5 self-start"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Usuń z kolejki
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2 self-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving || deleting}
              className="text-xs"
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || deleting}
              className="text-xs gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Zapisz zmiany w poście
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
