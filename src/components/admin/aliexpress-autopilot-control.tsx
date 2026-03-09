"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Save, Play, Layers } from 'lucide-react';

type Settings = {
  enabled: boolean;
  ensureProfiles: boolean;
  maxItemsPerProfile: number;
  hardCap: number;
  pageSize: number;
  maxPages: number;
  defaultProfileMaxItems: number;
  updatedAt?: string;
  updatedBy?: string;
};

const DEFAULTS: Settings = {
  enabled: true,
  ensureProfiles: true,
  maxItemsPerProfile: 500,
  hardCap: 5000,
  pageSize: 50,
  maxPages: 100,
  defaultProfileMaxItems: 200,
};

export function AliExpressAutopilotControl({
  authToken,
  setAuthError,
  onActionDone,
}: {
  authToken: string | null;
  setAuthError: (message: string | null) => void;
  onActionDone?: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [message, setMessage] = useState<string>('');

  const canAct = useMemo(() => Boolean(authToken), [authToken]);

  const loadSettings = async () => {
    if (!authToken) {
      setAuthError('Brak tokenu administratora. Zaloguj się ponownie.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/settings', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się pobrać ustawień');
      }

      setSettings({ ...DEFAULTS, ...(data.settings || {}) });
      setAuthError(null);
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      void loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const saveSettings = async () => {
    if (!authToken) return;

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się zapisać ustawień');
      }

      setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      setMessage('✅ Ustawienia zapisane.');
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runAutopilotNow = async () => {
    if (!authToken) return;

    setRunning(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxItemsPerProfile: settings.maxItemsPerProfile }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się uruchomić autopilota');
      }

      setMessage(`✅ Autopilot uruchomiony. Profile: ${data.total}, sukces: ${data.successful}.`);
      onActionDone?.();
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunning(false);
    }
  };

  const bootstrapProfiles = async (dryRun: boolean) => {
    if (!authToken) return;

    setBootstrapping(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/bootstrap-profiles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun, maxItemsPerRun: settings.defaultProfileMaxItems }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Bootstrap zakończony błędem');
      }

      const result = data.result || {};
      setMessage(
        `✅ Bootstrap ${dryRun ? '(dry-run)' : ''}: utworzono ${result.createdProfiles || 0}, pominięto ${result.skippedProfiles || 0}, targetów ${result.totalTargets || 0}.`
      );
      onActionDone?.();
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBootstrapping(false);
    }
  };

  const updateNumber = (key: keyof Settings, value: string) => {
    const parsed = Number(value);
    setSettings((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          AliExpress Autopilot - Sterowanie UX
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Autopilot aktywny</p>
              <p className="text-xs text-slate-500">Cron importuje tylko gdy ta opcja jest wlaczona.</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, enabled: value }))} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Auto-bootstrap profili</p>
              <p className="text-xs text-slate-500">Przed sync automatycznie dopina brakujace profile L3.</p>
            </div>
            <Switch checked={settings.ensureProfiles} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, ensureProfiles: value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>maxItemsPerProfile</Label>
            <Input type="number" value={settings.maxItemsPerProfile} onChange={(e) => updateNumber('maxItemsPerProfile', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>hardCap</Label>
            <Input type="number" value={settings.hardCap} onChange={(e) => updateNumber('hardCap', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>defaultProfileMaxItems</Label>
            <Input type="number" value={settings.defaultProfileMaxItems} onChange={(e) => updateNumber('defaultProfileMaxItems', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>pageSize</Label>
            <Input type="number" value={settings.pageSize} onChange={(e) => updateNumber('pageSize', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>maxPages</Label>
            <Input type="number" value={settings.maxPages} onChange={(e) => updateNumber('maxPages', e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={!canAct || loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Odswiez
          </Button>
          <Button onClick={saveSettings} disabled={!canAct || saving} className="gap-2">
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            Zapisz ustawienia
          </Button>
          <Button variant="secondary" onClick={runAutopilotNow} disabled={!canAct || running} className="gap-2">
            <Play className="w-4 h-4" />
            Uruchom teraz
          </Button>
          <Button variant="outline" onClick={() => bootstrapProfiles(true)} disabled={!canAct || bootstrapping}>
            Bootstrap dry-run
          </Button>
          <Button variant="outline" onClick={() => bootstrapProfiles(false)} disabled={!canAct || bootstrapping}>
            Bootstrap zapis
          </Button>
        </div>

        {settings.updatedAt && (
          <Badge variant="outline">Ostatnia zmiana: {new Date(settings.updatedAt).toLocaleString('pl-PL')}</Badge>
        )}

        {message && (
          <div className="rounded-md border p-3 text-sm bg-slate-50">{message}</div>
        )}
      </CardContent>
    </Card>
  );
}
