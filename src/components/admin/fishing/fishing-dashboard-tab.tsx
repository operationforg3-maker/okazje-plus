'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Fish,
  Sparkles,
  Send,
  Loader2,
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  Share2,
  CheckCircle2,
  AlertCircle,
  Globe,
  RefreshCw,
  Image as ImageIcon,
  ShieldAlert,
  Flame,
  ShoppingBag,
  Tag,
  Clock,
  Layers
} from 'lucide-react';
import type { 
  FishingAutopilotConfig, 
  FishingBotPersona, 
  FishingBotRole, 
  FishingPostQueueItem,
  FishingDealItem 
} from '@/lib/types';
import {
  generateFishingPostAction,
  addPostToFishingQueueAction,
  publishFishingPostAction,
  testFacebookApiAction,
} from '@/app/actions/fishing-autopilot';

interface FishingDashboardTabProps {
  config: FishingAutopilotConfig;
  bots: FishingBotPersona[];
  deals: FishingDealItem[];
  onRefreshQueue: () => void;
}

export function FishingDashboardTab({
  config,
  bots,
  deals,
  onRefreshQueue,
}: FishingDashboardTabProps) {
  const [selectedRole, setSelectedRole] = useState<FishingBotRole>('wife_secret');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [humorLevel, setHumorLevel] = useState<'subtle' | 'high' | 'legendary' | 'none'>('legendary');

  // Generator state
  const [generating, setGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<Partial<FishingPostQueueItem> | null>(null);
  const [editableContent, setEditableContent] = useState('');
  const [editableWifeAlibi, setEditableWifeAlibi] = useState('');

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    fbUrl?: string;
    portalId?: string;
  } | null>(null);

  // Meta API test state
  const [testingMeta, setTestingMeta] = useState(false);
  const [metaStatus, setMetaStatus] = useState<{
    tested: boolean;
    valid?: boolean;
    pageName?: string;
    message?: string;
  }>({
    tested: true,
    valid: true,
    pageName: config.fb.pageName || 'Wędkarskie Promocje Żona nie widzi',
    message: 'Połączenie aktywne (Meta Graph API)',
  });

  const handleTestConnection = async () => {
    try {
      setTestingMeta(true);
      const res = await testFacebookApiAction();
      if (res.success) {
        setMetaStatus({
          tested: true,
          valid: true,
          pageName: res.pageName,
          message: `Zweryfikowano pomyślnie! Znaleziono ${res.recentPostsCount ?? 0} postów.`,
        });
        toast.success(`Połączono z Facebookiem: ${res.pageName}`);
      } else {
        setMetaStatus({
          tested: true,
          valid: false,
          message: res.error || 'Błąd autoryzacji',
        });
        toast.error(res.error || 'Błąd połączenia z Facebookiem');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd wykonania zapytania do Meta');
    } finally {
      setTestingMeta(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setPublishResult(null);

      const chosenDeal = deals.find(d => d.id === selectedDealId);

      const res = await generateFishingPostAction({
        botRole: selectedRole,
        dealId: selectedDealId || undefined,
        customTopic: customTopic || undefined,
        targetDealData: chosenDeal ? {
          title: chosenDeal.title,
          price: chosenDeal.price,
          oldPrice: chosenDeal.oldPrice,
          discount: chosenDeal.discount,
          merchant: chosenDeal.merchant,
          imageUrl: chosenDeal.imageUrl,
          dealUrl: chosenDeal.dealUrl,
        } : undefined,
        humorLevel,
      });

      if (res.success && res.item) {
        setGeneratedPost(res.item);
        setEditableContent(res.item.content || '');
        setEditableWifeAlibi(res.item.wifeAlibi || '');
        toast.success('Post wygenerowany przez AI! Możesz go przejrzeć lub edytować.');
      } else {
        toast.error(res.error || 'Nie udało się wygenerować posta');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd generowania');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToQueue = async () => {
    if (!generatedPost) return;
    try {
      const res = await addPostToFishingQueueAction({
        ...(generatedPost as any),
        content: editableContent,
        wifeAlibi: editableWifeAlibi || undefined,
        status: 'pending',
      });
      if (res.success) {
        toast.success('Dodano post do kolejki moderacji!');
        onRefreshQueue();
      } else {
        toast.error(res.error || 'Błąd zapisu');
      }
    } catch {
      toast.error('Błąd zapisu do kolejki');
    }
  };

  const handlePublishNow = async (targets: { fb: boolean; portal: boolean }) => {
    if (!generatedPost) return;
    try {
      setPublishing(true);
      // Najpierw zapisujemy post do kolejki
      const addRes = await addPostToFishingQueueAction({
        ...(generatedPost as any),
        content: editableContent,
        wifeAlibi: editableWifeAlibi || undefined,
        status: 'approved',
        targets: {
          facebook: targets.fb,
          portal: targets.portal,
        },
      });

      if (!addRes.success || !addRes.id) {
        toast.error('Nie udało się zainicjować publikacji');
        return;
      }

      // Publikujemy
      const pubRes = await publishFishingPostAction(addRes.id, {
        publishToFb: targets.fb,
        publishToPortal: targets.portal,
        customContent: editableContent,
      });

      if (pubRes.success) {
        setPublishResult({
          fbUrl: pubRes.fbPostUrl,
          portalId: pubRes.portalDealId,
        });
        toast.success(
          targets.fb && targets.portal 
            ? '🚀 Opublikowano na Facebooku ORAZ w Portalu Okazje Plus!' 
            : targets.fb 
              ? '🚀 Opublikowano post na Facebooku!' 
              : '✅ Utworzono ofertę w Portalu Okazje Plus!'
        );
        onRefreshQueue();
      } else {
        toast.error(pubRes.error || 'Błąd publikacji');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd podczas publikacji');
    } finally {
      setPublishing(false);
    }
  };

  const activeBot = bots.find(b => b.role === selectedRole) || bots[0];

  return (
    <div className="space-y-6">
      {/* 1. Meta / Fanpage Status Bar */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
              🎣
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base sm:text-lg">
                  {metaStatus.pageName || 'Wędkarskie Promocje Żona nie widzi'}
                </h3>
                <Badge variant={metaStatus.valid ? 'default' : 'destructive'} className="text-xs">
                  {metaStatus.valid ? 'Połączono' : 'Błąd połączenia'}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>Page ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">{config.fb.pageId}</code></span>
                <span>•</span>
                <span className="text-emerald-500 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Gotowy do publikacji
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingMeta}
              className="text-xs"
            >
              {testingMeta ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Testowanie...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Przetestuj połączenie API
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="text-xs"
            >
              <a
                href={`https://www.facebook.com/${config.fb.pageId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Otwórz Fanpage
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Main Generation Layout: Left Form, Right Facebook Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Post Generator Configuration */}
        <div className="lg:col-span-6 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Generator Postów AI
              </CardTitle>
              <CardDescription>
                Wybierz bota, okazję ze sprzętem wędkarskim lub wpisz własny temat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bot Persona Selector */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Wybierz AI Bota (Personę)
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {bots.map((b) => {
                    const isSelected = selectedRole === b.role;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedRole(b.role)}
                        className={`p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
                          isSelected 
                            ? 'border-primary bg-primary/10 shadow-sm' 
                            : 'border-border/60 hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        <span className="text-2xl shrink-0">{b.avatar}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs leading-tight truncate">
                            {b.name}
                          </p>
                          <Badge variant="outline" className="text-[10px] mt-1 px-1 py-0 h-4">
                            {b.badge}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Deal from Database */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Wybierz Okazję z Bazy Okazje Plus</span>
                  <span className="text-[11px] text-muted-foreground lowercase">
                    {deals.length} znalezionych ofert
                  </span>
                </Label>
                <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                  <SelectTrigger className="mt-1.5 text-xs">
                    <SelectValue placeholder="Wybierz ofertę wędkarską (lub zostaw puste dla postu ogólnego)..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">-- Bez powiązanego produktu (post dyskusyjny) --</SelectItem>
                    {deals.map(deal => (
                      <SelectItem key={deal.id} value={deal.id} className="text-xs">
                        {deal.title} — {deal.price} {deal.discount ? `(${deal.discount})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Topic / Instruction */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Własny Temat / Nazwa Sprzętu / Wskazówka
                </Label>
                <Input
                  className="mt-1.5 text-xs"
                  placeholder="np. Kołowrotek Shimano Sedona 2500, Pytanie: żyłka czy plecionka na jesień..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                />
              </div>

              {/* Humor Level (for Wife Secret bot) */}
              {selectedRole === 'wife_secret' && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Poziom Humoru "Żona nie widzi"
                  </Label>
                  <Select value={humorLevel} onValueChange={(val: any) => setHumorLevel(val)}>
                    <SelectTrigger className="mt-1.5 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="legendary">🤫 Legendarny (pełne alibi, paczkomat o 22:00, koło zapasowe)</SelectItem>
                      <SelectItem value="high">😄 Wysoki (żart o cenie z paragonu)</SelectItem>
                      <SelectItem value="subtle">🙂 Subtelny (delikatna wzmianka)</SelectItem>
                      <SelectItem value="none">😐 Brak (tylko parametry i rabat)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Bot: <strong className="text-foreground">{activeBot?.name}</strong>
              </span>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generowanie przez AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Wygeneruj Post AI
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <span className="text-xs text-muted-foreground block">Wygenerowane</span>
              <span className="text-xl font-bold">{config.stats.totalGenerated || 0}</span>
            </Card>
            <Card className="p-3 text-center border-blue-500/20 bg-blue-500/5">
              <span className="text-xs text-muted-foreground block">Opublikowane na FB</span>
              <span className="text-xl font-bold text-blue-500">{config.stats.totalPublishedFb || 0}</span>
            </Card>
            <Card className="p-3 text-center border-amber-500/20 bg-amber-500/5">
              <span className="text-xs text-muted-foreground block">Na Portalu Okazje+</span>
              <span className="text-xl font-bold text-amber-500">{config.stats.totalPublishedPortal || 0}</span>
            </Card>
          </div>
        </div>

        {/* Right Column: Live Facebook Post Mockup & Actions */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-border/80 shadow-md">
            <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  Podgląd Posta na Facebooku
                </span>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {activeBot?.name}
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Facebook Header Mockup */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
                  🎣
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm leading-tight text-foreground truncate">
                      {config.fb.pageName || 'Wędkarskie Promocje Żona nie widzi'}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Przed chwilą</span>
                    <span>•</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Editable Post Content */}
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  Treść posta (możesz edytować bezpośrednio w tym polu):
                </Label>
                <Textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  placeholder="Kliknij 'Wygeneruj Post AI' po lewej stronie, aby AI stworzyło angażujący tekst wędkarski..."
                  className="min-h-[160px] text-xs sm:text-sm font-sans resize-y leading-relaxed"
                />
              </div>

              {/* Wife Alibi Box if applicable */}
              {editableWifeAlibi && (
                <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-500 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Oficjalne Alibi dla Żony:</span>
                  </div>
                  <Input
                    value={editableWifeAlibi}
                    onChange={(e) => setEditableWifeAlibi(e.target.value)}
                    className="h-8 text-xs bg-background/80"
                  />
                </div>
              )}

              {/* Image Preview Mockup */}
              {generatedPost?.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-border/80 bg-muted/40 relative">
                  <img
                    src={generatedPost.imageUrl}
                    alt="Podgląd okazji"
                    className="w-full h-48 sm:h-56 object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="p-3 bg-card border-t flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold truncate">
                        {generatedPost.title || 'Okazja wędkarska'}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        okazjeplus.pl • Sprawdź kod rabatowy
                      </p>
                    </div>
                    {generatedPost.realPrice && (
                      <Badge className="shrink-0 bg-emerald-600 text-white font-mono text-xs">
                        {generatedPost.realPrice}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Facebook Reactions Strip Mockup */}
              <div className="border-t border-b py-2 px-1 flex items-center justify-around text-xs text-muted-foreground select-none">
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer">
                  <ThumbsUp className="w-4 h-4 text-blue-500" />
                  <span>Lubię to!</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer">
                  <MessageCircle className="w-4 h-4" />
                  <span>Komentarz</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer">
                  <Share2 className="w-4 h-4" />
                  <span>Udostępnij</span>
                </div>
              </div>

              {/* First Comment Preview Mockup */}
              {config.fb.autoPostFirstComment && (
                <div className="p-2.5 rounded-lg bg-muted/40 border text-xs space-y-1">
                  <span className="font-semibold text-[11px] text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="w-3 h-3 text-blue-500" />
                    Automatyczny 1. komentarz (bezpośredni link do zakupu):
                  </span>
                  <p className="font-mono text-[11px] text-blue-500 truncate">
                    {generatedPost?.linkUrl || 'https://okazjeplus.pl/pl/deals/...'}
                  </p>
                </div>
              )}

              {/* Publish Result Banner if just posted */}
              {publishResult && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                  <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Sukces! Post został rozesłany.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {publishResult.fbUrl && (
                      <a
                        href={publishResult.fbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-500 hover:underline font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Zobacz post na Facebooku
                      </a>
                    )}
                    {publishResult.portalId && (
                      <a
                        href={`https://okazjeplus.pl/pl/deals/${publishResult.portalId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-500 hover:underline font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Zobacz w Portalu Okazje Plus
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Action Buttons */}
            <CardFooter className="p-4 border-t bg-muted/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToQueue}
                disabled={!editableContent || publishing}
                className="text-xs"
              >
                <Layers className="w-3.5 h-3.5 mr-1" />
                Zapisz do Kolejki Moderacji
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handlePublishNow({ fb: true, portal: false })}
                  disabled={!editableContent || publishing}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                >
                  {publishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Publikuj na FB
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handlePublishNow({ fb: true, portal: true })}
                  disabled={!editableContent || publishing}
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-xs gap-1.5 font-semibold"
                >
                  {publishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Publikuj Wszędzie (FB + Portal)
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
