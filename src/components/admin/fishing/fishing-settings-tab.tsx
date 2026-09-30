'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Settings,
  Facebook,
  Globe,
  Clock,
  ShieldCheck,
  Save,
  RefreshCw,
  Play,
  Key,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Users,
  Sparkles,
  Send,
} from 'lucide-react';
import type { FishingAutopilotConfig } from '@/lib/types';
import {
  saveFishingAutopilotConfigAction,
  testFacebookApiAction,
  runFishingAutopilotCycleAction,
} from '@/app/actions/fishing-autopilot';
import { testTelegramNotificationAction } from '@/app/actions/social-growth';

interface FishingSettingsTabProps {
  config: FishingAutopilotConfig;
  onRefreshConfig: () => void;
}

export function FishingSettingsTab({
  config,
  onRefreshConfig,
}: FishingSettingsTabProps) {
  const [formData, setFormData] = useState<FishingAutopilotConfig>(config);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingFb, setTestingFb] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);

  const handleTestTelegram = async () => {
    if (!formData.fb.telegram?.botToken || !formData.fb.telegram?.chatId) {
      toast.error('Wprowadź Bot Token i Chat ID');
      return;
    }
    setTestingTelegram(true);
    try {
      const res = await testTelegramNotificationAction(
        'fishing',
        formData.fb.telegram.botToken,
        formData.fb.telegram.chatId
      );
      if (res.success) {
        toast.success(res.message || 'Wysłano test na Telegram!');
      } else {
        toast.error(res.error || 'Błąd wysyłki');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTestingTelegram(false);
    }
  };

  // Helper updates
  const updateFb = (field: keyof FishingAutopilotConfig['fb'], value: any) => {
    setFormData(prev => ({ ...prev, fb: { ...prev.fb, [field]: value } }));
  };

  const updatePortal = (field: keyof FishingAutopilotConfig['portal'], value: any) => {
    setFormData(prev => ({ ...prev, portal: { ...prev.portal, [field]: value } }));
  };

  const updateSchedule = (field: keyof FishingAutopilotConfig['schedule'], value: any) => {
    setFormData(prev => ({ ...prev, schedule: { ...prev.schedule, [field]: value } }));
  };

  const updateFilters = (field: keyof FishingAutopilotConfig['filters'], value: any) => {
    setFormData(prev => ({ ...prev, filters: { ...prev.filters, [field]: value } }));
  };

  const updatePartners = (field: keyof FishingAutopilotConfig['partners'], value: any) => {
    setFormData(prev => ({
      ...prev,
      partners: { ...(prev.partners || { aliexpress: true, convertiser: true, tradetracker: true }), [field]: value }
    }));
  };

  const updateTracking = (field: keyof NonNullable<FishingAutopilotConfig['tracking']>, value: any) => {
    setFormData(prev => ({
      ...prev,
      tracking: {
        campaign: 'Fishing_2',
        subId: 'Fishing_2',
        utmSource: 'facebook',
        utmMedium: 'social',
        ...(prev.tracking || {}),
        [field]: value,
      }
    }));
  };

  const handleTestFb = async () => {
    try {
      setTestingFb(true);
      const res = await testFacebookApiAction(formData.fb.pageId, formData.fb.accessToken);
      if (res.success) {
        if (res.resolvedPageToken && res.resolvedPageToken !== formData.fb.accessToken) {
          setFormData(prev => ({
            ...prev,
            fb: {
              ...prev.fb,
              accessToken: res.resolvedPageToken!,
            },
          }));
        }
        toast.success(`Facebook API OK! Zweryfikowano: ${res.pageName}`);
      } else {
        toast.error(res.error || 'Błąd autoryzacji Facebook API');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd połączenia z Facebookiem');
    } finally {
      setTestingFb(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await saveFishingAutopilotConfigAction(formData);
      if (res.success) {
        if (res.resolvedPageToken && res.resolvedPageToken !== formData.fb.accessToken) {
          setFormData(prev => ({
            ...prev,
            fb: {
              ...prev.fb,
              accessToken: res.resolvedPageToken!,
            },
          }));
        }
        toast.success('Ustawienia wędkarskiego autopilota zostały zapisane!');
        onRefreshConfig();
      } else {
        toast.error(res.error || 'Błąd zapisu ustawień');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd zapisu konfiguracji');
    } finally {
      setSaving(false);
    }
  };

  const handleRunAutopilotCycle = async () => {
    try {
      setRunningCycle(true);
      const res = await runFishingAutopilotCycleAction();
      if (res.success) {
        toast.success(res.message);
        onRefreshConfig();
      } else {
        toast.error(res.error || res.message || 'Błąd uruchamiania cyklu');
      }
    } catch {
      toast.error('Błąd wykonania cyklu autopilota');
    } finally {
      setRunningCycle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Manual Run Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Konfiguracja Autopilota, Facebook API i Portalu
          </h3>
          <p className="text-xs text-muted-foreground">
            Zarządzaj poświadczeniami Meta Graph API, harmonogramem publikacji i zasadami moderacji.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAutopilotCycle}
            disabled={runningCycle}
            className="text-xs gap-1.5 border-primary/40 hover:bg-primary/10"
          >
            {runningCycle ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-primary" />
            )}
            Uruchom Cykl Autopilota Teraz
          </Button>

          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={saving}
            className="text-xs gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Zapisz Ustawienia
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Facebook Credentials */}
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3 border-b bg-blue-500/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                Facebook Fanpage & Grupa (Meta Graph API)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestFb}
                disabled={testingFb}
                className="text-xs h-7 gap-1"
              >
                {testingFb ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Test API
              </Button>
            </div>
            <CardDescription className="text-xs">
              Uwierzytelnienie dla strony "Wędkarskie Promocje Żona nie widzi".
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nazwa Strony / Grupy</Label>
              <Input
                value={formData.fb.pageName}
                onChange={(e) => updateFb('pageName', e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Page ID (Facebook)</Label>
                <Input
                  value={formData.fb.pageId}
                  onChange={(e) => updateFb('pageId', e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Group ID (Opcjonalnie)</Label>
                <Input
                  placeholder="ID grupy jeśli inna niż strona"
                  value={formData.fb.groupId || ''}
                  onChange={(e) => updateFb('groupId', e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Page Access Token</Label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showToken ? 'Ukryj token' : 'Pokaż token'}
                </button>
              </div>
              <Input
                type={showToken ? 'text' : 'password'}
                value={formData.fb.accessToken}
                onChange={(e) => updateFb('accessToken', e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold block cursor-pointer">
                    Dodawaj 1. komentarz z bezpośrednim linkiem
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Zwiększa zasięgi organiczne posta (Meta obcina posty z linkiem w treści głównej).
                  </p>
                </div>
                <Switch
                  checked={formData.fb.autoPostFirstComment}
                  onCheckedChange={(checked) => updateFb('autoPostFirstComment', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold block cursor-pointer">
                    Publikuj jako post fotograficzny (Photo API)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Zdjęcie sprzętu wędkarskiego zoptymalizowane pod feed Facebooka.
                  </p>
                </div>
                <Switch
                  checked={formData.fb.includePhoto}
                  onCheckedChange={(checked) => updateFb('includePhoto', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Zaangażowanie & Komentarze */}
        <Card className="border-purple-500/30">
          <CardHeader className="pb-3 border-b bg-purple-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Boty: Komentarze & Zwiększanie Zasięgów
            </CardTitle>
            <CardDescription className="text-xs">
              Automatyczny starter dyskusji (pytania o wodę, sprzęt) oraz asystent AI odpowiadający wędkarzom.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold block cursor-pointer">
                  Automatyczny Starter Dyskusji
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Bot wrzuca pod postem pytanie wędkarskie, zmuszając algorytm FB do windowania posta.
                </p>
              </div>
              <Switch
                checked={Boolean(formData.fb.autoEngagementComment)}
                onCheckedChange={(checked) => updateFb('autoEngagementComment', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold block cursor-pointer">
                  Asystent Auto-Reply AI
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Pomaga odpowiadać na pytania o plecionki, wysyłkę i dostępność 1 kliknięciem.
                </p>
              </div>
              <Switch
                checked={Boolean(formData.fb.autoReplyEnabled)}
                onCheckedChange={(checked) => updateFb('autoReplyEnabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Grupy Facebooka & Crossposting */}
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3 border-b bg-blue-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Grupy Wędkarskie & Crossposting
            </CardTitle>
            <CardDescription className="text-xs">
              Połączona grupa wędkarska zarządzana przez Fanpage.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ID Grupy Powiązanej (Linked Group ID)</Label>
              <Input
                placeholder="np. 123456789012345"
                value={formData.fb.linkedGroupId || ''}
                onChange={(e) => updateFb('linkedGroupId', e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold block cursor-pointer">
                  Auto-crossposting do grupy
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatycznie publikuj kopię na grupie podczas publikacji na Stronie.
                </p>
              </div>
              <Switch
                checked={Boolean(formData.fb.autoShareToLinkedGroup)}
                onCheckedChange={(checked) => updateFb('autoShareToLinkedGroup', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Powiadomienia Push Telegram */}
        <Card className="border-sky-500/30">
          <CardHeader className="pb-3 border-b bg-sky-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-600" />
              Powiadomienia Push Telegram (100% Zasięgu)
            </CardTitle>
            <CardDescription className="text-xs">
              Natychmiastowe alerty o perełkach wędkarskich na kanał Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold block cursor-pointer">
                  Włącz kanał Telegram
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Push bezpośrednio na telefon subskrybentów.
                </p>
              </div>
              <Switch
                checked={Boolean(formData.fb.telegram?.enabled)}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    fb: {
                      ...prev.fb,
                      telegram: {
                        enabled: checked,
                        botToken: prev.fb.telegram?.botToken || '',
                        chatId: prev.fb.telegram?.chatId || '',
                      },
                    },
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Telegram Bot Token</Label>
              <Input
                placeholder="Token od @BotFather"
                value={formData.fb.telegram?.botToken || ''}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    fb: {
                      ...prev.fb,
                      telegram: {
                        enabled: Boolean(prev.fb.telegram?.enabled),
                        chatId: prev.fb.telegram?.chatId || '',
                        botToken: e.target.value,
                      },
                    },
                  }))
                }
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Chat ID / Nazwa Kanału</Label>
              <Input
                placeholder="np. @wedkarskie_promki"
                value={formData.fb.telegram?.chatId || ''}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    fb: {
                      ...prev.fb,
                      telegram: {
                        enabled: Boolean(prev.fb.telegram?.enabled),
                        botToken: prev.fb.telegram?.botToken || '',
                        chatId: e.target.value,
                      },
                    },
                  }))
                }
                className="text-xs"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              disabled={testingTelegram || !formData.fb.telegram?.botToken || !formData.fb.telegram?.chatId}
              className="text-xs h-7 gap-1.5 mt-1"
            >
              {testingTelegram ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 text-sky-500" />}
              Wyślij Test na Telegram
            </Button>
          </CardContent>
        </Card>

        {/* 2. Mode & Schedule */}
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3 border-b bg-amber-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Tryb Pracy & Harmonogram Publikacji
            </CardTitle>
            <CardDescription className="text-xs">
              Wybierz czy wolisz akceptować każdy post w kolejce, czy dać pełną autonomię botom.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tryb Pracy Autopilota
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, mode: 'moderation' }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.mode === 'moderation'
                      ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-amber-500">
                    <ShieldCheck className="w-4 h-4" />
                    Kolejka Moderacji
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    AI generuje posty, Ty decydujesz jednym kliknięciem czy publikować.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, mode: 'autopilot' }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.mode === 'autopilot'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-500">
                    <Play className="w-4 h-4" />
                    Pełny Autopilot
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Posty są generowane i publikowane automatycznie w wyznaczonych godzinach.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Godziny publikacji postów (Format 24h, oddzielone przecinkami)
              </Label>
              <Input
                value={formData.schedule.scheduleTimes.join(', ')}
                onChange={(e) => {
                  const times = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateSchedule('scheduleTimes', times);
                }}
                className="text-xs font-mono"
                placeholder="06:30, 12:00, 17:30, 21:30"
              />
              <p className="text-[11px] text-muted-foreground">
                Zalecane pory: <strong>06:30</strong> (poranny wypad), <strong>12:00</strong> (lunch), <strong>17:30</strong> (po pracy), <strong>21:30</strong> (wieczorny chillout "żona nie widzi").
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Maksymalnie postów dziennie</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={formData.schedule.dailyLimit}
                  onChange={(e) => updateSchedule('dailyLimit', parseInt(e.target.value) || 4)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Minimalny rabat oferty (%)</Label>
                <Input
                  type="number"
                  min="5"
                  max="90"
                  value={formData.filters.minDiscountPercent}
                  onChange={(e) => updateFilters('minDiscountPercent', parseInt(e.target.value) || 15)}
                  className="text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Portal Okazje Plus Integration */}
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-3 border-b bg-emerald-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              Portal Okazje Plus (Katalog Wędkarski)
            </CardTitle>
            <CardDescription className="text-xs">
              Ustawienia automatycznego dodawania deali do serwisu.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
              <div>
                <Label className="text-xs font-semibold block cursor-pointer">
                  Automatycznie publikuj oferty w Portalu
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Okazje wędkarskie pojawią się na stronie głównej i w kategorii Sport i turystyka.
                </p>
              </div>
              <Switch
                checked={formData.portal.autoPublish}
                onCheckedChange={(checked) => updatePortal('autoPublish', checked)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nazwa profilu autora w portalu</Label>
              <Input
                value={formData.portal.authorName}
                onChange={(e) => updatePortal('authorName', e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kategoria docelowa</Label>
                <Select
                  value={formData.portal.categorySlug}
                  onValueChange={(val) => updatePortal('categorySlug', val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sport-turystyka">Sport i turystyka (Wędkarstwo)</SelectItem>
                    <SelectItem value="hobby">Hobby i rozrywka</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Domyślny status deali</Label>
                <Select
                  value={formData.portal.defaultStatus}
                  onValueChange={(val: any) => updatePortal('defaultStatus', val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Zatwierdzony (Strona główna)</SelectItem>
                    <SelectItem value="poczekalnia">Poczekalnia (Głosowanie)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Keywords and Filters */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Słowa Kluczowe Wędkarskie & Filtry
            </CardTitle>
            <CardDescription className="text-xs">
              Algorytm przeszukuje bazę oraz oferty z sieci pod kątem tych fraz.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Wędkarskie słowa kluczowe (oddzielone przecinkami)</Label>
              <Textarea
                value={formData.filters.keywords.join(', ')}
                onChange={(e) => {
                  const kws = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateFilters('keywords', kws);
                }}
                className="text-xs min-h-[90px] font-mono leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                np. wędka, kołowrotek, spinning, feeder, karpiowe, plecionka, woblery, zanęta, sygnalizator, echosonda, ponton, fotel wędkarski.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Słowa wykluczające (Negative Keywords)</Label>
              <Input
                value={formData.filters.negativeKeywords.join(', ')}
                onChange={(e) => {
                  const neg = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateFilters('negativeKeywords', neg);
                }}
                className="text-xs font-mono"
                placeholder="zabawka, akwarium domowe"
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. Partner Networks: Convertiser, TradeTracker, AliExpress */}
        <Card className="md:col-span-2 border-purple-500/30">
          <CardHeader className="pb-3 border-b bg-purple-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              Partnerzy Afiliacyjni & Źródła Ofert (Convertiser, TradeTracker, AliExpress)
            </CardTitle>
            <CardDescription className="text-xs">
              Autopilot pobiera oferty sprzętu wędkarskiego z wybranych sieci afiliacyjnych, przetwarza je przez AI i publikuje na FB oraz w portalu.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* AliExpress */}
              <div className="p-3 rounded-lg border bg-orange-500/5 border-orange-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-orange-600 dark:text-orange-400">🟠 AliExpress</span>
                  <Switch
                    checked={formData.partners?.aliexpress ?? true}
                    onCheckedChange={(checked) => updatePartners('aliexpress', checked)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Błyskawiczne okazje z bazy oraz wyszukiwarka gorących produktów i wyprzedaży sprzętowych.
                </p>
              </div>

              {/* Convertiser */}
              <div className="p-3 rounded-lg border bg-purple-500/5 border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-purple-600 dark:text-purple-400">🟣 Convertiser</span>
                  <Switch
                    checked={formData.partners?.convertiser ?? true}
                    onCheckedChange={(checked) => updatePartners('convertiser', checked)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Polskie i europejskie sklepy wędkarskie i sportowe (Decathlon, Militaria, eobuwie i inne).
                </p>
              </div>

              {/* TradeTracker */}
              <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-blue-600 dark:text-blue-400">🔵 TradeTracker</span>
                  <Switch
                    checked={formData.partners?.tradetracker ?? true}
                    onCheckedChange={(checked) => updatePartners('tradetracker', checked)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Programy partnerskie, feedy produktowe XML/CSV oraz kody rabatowe i promocje.
                </p>
              </div>
            </div>

            {/* Partner Credentials / Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              {/* Convertiser Token */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  Convertiser API Token
                </Label>
                <Input
                  type="password"
                  placeholder="sE1vVgCO6U7zfl3pN7XsPFFY4Uu9L0"
                  value={formData.partners?.convertiserToken || ''}
                  onChange={(e) => updatePartners('convertiserToken', e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Domyślny token jest skonfigurowany w środowisku. Możesz podać własny token API wydawcy.
                </p>
              </div>

              {/* TradeTracker Feed URL / Credentials */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  TradeTracker Product Feed URL (XML / CSV)
                </Label>
                <Input
                  placeholder="https://pf.tradetracker.net/?aid=...&encoding=utf-8&type=xml"
                  value={formData.partners?.tradeTrackerFeedUrl || ''}
                  onChange={(e) => updatePartners('tradeTrackerFeedUrl', e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Link do feedu produktowego ze sklepów wędkarskich wygenerowany w panelu TradeTracker.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracking & Attribution (Fishing_2) */}
        <Card className="md:col-span-2 border-emerald-500/30">
          <CardHeader className="pb-3 border-b bg-emerald-500/5">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Tracking & Atrybucja Afiliacyjna (SubID / UTM / Kampania)
            </CardTitle>
            <CardDescription className="text-xs">
              Ustawienie identyfikatora kampanii trackingowej dla wszystkich publikowanych linków i ofert (TradeTracker SubID reference 'r', Convertiser custom_id, UTM Campaign).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Identyfikator Trackingu (Campaign / SubID)
                </Label>
                <Input
                  value={formData.tracking?.campaign || 'Fishing_2'}
                  onChange={(e) => updateTracking('campaign', e.target.value)}
                  placeholder="Fishing_2"
                  className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[11px] text-muted-foreground">
                  Wstrzykiwany jako <code>r=Fishing_2</code> w TradeTracker, <code>custom_id=Fishing_2</code> w Convertiser oraz <code>utm_campaign=Fishing_2</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  UTM Source
                </Label>
                <Input
                  value={formData.tracking?.utmSource || 'facebook'}
                  onChange={(e) => updateTracking('utmSource', e.target.value)}
                  placeholder="facebook"
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Domyślnie: <code>facebook</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  UTM Medium
                </Label>
                <Input
                  value={formData.tracking?.utmMedium || 'social'}
                  onChange={(e) => updateTracking('utmMedium', e.target.value)}
                  placeholder="social"
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Domyślnie: <code>social</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          size="default"
          onClick={handleSaveSettings}
          disabled={saving}
          className="gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Zapisz Wszystkie Ustawienia Autopilota
        </Button>
      </div>
    </div>
  );
}
