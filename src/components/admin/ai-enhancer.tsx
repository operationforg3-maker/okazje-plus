'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface AIEnhancerProps {
  onConsoleLog?: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
  onEnhancementStarted?: () => void;
  onEnhancementCompleted?: (stats: EnhancementStats) => void;
}

interface EnhancementStats {
  totalProcessed: number;
  enhanced: number;
  errors: number;
  durationMs: number;
  avgQualityScore: number;
}

interface EnhancerConfig {
  draftStatus: 'draft' | 'pending_ai';
  maxItems: number;
  qualityThreshold: number;
  autoPublish: boolean;
  enhanceFields: {
    title: boolean;
    description: boolean;
    images: boolean;
    category: boolean;
    specifications: boolean;
  };
}

export function AIEnhancer({ onConsoleLog, onEnhancementStarted, onEnhancementCompleted }: AIEnhancerProps) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<EnhancerConfig>({
    draftStatus: 'pending_ai',
    maxItems: 50,
    qualityThreshold: 0.7,
    autoPublish: false,
    enhanceFields: {
      title: true,
      description: true,
      images: true,
      category: true,
      specifications: true,
    },
  });

  const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`[${type.toUpperCase()}] ${logMessage}`);
    onConsoleLog?.(logMessage, type);
  };

  const handleEnhance = async () => {
    setLoading(true);
    onEnhancementStarted?.();

    try {
      log('Rozpoczynam ulepszanie draftow AI...', 'info');
      log(`   Maksymalnie do przetworzenia: ${config.maxItems}`, 'info');
      log(`   Próg jakości: ${(config.qualityThreshold * 100).toFixed(0)}%`, 'info');
      log(`   Pola do ulepszenia:`, 'info');

      const fields = Object.entries(config.enhanceFields)
        .filter(([, enabled]) => enabled)
        .map(([field]) => field);
      fields.forEach(field => {
        log(`      ✓ ${field}`, 'info');
      });

      const response = await fetch('/api/admin/products/enhance-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result: { stats: EnhancementStats } = await response.json();

      log(`✅ Ulepszanie zakonczone!`, 'success');
      log(
        `   Przetworzono: ${result.stats.totalProcessed} | Ulepszone: ${result.stats.enhanced} | Bledy: ${result.stats.errors}`,
        'success'
      );
      log(
        `   Srednia jakosc: ${(result.stats.avgQualityScore * 100).toFixed(1)}% | Czas: ${(result.stats.durationMs / 1000).toFixed(2)}s`,
        'success'
      );

      if (config.autoPublish && result.stats.enhanced > 0) {
        log(`📤 Przygotowuje do publikacji ${result.stats.enhanced} ulepszonych itemow...`, 'info');
        // TODO: Auto-publish flow
      }

      onEnhancementCompleted?.(result.stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany blad';
      log(`❌ Blad ulepszania: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="card-base">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Ulepszacz AI
        </CardTitle>
        <CardDescription>Automatyczne ulepszanie draftow za pomoca sztucznej inteligencji</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Status draftu do przetworzenia</Label>
              <Select
                value={config.draftStatus}
                onValueChange={e => setConfig(prev => ({ ...prev, draftStatus: e as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (bez AI)</SelectItem>
                  <SelectItem value="pending_ai">Oczekuje AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Maksymalnie do przetworzenia</Label>
              <Input
                type="number"
                min="1"
                max="500"
                value={config.maxItems}
                onChange={e =>
                  setConfig(prev => ({
                    ...prev,
                    maxItems: Math.min(500, Math.max(1, parseInt(e.target.value) || 50)),
                  }))
                }
              />
            </div>
          </div>

          {/* Quality Threshold */}
          <div>
            <Label className="text-sm font-medium">Próg jakości: {(config.qualityThreshold * 100).toFixed(0)}%</Label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.qualityThreshold}
              onChange={e => setConfig(prev => ({ ...prev, qualityThreshold: parseFloat(e.target.value) }))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tylko itemy z wyższą jakością będą zaakceptowane
            </p>
          </div>

          {/* Fields to enhance */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pola do ulepszenia</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(config.enhanceFields).map(([field, enabled]) => (
                <label
                  key={field}
                  className="flex items-center gap-2 p-2 rounded border border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        enhanceFields: {
                          ...prev.enhanceFields,
                          [field]: e.target.checked,
                        },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm capitalize">{field}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Auto-publish option */}
          <label className="flex items-center gap-3 p-3 rounded border border-border/40 cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={config.autoPublish}
              onChange={e => setConfig(prev => ({ ...prev, autoPublish: e.target.checked }))}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium">Auto-publikacja po ulepszeniu</span>
              <p className="text-xs text-muted-foreground">
                Itemy powyżej progu jakości będą automatycznie opublikowane
              </p>
            </div>
          </label>
        </div>

        {/* Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            AI przeanalizuje zawartość, poprawi tytuły, opisy, kategoryzuje produkty i uzupełni brakujące dane.
          </AlertDescription>
        </Alert>

        {/* Action */}
        <Button onClick={handleEnhance} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ulepszam...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Rozpocznij ulepszanie AI
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
