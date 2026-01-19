'use client';

import { useAuth } from '@/lib/auth';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIEnhancer } from '@/components/admin/ai-enhancer';
import { withAuth } from '@/components/auth/withAuth';
import { Combine, ListTree, Package, Sparkles, Clock, Shield, Database, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { JobsMonitor } from '@/components/admin/jobs-monitor';
import { HarvesterJobsMonitor } from '@/components/admin/harvester-jobs-monitor';
import { ScheduleManager } from '@/components/admin/schedule-manager';
import { LinkVerifier } from '@/components/admin/link-verifier';
import { FirebaseIndexManager } from '@/components/admin/firebase-index-manager';
import { DatabaseCleaner } from '@/components/admin/database-cleaner';

interface ConsoleLine {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: string;
}

function HarvesterPage() {
  const { user, getIdToken } = useAuth();
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLine[]>([]);

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

  const clearLogs = () => {
    setConsoleLogs([]);
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
          <Tabs defaultValue="categories" className="space-y-4">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="categories" className="gap-1 px-1 text-xs">
                <ListTree className="h-4 w-4" />
                <span>Kategorie</span>
              </TabsTrigger>
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
              <TabsTrigger value="links" className="gap-1 px-1 text-xs">
                <Shield className="h-4 w-4" />
                <span>Linki</span>
              </TabsTrigger>
              <TabsTrigger value="indexes" className="gap-1 px-1 text-xs">
                <Database className="h-4 w-4" />
                <span>Indexes</span>
              </TabsTrigger>
              <TabsTrigger value="cleanup" className="gap-1 px-1 text-xs">
                <Trash2 className="h-4 w-4" />
                <span>Czyszczenie</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-4">
              <div className="p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                Ten moduł został zarchiwizowany.
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <div className="p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                Ten moduł został zarchiwizowany.
              </div>
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

            <TabsContent value="links" className="space-y-4">
              <LinkVerifier onConsoleLog={addLog} />
            </TabsContent>

            <TabsContent value="indexes" className="space-y-4">
              <FirebaseIndexManager onConsoleLog={addLog} />
            </TabsContent>

            <TabsContent value="cleanup" className="space-y-4">
              <DatabaseCleaner onConsoleLog={addLog} />
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
