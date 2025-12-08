'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryBuilder } from '@/components/admin/category-builder';
import { ProductImporter } from '@/components/admin/product-importer';
import { AIEnhancer } from '@/components/admin/ai-enhancer';
import { ImportConsole, ConsoleLine } from '@/components/admin/import-console';
import { withAuth } from '@/lib/auth';
import { Combine, ListTree, Package, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function HarvesterPage() {
  const [consoleLogo, setConsoleLogs] = useState<ConsoleLine[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setConsoleLogs(prev => [
      ...prev,
      {
        id: uuidv4(),
        timestamp: new Date().toLocaleTimeString('pl-PL'),
        message,
        type,
      },
    ]);
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setConsoleLogs(prev => [
      ...prev,
      {
        id: uuidv4(),
        timestamp: new Date().toLocaleTimeString('pl-PL'),
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories" className="gap-2">
                <ListTree className="h-4 w-4" />
                <span>Kategorie</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2">
                <Package className="h-4 w-4" />
                <span>Import</span>
              </TabsTrigger>
              <TabsTrigger value="enhance" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span>Ulepszanie</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-4">
              <CategoryBuilder
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
                onEnhancementCompleted={stats => {
                  addLog(`📊 Ulepszone: ${stats.enhanced}, Średnia jakość: ${(stats.avgQualityScore * 100).toFixed(1)}%`, 'success');
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Console Sidebar */}
        <div>
          <ImportConsole lines={consoleLogo} onClear={clearLogs} />
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Jak używać?</h3>
        <ol className="text-sm text-blue-900 dark:text-blue-100 space-y-1 list-decimal list-inside">
          <li><strong>Krok 1:</strong> Utwórz strukturę kategorii za pomocą "Konstruktora kategorii"</li>
          <li><strong>Krok 2:</strong> Importuj produkty/okazje z wybranych źródeł do schowka roboczego (drafty)</li>
          <li><strong>Krok 3:</strong> Użyj AI do ulepszenia drafty'ów - poprawi tytuły, opisy, kategoryzację</li>
          <li><strong>Krok 4:</strong> Przejrzyj wyniki w konsoli i publikuj gotowe itemy</li>
        </ol>
      </div>
    </div>
  );
}

export default withAuth(HarvesterPage, { requiredRole: 'admin' });
