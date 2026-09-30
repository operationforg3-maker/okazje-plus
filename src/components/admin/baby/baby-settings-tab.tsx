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
  Baby,
  Settings,
  Facebook,
  Globe,
  Clock,
  ShieldCheck,
  Save,
  RefreshCw,
  Key,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
} from 'lucide-react';
import type { BabyAutopilotConfig } from '@/lib/types';
import {
  saveBabyAutopilotConfigAction,
  validateFacebookBabyCredentialsAction,
  publishTestBabyPostAction,
} from '@/app/actions/baby-autopilot';

interface BabySettingsTabProps {
  config: BabyAutopilotConfig;
  onRefreshConfig: () => void;
}

export function BabySettingsTab({
  config,
  onRefreshConfig,
}: BabySettingsTabProps) {
  const [formData, setFormData] = useState<BabyAutopilotConfig>(config);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingFb, setTestingFb] = useState(false);
  const [publishingTest, setPublishingTest] = useState(false);

  const updateFb = (field: keyof BabyAutopilotConfig['fb'], value: any) => {
    setFormData(prev => ({ ...prev, fb: { ...prev.fb, [field]: value } }));
  };

  const updateSchedule = (field: keyof BabyAutopilotConfig['schedule'], value: any) => {
    setFormData(prev => ({ ...prev, schedule: { ...prev.schedule, [field]: value } }));
  };

  const updateFilters = (field: keyof BabyAutopilotConfig['filters'], value: any) => {
    setFormData(prev => ({ ...prev, filters: { ...prev.filters, [field]: value } }));
  };

  const updatePartners = (field: keyof BabyAutopilotConfig['partners'], value: any) => {
    setFormData(prev => ({
      ...prev,
      partners: { ...(prev.partners || { aliexpress: true, convertiser: true, tradetracker: true }), [field]: value },
    }));
  };

  const updateTracking = (field: keyof NonNullable<BabyAutopilotConfig['tracking']>, value: any) => {
    setFormData(prev => ({
      ...prev,
      tracking: {
        campaign: 'Maluch_1',
        subId: 'Maluch_1',
        ...(prev.tracking || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await saveBabyAutopilotConfigAction(formData);
      if (res.success) {
        toast.success('Zapisano ustawienia autopilota "Perełki dla Malucha i Mamy"');
        onRefreshConfig();
      } else {
        toast.error(res.error || 'Błąd zapisu ustawień');
      }
    } catch {
      toast.error('Błąd zapisu konfiguracji');
    } finally {
      setSaving(false);
    }
  };

  const handleValidateFacebook = async () => {
    try {
      setTestingFb(true);
      const res = await validateFacebookBabyCredentialsAction(
        formData.fb.accessToken,
        formData.fb.pageId
      );
      if (res.valid) {
        toast.success(`Token ważny! Strona: ${res.pageName || res.pageId}`);
      } else {
        toast.error(res.error || 'Błąd weryfikacji tokena Facebook');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd sprawdzania Facebooka');
    } finally {
      setTestingFb(false);
    }
  };

  const handlePublishTest = async () => {
    if (!confirm('Czy na pewno chcesz opublikować próbny post testowy na Facebooku?')) return;
    try {
      setPublishingTest(true);
      const res = await publishTestBabyPostAction();
      if (res.success) {
        toast.success(`Opublikowano post próbny na FB! ID: ${res.fbPostId}`);
      } else {
        toast.error(res.error || 'Błąd publikacji testowej');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Błąd publikacji testowej');
    } finally {
      setPublishingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SEKCJA FACEBOOK */}
      <Card className="border-pink-200 dark:border-pink-900">
        <CardHeader className="bg-pink-50/40 dark:bg-pink-950/20 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-pink-700 dark:text-pink-300">
              <Facebook className="w-5 h-5 text-blue-600" />
              Konfiguracja Facebook Graph API ("Perełki dla Malucha i Mamy")
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleValidateFacebook}
                disabled={testingFb}
              >
                {testingFb ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Weryfikacja...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Sprawdź token
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-blue-600 border-blue-200"
                onClick={handlePublishTest}
                disabled={publishingTest}
              >
                {publishingTest ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Wyślij próbny post testowy
                  </>
                )}
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Dostęp do publikacji na fanpage'u i w społeczności. Token strony jest w pełni skonfigurowany.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nazwa Fanpage'a:</Label>
              <Input
                value={formData.fb.pageName}
                onChange={e => updateFb('pageName', e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ID Strony na Facebooku (Page ID):</Label>
              <Input
                value={formData.fb.pageId}
                onChange={e => updateFb('pageId', e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Page Access Token:</Label>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showToken ? 'Ukryj token' : 'Pokaż token'}
              </button>
            </div>
            <Input
              type={showToken ? 'text' : 'password'}
              value={formData.fb.accessToken}
              onChange={e => updateFb('accessToken', e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Pierwszy komentarz z linkiem afiliacyjnym</Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatycznie dodaje komentarz z bezpośrednim linkiem zaraz po opublikowaniu posta.
                </p>
              </div>
              <Switch
                checked={formData.fb.autoPostFirstComment}
                onCheckedChange={checked => updateFb('autoPostFirstComment', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Publikacja ze zdjęciem produktu</Label>
                <p className="text-[11px] text-muted-foreground">
                  Wrzuca post ze zdjęciem w wysokiej rozdzielczości z bazy ofert.
                </p>
              </div>
              <Switch
                checked={formData.fb.includePhoto}
                onCheckedChange={checked => updateFb('includePhoto', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. SEKCJA TRACKINGU I AFILIACJI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Afiliacja i Tracking Partnerski
          </CardTitle>
          <CardDescription className="text-xs">
            Konfiguracja parametrów SubID, które są doklejane do wszystkich linków afiliacyjnych na Facebooku.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kampania / SubID (np. Maluch_1):</Label>
              <Input
                value={formData.tracking?.campaign || 'Maluch_1'}
                onChange={e => updateTracking('campaign', e.target.value)}
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Ten parametr trafi do linków AliExpress (subid), Convertiser (subid) i TradeTracker (u).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">UTM Source:</Label>
              <Input
                value={formData.tracking?.utmSource || 'facebook'}
                onChange={e => updateTracking('utmSource', e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="pt-2 border-t space-y-3">
            <Label className="text-xs font-semibold block">Aktywne sieci afiliacyjne i źródła feedów:</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-2.5 border rounded-lg">
                <span className="font-medium text-xs">AliExpress</span>
                <Switch
                  checked={formData.partners?.aliexpress ?? true}
                  onCheckedChange={checked => updatePartners('aliexpress', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 border rounded-lg">
                <span className="font-medium text-xs">Convertiser</span>
                <Switch
                  checked={formData.partners?.convertiser ?? true}
                  onCheckedChange={checked => updatePartners('convertiser', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 border rounded-lg">
                <span className="font-medium text-xs">TradeTracker</span>
                <Switch
                  checked={formData.partners?.tradetracker ?? true}
                  onCheckedChange={checked => updatePartners('tradetracker', checked)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">TradeTracker — URL Feeda Produktowego (XML / CSV):</Label>
                <Input
                  placeholder="https://pf.tradetracker.net/?aid=...&encoding=utf-8&type=xml"
                  value={formData.partners?.tradeTrackerFeedUrl || ''}
                  onChange={e => updatePartners('tradeTrackerFeedUrl', e.target.value)}
                  className="text-xs h-8 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Wklej bezpośredni link do pliku XML lub CSV z produktami z TradeTracker.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">TradeTracker Affiliate Site ID (opcjonalnie):</Label>
                <Input
                  placeholder="np. 456789"
                  value={formData.partners?.tradeTrackerSiteId || ''}
                  onChange={e => updatePartners('tradeTrackerSiteId', e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. SEKCJA HARMONOGRAMU I KRYTERIÓW OKAZJI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Harmonogram Autopilota i Filtry Ofert
          </CardTitle>
          <CardDescription className="text-xs">
            Określ jak często system ma wybierać oferty i jakie kryteria rabatowe muszą spełniać.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Minimalny rabat (%):</Label>
              <Input
                type="number"
                value={formData.filters.minDiscountPercent}
                onChange={e => updateFilters('minDiscountPercent', parseInt(e.target.value) || 0)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Odstęp publikacji (godziny):</Label>
              <Input
                type="number"
                value={formData.schedule.intervalHours}
                onChange={e => updateSchedule('intervalHours', parseInt(e.target.value) || 3)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Maks. postów dziennie:</Label>
              <Input
                type="number"
                value={formData.schedule.dailyLimit}
                onChange={e => updateSchedule('dailyLimit', parseInt(e.target.value) || 6)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Słowa kluczowe (wyszukiwanie perełek dla malucha i mamy):</Label>
            <Textarea
              value={formData.filters.keywords.join(', ')}
              onChange={e =>
                updateFilters(
                  'keywords',
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )
              }
              rows={3}
              className="text-xs font-mono text-[11px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Słowa wykluczające (negatywne):</Label>
            <Textarea
              value={formData.filters.negativeKeywords.join(', ')}
              onChange={e =>
                updateFilters(
                  'negativeKeywords',
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )
              }
              rows={2}
              className="text-xs font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Tryb pełnego autopilota</Label>
              <p className="text-[11px] text-muted-foreground">
                Gdy włączony, boty publikują posty automatycznie wg harmonogramu bez konieczności klikania "Zatwierdź".
              </p>
            </div>
            <Switch
              checked={formData.mode === 'autopilot'}
              onCheckedChange={checked =>
                setFormData(prev => ({ ...prev, mode: checked ? 'autopilot' : 'moderation' }))
              }
            />
          </div>
        </CardContent>

        <CardFooter className="pt-2 border-t">
          <Button
            size="sm"
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium text-xs h-9"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Zapisywanie konfiguracji...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Zapisz wszystkie ustawienia
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
