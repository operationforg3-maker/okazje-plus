'use client';

import { useAuth } from '@/lib/auth';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ConvertiserAutoImport from '@/components/admin/convertiser-auto-import';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIEnhancer } from '@/components/admin/ai-enhancer';
import { withAuth } from '@/components/auth/withAuth';
import { Combine, Package, Sparkles, Clock, Rocket, Layers, PlayCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { HarvesterJobsMonitor } from '@/components/admin/harvester-jobs-monitor';
import { ScheduleManager } from '@/components/admin/schedule-manager';

interface ConsoleLine {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: string;
}

type HarvesterSource = 'convertiser' | 'aliexpress' | 'amazon' | 'allegro';

function HarvesterPage() {
  const { user, getIdToken } = useAuth();
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLine[]>([]);
  const [source, setSource] = useState<HarvesterSource>('convertiser');
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [isFillingCategories, setIsFillingCategories] = useState(false);
  const [isBootstrappingProfiles, setIsBootstrappingProfiles] = useState(false);
  const [isRunningAutopilot, setIsRunningAutopilot] = useState(false);
  const [isEnablingDealSchedule, setIsEnablingDealSchedule] = useState(false);

  const runM6FillCategories = async () => {
    setIsFillingCategories(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/ai/fill-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się uzupełnić kategorii');
      }

      addLog('M6: Automatyczne uzupełnianie kategorii zakończone.', 'success');
    } catch (error: any) {
      addLog(`M6: Błąd uzupełniania kategorii: ${error?.message || 'Nieznany błąd'}`, 'error');
    } finally {
      setIsFillingCategories(false);
    }
  };

  const runM6BootstrapProfiles = async () => {
    setIsBootstrappingProfiles(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/autopilot/bootstrap-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dryRun: false,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się przygotować profili autopilota');
      }

      const created = Number(data?.result?.createdProfiles || 0);
      const skipped = Number(data?.result?.skippedProfiles || 0);
      addLog(`M6: Bootstrap profili zakończony. Utworzono: ${created}, pominięto: ${skipped}.`, 'success');
    } catch (error: any) {
      addLog(`M6: Błąd bootstrapu profili: ${error?.message || 'Nieznany błąd'}`, 'error');
    } finally {
      setIsBootstrappingProfiles(false);
    }
  };

  const runM6AutopilotNow = async () => {
    setIsRunningAutopilot(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/autopilot/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się uruchomić autopilota');
      }

      addLog(
        `M6: Autopilot uruchomiony. Profile: ${Number(data?.total || 0)}, sukces: ${Number(data?.successful || 0)}, błędy: ${Number(data?.failed || 0)}.`,
        'success'
      );
    } catch (error: any) {
      addLog(`M6: Błąd autopilota: ${error?.message || 'Nieznany błąd'}`, 'error');
    } finally {
      setIsRunningAutopilot(false);
    }
  };

  const runEnableDealsSchedule = async () => {
    setIsEnablingDealSchedule(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/schedule/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          frequency: 'hourly',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się ustawić harmonogramu deali');
      }

      addLog('M6: Włączono harmonogram deali (hourly), aby utrzymać świeże najlepsze oferty.', 'success');
    } catch (error: any) {
      addLog(`M6: Błąd ustawiania harmonogramu deali: ${error?.message || 'Nieznany błąd'}`, 'error');
    } finally {
      setIsEnablingDealSchedule(false);
    }
  };

  const startHarvesterJob = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery && source !== 'convertiser') {
      addLog('Podaj zapytanie dla wybranego źródła.', 'warning');
      return;
    }

    setIsStartingJob(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source,
          query: source === 'convertiser' && !normalizedQuery ? 'promocje' : normalizedQuery,
          maxResults,
          mode: 'single',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Nie udało się uruchomić harvestera');
      }

      addLog(
        `Harvester uruchomiony: ${source}, Job ID: ${data?.job?.id || 'brak'}`,
        'success'
      );
    } catch (error: any) {
      addLog(`Błąd uruchamiania harvestera: ${error?.message || 'Nieznany błąd'}`, 'error');
    } finally {
      setIsStartingJob(false);
    }
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setConsoleLogs(prev => [
      ...prev,
      {
        id: uuidv4(),
        timestamp,
        message,
        type,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Combine className="h-8 w-8" />
          Kombajn Importu
        </h1>
        <p className="text-muted-foreground mt-2">
          Kompletny system do importu kategorii, produktów i automatycznego ulepszania za pomocą AI
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          <Tabs defaultValue="import" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="import" className="gap-1 px-1 text-xs">
                <Package className="h-4 w-4" />
                <span>Import</span>
              </TabsTrigger>
              <TabsTrigger value="enhance" className="gap-1 px-1 text-xs">
                <Sparkles className="h-4 w-4" />
                <span>Ulepszanie</span>
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1 px-1 text-xs">
                <Clock className="h-4 w-4" />
                <span>Zadania</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1 px-1 text-xs">
                <Clock className="h-4 w-4" />
                <span>Harmonogramy</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4">
              <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                <h3 className="text-lg font-semibold">Uruchom import M6</h3>
                <p className="text-sm text-muted-foreground">
                  Import działa asynchronicznie w tle. Status i logi zobaczysz w zakładce „Zadania”.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Źródło</Label>
                    <Select value={source} onValueChange={(value) => setSource(value as HarvesterSource)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="convertiser">Convertiser</SelectItem>
                        <SelectItem value="aliexpress">AliExpress</SelectItem>
                        <SelectItem value="amazon">Amazon</SelectItem>
                        <SelectItem value="allegro">Allegro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Zapytanie</Label>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="np. laptop gaming, smartfon 5g, ekspres do kawy"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Maksymalna liczba wyników</Label>
                    <Input
                      type="number"
                      min={10}
                      max={200}
                      value={maxResults}
                      onChange={(e) => setMaxResults(Math.max(10, Math.min(200, Number(e.target.value) || 50)))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button onClick={startHarvesterJob} disabled={isStartingJob} className="w-full md:w-auto">
                      {isStartingJob ? 'Uruchamianie...' : 'Uruchom Harvester'}
                    </Button>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Rocket className="h-4 w-4" />
                    M6 Autopilot - kategorie i najlepsze deale
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Layers className="h-3 w-3" />
                      Wypelnianie kategorii
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <PlayCircle className="h-3 w-3" />
                      Biezace top deale
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Button
                      variant="outline"
                      onClick={runM6FillCategories}
                      disabled={isFillingCategories}
                    >
                      {isFillingCategories ? 'Uzupelniam kategorie...' : 'Uzupelnij wszystkie kategorie'}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={runM6BootstrapProfiles}
                      disabled={isBootstrappingProfiles}
                    >
                      {isBootstrappingProfiles ? 'Przygotowuje profile...' : 'Bootstrap profili L3'}
                    </Button>

                    <Button
                      onClick={runM6AutopilotNow}
                      disabled={isRunningAutopilot}
                    >
                      {isRunningAutopilot ? 'Uruchamiam autopilot...' : 'Uruchom najlepsze deale teraz'}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={runEnableDealsSchedule}
                      disabled={isEnablingDealSchedule}
                    >
                      {isEnablingDealSchedule ? 'Wlaczam harmonogram...' : 'Wlacz harmonogram hourly'}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Rekomendowany workflow: 1) Uzupelnij kategorie, 2) Bootstrap profili L3, 3) Uruchom autopilot.
                    Wyniki monitoruj w zakladce Zadania.
                  </p>
                </CardContent>
              </Card>

              <ConvertiserAutoImport />
            </TabsContent>

            <TabsContent value="enhance" className="space-y-4">
              <AIEnhancer
                onConsoleLog={addLog}
                onEnhancementStarted={() => {
                  addLog('🤖 Sesja ulepszania AI rozpoczęta', 'info');
                }}
                onEnhancementCompleted={(stats: any) => {
                  addLog(`📊 Ulepszone: ${stats.enhanced}, Średnia jakość: ${(stats.avgQualityScore * 100).toFixed(1)}%`, 'success');
                }}
              />
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <HarvesterJobsMonitor onConsoleLog={addLog} />
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <ScheduleManager onConsoleLog={addLog} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Console Sidebar - Archived */}
        <div className="hidden">
           {/* Console removed */}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Jak uzywac?</h3>
        <ol className="text-sm text-blue-900 dark:text-blue-100 space-y-1 list-decimal list-inside">
          <li><strong>Krok 1:</strong> Utworz strukture kategorii za pomoca "Konstruktora kategorii"</li>
          <li><strong>Krok 2:</strong> Importuj produkty/okazje z wybranych zrodel do schowka roboczego (drafty)</li>
          <li><strong>Krok 3:</strong> Uzyj AI do ulepszenia draftow - poprawi tytuły, opisy, kategoryzacje</li>
          <li><strong>Krok 4:</strong> Przejrzyj wyniki w konsoli i publikuj gotowe itemy</li>
        </ol>
      </div>
    </div>
  );
}

export default withAuth(HarvesterPage, { requiredRole: 'admin' });
