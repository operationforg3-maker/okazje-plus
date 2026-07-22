'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Power,
  PowerOff,
  Bot,
  Layers,
  TrendingDown,
  ShieldCheck,
  Mail,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { AutomationSettings } from '@/lib/system-settings';

export function BackgroundProcessControl() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-settings/automation');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      } else {
        toast.error(data.error || 'Nie udało się pobrać stanu procesów');
      }
    } catch (err) {
      console.error(err);
      toast.error('Błąd podczas ładowania ustawień automatyzacji');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (key: keyof AutomationSettings, value: boolean) => {
    if (!settings) return;

    const previousState = { ...settings };
    const updatedState = { ...settings, [key]: value };
    setSettings(updatedState);
    setUpdating(true);

    try {
      const res = await fetch('/api/admin/system-settings/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [key]: value } }),
      });
      const data = await res.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
        if (key === 'masterSwitchEnabled') {
          if (value) {
            toast.success('🟢 Włączono globalny Master Switch procesów w tle!');
          } else {
            toast.warning('🔴 Wyłączono WSZYSTKIE procesy w tle! (Tryb oszczędzania kosztów)');
          }
        } else {
          toast.success(`Zaktualizowano ustawienie: ${key}`);
        }
      } else {
        setSettings(previousState);
        toast.error(data.error || 'Wystąpił błąd podczas zapisywania');
      }
    } catch (err) {
      console.error(err);
      setSettings(previousState);
      toast.error('Błąd komunikacji z serwerem');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
        <CardContent className="p-6 flex items-center justify-center space-x-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Ładowanie ustawień procesów w tle...</span>
        </CardContent>
      </Card>
    );
  }

  const isMasterOn = Boolean(settings?.masterSwitchEnabled);

  return (
    <Card className={`border backdrop-blur transition-all duration-300 ${
      isMasterOn 
        ? 'border-emerald-500/30 bg-slate-950/80 shadow-lg shadow-emerald-950/20' 
        : 'border-rose-500/30 bg-slate-950/90 shadow-lg shadow-rose-950/20'
    }`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className={`h-6 w-6 ${isMasterOn ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
              <CardTitle className="text-xl font-bold text-white">
                Kontrola Procesów w Tle (Master Switch)
              </CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Główny wyłącznik automatycznych zadań w tle (Cron, Autopilot, Synchro) zapobiegający generowaniu kosztów GCP.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSettings}
              disabled={updating}
              className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${updating ? 'animate-spin' : ''}`} />
              Odśwież
            </Button>

            <Badge
              variant="outline"
              className={`px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5 ${
                isMasterOn
                  ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                  : 'border-rose-500/50 bg-rose-950/60 text-rose-300 animate-pulse'
              }`}
            >
              {isMasterOn ? (
                <>
                  <Power className="h-4 w-4 text-emerald-400" />
                  PROCESY AKTYWNE
                </>
              ) : (
                <>
                  <PowerOff className="h-4 w-4 text-rose-400" />
                  WYŁĄCZONE (Zabezpieczenie Kosztów)
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Banner ostrzegawczy / informacyjny */}
        {!isMasterOn ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-4 text-rose-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-white">Główny wyłącznik jest obecnie wyłączony.</span>
              <p className="mt-1 text-rose-300/90">
                Żadne automatyczne zadania w tle, scrapowanie, synchronizacje ani cykliczne zapytania AI nie będą się wykonywać. Pakiety i wywołania w GCP są całkowicie wstrzymane.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-4 text-emerald-200 flex items-start gap-3">
            <Zap className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-white">Zadania automatyczne są aktywne.</span>
              <p className="mt-1 text-emerald-300/90">
                Aktywne automaty w tle będą przetwarzać zlecenia zgodnie ze zdefiniowanym harmonogramem.
              </p>
            </div>
          </div>
        )}

        {/* MASTER SWITCH CARD */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">MASTER SWITCH – Główny Przełącznik</span>
              <Badge className={isMasterOn ? 'bg-emerald-600' : 'bg-rose-600'}>
                {isMasterOn ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Włączenie lub wyłączenie tego przełącznika nadrzędnie steruje wszystkimi automatyzacjami w tle w całej aplikacji.
            </p>
          </div>
          <Switch
            checked={isMasterOn}
            onCheckedChange={(val) => handleToggle('masterSwitchEnabled', val)}
            disabled={updating}
            className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-600"
          />
        </div>

        {/* Subsystem Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Autopilot AliExpress */}
          <div className={`p-4 rounded-lg border transition-opacity ${
            !isMasterOn ? 'opacity-50 pointer-events-none border-slate-800 bg-slate-950/40' : 'border-slate-800 bg-slate-900/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-purple-950/60 border border-purple-500/30 text-purple-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-white cursor-pointer">
                    Autopilot AliExpress
                  </Label>
                  <p className="text-xs text-slate-400">
                    Automatyczne pobieranie i generowanie ofert
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(settings?.autopilotEnabled)}
                onCheckedChange={(val) => handleToggle('autopilotEnabled', val)}
                disabled={!isMasterOn || updating}
              />
            </div>
          </div>

          {/* Harvester Jobs */}
          <div className={`p-4 rounded-lg border transition-opacity ${
            !isMasterOn ? 'opacity-50 pointer-events-none border-slate-800 bg-slate-950/40' : 'border-slate-800 bg-slate-900/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-950/60 border border-blue-500/30 text-blue-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-white cursor-pointer">
                    Harvester / Kolejka Zadań
                  </Label>
                  <p className="text-xs text-slate-400">
                    Przetwarzanie zadań z kolejki `processImportJobs`
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(settings?.harvesterEnabled)}
                onCheckedChange={(val) => handleToggle('harvesterEnabled', val)}
                disabled={!isMasterOn || updating}
              />
            </div>
          </div>

          {/* Price Monitor */}
          <div className={`p-4 rounded-lg border transition-opacity ${
            !isMasterOn ? 'opacity-50 pointer-events-none border-slate-800 bg-slate-950/40' : 'border-slate-800 bg-slate-900/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-400">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-white cursor-pointer">
                    Monitor Cen
                  </Label>
                  <p className="text-xs text-slate-400">
                    Sprawdzanie aktualności cen i powiadomień okazjonalnych
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(settings?.priceMonitorEnabled)}
                onCheckedChange={(val) => handleToggle('priceMonitorEnabled', val)}
                disabled={!isMasterOn || updating}
              />
            </div>
          </div>

          {/* SEO Zombie Cleaner */}
          <div className={`p-4 rounded-lg border transition-opacity ${
            !isMasterOn ? 'opacity-50 pointer-events-none border-slate-800 bg-slate-950/40' : 'border-slate-800 bg-slate-900/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-teal-950/60 border border-teal-500/30 text-teal-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-white cursor-pointer">
                    SEO Zombie Cleaner & Audit
                  </Label>
                  <p className="text-xs text-slate-400">
                    Czyszczenie starych / nieaktywnych wpisów i audyt SEO
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(settings?.seoCleanerEnabled)}
                onCheckedChange={(val) => handleToggle('seoCleanerEnabled', val)}
                disabled={!isMasterOn || updating}
              />
            </div>
          </div>
        </div>

        {settings?.updatedAt && (
          <div className="text-xs text-right text-slate-500 pt-2 border-t border-slate-800">
            Ostatnia zmiana ustawień: {new Date(settings.updatedAt).toLocaleString('pl-PL')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
