'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ProductImporterProps {
  onConsoleLog?: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
  onImportStarted?: () => void;
  onImportCompleted?: (stats: ImportStats) => void;
}

interface ImportStats {
  totalProcessed: number;
  created: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

interface ImportConfig {
  source: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'convertiser';
  mainCategory: string;
  subCategory: string;
  subSubCategory: string;
  itemsPerCategory: number;
  importType: 'products' | 'deals' | 'coupons';
  draftStatus: 'draft' | 'pending_ai' | 'ready_to_publish';
}

export function ProductImporter({ onConsoleLog, onImportStarted, onImportCompleted }: ProductImporterProps) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ImportConfig>({
    source: 'aliexpress',
    mainCategory: '',
    subCategory: '',
    subSubCategory: '',
    itemsPerCategory: 20,
    importType: 'products',
    draftStatus: 'pending_ai',
  });

  const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`[${type.toUpperCase()}] ${logMessage}`);
    onConsoleLog?.(logMessage, type);
  };

  const handleImport = async () => {
    if (!config.mainCategory || !config.subCategory || !config.subSubCategory) {
      log('❌ Wszystkie pola kategorii są wymagane', 'error');
      return;
    }

    setLoading(true);
    onImportStarted?.();

    try {
      log(`🚀 Rozpoczynam import ${config.importType}...`, 'info');
      log(`   Źródło: ${config.source}`, 'info');
      log(`   Kategoria: ${config.mainCategory} → ${config.subCategory} → ${config.subSubCategory}`, 'info');
      log(`   Ilość na kategor ię: ${config.itemsPerCategory}`, 'info');

      const response = await fetch('/api/admin/products/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result: { stats: ImportStats; errors?: Array<{ item: string; error: string }> } =
        await response.json();

      log(`✅ Import zakończony!`, 'success');
      log(
        `   Przetworzono: ${result.stats.totalProcessed} | Utworzono: ${result.stats.created} | Pominięto: ${result.stats.skipped} | Błędy: ${result.stats.errors}`,
        'success'
      );
      log(`   Czas: ${(result.stats.durationMs / 1000).toFixed(2)}s`, 'success');

      if (result.errors && result.errors.length > 0) {
        log(`⚠️ Błędy podczas importu (${result.errors.length}):`, 'warning');
        result.errors.slice(0, 5).forEach(err => {
          log(`   - ${err.item}: ${err.error}`, 'warning');
        });
        if (result.errors.length > 5) {
          log(`   ... i ${result.errors.length - 5} więcej błędów`, 'warning');
        }
      }

      onImportCompleted?.(result.stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      log(`❌ Błąd importu: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="card-base">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Importer produktów
        </CardTitle>
        <CardDescription>
          Import produktów/okazji iteracyjnie po kategoriach do schowka roboczego (drafty)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Source Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Źródło importu</Label>
              <Select value={config.source} onValueChange={e => setConfig(prev => ({ ...prev, source: e as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aliexpress">AliExpress</SelectItem>
                  <SelectItem value="allegro">Allegro</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="convertiser">Convertiser</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Typ importu</Label>
              <Select value={config.importType} onValueChange={e => setConfig(prev => ({ ...prev, importType: e as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products">Produkty</SelectItem>
                  <SelectItem value="deals">Okazje</SelectItem>
                  <SelectItem value="coupons">Kupony</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Kategoria</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Kategoria główna"
                value={config.mainCategory}
                onChange={e => setConfig(prev => ({ ...prev, mainCategory: e.target.value }))}
              />
              <Input
                placeholder="Podkategoria"
                value={config.subCategory}
                onChange={e => setConfig(prev => ({ ...prev, subCategory: e.target.value }))}
              />
              <Input
                placeholder="Pod-podkategoria"
                value={config.subSubCategory}
                onChange={e => setConfig(prev => ({ ...prev, subSubCategory: e.target.value }))}
              />
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Ilość na kategorię (10-50)</Label>
              <Input
                type="number"
                min="10"
                max="50"
                value={config.itemsPerCategory}
                onChange={e =>
                  setConfig(prev => ({
                    ...prev,
                    itemsPerCategory: Math.min(50, Math.max(10, parseInt(e.target.value) || 10)),
                  }))
                }
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Status draftu</Label>
              <Select value={config.draftStatus} onValueChange={e => setConfig(prev => ({ ...prev, draftStatus: e as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (bez AI)</SelectItem>
                  <SelectItem value="pending_ai">Oczekuje AI</SelectItem>
                  <SelectItem value="ready_to_publish">Gotów do publikacji</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Import utworzy produkty w statusie <Badge variant="secondary" className="ml-1">Draft</Badge> w schowku roboczym.
            Następnie możesz je ulepszyć za pomocą AI i opublikować.
          </AlertDescription>
        </Alert>

        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Pro tip:</strong> Dla dużych importów (&gt;5 kategorii lub z AI) użyj zakładki <strong>Jobs</strong> - 
            import będzie działał w tle bez ryzyka timeout.
          </AlertDescription>
        </Alert>

        {/* Action */}
        <Button
          onClick={handleImport}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Import w trakcie...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Rozpocznij import
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
