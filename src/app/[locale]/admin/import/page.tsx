'use client';

import { useEffect, useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Bot,
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  Image,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { AliExpressAutopilotControl } from '@/components/admin/aliexpress-autopilot-control';
import { ScheduleManager } from '@/components/admin/schedule-manager';
import { ScrapingQueuePanel } from '@/components/admin/scraping-queue-panel';
import { HarvesterJobsMonitor } from '@/components/admin/harvester-jobs-monitor';
import { AliExpressCsvImporter } from '@/components/admin/aliexpress-csv-importer';

// ─── Status bar at the top ───────────────────────────────────────────────────

function ImportStatusBar({ authToken }: { authToken: string | null }) {
  const [state, setState] = useState<{
    enabled?: boolean;
    lockedUntil?: string | null;
    lastRunAt?: string | null;
    lastResult?: { created?: number; updated?: number; skipped?: number } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch_ = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/autopilot-state', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLocked = state?.lockedUntil && new Date(state.lockedUntil) > new Date();

  return (
    <Card className="border-l-4 border-l-indigo-500">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {/* Enabled */}
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium">Autopilot</span>
              {state?.enabled !== undefined && (
                <Badge variant={state.enabled ? 'default' : 'secondary'}>
                  {state.enabled ? 'Aktywny' : 'Wyłączony'}
                </Badge>
              )}
            </div>

            {/* Lock status */}
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-medium ${isLocked ? 'text-blue-600' : 'text-green-600'}`}>
                {isLocked ? '⟳ Trwa import' : '✓ Wolny'}
              </span>
            </div>

            {/* Last result */}
            {state?.lastResult && (
              <div className="flex items-center gap-2 text-sm">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Ostatni run:</span>
                <span className="font-medium text-green-600">+{state.lastResult.created ?? 0}</span>
                <span className="text-muted-foreground">nowych,</span>
                <span className="font-medium text-blue-600">{state.lastResult.updated ?? 0}</span>
                <span className="text-muted-foreground">zaktualizowanych</span>
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={fetch_} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ImportPage() {
  const { getIdToken } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    getIdToken().then(t => setAuthToken(t || null));
  }, [getIdToken]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Import & Pipeline</h2>
          <p className="text-muted-foreground mt-1">
            Centrum kontroli importu AliExpress — autopilot, kolejka scrapingu i logi
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3">
          <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
          Cron co 30 min
        </Badge>
      </div>

      {/* Auth error */}
      {authError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {authError}
        </div>
      )}

      {/* Status bar */}
      <ImportStatusBar authToken={authToken} />

      {/* Main tabs */}
      <Tabs defaultValue="autopilot" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="autopilot" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Autopilot</span>
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-orange-500" />
            <span className="hidden sm:inline">Import CSV</span>
          </TabsTrigger>
          <TabsTrigger value="scraping" className="gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Scraping</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Logi</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden sm:inline">Harmonogram</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Autopilot ────────────────────────────────── */}
        <TabsContent value="autopilot" className="space-y-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                Jak działa pipeline
              </CardTitle>
              <CardDescription>
                Cykl importu uruchamia się automatycznie co 30 minut lub ręcznie poniżej.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li><b>AliExpress API</b> → pobranie produktów wg presetów (kategorie, słowa kluczowe)</li>
                <li><b>Harvester</b> → dedupl., normalizacja cen, zapis do <code>product_cores</code> z <code>scrapingStatus: pending</code></li>
                <li><b>Cloud Function</b> <code>scrapeProductCore</code> → trigger Firestore onCreate → Puppeteer</li>
                <li><b>Scraper</b> → specyfikacje, zdjęcia recenzji, opis HTML → update <code>product_cores</code></li>
                <li><b>Moderacja</b> → admin zatwierdza lub odrzuca → publikacja</li>
              </ol>
            </CardContent>
          </Card>

          <AliExpressAutopilotControl
            authToken={authToken}
            setAuthError={setAuthError}
          />
        </TabsContent>

        {/* ── Tab: Import CSV ─────────────────────────────────── */}
        <TabsContent value="csv" className="space-y-4">
          <AliExpressCsvImporter authToken={authToken} />
        </TabsContent>

        {/* ── Tab 2: Scraping Queue ───────────────────────────── */}
        <TabsContent value="scraping" className="space-y-4">
          <ScrapingQueuePanel />
        </TabsContent>

        {/* ── Tab 3: Logi ─────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4">
          <HarvesterJobsMonitor />
        </TabsContent>

        {/* ── Tab 4: Harmonogram ──────────────────────────────── */}
        <TabsContent value="schedule" className="space-y-4">
          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-violet-500" />
                Harmonogram synchronizacji
              </CardTitle>
              <CardDescription>
                Zarządzaj presетami harvestera i konfiguracją cykli importu.
              </CardDescription>
            </CardHeader>
          </Card>
          <ScheduleManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ImportPage, { requiredRole: 'admin' });
