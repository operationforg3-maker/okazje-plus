'use client';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Pause,
  RotateCcw,
  Download,
  Settings,
  Clock,
  TrendingUp,
  Database,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { getCategories } from '@/lib/data';
import { Category } from '@/lib/types';
import { useLocale, useFormatter } from 'next-intl';
import { ImportSystemsComparison } from '@/components/admin/import-systems-comparison';

const translations = {
  pl: {
    selectAtLeast: 'Wybierz przynajmniej jedną kategorię',
    importStarted: 'Import rozpoczęty! Job ID',
    importFailed: 'Nie udało się rozpocząć importu',
    importPaused: 'Import wstrzymany',
    pauseFailed: 'Nie udało się wstrzymać importu',
    importResumed: 'Import wznowiony',
    resumeFailed: 'Nie udało się wznowić importu',
    importComplete: 'Import zakończony! Utworzono',
    products: 'produktów'
  },
  en: {
    selectAtLeast: 'Select at least one category',
    importStarted: 'Import started! Job ID',
    importFailed: 'Failed to start import',
    importPaused: 'Import paused',
    pauseFailed: 'Failed to pause import',
    importResumed: 'Import resumed',
    resumeFailed: 'Failed to resume import',
    importComplete: 'Import complete! Created',
    products: 'products'
  },
  de: {
    selectAtLeast: 'Wähle mindestens eine Kategorie',
    importStarted: 'Import gestartet! Job-ID',
    importFailed: 'Import konnte nicht gestartet werden',
    importPaused: 'Import pausiert',
    pauseFailed: 'Pausieren fehlgeschlagen',
    importResumed: 'Import fortgesetzt',
    resumeFailed: 'Fortsetzen fehlgeschlagen',
    importComplete: 'Import abgeschlossen! Erstellt',
    products: 'Produkte'
  }
} as const;

interface BatchItem {
  id: string;
  categorySlug: string;
  subcategorySlug: string;
  subsubcategorySlug: string;
  categoryName: string;
  subcategoryName: string;
  subsubcategoryName: string;
  selected: boolean;
  expanded?: boolean;
}

interface JobStatus {
  jobId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percent: number;
  };
  stats: {
    fetched: number;
    deduped: number;
    enriched: number;
    translated: number;
    saved: number;
    errors: number;
  };
  itemsCreated: string[];
  itemsUpdated: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

