'use client';

import { useAuth } from '@/lib/auth';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBuilder } from '@/components/admin/category-builder';
import { ProductImporter } from '@/components/admin/product-importer';
import { AIEnhancer } from '@/components/admin/ai-enhancer';
import { ImportConsole, ConsoleLine } from '@/components/admin/import-console';
import { withAuth } from '@/components/auth/withAuth';
import { Combine, ListTree, Package, Sparkles, Clock, Shield, Database, Trash2, TrendingUp, Activity, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { JobsMonitor } from '@/components/admin/jobs-monitor';
import { ScheduleManager } from '@/components/admin/schedule-manager';
import { LinkVerifier } from '@/components/admin/link-verifier';
import { FirebaseIndexManager } from '@/components/admin/firebase-index-manager';
import { DatabaseCleaner } from '@/components/admin/database-cleaner';
import { useEffect as useEffectHook } from 'react';

interface DashboardStats {
  productsCount: number;
  dealsCount: number;
  jobsRunning: number;
  lastImportTime?: string;
  totalImports: number;
}

function HarvesterPage() {
  const { user, getIdToken } = useAuth();
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLine[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    productsCount: 0,
    dealsCount: 0,
    jobsRunning: 0,
    totalImports: 0,
  });

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

  // Fetch dashboard stats
  useEffectHook(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/import/dashboard/summary', {
          headers: {
            'Authorization': `Bearer ${await getIdToken()}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            productsCount: data.products?.approved || 0,
            dealsCount: data.products?.draft || 0,
            jobsRunning: data.recentJobs?.filter((j: any) => j.status === 'running').length || 0,
            totalImports: data.recentJobs?.length || 0,
            lastImportTime: data.recentJobs?.[0]?.createdAt,
          });
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [getIdToken]);

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

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Produkty (Zatwierdzone)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.productsCount.toLocaleString()}</div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Opublikowane</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">Okazje (Robocze)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.dealsCount.toLocaleString()}</div>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">Do przeglądu</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Zadania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.jobsRunning}</div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">W trakcie {stats.totalImports > 0 && `(${stats.totalImports} razem)`}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {stats.jobsRunning > 0 ? '🟢' : '⚪'}
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
              {stats.jobsRunning > 0 ? 'Aktywne' : 'Gotowy'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Tools Shortcuts */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            ⭐ Najczęściej Używane Narzędzia (Top 3)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-amber-100 dark:border-amber-800 hover:shadow-md transition-shadow cursor-pointer"
                 onClick={() => { (document.querySelector('[value="jobs"]') as HTMLElement)?.click?.(); }}>
              <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">📋 TASKS</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Zadania (v2.1)</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Monitor i tworzenie jobów</p>
              <div className="text-xs text-gray-500 mt-2 font-mono">Auto-refresh co 5s</div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-amber-100 dark:border-amber-800 hover:shadow-md transition-shadow cursor-pointer"
                 onClick={() => { (document.querySelector('[value="import"]') as HTMLElement)?.click?.(); }}>
              <div className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400 mb-1">📦 IMPORT</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Import Produktów (v1.8)</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Importuj z wielu źródeł</p>
              <div className="text-xs text-gray-500 mt-2 font-mono">5 źródeł</div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-amber-100 dark:border-amber-800 hover:shadow-md transition-shadow cursor-pointer"
                 onClick={() => { (document.querySelector('[value="enhance"]') as HTMLElement)?.click?.(); }}>
              <div className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">✨ ENHANCE</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Ulepszanie AI (v1.5)</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">AI opisy i kategoryzacja</p>
              <div className="text-xs text-gray-500 mt-2 font-mono">3 agenty</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          <Tabs defaultValue="jobs" className="space-y-4">
            <TabsList className="grid w-full grid-cols-8">
              {/* Most Frequently Used - JOBS (moved first) */}
              <TabsTrigger value="jobs" data-tab="jobs" className="gap-1 px-1 text-xs" title="Zadania importu (v2.1)">
                <Clock className="h-4 w-4" />
                <span>Zadania</span>
              </TabsTrigger>
              {/* Most Frequently Used - IMPORT (second) */}
              <TabsTrigger value="import" data-tab="import" className="gap-1 px-1 text-xs" title="Import produktów (v1.8)">
                <Package className="h-4 w-4" />
                <span>Import</span>
              </TabsTrigger>
              {/* Most Frequently Used - ENHANCE (third) */}
              <TabsTrigger value="enhance" data-tab="enhance" className="gap-1 px-1 text-xs" title="Ulepszanie AI (v1.5)">
                <Sparkles className="h-4 w-4" />
                <span>Ulepszanie</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1 px-1 text-xs" title="Konstruktor kategorii (v2.0)">
                <ListTree className="h-4 w-4" />
                <span>Kategorie</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1 px-1 text-xs" title="Harmonogramy (v1.2)">
                <Clock className="h-4 w-4" />
                <span>Plan</span>
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1 px-1 text-xs" title="Weryfikator linków (v1.3)">
                <Shield className="h-4 w-4" />
                <span>Linki</span>
              </TabsTrigger>
              <TabsTrigger value="indexes" className="gap-1 px-1 text-xs" title="Manager indeksów (v1.1)">
                <Database className="h-4 w-4" />
                <span>Index</span>
              </TabsTrigger>
              <TabsTrigger value="cleanup" className="gap-1 px-1 text-xs" title="Czyszczenie bazy (v1.0)">
                <Trash2 className="h-4 w-4" />
                <span>Czysty</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-4">
              <CategoryBuilder
                user={user}
                getIdToken={getIdToken}
                onConsoleLog={addLog}
                onCategoriesCreated={cats => {
                  addLog(`✅ Struktura kategorii przygotowana (${cats.length} kategorii)`, 'success');
                }}
              />
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <ProductImporter
                onConsoleLog={addLog}
                onImportStarted={() => {
                  addLog('🔄 Sesja importu rozpoczęta', 'info');
                }}
                onImportCompleted={stats => {
                  addLog(`📊 Statystyka: ${stats.created} utworzono, ${stats.skipped} pominięto`, 'success');
                }}
              />
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
              <JobsMonitor onConsoleLog={addLog} />
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

        {/* Console Sidebar */}
        <div>
          <ImportConsole lines={consoleLogs} onClear={clearLogs} />
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
