'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
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
  ShoppingBag,
  ShieldCheck,
  Tag,
  Clock,
  Layers,
  Swords,
} from 'lucide-react';
import type {
  GeneralAutopilotConfig,
  GeneralBotPersona,
  GeneralBotRole,
  GeneralPostQueueItem,
  GeneralDealItem,
} from '@/lib/types';
import {
  generateGeneralPostAction,
  addGeneralPostToQueueAction,
  publishGeneralPostAction,
  validateFacebookGeneralCredentialsAction,
} from '@/app/actions/general-autopilot';
import { generateGrowthPostAction } from '@/app/actions/social-growth';

interface GeneralDashboardTabProps {
  config: GeneralAutopilotConfig;
  bots: GeneralBotPersona[];
  deals: GeneralDealItem[];
  onRefreshQueue: () => void;
  selectedDealIdProp?: string | null;
  onClearSelectedDeal?: () => void;
  onSelectDeal?: (dealId: string) => void;
}

export function GeneralDashboardTab({
  config,
  bots,
  deals,
  onRefreshQueue,
  selectedDealIdProp,
  onClearSelectedDeal,
  onSelectDeal,
}: GeneralDashboardTabProps) {
  const [postType, setPostType] = useState<'deal' | 'versus' | 'lifestyle'>('deal');
  const [selectedRole, setSelectedRole] = useState<GeneralBotRole>('bargain_hunter');
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
  const [generatedPost, setGeneratedPost] = useState<Partial<GeneralPostQueueItem> | null>(null);
  const [editableContent, setEditableContent] = useState('');

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    fbUrl?: string;
  } | null>(null);

  // Meta API test state
  const [testingMeta, setTestingMeta] = useState(false);
  const [metaStatus, setMetaStatus] = useState<{
    tested: boolean;
    valid?: boolean;
    pageName?: string;
    message?: string;
  }>({
    tested: Boolean(config.fb.pageId && config.fb.accessToken),
    valid: Boolean(config.fb.pageId && config.fb.accessToken),
    pageName: config.fb.pageName || 'Okazje Plus',
    message: config.fb.accessToken ? 'Skonfigurowano (Meta Graph API)' : 'Wymaga konfiguracji w Ustawieniach',
  });

  const handleTestConnection = async () => {
    try {
      setTestingMeta(true);
      const res = await validateFacebookGeneralCredentialsAction();
      if (res.valid) {
        setMetaStatus({
          tested: true,
          valid: true,
          pageName: res.pageName,
          message: `Połączono pomyślnie ze stroną: ${res.pageName}`,
        });
        toast.success(`Facebook API działa! Połączono ze stroną: ${res.pageName}`);
      } else {
        setMetaStatus({
          tested: true,
          valid: false,
          message: res.error || 'Nieprawidłowy token lub ID strony',
        });
        toast.error(`Błąd weryfikacji tokena FB: ${res.error}`);
      }
    } catch (err: any) {
      toast.error('Błąd połączenia z serwerem');
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
          toast.error('Wybierz dwie oferty z bazy do pojedynku!');
          setGenerating(false);
          return;
        }
        const res = await generateGrowthPostAction('general', {
          postType: 'versus',
          dealId1: selectedDealId,
          dealId2: selectedDealId2,
          botRole: selectedRole,
        });

        if (res.success && res.generatedItem) {
          setGeneratedPost(res.generatedItem);
          setEditableContent(res.generatedItem.content || '');
          toast.success('Pojedynek ofert (A vs B) wygenerowany pomyślnie!');
        } else {
          toast.error(res.error || 'Błąd generowania pojedynku');
        }
      } else if (postType === 'lifestyle') {
        const res = await generateGrowthPostAction('general', {
          postType: 'lifestyle',
          lifestyleTopic: customTopic || undefined,
          botRole: selectedRole,
        });

        if (res.success && res.generatedItem) {
          setGeneratedPost(res.generatedItem);
          setEditableContent(res.generatedItem.content || '');
          toast.success('Post społecznościowy wygenerowany pomyślnie!');
        } else {
          toast.error(res.error || 'Błąd generowania posta');
        }
      } else {
        const chosenDeal = deals.find(d => d.id === selectedDealId);

        const res = await generateGeneralPostAction({
          botRole: selectedRole,
          dealId: selectedDealId || undefined,
          targetDealData: chosenDeal ? {
            id: chosenDeal.id,
            title: chosenDeal.title,
            price: chosenDeal.price,
            oldPrice: chosenDeal.oldPrice,
            discount: chosenDeal.discount,
            merchant: chosenDeal.merchant,
            imageUrl: chosenDeal.imageUrl,
            dealUrl: chosenDeal.dealUrl,
            description: chosenDeal.description,
            specs: chosenDeal.specs,
            tags: chosenDeal.tags,
            source: chosenDeal.source,
          } : undefined,
          customTopic: customTopic || undefined,
          humorLevel,
          target: 'both',
        });

        if (res.success && res.post) {
          setGeneratedPost(res.post);
          setEditableContent(res.post.content || '');
          toast.success('Wygenerowano angażujący post AI dla Okazje Plus!');
        } else {
          toast.error(res.error || 'Błąd generowania posta');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd podczas generowania');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!generatedPost || !editableContent) return;
    try {
      setPublishing(true);
      const res = await addGeneralPostToQueueAction({
        ...(generatedPost as any),
        content: editableContent,
        status: 'approved',
      });

      if (res.success) {
        toast.success('Post został zatwierdzony i dodany do kolejki publikacji!');
        onRefreshQueue();
        setGeneratedPost(null);
        setEditableContent('');
      } else {
        toast.error(res.error || 'Nie udało się dodać do kolejki');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu do kolejki');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishNow = async () => {
    if (!generatedPost || !editableContent) return;
    try {
      setPublishing(true);
      const qRes = await addGeneralPostToQueueAction({
        ...(generatedPost as any),
        content: editableContent,
        status: 'approved',
      });

      if (!qRes.success || !qRes.id) {
        throw new Error(qRes.error || 'Błąd tworzenia rekordu w kolejce');
      }

      const pubRes = await publishGeneralPostAction(qRes.id, editableContent);

      if (pubRes.success) {
        toast.success('🎉 Post został opublikowany na Facebooku!');
        setPublishResult({
          fbUrl: pubRes.fbPostId ? `https://www.facebook.com/${pubRes.fbPostId}` : undefined,
        });
        onRefreshQueue();
      } else {
        toast.error(pubRes.error || 'Błąd bezpośredniej publikacji na Facebooku');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd publikacji');
    } finally {
      setPublishing(false);
    }
  };

  const activeBot = bots.find(b => b.role === selectedRole) || bots[0];
  const selectedDeal = deals.find(d => d.id === selectedDealId);

  return (
    <div className="space-y-6">
      {/* Quick KPI stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Opublikowane FB</p>
              <p className="text-2xl font-bold text-primary">{config.stats?.totalPublishedFb || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Share2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Baza Okazji</p>
              <p className="text-2xl font-bold">{deals.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Aktywne Persony Botów</p>
              <p className="text-2xl font-bold text-amber-500">{bots.filter(b => b.enabled).length}/{bots.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Status Facebook API</p>
              <div className="flex items-center gap-1.5 mt-1">
                {metaStatus.valid ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                    Aktywne
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                    Sprawdź
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleTestConnection}
              disabled={testingMeta}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Przetestuj połączenie z Facebookiem"
            >
              <RefreshCw className={`w-4 h-4 ${testingMeta ? 'animate-spin' : ''}`} />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Generator & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Generator Postów AI
                </CardTitle>
                <Badge variant="secondary" className="text-[11px]">
                  Gemini 2.5 Flash
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Twórz natychmiast profesjonalne posty z haczykiem, specyfikacją i bezpośrednim linkiem w pierwszym komentarzu.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
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
                    <span>🎯</span>
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

              {/* Bot Persona Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Wybierz Personę Bota</span>
                  {activeBot && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Styl: {activeBot.tone}
                    </span>
                  )}
                </Label>
                <Select
                  value={selectedRole}
                  onValueChange={(val: GeneralBotRole) => setSelectedRole(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Wybierz bota" />
                  </SelectTrigger>
                  <SelectContent>
                    {bots.map(b => (
                      <SelectItem key={b.id} value={b.role}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{b.avatar}</span>
                          <span className="font-medium text-xs">{b.name}</span>
                          <Badge variant="outline" className="text-[10px] ml-1 py-0 px-1">
                            {b.badge}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeBot && (
                  <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border border-border/50">
                    {activeBot.description}
                  </p>
                )}
              </div>

              {/* Pola dla Trybu Pojedynku (A vs B) */}
              {postType === 'versus' ? (
                <div className="space-y-3 p-3 bg-muted/30 border border-primary/20 rounded-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                      <span>🔵 Zawodnik A (Reakcja 👍)</span>
                    </Label>
                    <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="-- Wybierz produkt A --" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[220px]">
                        {deals.map(d => (
                          <SelectItem key={d.id} value={d.id} className="text-xs">
                            <div className="flex items-center justify-between gap-2 max-w-[320px]">
                              <span className="truncate">{d.title}</span>
                              <span className="font-bold shrink-0 text-primary">{d.price}</span>
                            </div>
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
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="-- Wybierz produkt B --" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[220px]">
                        {deals.map(d => (
                          <SelectItem key={d.id} value={d.id} className="text-xs">
                            <div className="flex items-center justify-between gap-2 max-w-[320px]">
                              <span className="truncate">{d.title}</span>
                              <span className="font-bold shrink-0 text-primary">{d.price}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : postType === 'lifestyle' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Temat / Pytanie Społecznościowe</Label>
                  <Input
                    placeholder="np. Weekendowe plany zakupowe, Wasz najlepszy zakup z rabatem 70%..."
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    AI wygeneruje post budujący relację ze społecznością zakończony otwartym pytaniem.
                  </p>
                </div>
              ) : (
                <>
                  {/* Deal Picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Wybierz Okazję z Bazy ({deals.length})</span>
                      {selectedDealId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDealId('');
                            onClearSelectedDeal?.();
                          }}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Wyczyść
                        </button>
                      )}
                    </Label>
                    <Select
                      value={selectedDealId || 'none'}
                      onValueChange={(val) => {
                        const newId = val === 'none' ? '' : val;
                        setSelectedDealId(newId);
                        if (!newId) onClearSelectedDeal?.();
                      }}
                    >
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="-- Wybierz okazję z bazy --" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        <SelectItem value="none">-- Bez powiązanej okazji (wpisz temat z ręki) --</SelectItem>
                        {deals.map(d => (
                          <SelectItem key={d.id} value={d.id} className="text-xs">
                            <div className="flex items-center justify-between gap-2 max-w-[340px]">
                              <span className="truncate">{d.title}</span>
                              <span className="font-bold shrink-0 text-primary">{d.price}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Rich Deal Preview Card */}
                    {(() => {
                      const chosenDeal = deals.find(d => d.id === selectedDealId);
                      if (!chosenDeal) return null;
                      return (
                        <div className="p-3 bg-muted/40 rounded-lg border border-border/80 flex items-start gap-3 mt-2 animate-in fade-in-50 duration-200">
                          {chosenDeal.imageUrl ? (
                            <img
                              src={chosenDeal.imageUrl}
                              alt={chosenDeal.title}
                              className="w-16 h-16 object-cover rounded-md border shrink-0 bg-background"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center text-2xl shrink-0">
                              🛍️
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs leading-snug line-clamp-1">{chosenDeal.title}</span>
                              {chosenDeal.discount && (
                                <Badge className="bg-destructive text-[10px] px-1 py-0 h-4">
                                  {chosenDeal.discount}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                {chosenDeal.price}
                              </span>
                              {chosenDeal.oldPrice && (
                                <span className="text-xs text-muted-foreground line-through font-mono">
                                  {chosenDeal.oldPrice}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground">· {chosenDeal.merchant}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <a
                                href={chosenDeal.dealUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Podgląd oferty ze sklepu
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
                                Usuń wybór
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Or Custom Topic */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Lub wpisz własny produkt / temat z ręki
                    </Label>
                    <Input
                      placeholder="np. Ekspres DeLonghi Magnifica S za 1199 zł w Media Expert..."
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </>
              )}

              {/* Humor Level */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Poziom Humoru / Energii</Label>
                <Select
                  value={humorLevel}
                  onValueChange={(val: any) => setHumorLevel(val)}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subtle">Subtelny / Merytoryczny</SelectItem>
                    <SelectItem value="high">Wysoki (Viral & Chwytliwy)</SelectItem>
                    <SelectItem value="legendary">Maksymalny (Mega Emocje)</SelectItem>
                    <SelectItem value="none">Formalny (Czyste Fakty)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                className="w-full font-semibold gap-2"
                onClick={handleGenerate}
                disabled={
                  generating ||
                  (postType === 'versus'
                    ? !selectedDealId || !selectedDealId2
                    : postType === 'lifestyle'
                    ? false
                    : !selectedDealId && !customTopic)
                }
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
        </div>

        {/* Right Column: Live Facebook Post Mockup (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border shadow-md bg-card overflow-hidden">
            <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-xs font-semibold text-muted-foreground ml-2">
                  Podgląd na żywo na Facebooku (Live Mockup)
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-background">
                {config.fb.pageName || 'Okazje Plus'}
              </Badge>
            </div>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Facebook Post Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {activeBot.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-foreground">
                      {config.fb.pageName || 'Okazje Plus'}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0">
                      Autor: {activeBot.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span>Przed chwilą</span>
                    <span>•</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Editable Content */}
              {generatedPost ? (
                <div className="space-y-3">
                  <Textarea
                    value={editableContent}
                    onChange={e => setEditableContent(e.target.value)}
                    rows={12}
                    className="w-full text-xs font-sans leading-relaxed resize-y border-border/80 focus-visible:ring-primary/40 bg-background"
                    placeholder="Treść posta..."
                  />

                  {/* Image Preview */}
                  {generatedPost.imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-border/60 max-h-[300px] bg-muted/20 flex items-center justify-center">
                      <img
                        src={generatedPost.imageUrl}
                        alt="Okazja"
                        className="object-contain max-h-[300px] w-full"
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : selectedDeal?.imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-border/60 max-h-[300px] bg-muted/20 flex items-center justify-center">
                      <img
                        src={selectedDeal.imageUrl}
                        alt="Okazja"
                        className="object-contain max-h-[300px] w-full"
                      />
                    </div>
                  ) : null}

                  {/* Facebook Mockup Action Bar */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-muted-foreground text-xs px-2">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                      <span>Lubię to!</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Komentarz</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Udostępnij</span>
                    </div>
                  </div>

                  {/* First Comment Mockup */}
                  <div className="bg-muted/40 p-3 rounded-lg border border-border/50 space-y-1.5 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        💬 Pierwszy komentarz (automatyczny z linkiem afiliacyjnym):
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground break-all font-mono bg-background p-2 rounded border">
                      {generatedPost.firstComment || `🔗 Bezpośredni link do okazji i kod rabatowy:\n${generatedPost.linkUrl || 'https://okazjeplus.pl'}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                    <Sparkles className="w-6 h-6 text-primary/60" />
                  </div>
                  <h4 className="text-sm font-semibold">Podgląd jest pusty</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Wybierz okazję z bazy lub wpisz temat po lewej stronie, a następnie kliknij <strong>"Wygeneruj Post AI"</strong>, aby zobaczyć podgląd.
                  </p>
                </div>
              )}

              {/* Publish Result Feedback */}
              {publishResult?.fbUrl && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Post opublikowany pomyślnie na Facebooku!</span>
                  </div>
                  <a
                    href={publishResult.fbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    Otwórz post <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </CardContent>

            {generatedPost && (
              <CardFooter className="bg-muted/20 border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddToQueue}
                  disabled={publishing}
                  className="w-full sm:w-auto text-xs"
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Zapisz do kolejki (moderacja)
                </Button>

                <Button
                  size="sm"
                  onClick={handlePublishNow}
                  disabled={publishing}
                  className="w-full sm:w-auto font-semibold text-xs gap-1.5 bg-primary hover:bg-primary/90"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Publikowanie...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Opublikuj teraz na Facebooku
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
