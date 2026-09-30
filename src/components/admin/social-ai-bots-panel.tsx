'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Bot,
  Sparkles,
  Play,
  Settings2,
  CheckCircle2,
  Users,
  Copy,
  ExternalLink,
  Download,
  ShieldCheck,
  Flame,
  MessageSquare,
  HelpCircle,
  Clock,
  Loader2,
  Eye,
  RefreshCw,
  Search,
  Check,
  X,
  TrendingUp,
  Tag,
  ArrowRight
} from 'lucide-react';
import type { SocialAIBot } from '@/lib/types';
import {
  getSocialAIBotsAction,
  saveSocialAIBotAction,
  toggleSocialAIBotAction,
  toggleSocialAIBotAutoApproveAction,
  setAllSocialAIBotsAutoPostingAction,
  runSocialAIBotAction,
  getPromotableDealsAction,
  type PromotableDeal
} from '@/app/actions/social-ai-bots';

export function SocialAIBotsPanel() {
  const [bots, setBots] = useState<SocialAIBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<SocialAIBot | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [runningBotId, setRunningBotId] = useState<string | null>(null);
  const [immediatePublish, setImmediatePublish] = useState(false);
  const [topicHint, setTopicHint] = useState('');
  const [runResult, setRunResult] = useState<{ content?: string; published?: boolean; platformPostId?: string } | null>(null);

  // Suggested & searchable deals state
  const [promotableDeals, setPromotableDeals] = useState<PromotableDeal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [dealSearchQuery, setDealSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const loadBots = async () => {
    try {
      setLoading(true);
      const res = await getSocialAIBotsAction();
      if (res.success && res.bots) {
        setBots(res.bots);
      } else {
        toast.error(res.error || 'Błąd ładowania botów');
      }
    } catch (err) {
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  const loadPromotableDeals = async (search?: string, cat?: string) => {
    try {
      setLoadingDeals(true);
      const res = await getPromotableDealsAction(search, 24, cat !== undefined ? cat : selectedCategory);
      if (res.success) {
        setPromotableDeals(res.deals);
      }
    } catch (err) {
      console.error('Error loading promotable deals:', err);
    } finally {
      setLoadingDeals(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPromotableDeals(dealSearchQuery, selectedCategory);
    }, 300);
    return () => clearTimeout(timer);
  }, [dealSearchQuery, selectedCategory]);

  const handleToggle = async (botId: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    setBots(prev => prev.map(b => b.id === botId ? { ...b, enabled: nextEnabled } : b));
    
    const res = await toggleSocialAIBotAction(botId, nextEnabled);
    if (res.success) {
      toast.success(nextEnabled ? 'Bot aktywowany' : 'Bot wyłączony');
    } else {
      toast.error(res.error || 'Nie udało się zmienić statusu bota');
      setBots(prev => prev.map(b => b.id === botId ? { ...b, enabled: currentEnabled } : b));
    }
  };

  const handleToggleAutoApprove = async (botId: string, currentAutoApprove: boolean) => {
    const nextAutoApprove = !currentAutoApprove;
    setBots(prev => prev.map(b => b.id === botId ? { ...b, autoApprove: nextAutoApprove } : b));

    const res = await toggleSocialAIBotAutoApproveAction(botId, nextAutoApprove);
    if (res.success) {
      toast.success(
        nextAutoApprove
          ? '🚀 Automatyczne postowanie WŁĄCZONE: bot publikuje od razu na Facebooku!'
          : '📋 Tryb kolejki: posty bota wymagają ręcznego zatwierdzenia'
      );
    } else {
      toast.error(res.error || 'Nie udało się zmienić trybu auto-postowania');
      setBots(prev => prev.map(b => b.id === botId ? { ...b, autoApprove: currentAutoApprove } : b));
    }
  };

  const handleSetAllAutoPosting = async (enable: boolean) => {
    try {
      setLoading(true);
      const res = await setAllSocialAIBotsAutoPostingAction(enable);
      if (res.success) {
        setBots(prev => prev.map(b => ({ ...b, autoApprove: enable })));
        toast.success(
          enable
            ? '🚀 Automatyczne postowanie włączone dla wszystkich botów!'
            : '⏸️ Automatyczne postowanie wyłączone (tryb kolejki do zatwierdzenia)'
        );
      } else {
        toast.error(res.error || 'Błąd zmiany auto-postowania');
      }
    } catch {
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBot = async () => {
    if (!selectedBot) return;
    try {
      const res = await saveSocialAIBotAction(selectedBot);
      if (res.success) {
        toast.success(`Zapisano bota: ${selectedBot.name}`);
        setBots(prev => prev.map(b => b.id === selectedBot.id ? selectedBot : b));
        setIsEditing(false);
      } else {
        toast.error(res.error || 'Błąd zapisu');
      }
    } catch (err) {
      toast.error('Błąd zapisu');
    }
  };

  const handleRunBot = async () => {
    if (!runningBotId) return;
    try {
      setLoading(true);
      const res = await runSocialAIBotAction(runningBotId, immediatePublish, topicHint, selectedDealId || undefined);
      if (res.success) {
        setRunResult({
          content: res.postContent,
          published: res.published,
          platformPostId: res.platformPostId,
        });
        toast.success(res.published ? '🚀 Opublikowano na Facebooku!' : '✅ Post wygenerowany i dodany do kolejki!');
        loadBots();
        loadPromotableDeals(dealSearchQuery);
      } else {
        toast.error(res.error || 'Błąd generowania posta');
      }
    } catch (err) {
      toast.error('Błąd podczas generowania');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPromoteDeal = (deal: PromotableDeal, botRole: 'hunter' | 'expert' = 'hunter') => {
    const targetBot = bots.find(b => b.role === botRole) || bots[0];
    if (targetBot) {
      setRunningBotId(targetBot.id);
      setSelectedDealId(deal.id);
      setTopicHint('');
      setRunResult(null);
      setImmediatePublish(targetBot.autoApprove);
      setIsRunDialogOpen(true);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Skopiowano: ${label}`);
  };

  const groupDescriptionText = `Witaj w oficjalnej grupie serwisu Okazje Plus (https://okazjeplus.pl)! 🎯\n\nTo miejsce dla świadomych konsumentów, którzy nie lubią przepłacać. Eliminujemy buble, tropimy prawdziwe okazje i dzielimy się perełkami cenowymi, kodami rabatowymi oraz promocjami z polskich i zagranicznych sklepów.\n\nW naszej społeczności znajdziesz:\n🔥 Błyskawiczne okazje i błędy cenowe\n🏷️ Działające kody rabatowe i promocje cashback\n🔍 Wyniki fizycznych testów produktów i opinie bez marketingu\n💬 Pomoc i porady przedzakupowe innych członków\n\nZnalazłeś super ofertę? Podziel się nią z innymi!\n🌐 https://okazjeplus.pl`;

  const groupRulesText = `1. Tylko realne okazje i sprawdzone promocje (sprawdzaj historię cen przed publikacją).\n2. Kultura i wzajemny szacunek (zero hejtu i wulgaryzmów).\n3. Zakaz spamu i prywatnych reflinków bez zgody administratora.`;

  return (
    <div className="space-y-8">
      {/* 1. Karta Zarządzania Grupą na Facebooku */}
      <Card className="border-primary/20 bg-gradient-to-r from-blue-950/20 via-background to-orange-950/20 shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Grupa Facebookowa Okazje Plus
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Połączona
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Okazje Plus – Społeczność Łowców Promocji i Okazji (ID: 1419456073494287)
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                asChild
              >
                <a href="/facebook-group-cover.png" download="facebook-group-cover.png" target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 text-orange-500" />
                  Pobierz baner grupy (1640x856)
                </a>
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                asChild
              >
                <a href="https://www.facebook.com/groups/okazjepluspl/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Otwórz Grupę na FB
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  📝 Zoptymalizowany Opis Grupy
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => copyToClipboard(groupDescriptionText, 'Opis grupy')}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Kopiuj opis
                </Button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {groupDescriptionText}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  📋 3 Reguły Społeczności
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => copyToClipboard(groupRulesText, 'Reguły grupy')}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Kopiuj reguły
                </Button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {groupRulesText}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Podpowiedzi & Wyszukiwarka Okazji do Promocji */}
      <Card className="border-border/80 shadow-sm bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" />
                Podpowiedzi okazji do promowania
              </CardTitle>
              <CardDescription>
                Wybierz okazję z bazy lub wyszukaj konkretny produkt, aby wygenerować świeży post botem 1-kliknięciem.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Wyszukaj okazję (np. popdeer, lego, ID)..."
                  value={dealSearchQuery}
                  onChange={(e) => setDealSearchQuery(e.target.value)}
                  className="pl-8 pr-7 h-9 text-xs"
                />
                {dealSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDealSearchQuery('')}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground text-xs px-1"
                    title="Wyczyść"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPromotableDeals(dealSearchQuery, selectedCategory)}
                disabled={loadingDeals}
                className="h-9 px-3"
                title="Odśwież okazje"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingDeals ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Szybkie filtry kategorii */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 scrollbar-none">
            {[
              { id: 'all', label: '🔥 Wszystkie' },
              { id: 'elektronika', label: '💻 Elektronika' },
              { id: 'dom-ogrod', label: '🏡 Dom i Ogród' },
              { id: 'motoryzacja', label: '🚗 Motoryzacja' },
              { id: 'sport-turystyka', label: '⚽ Sport & Rekreacja' },
              { id: 'moda-uroda', label: '👗 Moda i Uroda' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {loadingDeals ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : promotableDeals.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
              <p>Brak okazji spełniających kryteria dla „<strong>{dealSearchQuery}</strong>”.</p>
              <p className="text-[11px] opacity-80">Wskazówka: możesz wpisać nazwę (np. <em>popdeer</em>), markę, lub wkleić bezpośredni link/ID okazji.</p>
              {dealSearchQuery && (
                <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={() => setDealSearchQuery('')}>
                  Wyczyść wyszukiwanie
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {promotableDeals.slice(0, 12).map((deal) => (
                <div
                  key={deal.id}
                  className="p-3 rounded-xl border border-border/70 bg-background/80 hover:border-primary/50 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="relative h-32 rounded-lg overflow-hidden border bg-muted">
                      {deal.imageUrl ? (
                        <img
                          src={deal.imageUrl}
                          alt={deal.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          Brak zdjęcia
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge className="bg-amber-500/90 text-white font-bold text-[10px] px-1.5 py-0.5">
                          🔥 {deal.temperature}°
                        </Badge>
                      </div>
                      {deal.postedRecently && (
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="text-[10px] bg-black/60 text-white backdrop-blur-sm">
                            Promowana w 14 dni
                          </Badge>
                        </div>
                      )}
                      {deal.category && !deal.postedRecently && (
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="text-[10px] bg-black/60 text-white backdrop-blur-sm capitalize">
                            {deal.category}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-xs text-foreground line-clamp-2 leading-tight" title={deal.title}>
                        {deal.title}
                      </h4>
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        <span className="font-bold text-sm text-primary">{deal.price}</span>
                        {deal.oldPrice && (
                          <span className="text-[11px] text-muted-foreground line-through">{deal.oldPrice}</span>
                        )}
                        {deal.discount && (
                          <span className="text-[11px] font-bold text-red-500">{deal.discount}</span>
                        )}
                      </div>
                      {deal.merchant && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          🛒 {deal.merchant}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-1 text-orange-500 hover:text-orange-600"
                      onClick={() => handleQuickPromoteDeal(deal, 'hunter')}
                    >
                      <Flame className="h-3 w-3 mr-1" />
                      Łowca
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-1 text-blue-500 hover:text-blue-600"
                      onClick={() => handleQuickPromoteDeal(deal, 'expert')}
                    >
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Ekspert
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Nagłówek Sekcji AI Botów */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Administratorzy & Boty Społeczności
          </h2>
          <p className="text-muted-foreground text-sm">
            Zarządzaj autonomicznymi personami AI, które tworzą posty, animują grupę i promują okazje na Facebooku.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadBots}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </div>

      {/* Baner Główny: Automatyczne Postowanie na FB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-background to-blue-950/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              Autopilot Social Media & Posty AI
              {bots.some(b => b.enabled && b.autoApprove) ? (
                <Badge className="bg-emerald-500 text-white text-[11px]">
                  Aktywne ({bots.filter(b => b.enabled && b.autoApprove).length} botów)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-[11px]">
                  Wstrzymane (wymaga akceptacji)
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Po włączeniu automatycznego postowania boty autonomously dobierają okazje, piszą bogate, angażujące posty i publikują je na Facebooku.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400"
            onClick={() => handleSetAllAutoPosting(true)}
            disabled={loading}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Włącz auto-postowanie dla wszystkich
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleSetAllAutoPosting(false)}
            disabled={loading}
          >
            <X className="h-3.5 w-3.5" />
            Wyłącz (tryb kolejki)
          </Button>
        </div>
      </div>

      {/* 3. Grid Kart Botów */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bots.map((bot) => (
          <Card
            key={bot.id}
            className={`transition-all border ${
              bot.enabled
                ? 'border-border/80 shadow-md bg-card/80 hover:border-primary/40'
                : 'border-border/40 opacity-70 bg-muted/20'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl p-2.5 rounded-2xl bg-muted/70 border border-border/50">
                    {bot.avatar}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {bot.name}
                      <Badge
                        variant={bot.target === 'both' ? 'default' : 'secondary'}
                        className="text-xs font-normal"
                      >
                        {bot.target === 'both' ? 'Fanpage + Grupa' : bot.target === 'group' ? 'Tylko Grupa' : 'Tylko Fanpage'}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Harmonogram: {
                          bot.schedule === 'hourly' ? 'Co 1h' :
                          bot.schedule === 'every_3_hours' ? 'Co 3h' :
                          bot.schedule === 'daily' ? '1x dziennie' :
                          bot.schedule === 'twice_daily' ? '2x dziennie' : 'Ręczny'
                        }
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Styl: {bot.tone}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <Switch
                    checked={bot.enabled}
                    onCheckedChange={() => handleToggle(bot.id, bot.enabled)}
                  />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {bot.enabled ? 'Aktywny' : 'Wyłączony'}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-sm pb-4">
              <p className="text-muted-foreground text-xs leading-relaxed min-h-[40px]">
                {bot.description}
              </p>

              {bot.customInstructions && (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground/80">
                  <span className="font-semibold text-primary">Wytyczne:</span> {bot.customInstructions}
                </div>
              )}

              {/* Przełącznik automatycznego postowania bezpośrednio na karcie */}
              <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                bot.autoApprove 
                  ? 'border-emerald-500/40 bg-emerald-950/20' 
                  : 'border-border/60 bg-muted/30'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${bot.autoApprove ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/60'}`} />
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      Auto-postowanie na FB
                      {bot.autoApprove ? (
                        <Badge className="h-4 px-1 text-[10px] bg-emerald-500 text-white font-medium">LIVE</Badge>
                      ) : (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] text-muted-foreground">Kolejka</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {bot.autoApprove ? 'Publikuje od razu na Facebooku' : 'Zapisuje posty do kolejki'}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={bot.autoApprove}
                  disabled={!bot.enabled}
                  onCheckedChange={() => handleToggleAutoApprove(bot.id, bot.autoApprove)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-center">
                <div className="p-2 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground">Wygenerowano</div>
                  <div className="text-base font-bold text-foreground">{bot.totalGenerated || 0}</div>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground">Opublikowano na FB</div>
                  <div className="text-base font-bold text-emerald-400">{bot.totalPublished || 0}</div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-4 border-t border-border/40 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setSelectedBot(bot);
                  setIsEditing(true);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Ustawienia
              </Button>

              <Button
                size="sm"
                className="gap-1.5 text-xs bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-sm"
                onClick={() => {
                  setRunningBotId(bot.id);
                  setRunResult(null);
                  setTopicHint('');
                  setImmediatePublish(bot.autoApprove);
                  setIsRunDialogOpen(true);
                }}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Uruchom bota teraz
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* 4. Dialog Edycji Bota */}
      {selectedBot && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedBot.avatar}</span>
                Edycja bota: {selectedBot.name}
              </DialogTitle>
              <DialogDescription>
                Dostosuj zachowanie, ton wypowiedzi i kanały docelowe dla tej persony AI.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="bot-name">Nazwa bota</Label>
                <Input
                  id="bot-name"
                  value={selectedBot.name}
                  onChange={(e) => setSelectedBot({ ...selectedBot, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cel publikacji</Label>
                  <Select
                    value={selectedBot.target}
                    onValueChange={(val: any) => setSelectedBot({ ...selectedBot, target: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Fanpage + Grupa</SelectItem>
                      <SelectItem value="group">Tylko Grupa FB</SelectItem>
                      <SelectItem value="fanpage">Tylko Fanpage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Harmonogram</Label>
                  <Select
                    value={selectedBot.schedule}
                    onValueChange={(val: any) => setSelectedBot({ ...selectedBot, schedule: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Co godzinę</SelectItem>
                      <SelectItem value="every_3_hours">Co 3 godziny</SelectItem>
                      <SelectItem value="twice_daily">2x dziennie</SelectItem>
                      <SelectItem value="daily">1x dziennie</SelectItem>
                      <SelectItem value="manual">Tylko na żądanie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ton głosu</Label>
                  <Select
                    value={selectedBot.tone}
                    onValueChange={(val: any) => setSelectedBot({ ...selectedBot, tone: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enthusiastic">Entuzjastyczny 🔥</SelectItem>
                      <SelectItem value="expert">Ekspert & Rzeczowy 🛡️</SelectItem>
                      <SelectItem value="friendly">Przyjazny & Otwarty 💬</SelectItem>
                      <SelectItem value="concise">Zwięzły & Precyzyjny ⚡</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tryb publikacji</Label>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">Publikuj od razu</span>
                    <Switch
                      checked={selectedBot.autoApprove}
                      onCheckedChange={(checked) => setSelectedBot({ ...selectedBot, autoApprove: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bot-instructions">Własne instrukcje dla AI (Prompt)</Label>
                <Textarea
                  id="bot-instructions"
                  rows={3}
                  value={selectedBot.customInstructions || ''}
                  onChange={(e) => setSelectedBot({ ...selectedBot, customInstructions: e.target.value })}
                  placeholder="np. Dodawaj zawsze wzmiankę o darmowej dostawie z Allegro Smart..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Anuluj
              </Button>
              <Button onClick={handleSaveBot}>
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 5. Dialog Uruchomienia Bota Teraz */}
      <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Uruchom bota AI na żądanie
            </DialogTitle>
            <DialogDescription>
              Wygeneruj świeży, unikalny post na podstawie wybranej okazji lub zdaj się na algorytm bota.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Wybór konkretnej okazji do promowania */}
            <div className="space-y-2.5 p-3.5 rounded-xl border border-border/70 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Okazja do promowania:
                </Label>
                {selectedDealId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedDealId(null)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Wybierz automatycznie
                  </Button>
                )}
              </div>

              {selectedDealId ? (
                (() => {
                  const selectedDeal = promotableDeals.find(d => d.id === selectedDealId);
                  return (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-primary/40 shadow-sm">
                      {selectedDeal?.imageUrl ? (
                        <img
                          src={selectedDeal.imageUrl}
                          alt={selectedDeal.title}
                          className="w-12 h-12 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs">
                          Foto
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-foreground">
                          {selectedDeal?.title || 'Wybrana okazja'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span className="font-bold text-primary">{selectedDeal?.price}</span>
                          {selectedDeal?.oldPrice && (
                            <span className="text-muted-foreground text-[11px] line-through">{selectedDeal.oldPrice}</span>
                          )}
                          {selectedDeal?.discount && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-red-500/10 text-red-500 font-bold">
                              {selectedDeal.discount}
                            </Badge>
                          )}
                          <span className="text-[11px] text-amber-500 font-medium">🔥 {selectedDeal?.temperature}°</span>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        Wybrana
                      </Badge>
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-2">
                  <div className="p-2 rounded bg-muted/60 text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="text-base">🤖</span>
                    <span>
                      <strong>Tryb inteligentny:</strong> Bot wybierze najlepszą okazję z bazy, <strong>wykluczając okazje promowane w ostatnich 14 dniach</strong>.
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Wyszukaj inną okazję (np. popdeer, lego, link, ID)..."
                      value={dealSearchQuery}
                      onChange={(e) => setDealSearchQuery(e.target.value)}
                      className="pl-8 pr-7 h-8 text-xs bg-background"
                    />
                    {dealSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDealSearchQuery('')}
                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground text-xs px-1"
                        title="Wyczyść"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Lista podpowiedzi do wyboru */}
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {promotableDeals.slice(0, 10).map(deal => (
                      <div
                        key={deal.id}
                        onClick={() => setSelectedDealId(deal.id)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer border border-transparent hover:border-border text-xs transition-colors bg-background/50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {deal.imageUrl && (
                            <img src={deal.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <div className="min-w-0">
                            <span className="truncate block font-medium max-w-[260px] text-foreground">{deal.title}</span>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>🔥 {deal.temperature}°</span>
                              {deal.merchant && <span>• {deal.merchant}</span>}
                              {deal.postedRecently && (
                                <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-muted-foreground">
                                  Promowana
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-primary">{deal.price}</span>
                          {deal.discount && (
                            <span className="text-[10px] text-red-500 font-bold">{deal.discount}</span>
                          )}
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                            Wybierz
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic-hint">Opcjonalny motyw / instrukcja dodatkowa dla bota</Label>
              <Input
                id="topic-hint"
                placeholder="np. Podkreśl darmową dostawę, ograniczoną ilość sztuk..."
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/40">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Opublikuj od razu na Facebooku</Label>
                <p className="text-xs text-muted-foreground">
                  Gdy włączone, post natychmiast trafi na Fanpage (i doda 1. komentarz z linkiem).
                </p>
              </div>
              <Switch
                checked={immediatePublish}
                onCheckedChange={setImmediatePublish}
              />
            </div>

            {runResult && (
              <div className="space-y-2 p-3 rounded-xl bg-card border border-primary/30">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span>Wygenerowana treść posta:</span>
                  {runResult.published ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      Opublikowano na FB!
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                      Zapisano w kolejce
                    </Badge>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-muted text-xs whitespace-pre-wrap font-sans max-h-48 overflow-y-auto leading-relaxed">
                  {runResult.content}
                </div>
                {runResult.platformPostId && (
                  <div className="pt-1">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-400 gap-1"
                      asChild
                    >
                      <a href={`https://www.facebook.com/${runResult.platformPostId}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Otwórz opublikowany post na Facebooku
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunDialogOpen(false)}>
              Zamknij
            </Button>
            <Button
              onClick={handleRunBot}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generowanie...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {immediatePublish ? 'Generuj i publikuj teraz' : 'Generuj do kolejki'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
