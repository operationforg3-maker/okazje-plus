'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Wrench,
  Play,
  Loader,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Database,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

interface M6Log {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warn';
  category?: string;
  message: string;
  data?: {
    itemsProcessed?: number;
    itemsFound?: number;
    itemsFailed?: number;
    progress?: number;
    processingTime?: number;
  };
}

interface ToolState {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  running: boolean;
  logs: M6Log[];
  result?: any;
  startTime?: Date;
}

export function M6ToolsPanel() {
  const [tools, setTools] = useState<Record<string, ToolState>>({
    migration: {
      id: 'migration',
      name: 'Migracja Kategorii',
      description: 'Przypisz kategorie do starych dealów',
      icon: <Database className="h-5 w-5" />,
      running: false,
      logs: [],
    },
    harvester: {
      id: 'harvester',
      name: 'Harvester',
      description: 'Importuj produkty z AliExpress/Amazon/Allegro',
      icon: <TrendingUp className="h-5 w-5" />,
      running: false,
      logs: [],
    },
    refiner: {
      id: 'refiner',
      name: 'AI Refiner',
      description: 'Wzbogacaj produkty AI-generowaną zawartością',
      icon: <Wrench className="h-5 w-5" />,
      running: false,
      logs: [],
    },
  });

  const [expandedTool, setExpandedTool] = useState<string>('migration');

  const addLog = (toolId: string, log: M6Log) => {
    setTools((prev) => ({
      ...prev,
      [toolId]: {
        ...prev[toolId],
        logs: [...prev[toolId].logs, log],
      },
    }));
  };

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return await user.getIdToken();
  };

  const runDealCategoryMigration = async () => {
    const toolId = 'migration';
    setTools((prev) => ({
      ...prev,
      [toolId]: { ...prev[toolId], running: true, logs: [], result: null },
    }));

    const startTime = Date.now();
    addLog(toolId, {
      timestamp: new Date().toLocaleTimeString('pl-PL'),
      level: 'info',
      message: '▶ Uruchamianie migracji kategorii dealów...',
    });

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/migrate-deal-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      const elapsedTime = ((Date.now() - startTime) / 1000);
      const elapsedTimeFormatted = elapsedTime.toFixed(2);

      if (data.success) {
        addLog(toolId, {
          timestamp: new Date().toLocaleTimeString('pl-PL'),
          level: 'success',
          message: `✅ Migracja zakończona`,
          data: {
            itemsProcessed: data.fixed,
            itemsFailed: data.missing,
            processingTime: elapsedTime,
          },
        });

        setTools((prev) => ({
          ...prev,
          [toolId]: { ...prev[toolId], result: data },
        }));

        toast.success(`✅ Naprawiono ${data.fixed} dealów w ${elapsedTimeFormatted}s`);
      } else {
        addLog(toolId, {
          timestamp: new Date().toLocaleTimeString('pl-PL'),
          level: 'error',
          message: `❌ Błąd: ${data.error}`,
        });
        toast.error(`❌ ${data.error}`);
      }
    } catch (e: any) {
      const elapsedTime = ((Date.now() - startTime) / 1000);
      addLog(toolId, {
        timestamp: new Date().toLocaleTimeString('pl-PL'),
        level: 'error',
        message: `❌ Błąd: ${e?.message || 'Nieznany błąd'}`,
        data: {
          processingTime: elapsedTime,
        },
      });
      toast.error('Błąd migracji');
    } finally {
      setTools((prev) => ({
        ...prev,
        [toolId]: { ...prev[toolId], running: false },
      }));
    }
  };

  const runHarvesterSimulation = async () => {
    const toolId = 'harvester';
    setTools((prev) => ({
      ...prev,
      [toolId]: { ...prev[toolId], running: true, logs: [], result: null, startTime: new Date() },
    }));

    const startTime = Date.now();
    addLog(toolId, {
      timestamp: new Date().toLocaleTimeString('pl-PL'),
      level: 'info',
      message: '▶ Uruchamianie harvestera...',
    });

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: 'aliexpress',
          query: 'category-tree',
          maxResults: 50,
          mode: 'category-tree',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addLog(toolId, {
          timestamp: new Date().toLocaleTimeString('pl-PL'),
          level: 'error',
          message: `❌ Błąd: ${data.error}`,
        });
        toast.error(`Harvester error: ${data.error}`);
      } else {
        addLog(toolId, {
          timestamp: new Date().toLocaleTimeString('pl-PL'),
          level: 'success',
          message: `✓ Harvester uruchomiony - Job ID: ${data.job.id}`,
          data: {
            processingTime: ((Date.now() - startTime) / 1000),
          },
        });
        toast.success(`✅ Harvester started (Job ID: ${data.job.id}). Check Job Monitor for updates.`);
      }
    } catch (e: any) {
      const elapsedTime = ((Date.now() - startTime) / 1000);
      addLog(toolId, {
        timestamp: new Date().toLocaleTimeString('pl-PL'),
        level: 'error',
        message: `❌ Błąd: ${e?.message || 'Nieznany błąd'}`,
        data: {
          processingTime: elapsedTime,
        },
      });
      toast.error('Harvester error');
    } finally {
      setTools((prev) => ({
        ...prev,
        [toolId]: { ...prev[toolId], running: false },
      }));
    }
  };

  const runRefinerSimulation = async () => {
    const toolId = 'refiner';
    setTools((prev) => ({
      ...prev,
      [toolId]: { ...prev[toolId], running: true, logs: [], result: null, startTime: new Date() },
    }));

    const startTime = Date.now();
    addLog(toolId, {
      timestamp: new Date().toLocaleTimeString('pl-PL'),
      level: 'info',
      message: '▶ Uruchamianie refinera AI...',
    });

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/refiner/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: 50,
        }),
      });

      const data = await res.json();
      const elapsedTime = ((Date.now() - startTime) / 1000);

      if (!res.ok) {
        addLog(toolId, {
          timestamp: new Date().toLocaleTimeString('pl-PL'),
          level: 'error',
          message: `❌ Błąd: ${data.error}`,
          data: {
            processingTime: elapsedTime,
          },
        });
        toast.error(`Refiner error: ${data.error}`);
      } else {
        const productsFound = data.job?.productsFound || 0;
        const productsEnriched = data.job?.productsEnriched || 0;
        const status = data.job?.status || 'completed';

        if (status === 'skipped') {
          addLog(toolId, {
            timestamp: new Date().toLocaleTimeString('pl-PL'),
            level: 'info',
            message: `ℹ️ Brak produktów do wzbogacenia`,
            data: {
              processingTime: elapsedTime,
            },
          });
        } else {
          addLog(toolId, {
            timestamp: new Date().toLocaleTimeString('pl-PL'),
            level: 'success',
            message: `✅ Refiner zakończył pracę`,
            data: {
              itemsProcessed: productsEnriched,
              itemsFound: productsFound,
              processingTime: elapsedTime,
            },
          });
          toast.success(`✅ Wzbogacono ${productsEnriched} produktów`);
        }
      }
    } catch (e: any) {
      const elapsedTime = ((Date.now() - startTime) / 1000);
      addLog(toolId, {
        timestamp: new Date().toLocaleTimeString('pl-PL'),
        level: 'error',
        message: `❌ Błąd: ${e?.message || 'Nieznany błąd'}`,
        data: {
          processingTime: elapsedTime,
        },
      });
      toast.error('Refiner error');
    } finally {
      setTools((prev) => ({
        ...prev,
        [toolId]: { ...prev[toolId], running: false },
      }));
    }
  };

  const handleRunTool = async (toolId: string) => {
    switch (toolId) {
      case 'migration':
        await runDealCategoryMigration();
        break;
      case 'harvester':
        await runHarvesterSimulation();
        break;
      case 'refiner':
        await runRefinerSimulation();
        break;
    }
  };

  const clearLogs = (toolId: string) => {
    setTools((prev) => ({
      ...prev,
      [toolId]: { ...prev[toolId], logs: [] },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wrench className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold">Narzędzia M6</h2>
          <p className="text-sm text-gray-600">
            Zarządzaj harvesterem, refinerem i innymi narzędziami importu
          </p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(tools).map(([toolId, tool]) => (
          <Card
            key={toolId}
            className={`cursor-pointer transition-all ${
              expandedTool === toolId
                ? 'ring-2 ring-blue-500 md:col-span-3'
                : 'hover:shadow-md'
            }`}
            onClick={() => setExpandedTool(toolId)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-blue-600">{tool.icon}</div>
                  <div>
                    <CardTitle className="text-base">{tool.name}</CardTitle>
                    <p className="text-xs text-gray-600 mt-1">{tool.description}</p>
                  </div>
                </div>
                {tool.running && <Badge className="bg-blue-100 text-blue-800">Pracuje...</Badge>}
              </div>
            </CardHeader>

            {expandedTool === toolId && (
              <>
                <CardContent className="space-y-4">
                  {/* Control Panel */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRunTool(toolId)}
                      disabled={tool.running}
                      size="sm"
                      className="flex-1"
                    >
                      {tool.running ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Przetwarzanie...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Uruchom
                        </>
                      )}
                    </Button>
                    {tool.logs.length > 0 && (
                      <Button
                        onClick={() => clearLogs(toolId)}
                        disabled={tool.running}
                        size="sm"
                        variant="outline"
                      >
                        Wyczyść logi
                      </Button>
                    )}
                  </div>

                  {/* Logs Output */}
                  {tool.logs.length > 0 && (
                    <div className="bg-gray-950 text-gray-100 rounded p-3 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                      {tool.logs.map((log, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className={`flex gap-2 ${
                            log.level === 'error'
                              ? 'text-red-400'
                              : log.level === 'success'
                              ? 'text-green-400'
                              : log.level === 'warn'
                              ? 'text-yellow-400'
                              : 'text-blue-400'
                          }`}>
                            <span className="w-12 flex-shrink-0">[{log.timestamp}]</span>
                            <span className="flex-1">{log.message}</span>
                          </div>

                          {/* Log Metadata */}
                          {log.data && (
                            <div className="ml-16 text-gray-500 space-y-0.5">
                              {log.category && (
                                <div>📂 {log.category}</div>
                              )}
                              {log.data.itemsFound !== undefined && (
                                <div>🔍 Znaleziono: {log.data.itemsFound}</div>
                              )}
                              {log.data.itemsProcessed !== undefined && (
                                <div>✓ Przetworzono: {log.data.itemsProcessed}</div>
                              )}
                              {log.data.itemsFailed !== undefined && (
                                <div className="text-red-500">✗ Błędy: {log.data.itemsFailed}</div>
                              )}
                              {log.data.progress !== undefined && (
                                <div>
                                  📊 Postęp: {log.data.progress}%
                                  <div className="w-full bg-gray-800 rounded mt-0.5 h-1.5">
                                    <div
                                      className="bg-blue-500 h-full rounded transition-all"
                                      style={{ width: `${log.data.progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              {log.data.processingTime !== undefined && (
                                <div className="text-gray-400">⏱ Czas: {log.data.processingTime}s</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Result Summary */}
                  {tool.result && (
                    <Alert className={tool.result.success ? 'bg-green-50' : 'bg-red-50'}>
                      {tool.result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={tool.result.success ? 'text-green-900' : 'text-red-900'}>
                        {tool.result.success
                          ? `✅ Ukończono: ${tool.result.fixed} naprawiono${
                              tool.result.missing > 0 ? `, ${tool.result.missing} błędów` : ''
                            }`
                          : `❌ ${tool.result.error}`}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Migracja Kategorii
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-700 space-y-1">
            <p>• Przypisuje kategorie do starych dealów</p>
            <p>• Skanuje deale bez mainCategorySlug</p>
            <p>• Importuje z powiązanego ProductCore</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Harvester
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-700 space-y-1">
            <p>• Importuje z AliExpress, Amazon, Allegro</p>
            <p>• Automatyczna deduplicacja</p>
            <p>• Tworzy nowe deale lub aktualizuje istniejące</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              AI Refiner
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-700 space-y-1">
            <p>• Wzbogaca produkty zawartością AI</p>
            <p>• Czyści specyfikacje (specs cleanup)</p>
            <p>• Generuje opisy PL/EN/DE</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
