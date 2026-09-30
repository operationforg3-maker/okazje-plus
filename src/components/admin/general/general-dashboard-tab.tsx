'use client';

import { useState } from 'react';
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

interface GeneralDashboardTabProps {
  config: GeneralAutopilotConfig;
  bots: GeneralBotPersona[];
  deals: GeneralDealItem[];
  onRefreshQueue: () => void;
  onSelectDeal?: (dealId: string) => void;
}

export function GeneralDashboardTab({
  config,
  bots,
  deals,
  onRefreshQueue,
}: GeneralDashboardTabProps) {
  const [selectedRole, setSelectedRole] = useState<GeneralBotRole>('bargain_hunter');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [humorLevel, setHumorLevel] = useState<'subtle' | 'high' | 'legendary' | 'none'>('high');

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

      const res = await generateGeneralPostAction({
        botRole: selectedRole,
        dealId: selectedDealId || undefined,
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

              {/* Deal Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Wybierz Okazję z Bazy ({deals.length})</span>
                  {selectedDealId && (
                    <button
                      onClick={() => setSelectedDealId('')}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Wyczyść
                    </button>
                  )}
                </Label>
                <Select
                  value={selectedDealId}
                  onValueChange={setSelectedDealId}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="-- Wybierz okazję z bazy --" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
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
                disabled={generating || (!selectedDealId && !customTopic)}
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
