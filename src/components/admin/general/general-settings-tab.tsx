'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Save,
  Loader2,
  RefreshCw,
  Send,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Share2,
  Clock,
  Tag,
  Key,
  Users,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import type { GeneralAutopilotConfig } from '@/lib/types';
import {
  saveGeneralAutopilotConfigAction,
  validateFacebookGeneralCredentialsAction,
  publishTestGeneralPostAction,
} from '@/app/actions/general-autopilot';
import { testTelegramNotificationAction } from '@/app/actions/social-growth';

interface GeneralSettingsTabProps {
  config: GeneralAutopilotConfig;
  onRefreshConfig: () => void;
}

export function GeneralSettingsTab({
  config,
  onRefreshConfig,
}: GeneralSettingsTabProps) {
  const [formData, setFormData] = useState<GeneralAutopilotConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTestPost, setSendingTestPost] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    valid?: boolean;
    pageName?: string;
    error?: string;
  } | null>(null);

  const handleTestTelegram = async () => {
    if (!formData.fb.telegram?.botToken || !formData.fb.telegram?.chatId) {
      toast.error('Wprowadź Bot Token i Chat ID');
      return;
    }
    setTestingTelegram(true);
    try {
      const res = await testTelegramNotificationAction(
        'general',
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

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await saveGeneralAutopilotConfigAction(formData);
      if (res.success) {
        toast.success('Ustawienia autopilota Okazje Plus zostały zapisane!');
        onRefreshConfig();
      } else {
        toast.error(res.error || 'Błąd zapisu ustawień');
      }
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const res = await validateFacebookGeneralCredentialsAction(
        formData.fb.accessToken,
        formData.fb.pageId
      );
      setTestResult({
        tested: true,
        valid: res.valid,
        pageName: res.pageName,
        error: res.error,
      });

      if (res.valid) {
        toast.success(`Połączenie aktywne! Fanpage: ${res.pageName}`);
        if (res.pageName && res.pageName !== formData.fb.pageName) {
          setFormData(prev => ({
            ...prev,
            fb: { ...prev.fb, pageName: res.pageName! },
          }));
        }
      } else {
        toast.error(`Błąd weryfikacji tokena FB: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd testu');
    } finally {
      setTesting(false);
    }
  };

  const handlePublishTest = async () => {
    try {
      setSendingTestPost(true);
      const res = await publishTestGeneralPostAction();
      if (res.success) {
        toast.success('🎉 Testowy post został opublikowany na Facebooku!');
      } else {
        toast.error(res.error || 'Nie udało się opublikować posta testowego');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd publikacji');
    } finally {
      setSendingTestPost(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Meta / Facebook Graph API Credentials */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Konfiguracja Facebook Graph API (Meta)
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Profil: Okazje Plus
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Wprowadź ID Fanpage'a oraz Długoterminowy Page Access Token dla strony głównej Okazje Plus.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ID Strony Facebooka (Page ID)</Label>
              <Input
                value={formData.fb.pageId}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    fb: { ...prev.fb, pageId: e.target.value.trim() },
                  }))
                }
                placeholder="np. 123456789012345"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nazwa Wyświetlana Strony</Label>
              <Input
                value={formData.fb.pageName}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    fb: { ...prev.fb, pageName: e.target.value },
                  }))
                }
                placeholder="Okazje Plus"
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Page Access Token</Label>
            <Input
              type="password"
              value={formData.fb.accessToken}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  fb: { ...prev.fb, accessToken: e.target.value.trim() },
                }))
              }
              placeholder="EAA..."
              className="text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Automatyczny Pierwszy Komentarz z Linkiem</Label>
              <p className="text-[11px] text-muted-foreground">
                Publikuje bezpośredni link afiliacyjny w pierwszym komentarzu bota tuż po dodaniu posta na Facebooku.
              </p>
            </div>
            <Switch
              checked={formData.fb.autoPostFirstComment}
              onCheckedChange={checked =>
                setFormData(prev => ({
                  ...prev,
                  fb: { ...prev.fb, autoPostFirstComment: checked },
                }))
              }
            />
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                testResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                  : 'bg-red-500/10 border-red-500/30 text-red-600'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>
                  {testResult.valid
                    ? `Połączenie poprawne: ${testResult.pageName}`
                    : `Błąd połączenia: ${testResult.error}`}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !formData.fb.accessToken || !formData.fb.pageId}
              className="text-xs h-8"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />}
              Przetestuj Połączenie z FB
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePublishTest}
              disabled={sendingTestPost || !formData.fb.accessToken || !formData.fb.pageId}
              className="text-xs h-8"
            >
              {sendingTestPost ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Opublikuj Post Testowy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. AI Zaangażowanie & Komentarze */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Boty: Komentarze & Zwiększanie Zasięgów
          </CardTitle>
          <CardDescription className="text-xs">
            Automatyczny starter dyskusji pod postami oraz AI asystent odpowiadający na komentarze czytelników.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <span className="font-semibold text-sm">Automatyczny Starter Dyskusji</span>
              <p className="text-xs text-muted-foreground">
                Bot po publikacji posta wrzuca otwarte pytanie do społeczności, zmuszając algorytm FB do windowania posta.
              </p>
            </div>
            <Switch
              checked={Boolean(formData.fb.autoEngagementComment)}
              onCheckedChange={checked =>
                setFormData(prev => ({
                  ...prev,
                  fb: { ...prev.fb, autoEngagementComment: checked },
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <span className="font-semibold text-sm">Asystent Auto-Reply AI</span>
              <p className="text-xs text-muted-foreground">
                Pozwala moderować i generować odpowiedzi na pytania czytelników o cenę, sklep czy dostawę 1 kliknięciem.
              </p>
            </div>
            <Switch
              checked={Boolean(formData.fb.autoReplyEnabled)}
              onCheckedChange={checked =>
                setFormData(prev => ({
                  ...prev,
                  fb: { ...prev.fb, autoReplyEnabled: checked },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Grupy Facebooka & Crossposting */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Grupy Facebooka & Automatyczny Crossposting
          </CardTitle>
          <CardDescription className="text-xs">
            Skonfiguruj ID grupy powiązanej z Fanpage oraz automatyczne udostępnianie postów.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold">ID Grupy Powiązanej (Linked Group ID)</Label>
              <Input
                placeholder="np. 123456789012345"
                value={formData.fb.linkedGroupId || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    fb: { ...prev.fb, linkedGroupId: e.target.value },
                  }))
                }
                className="text-xs h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Strona Fanpage musi być administratorem grupy, aby postować bezpośrednio przez API.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 self-start">
              <div className="space-y-0.5">
                <span className="font-semibold">Auto-crossposting do grupy</span>
                <p className="text-[11px] text-muted-foreground">
                  Automatycznie publikuj kopię na grupie podczas publikacji na Stronie.
                </p>
              </div>
              <Switch
                checked={Boolean(formData.fb.autoShareToLinkedGroup)}
                onCheckedChange={checked =>
                  setFormData(prev => ({
                    ...prev,
                    fb: { ...prev.fb, autoShareToLinkedGroup: checked },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Powiadomienia Push Telegram */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-500" />
            Powiadomienia Push Telegram (100% Zasięgu)
          </CardTitle>
          <CardDescription className="text-xs">
            Wysyłaj każdą okazję na kanał lub grupę Telegram bez ograniczeń algorytmów Facebooka.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <span className="font-semibold text-sm">Włącz powiadomienia na Telegram</span>
              <p className="text-xs text-muted-foreground">
                Każdy opublikowany post trafia natychmiast na Twój kanał Telegram ze zdjęciem i linkiem.
              </p>
            </div>
            <Switch
              checked={Boolean(formData.fb.telegram?.enabled)}
              onCheckedChange={checked =>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold">Telegram Bot Token (od @BotFather)</Label>
              <Input
                placeholder="np. 123456789:ABCdefGhIJKlmNoPQRstUVwxyZ"
                value={formData.fb.telegram?.botToken || ''}
                onChange={e =>
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
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Chat ID lub Nazwa Kanału</Label>
              <Input
                placeholder="np. @okazjeplus lub -100123456789"
                value={formData.fb.telegram?.chatId || ''}
                onChange={e =>
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
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              disabled={testingTelegram || !formData.fb.telegram?.botToken || !formData.fb.telegram?.chatId}
              className="text-xs h-8 gap-1.5"
            >
              {testingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-sky-500" />}
              Wyślij Test na Telegram
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 5. Partner Feeds & Integration */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-500" />
            Integracje Feedów Partnerskich
          </CardTitle>
          <CardDescription className="text-xs">
            Włącz partnerów, z których Harvester pobiera oferty dla ogólnego profilu.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <span className="font-semibold">Convertiser (API)</span>
              <Switch
                checked={formData.partners.convertiser}
                onCheckedChange={checked =>
                  setFormData(prev => ({
                    ...prev,
                    partners: { ...prev.partners, convertiser: checked },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <span className="font-semibold">AliExpress (Choice)</span>
              <Switch
                checked={formData.partners.aliexpress}
                onCheckedChange={checked =>
                  setFormData(prev => ({
                    ...prev,
                    partners: { ...prev.partners, aliexpress: checked },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <span className="font-semibold">TradeTracker</span>
              <Switch
                checked={formData.partners.tradetracker}
                onCheckedChange={checked =>
                  setFormData(prev => ({
                    ...prev,
                    partners: { ...prev.partners, tradetracker: checked },
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold">Bezpośredni URL Feeda Produktowego XML/CSV (TradeTracker)</Label>
            <Input
              value={formData.partners.tradeTrackerFeedUrl || ''}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  partners: { ...prev.partners, tradeTrackerFeedUrl: e.target.value.trim() },
                }))
              }
              placeholder="https://pf.tradetracker.net/?aid=...&encoding=utf-8&type=xml"
              className="text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Wklej link do wygenerowanego pliku feeda XML/CSV z panelu TradeTracker, aby Harvester automatycznie pobierał produkty.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tracking & Affiliate IDs */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-500" />
            Afiliacja i Tracking SubID
          </CardTitle>
          <CardDescription className="text-xs">
            Wartości wstrzykiwane do linków partnerskich generowanych przez boty na profilu ogólnym.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">SubID / Campaign Tag</Label>
              <Input
                value={formData.tracking?.campaign || 'Okazje_1'}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    tracking: {
                      ...(prev.tracking || { campaign: 'Okazje_1' }),
                      campaign: e.target.value.trim(),
                      subId: e.target.value.trim(),
                    },
                  }))
                }
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">UTM Source</Label>
              <Input
                value={formData.tracking?.utmSource || 'facebook'}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    tracking: {
                      ...(prev.tracking || { campaign: 'Okazje_1' }),
                      utmSource: e.target.value.trim(),
                    },
                  }))
                }
                className="text-xs font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Autopilot Scheduling & Mode */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Harmonogram i Autopilot
          </CardTitle>
          <CardDescription className="text-xs">
            Zarządzaj automatycznym publikowaniem postów w tle przez zadania cron.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Włącz Autopilot</Label>
              <p className="text-[11px] text-muted-foreground">
                Główny włącznik automatycznego pobierania ofert i publikacji postów.
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={checked =>
                setFormData(prev => ({
                  ...prev,
                  enabled: checked,
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tryb Działania</Label>
              <Select
                value={formData.mode}
                onValueChange={(val: any) =>
                  setFormData(prev => ({
                    ...prev,
                    mode: val,
                  }))
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderation">Moderacja (Posty trafiają do kolejki do zatwierdzenia)</SelectItem>
                  <SelectItem value="autopilot">Pełny Autopilot (Natychmiastowa publikacja na FB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Maksymalny Limit Postów Dziennie</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={formData.schedule.dailyLimit}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, dailyLimit: parseInt(e.target.value) || 5 },
                  }))
                }
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 border-t bg-muted/20 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="text-xs h-9 font-semibold gap-1.5 bg-primary hover:bg-primary/90"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Zapisz Wszystkie Ustawienia
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