function BatchImportPage() {
  const locale = useLocale();
  const format = useFormatter();
  const copy = translations[(locale as keyof typeof translations) || 'pl'] || translations.pl;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  
  const formatNumber = (value?: number) => format.number(value ?? 0);
  
  // Import settings
  const [maxItemsPerSubcategory, setMaxItemsPerSubcategory] = useState(50);
  const [currencyRate, setCurrencyRate] = useState(4.0);
  
  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [polling, setPolling] = useState(false);

  // Load categories and build batch items
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
        
        // Build flat list of all category combinations
        const items: BatchItem[] = [];
        cats.forEach(cat => {
          cat.subcategories?.forEach(sub => {
            sub.subcategories?.forEach(subsub => {
              items.push({
                id: `${cat.id}-${sub.slug}-${subsub.slug || ''}`,
                categorySlug: cat.id,
                subcategorySlug: sub.slug || '',
                subsubcategorySlug: subsub.slug || '',
                categoryName: cat.name,
                subcategoryName: sub.name,
                subsubcategoryName: subsub.name,
                selected: false,
              });
            });
          });
        });
        
        setBatchItems(items);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast.error('Nie udało się załadować kategorii');
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, []);

  // Update selected count
  useEffect(() => {
    setSelectedCount(batchItems.filter(item => item.selected).length);
  }, [batchItems]);

  // Poll job status
  useEffect(() => {
    if (!jobId || !polling) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/import/status?jobId=${jobId}`);
        if (!res.ok) throw new Error('Failed to fetch status');
        
        const data = await res.json();
        setJobStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false);
          setImporting(false);
          
          if (data.status === 'completed') {
            toast.success(`Import zakończony! Utworzono ${data.itemsCreated?.length || 0} produktów`);
          } else {
            toast.error(`Import failed: ${data.error || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [jobId, polling]);

  const toggleItem = (id: string) => {
    setBatchItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleCategory = (categorySlug: string, selected: boolean) => {
    setBatchItems(prev =>
      prev.map(item =>
        item.categorySlug === categorySlug ? { ...item, selected } : item
      )
    );
  };

  const selectAll = () => {
    setBatchItems(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAll = () => {
    setBatchItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const startImport = async () => {
    const selectedItems = batchItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      toast.error(copy.selectAtLeast);
      return;
    }

    setImporting(true);
    
    try {
      const payload = {
        batches: selectedItems.map(item => ({
          categorySlug: item.categorySlug,
          subcategorySlug: item.subcategorySlug,
          subsubcategorySlug: item.subsubcategorySlug,
          categoryName: item.categoryName,
          subcategoryName: item.subcategoryName,
          subsubcategoryName: item.subsubcategoryName,
        })),
        maxItemsPerSubcategory,
        currencyRate,
      };

      const res = await fetch('/api/admin/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Import failed');
      }

      const data = await res.json();
      setJobId(data.jobId);
      setJobStatus(data);
      setPolling(true);
      
      toast.success(`${copy.importStarted}: ${data.jobId}`);
    } catch (error: any) {
      console.error('Import failed:', error);
      toast.error(error.message || copy.importFailed);
      setImporting(false);
    }
  };

  const pauseImport = async () => {
    if (!jobId) return;
    
    try {
      const res = await fetch(`/api/admin/import/status?jobId=${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });
      
      if (!res.ok) throw new Error('Failed to pause');
      
      toast.success(copy.importPaused);
      setPolling(false);
    } catch (error) {
      toast.error(copy.pauseFailed);
    }
  };

  const resumeImport = async () => {
    if (!jobId) return;
    
    try {
      const res = await fetch(`/api/admin/import/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeJobId: jobId }),
      });
      
      if (!res.ok) throw new Error('Failed to resume');
      
      toast.success(copy.importResumed);
      setPolling(true);
    } catch (error) {
      toast.error(copy.resumeFailed);
    }
  };

  // Group items by category
  const groupedItems = categories.map(cat => ({
    category: cat,
    items: batchItems.filter(item => item.categorySlug === cat.id),
    selectedCount: batchItems.filter(
      item => item.categorySlug === cat.id && item.selected
    ).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Batch Import AliExpress</h2>
        <p className="text-muted-foreground">
          Masowy import produktów z wielu kategorii za pomocą 5-stage AI pipeline
        </p>
      </div>

      {/* System Comparison */}
      <ImportSystemsComparison currentSystem="batch" variant="compact" />

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ustawienia importu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxItems">Max produktów na kategorię</Label>
              <Input
                id="maxItems"
                type="number"
                min={1}
                max={200}
                value={maxItemsPerSubcategory}
                onChange={(e) => setMaxItemsPerSubcategory(parseInt(e.target.value))}
                disabled={importing}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 50-100 produktów
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currencyRate">Kurs USD → PLN</Label>
              <Input
                id="currencyRate"
                type="number"
                step={0.01}
                min={3}
                max={6}
                value={currencyRate}
                onChange={(e) => setCurrencyRate(parseFloat(e.target.value))}
                disabled={importing}
              />
              <p className="text-xs text-muted-foreground">
                Aktualny kurs: ~4.00 PLN
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Wybrano: {selectedCount} kategorii</p>
              <p className="text-xs text-muted-foreground">
                Szacowany czas: ~{Math.ceil(selectedCount * maxItemsPerSubcategory * 2 / 60)} min
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={importing}
              >
                Zaznacz wszystkie
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={importing}
              >
                Odznacz wszystkie
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Status Card */}
      {jobStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {jobStatus.status === 'running' && <Loader2 className="h-5 w-5 animate-spin" />}
              {jobStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {jobStatus.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
              {jobStatus.status === 'paused' && <Pause className="h-5 w-5 text-yellow-500" />}
              Status importu
            </CardTitle>
            <CardDescription>Job ID: {jobStatus.jobId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Postęp kategorii</span>
                <span className="font-medium">
                  {jobStatus.progress.current} / {jobStatus.progress.total}
                </span>
              </div>
              <Progress value={jobStatus.progress.percent} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{jobStatus.stats.fetched}</div>
                <div className="text-xs text-muted-foreground">Fetched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{jobStatus.stats.deduped}</div>
                <div className="text-xs text-muted-foreground">Deduped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{jobStatus.stats.enriched}</div>
                <div className="text-xs text-muted-foreground">Enriched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-500">{jobStatus.stats.translated}</div>
                <div className="text-xs text-muted-foreground">Translated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{jobStatus.stats.saved}</div>
                <div className="text-xs text-muted-foreground">Saved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{jobStatus.stats.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {jobStatus.status === 'running' && (
                <Button variant="outline" size="sm" onClick={pauseImport}>
                  <Pause className="h-4 w-4 mr-2" />
                  Wstrzymaj
                </Button>
              )}
              {jobStatus.status === 'paused' && (
                <Button variant="outline" size="sm" onClick={resumeImport}>
                  <Play className="h-4 w-4 mr-2" />
                  Wznów
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/admin/import/history?jobId=${jobStatus.jobId}`} target="_blank">
                  <Download className="h-4 w-4 mr-2" />
                  Eksportuj raport
                </a>
              </Button>
            </div>

            {jobStatus.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Błąd</AlertTitle>
                <AlertDescription>{jobStatus.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Category Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Wybierz kategorie do importu
          </CardTitle>
          <CardDescription>
            Zaznacz sub-sub-kategorie które chcesz wypełnić produktami z AliExpress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedItems.map(({ category, items, selectedCount }) => (
            <div key={category.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedCount === items.length && items.length > 0}
                    onCheckedChange={(checked) =>
                      toggleCategory(category.id, checked as boolean)
                    }
                    disabled={importing}
                  />
                  <div>
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCount} / {items.length} zaznaczonych
                    </p>
                  </div>
                </div>
                <Badge variant={selectedCount > 0 ? "default" : "outline"}>
                  {category.id}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 ml-8">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleItem(item.id)}
                      disabled={importing}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.subcategoryName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.subsubcategoryName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Start Button */}
      <div className="flex justify-end gap-4">
        <Button
          size="lg"
          onClick={startImport}
          disabled={importing || selectedCount === 0}
          className="min-w-[200px]"
        >
          {importing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Importowanie...
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 mr-2" />
              Rozpocznij import ({selectedCount})
            </>
          )}
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Jak działa batch import?</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p>
            <strong>5-Stage Pipeline:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
            <li><strong>Fetch:</strong> Pobieranie produktów z AliExpress API (English keywords)</li>
            <li><strong>Dedupe:</strong> Filtrowanie duplikatów i produktów low-quality</li>
            <li><strong>Enrich:</strong> Konwersja walut USD → PLN, scoring jakości</li>
            <li><strong>Translate:</strong> AI translation EN → PL (Gemini 2.0)</li>
            <li><strong>Save:</strong> Zapis do Firestore jako draft products</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            Import działa w tle. Możesz zamknąć stronę - job będzie kontynuowany.
            Status sprawdzisz w <strong>/admin/import/history</strong>
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default withAuth(BatchImportPage, { requireAdmin: true });
