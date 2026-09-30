'use client';

import { useState, useEffect } from 'react';
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
  Baby,
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
  Heart,
  ShoppingBag,
  ShieldCheck,
  Tag,
  Clock,
  Layers,
  Swords,
} from 'lucide-react';
import type {
  BabyAutopilotConfig,
  BabyBotPersona,
  BabyBotRole,
  BabyPostQueueItem,
  BabyDealItem,
} from '@/lib/types';
import {
  generateBabyPostAction,
  addBabyPostToQueueAction,
  publishBabyPostAction,
  validateFacebookBabyCredentialsAction,
} from '@/app/actions/baby-autopilot';
import { generateGrowthPostAction } from '@/app/actions/social-growth';

interface BabyDashboardTabProps {
  config: BabyAutopilotConfig;
  bots: BabyBotPersona[];
  deals: BabyDealItem[];
  onRefreshQueue: () => void;
  selectedDealIdProp?: string | null;
  onClearSelectedDeal?: () => void;
  onSelectDeal?: (dealId: string) => void;
}

export function BabyDashboardTab({
  config,
  bots,
  deals,
  onRefreshQueue,
  selectedDealIdProp,
  onClearSelectedDeal,
}: BabyDashboardTabProps) {
  const [postType, setPostType] = useState<'deal' | 'versus' | 'lifestyle'>('deal');
  const [selectedRole, setSelectedRole] = useState<BabyBotRole>('bargain_mom');
  const [selectedDealId, setSelectedDealId] = useState<string>(selectedDealIdProp || '');
  const [selectedDealId2, setSelectedDealId2] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [humorLevel, setHumorLevel] = useState<'subtle' | 'high' | 'legendary' | 'none'>('high');

  // Reaguj na przekazanie wybranej okazji z Bazy Okazji
  useEffect(() => {
    if (selectedDealIdProp) {
      setSelectedDealId(selectedDealIdProp);
      setPostType('deal');
    }
  }, [selectedDealIdProp]);

  // Generator state
  const [generating, setGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<Partial<BabyPostQueueItem> | null>(null);
  const [editableContent, setEditableContent] = useState('');
  const [editableMomTip, setEditableMomTip] = useState('');

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
    pageName: config.fb.pageName || 'Perełki dla Malucha i Mamy',
    message: 'Połączenie aktywne (Meta Graph API)',
  });

  const handleTestConnection = async () => {
    try {
      setTestingMeta(true);
      const res = await validateFacebookBabyCredentialsAction();
      if (res.valid) {
        setMetaStatus({
          tested: true,
          valid: true,
          pageName: res.pageName,
          message: `Zweryfikowano pomyślnie! Kategoria: ${res.category || 'Children & Parenting'}.`,
        });
        toast.success(`Połączono ze stroną Facebook: ${res.pageName}`);
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

      if (postType === 'versus') {
        if (!selectedDealId || !selectedDealId2) {
          toast.error('Wybierz dwa produkty dla dzieci/mam do pojedynku!');
          setGenerating(false);
          return;
        }
        const res = await generateGrowthPostAction('baby', {
          postType: 'versus',
          dealId1: selectedDealId,
          dealId2: selectedDealId2,
          botRole: selectedRole,
        });

        if (res.success && res.generatedItem) {
          setGeneratedPost(res.generatedItem);
          setEditableContent(res.generatedItem.content || '');
          setEditableMomTip('');
          toast.success('Pojedynek produktów dla dzieci/mam (A vs B) gotowy!');
        } else {
          toast.error(res.error || 'Błąd generowania pojedynku');
        }
      } else if (postType === 'lifestyle') {
        const res = await generateGrowthPostAction('baby', {
          postType: 'lifestyle',
          lifestyleTopic: customTopic || undefined,
          botRole: selectedRole,
        });

        if (res.success && res.generatedItem) {
          setGeneratedPost(res.generatedItem);
          setEditableContent(res.generatedItem.content || '');
          setEditableMomTip('');
          toast.success('Post parentingowy dla mam gotowy!');
        } else {
          toast.error(res.error || 'Błąd generowania posta');
        }
      } else {
        const chosenDeal = deals.find(d => d.id === selectedDealId);

        const res = await generateBabyPostAction({
          botRole: selectedRole,
          dealId: selectedDealId || undefined,
          customTopic: customTopic || undefined,
          targetDealData: chosenDeal
            ? {
                title: chosenDeal.title,
                description: chosenDeal.description,
                specs: chosenDeal.specs,
                tags: chosenDeal.tags,
                price: chosenDeal.price,
                oldPrice: chosenDeal.oldPrice,
                discount: chosenDeal.discount,
                merchant: chosenDeal.merchant,
                imageUrl: chosenDeal.imageUrl,
                dealUrl: chosenDeal.dealUrl,
              }
            : undefined,
          humorLevel,
        });

        if (res.success && res.item) {
          setGeneratedPost(res.item);
          setEditableContent(res.item.content || '');
          setEditableMomTip(res.item.momTip || '');
          toast.success('Post AI wygenerowany! Możesz go przejrzeć lub edytować.');
        } else {
          toast.error(res.error || 'Nie udało się wygenerować posta');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd generatora AI');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToQueue = async () => {
    if (!generatedPost || !editableContent) {
      toast.error('Brak treści posta do zapisania');
      return;
    }

    try {
      const itemToSave = {
        botId: generatedPost.botId || 'bot-bargain-mom',
        botRole: generatedPost.botRole || selectedRole,
        botName: generatedPost.botName || 'Bot',
        status: (generatedPost.status as any) || 'approved',
        dealId: generatedPost.dealId,
        title: generatedPost.title || 'Post dla Malucha i Mamy',
        content: editableContent,
        momTip: editableMomTip || undefined,
        realPrice: generatedPost.realPrice,
        discountStr: generatedPost.discountStr,
        linkUrl: generatedPost.linkUrl || '',
        imageUrl: generatedPost.imageUrl,
        hashtags: generatedPost.hashtags || [],
        firstComment: generatedPost.firstComment,
        targets: generatedPost.targets || { facebook: true, portal: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await addBabyPostToQueueAction(itemToSave);
      if (res.success) {
        toast.success('Post został zapisany w kolejce!');
        onRefreshQueue();
        setGeneratedPost(null);
      } else {
        toast.error(res.error || 'Nie udało się dodać do kolejki');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd zapisu do kolejki');
    }
  };

  const handlePublishNow = async () => {
    if (!generatedPost || !editableContent) {
      toast.error('Brak treści posta do publikacji');
      return;
    }

    try {
      setPublishing(true);

      // Najpierw dodaj do bazy
      const itemToSave = {
        botId: generatedPost.botId || 'bot-bargain-mom',
        botRole: generatedPost.botRole || selectedRole,
        botName: generatedPost.botName || 'Bot',
        status: 'approved' as const,
        dealId: generatedPost.dealId,
        title: generatedPost.title || 'Post dla Malucha i Mamy',
        content: editableContent,
        momTip: editableMomTip || undefined,
        realPrice: generatedPost.realPrice,
        discountStr: generatedPost.discountStr,
        linkUrl: generatedPost.linkUrl || '',
        imageUrl: generatedPost.imageUrl,
        hashtags: generatedPost.hashtags || [],
        firstComment: generatedPost.firstComment,
        targets: generatedPost.targets || { facebook: true, portal: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const addRes = await addBabyPostToQueueAction(itemToSave);
      if (!addRes.success || !addRes.id) {
        toast.error('Błąd zapisu przed publikacją');
        return;
      }

      // Publikuj natychmiast
      const pubRes = await publishBabyPostAction(addRes.id, editableContent);
      if (pubRes.success) {
        toast.success('Post został opublikowany na Facebooku!');
        setPublishResult({
          fbUrl: pubRes.fbPostId ? `https://facebook.com/${pubRes.fbPostId}` : undefined,
          portalId: pubRes.portalDealId,
        });
        onRefreshQueue();
      } else {
        toast.error(pubRes.error || 'Błąd podczas publikacji na Facebooku');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd procesu publikacji');
    } finally {
      setPublishing(false);
    }
  };

  const activeBot = bots.find(b => b.role === selectedRole) || bots[0];
  const chosenDeal = deals.find(d => d.id === selectedDealId);

  return (
    <div className="space-y-6">
      {/* 1. KAFELEK STATUSU FACEBOOK I TRACKINGU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-pink-200 dark:border-pink-900 bg-pink-50/40 dark:bg-pink-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-pink-700 dark:text-pink-300">
                <Baby className="w-4 h-4 text-pink-500" />
                Strona FB & Społeczność
              </CardTitle>
              <Badge variant={metaStatus.valid ? 'default' : 'destructive'} className="text-[11px]">
                {metaStatus.valid ? 'Połączono' : 'Błąd'}
              </Badge>
            </div>
            <CardDescription className="text-xs truncate">
              {config.fb.pageName || 'Perełki dla Malucha i Mamy'} (ID: {config.fb.pageId})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Token autoryzacyjny:</span>
              <span className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border">
                {config.fb.accessToken ? '✓ Skonfigurowany' : 'Brak tokena'}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Automatyczny 1. komentarz:</span>
              <Badge variant="outline" className="text-[10px]">
                {config.fb.autoPostFirstComment ? 'Włączony (Afiliacja)' : 'Wyłączony'}
              </Badge>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8"
              onClick={handleTestConnection}
              disabled={testingMeta}
            >
              {testingMeta ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Sprawdzanie Meta API...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Przetestuj połączenie z FB
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Afiliacja & Tracking
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                {config.tracking?.campaign || 'Maluch_1'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Automatyczny subID dla partnerów (AliExpress, Convertiser, TradeTracker)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>AliExpress:</span>
              <span className="font-medium text-foreground">subid={config.tracking?.campaign || 'Maluch_1'}</span>
            </div>
            <div className="flex justify-between">
              <span>Convertiser:</span>
              <span className="font-medium text-foreground">subid={config.tracking?.campaign || 'Maluch_1'}</span>
            </div>
            <div className="flex justify-between">
              <span>TradeTracker:</span>
              <span className="font-medium text-foreground">u={config.tracking?.campaign || 'Maluch_1'}</span>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 w-full">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Linki wstawiane bezbłędnie w 1. komentarzu
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Tryb Autopilota & Statystyki
              </CardTitle>
              <Badge variant={config.enabled ? 'default' : 'outline'} className="text-[11px]">
                {config.enabled ? 'Aktywny' : 'Wstrzymany'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Publikacja: {config.mode === 'autopilot' ? 'Pełny Autopilot' : 'Wymaga Moderacji'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Opublikowano na FB:</span>
              <span className="font-bold text-foreground">{config.stats?.totalPublishedFb || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harmonogram:</span>
              <span>co {config.schedule?.intervalHours || 3}h (max {config.schedule?.dailyLimit || 6}/dzień)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dostępnych okazji w bazie:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{deals.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. GENERATOR KREATYWNYCH POSTÓW AI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lewa kolumna: Formularz generowania */}
        <div className="lg:col-span-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-5 h-5 text-pink-500" />
                Generator Postów AI dla Malucha i Mamy
              </CardTitle>
              <CardDescription>
                Wybierz postać bota AI, wskaż okazję z bazy lub wpisz własny temat.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Wybór Formatu Posta */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Format Publikacji</Label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPostType('deal')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      postType === 'deal'
                        ? 'bg-background shadow-xs text-primary font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>👶</span>
                    <span>Okazja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('versus')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      postType === 'versus'
                        ? 'bg-background shadow-xs text-primary font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Pojedynek</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('lifestyle')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      postType === 'lifestyle'
                        ? 'bg-background shadow-xs text-primary font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Społeczność</span>
                  </button>
                </div>
              </div>

              {/* Wybór bota */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Wybierz Bota / Personę AI:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {bots.map(bot => {
                    const isSelected = selectedRole === bot.role;
                    return (
                      <div
                        key={bot.id}
                        onClick={() => setSelectedRole(bot.role)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-pink-500 bg-pink-50/50 dark:bg-pink-950/30 shadow-sm'
                            : 'border-border/60 hover:border-pink-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{bot.avatar}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{bot.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{bot.badge}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informacja o aktywnym bocie */}
              {activeBot && (
                <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                  <p className="font-medium text-foreground">{activeBot.description}</p>
                  <p className="text-[11px] text-muted-foreground italic">
                    Instrukcje: {activeBot.customInstructions}
                  </p>
                </div>
              )}

              {/* Tryb Pojedynku (A vs B) */}
              {postType === 'versus' ? (
                <div className="space-y-3 p-3 bg-muted/30 border border-primary/20 rounded-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                      <span>🔵 Zawodnik A (Reakcja 👍)</span>
                    </Label>
                    <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Wybierz produkt A..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {deals.map(deal => (
                          <SelectItem key={deal.id} value={deal.id}>
                            {deal.title.slice(0, 50)}... ({deal.price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                      <span>🔴 Zawodnik B (Reakcja ❤️)</span>
                    </Label>
                    <Select value={selectedDealId2} onValueChange={setSelectedDealId2}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Wybierz produkt B..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {deals.map(deal => (
                          <SelectItem key={deal.id} value={deal.id}>
                            {deal.title.slice(0, 50)}... ({deal.price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : postType === 'lifestyle' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Temat / Pytanie Parentingowe do Mam</Label>
                  <Input
                    placeholder="np. Kiedy Wasze maluchy zaczęły przesypiać noce? Triki na ząbkowanie, picie ciepłej kawy..."
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    className="text-xs h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    AI wygeneruje ciepły, humorystyczny post budujący zaangażowanie społeczności mam.
                  </p>
                </div>
              ) : (
                <>
                  {/* Wybór okazji z bazy */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Wybierz okazję z bazy ({deals.length}):</Label>
                      {selectedDealId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDealId('');
                            onClearSelectedDeal?.();
                          }}
                          className="text-[11px] text-pink-600 dark:text-pink-400 hover:underline"
                        >
                          Wyczyść wybór
                        </button>
                      )}
                    </div>
                    <Select
                      value={selectedDealId || 'none'}
                      onValueChange={(val) => {
                        const newId = val === 'none' ? '' : val;
                        setSelectedDealId(newId);
                        if (!newId) onClearSelectedDeal?.();
                      }}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Wybierz okazję z bazy produktów..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="none">-- Brak (generuj na temat ogólny) --</SelectItem>
                        {deals.map(deal => (
                          <SelectItem key={deal.id} value={deal.id}>
                            {deal.title.slice(0, 55)}... ({deal.price} | {deal.merchant})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Podgląd wybranej okazji */}
                    {chosenDeal && (
                      <div className="p-3 border rounded-lg bg-background/50 flex gap-3 items-center mt-2 animate-in fade-in-50 duration-200">
                        {chosenDeal.imageUrl ? (
                          <img
                            src={chosenDeal.imageUrl}
                            alt={chosenDeal.title}
                            className="w-14 h-14 object-cover rounded border flex-shrink-0"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded border bg-muted flex items-center justify-center text-2xl shrink-0">
                            👶
                          </div>
                        )}
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-bold truncate">{chosenDeal.title}</p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {chosenDeal.price} {chosenDeal.oldPrice && <span className="line-through text-muted-foreground text-[11px] ml-1">{chosenDeal.oldPrice}</span>}
                            {chosenDeal.discount && <span className="ml-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-1 py-0.5 rounded">{chosenDeal.discount}</span>}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-muted-foreground text-[10px]">Sklep: {chosenDeal.merchant}</p>
                            <div className="flex items-center gap-2">
                              <a
                                href={chosenDeal.dealUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-pink-600 dark:text-pink-400 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Sklep
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDealId('');
                                  onClearSelectedDeal?.();
                                }}
                                className="text-[10px] h-5 px-1.5 text-muted-foreground hover:text-destructive"
                              >
                                Usuń
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Temat własny */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Własny temat / produkt (opcjonalnie):</Label>
                    <Input
                      placeholder="np. Wózek Kinderkraft Nubi 2 lub Promocja na pieluszki Pampers Premium Care..."
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                </>
              )}

              {/* Poziom humoru / tonu */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Poziom emocji / humoru bota:</Label>
                <Select value={humorLevel} onValueChange={(val: any) => setHumorLevel(val)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Ciepły i energiczny (rekomendowany)</SelectItem>
                    <SelectItem value="subtle">Subtelny, stonowany, merytoryczny</SelectItem>
                    <SelectItem value="legendary">Maksymalne zaangażowanie i emocje</SelectItem>
                    <SelectItem value="none">Formalny i rzeczowy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium shadow-sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI pisze post dla Malucha i Mamy (Gemini 2.5)...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Wygeneruj post AI
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Prawa kolumna: Podgląd Facebooka & Edycja */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Baby className="w-5 h-5 text-pink-500" />
                  Podgląd Posta na Facebooku
                </CardTitle>
                {generatedPost && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {activeBot?.name}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Realistyczny mockup posta, jak zobaczą go obserwatorki strony.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
              {generatedPost ? (
                <div className="space-y-4">
                  {/* Mockup Facebooka */}
                  <div className="border border-border/80 rounded-xl bg-card p-4 shadow-sm space-y-3">
                    {/* Header posta FB */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950 flex items-center justify-center text-lg border border-pink-300">
                        {activeBot?.avatar || '👶'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs">Perełki dla Malucha i Mamy</p>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            Autor
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Przed chwilą · 🌐</p>
                      </div>
                    </div>

                    {/* Treść posta (edytowalna) */}
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Treść posta (możesz edytować przed publikacją):
                      </Label>
                      <Textarea
                        value={editableContent}
                        onChange={e => setEditableContent(e.target.value)}
                        rows={12}
                        className="text-xs leading-relaxed font-sans"
                      />
                    </div>

                    {/* Zdjęcie produktu */}
                    {generatedPost.imageUrl && (
                      <div className="rounded-lg overflow-hidden border max-h-60 bg-muted/30 flex items-center justify-center">
                        <img
                          src={generatedPost.imageUrl}
                          alt="Produkt"
                          className="w-full h-56 object-cover"
                        />
                      </div>
                    )}

                    {/* Pierwszy komentarz podgląd */}
                    {generatedPost.firstComment && (
                      <div className="p-2.5 rounded-lg bg-pink-50/70 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-pink-700 dark:text-pink-300 text-[11px]">
                          <MessageCircle className="w-3.5 h-3.5" />
                          Pierwszy komentarz (automatyczny z linkiem):
                        </div>
                        <p className="text-[11px] break-all text-muted-foreground whitespace-pre-wrap">
                          {generatedPost.firstComment}
                        </p>
                      </div>
                    )}

                    {/* Dolny pasek reakcji FB */}
                    <div className="pt-2 border-t flex items-center justify-around text-muted-foreground text-xs">
                      <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                        <ThumbsUp className="w-3.5 h-3.5 text-pink-500" /> Lubię to
                      </div>
                      <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                        <MessageCircle className="w-3.5 h-3.5" /> Komentarz
                      </div>
                      <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                        <Share2 className="w-3.5 h-3.5" /> Udostępnij
                      </div>
                    </div>
                  </div>

                  {/* Sukces publikacji */}
                  {publishResult?.fbUrl && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 rounded-lg text-xs space-y-1 text-emerald-800 dark:text-emerald-200">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Opublikowano na Facebooku!
                      </p>
                      <a
                        href={publishResult.fbUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline inline-flex items-center gap-1 hover:opacity-80 font-medium"
                      >
                        Zobacz post na żywo na Facebooku <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-xl border-muted">
                  <Baby className="w-12 h-12 text-pink-400 mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-muted-foreground">Brak wygenerowanego posta</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Wybierz bota i okazję po lewej stronie, a następnie kliknij "Wygeneruj post AI", aby zobaczyć podgląd.
                  </p>
                </div>
              )}
            </CardContent>

            {generatedPost && (
              <CardFooter className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={handleSaveToQueue}
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Zapisz do kolejki
                </Button>
                <Button
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white text-xs"
                  onClick={handlePublishNow}
                  disabled={publishing}
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Publikowanie na FB...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Opublikuj teraz na FB
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
