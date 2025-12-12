'use client';

/**
 * Bulk Import with AI - Generate product catalog for entire category tree
 */

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, CheckCircle, XCircle, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category } from '@/lib/types';
import { useLocale, useFormatter } from 'next-intl';
import { ImportSystemsComparison } from '@/components/admin/import-systems-comparison';
import { ImportProgress, ImportLog, ImportStats, ImportStatus } from '@/components/admin/import-progress';

const translations = {
  pl: {
    noConfig: 'Brak konfiguracji',
    selectCategories: 'Zaznacz kategorie i wpisz search queries',
    generating: 'Generating Preview...',
    processing: 'Processing',
    withAI: 'categories with AI pipeline',
    previewReady: 'Preview Ready!',
    generated: 'products generated with AI enrichment',
    error: 'Błąd',
    unknownError: 'Nieznany błąd',
    noSelected: 'Brak zaznaczonych',
    selectProducts: 'Zaznacz produkty do importu',
    importComplete: 'Import Complete!',
    productsSaved: 'products saved to database',
    importError: 'Błąd importu',
    autoImport: 'Auto-Import: 10 Best',
    configuring: 'Konfigurowanie wszystkich kategorii...',
    configured: 'Skonfigurowano!',
    categoriesWithQuery: 'kategorii z query "bestseller" i 10 produktami każda',
    generatingPreview: 'Generowanie podglądu...',
    alreadyConfigured: 'kategorii już skonfigurowanych'
  },
  en: {
    noConfig: 'No configuration',
    selectCategories: 'Select categories and enter search queries',
    generating: 'Generating Preview...',
    processing: 'Processing',
    withAI: 'categories with AI pipeline',
    previewReady: 'Preview Ready!',
    generated: 'products generated with AI enrichment',
    error: 'Error',
    unknownError: 'Unknown error',
    noSelected: 'None selected',
    selectProducts: 'Select products to import',
    importComplete: 'Import Complete!',
    productsSaved: 'products saved to database',
    importError: 'Import error',
    autoImport: 'Auto-Import: 10 Best',
    configuring: 'Configuring all categories...',
    configured: 'Configured!',
    categoriesWithQuery: 'categories with "bestseller" query and 10 products each',
    generatingPreview: 'Generating preview...',
    alreadyConfigured: 'categories already configured'
  },
  de: {
    noConfig: 'Keine Konfiguration',
    selectCategories: 'Kategorien auswählen und Suchanfragen eingeben',
    generating: 'Vorschau generieren...',
    processing: 'Verarbeitung',
    withAI: 'Kategorien mit AI-Pipeline',
    previewReady: 'Vorschau bereit!',
    generated: 'Produkte mit AI-Anreicherung generiert',
    error: 'Fehler',
    unknownError: 'Unbekannter Fehler',
    noSelected: 'Keine ausgewählt',
    selectProducts: 'Produkte zum Import auswählen',
    importComplete: 'Import abgeschlossen!',
    productsSaved: 'Produkte in Datenbank gespeichert',
    importError: 'Import-Fehler',
    autoImport: 'Auto-Import: 10 Beste',
    configuring: 'Alle Kategorien konfigurieren...',
    configured: 'Konfiguriert!',
    categoriesWithQuery: 'Kategorien mit "bestseller" Anfrage und 10 Produkten jeweils',
    generatingPreview: 'Vorschau generieren...',
    alreadyConfigured: 'Kategorien bereits konfiguriert'
  }
} as const;

interface CategoryConfig {
  mainSlug: string;
  mainName: string;
  subSlug: string;
  subName: string;
  subSubSlug?: string;
  subSubName?: string;
  searchQuery: string;
  productsCount: number;
  enabled: boolean;
}

interface PreviewProduct {
  id: string;
  sourceId: string;
  title: string;
  normalizedTitle: string;
  price: number;
  image: string;
  categoryPath: string[];
  aiQuality: {
    score: number;
    recommendation: 'approve' | 'review' | 'reject';
    reasoning: string;
  };
  seoDescription: string;
  selected: boolean;
}

function BulkImportPage() {
  const { toast } = useToast();
  const locale = useLocale();
  const format = useFormatter();
  const copy = translations[(locale as keyof typeof translations) || 'pl'] || translations.pl;
  // Note: useAuth() is provided by withAuth HOC wrapper, not needed here
  const [categoriesSnapshot] = useCollection(collection(db, 'categories'));
  
  const formatNumber = (value?: number) => format.number(value ?? 0);

  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>([]);
  const [defaultProductsPerCategory, setDefaultProductsPerCategory] = useState(10);
  const [loading, setLoading] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'config' | 'preview' | 'complete'>('config');
  
  // Import progress tracking
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [importStats, setImportStats] = useState<ImportStats>({});
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const addLog = (level: ImportLog['level'], message: string, details?: string) => {
    setImportLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    }]);
  };

  // Initialize category configs from Firestore categories
  useEffect(() => {
    if (!categoriesSnapshot) return;
    
    const categories: Category[] = categoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    
    if (categories.length === 0) return;

    const configs: CategoryConfig[] = [];
    
    categories.forEach(cat => {
      cat.subcategories?.forEach(sub => {
        if (sub.subcategories && sub.subcategories.length > 0) {
          // Has sub-subcategories (level 3)
          sub.subcategories.forEach(subSub => {
            configs.push({
              mainSlug: cat.id,
              mainName: cat.name,
              subSlug: sub.slug || '',
              subName: sub.name,
              subSubSlug: subSub.slug || '',
              subSubName: subSub.name,
              searchQuery: '', // User will fill
              productsCount: defaultProductsPerCategory,
              enabled: false,
            });
          });
        } else {
          // Only level 2 (sub-category without sub-sub)
          configs.push({
            mainSlug: cat.id,
            mainName: cat.name,
            subSlug: sub.slug || '',
            subName: sub.name,
            searchQuery: '',
            productsCount: defaultProductsPerCategory,
            enabled: false,
          });
        }
      });
    });

    setCategoryConfigs(configs);
  }, [categoriesSnapshot, defaultProductsPerCategory]);

  const handleGeneratePreview = async () => {
    const enabledConfigs = categoryConfigs.filter(c => c.enabled && c.searchQuery.trim());
    
    if (enabledConfigs.length === 0) {
      toast({
        title: copy.noConfig,
        description: copy.selectCategories,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setImportStatus('running');
    setStartedAt(new Date().toISOString());
    setImportLogs([]);
    setImportStats({});
    addLog('info', `Rozpoczęto generowanie podglądu dla ${enabledConfigs.length} kategorii`);
    
    try {
      // Get Firebase token - user is guaranteed to be logged in by withAuth HOC
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Brak zalogowanego użytkownika');
      
      const token = await firebaseUser.getIdToken();
      if (!token) throw new Error('Brak tokena autoryzacji');

      toast({
        title: `🤖 ${copy.generating}`,
        description: `${copy.processing} ${formatNumber(enabledConfigs.length)} ${copy.withAI}`,
      });

      const response = await fetch('/api/admin/bulk-import/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configs: enabledConfigs,
        }),
      });
      const data = await response.json();
      
      setPreviewProducts(data.products.map((p: any) => ({ ...p, selected: true })));
      setStep('preview');
      setImportStatus('completed');
      setImportStats({ fetched: data.stats?.totalFetched, saved: data.stats?.totalPassed });
      addLog('success', `Wygenerowano ${data.products.length} produktów`, `Przeszło filtr: ${data.stats?.totalPassed || 0}/${data.stats?.totalFetched || 0}`);
      
      toast({
        title: `${copy.previewReady}`,
        description: `${formatNumber(data.products.length)} ${copy.generated}`,
      });
    } catch (error) {
      console.error('[Bulk Import]', error);
      setImportStatus('failed');
      addLog('error', 'Błąd podczas generowania podglądu', error instanceof Error ? error.message : 'Unknown');
      toast({
        title: copy.error,
        description: error instanceof Error ? error.message : copy.unknownError,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    const selectedProducts = previewProducts.filter(p => p.selected);
    
    if (selectedProducts.length === 0) {
      toast({
        title: copy.noSelected,
        description: copy.selectProducts,
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setImportStatus('running');
    setStartedAt(new Date().toISOString());
    addLog('info', `Rozpoczęto zapis ${selectedProducts.length} produktów do bazy`);
    
    try {
      // Get Firebase token - user is guaranteed to be logged in by withAuth HOC
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Brak zalogowanego użytkownika');
      
      const token = await firebaseUser.getIdToken();
      if (!token) throw new Error('Brak tokena');

      const response = await fetch('/api/admin/bulk-import/commit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: selectedProducts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const data = await response.json();
      
      setImportStatus('completed');
      setImportStats({ saved: data.imported, total: selectedProducts.length });
      addLog('success', `Zaimportowano ${data.imported} produktów do bazy danych`);
      
      toast({
        title: `✅ ${copy.importComplete}`,
        description: `${formatNumber(data.imported)} ${copy.productsSaved}`,
      });
      
      setStep('complete');
    } catch (error) {
      console.error('[Bulk Import Commit]', error);
      setImportStatus('failed');
      addLog('error', 'Błąd podczas zapisu produktów', error instanceof Error ? error.message : 'Unknown');
      toast({
        title: copy.importError,
        description: error instanceof Error ? error.message : copy.unknownError,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const toggleCategory = (index: number) => {
    setCategoryConfigs(prev => {
      const next = [...prev];
      next[index].enabled = !next[index].enabled;
      return next;
    });
  };

  const updateSearchQuery = (index: number, query: string) => {
    setCategoryConfigs(prev => {
      const next = [...prev];
      next[index].searchQuery = query;
      return next;
    });
  };

  const updateProductsCount = (index: number, count: number) => {
    setCategoryConfigs(prev => {
      const next = [...prev];
      next[index].productsCount = count;
      return next;
    });
  };

  const toggleProductSelection = (productId: string) => {
    setPreviewProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, selected: !p.selected } : p)
    );
  };

  const selectAllByQuality = (minScore: number) => {
    setPreviewProducts(prev =>
      prev.map(p => ({ ...p, selected: p.aiQuality.score >= minScore }))
    );
  };

  // Auto-import: Configure all categories with "bestseller" query
  const handleAutoImportBest = () => {
    const enabledCount = categoryConfigs.filter(c => c.enabled).length;
    
    if (enabledCount === 0) {
      toast({
        title: `🚀 ${copy.autoImport}`,
        description: copy.configuring,
      });

      // Enable all categories with "bestseller" query
      setCategoryConfigs(prev =>
        prev.map(c => ({
          ...c,
          enabled: true,
          searchQuery: 'bestseller',
          productsCount: 10,
        }))
      );

      toast({
        title: `✅ ${copy.configured}`,
        description: `${formatNumber(categoryConfigs.length)} ${copy.categoriesWithQuery}`,
      });
    } else {
      // Already configured, just generate preview
      toast({
        title: `🤖 ${copy.generatingPreview}`,
        description: `${formatNumber(enabledCount)} ${copy.alreadyConfigured}`,
      });
      handleGeneratePreview();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">🤖 Bulk AI Import</h2>
        <p className="text-muted-foreground">
          Automatyczne wypełnienie katalogu produktami z AI enrichment
        </p>
      </div>

      {/* System Comparison */}
      <ImportSystemsComparison currentSystem="bulk" variant="compact" />

      {/* Import Progress */}
      {importStatus !== 'idle' && (
        <ImportProgress
          status={importStatus}
          stats={importStats}
          logs={importLogs}
          startedAt={startedAt || undefined}
          completedAt={importStatus === 'completed' || importStatus === 'failed' ? new Date().toISOString() : undefined}
          systemType="bulk"
        />
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-4">
        <Badge variant={step === 'config' ? 'default' : 'outline'}>1. Konfiguracja</Badge>
        <Badge variant={step === 'preview' ? 'default' : 'outline'}>2. Preview</Badge>
        <Badge variant={step === 'complete' ? 'default' : 'outline'}>3. Zakończone</Badge>
      </div>

      {/* Step 1: Configuration */}
      {step === 'config' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Globalne ustawienia</CardTitle>
              <CardDescription>Domyślne wartości dla wszystkich kategorii</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produktów na kategorię (domyślnie)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={defaultProductsPerCategory}
                    onChange={e => setDefaultProductsPerCategory(parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCategoryConfigs(prev =>
                        prev.map(c => ({ ...c, productsCount: defaultProductsPerCategory }))
                      );
                      toast({ title: 'Zaktualizowano wszystkie kategorie' });
                    }}
                  >
                    Zastosuj do wszystkich
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Import Best Products Button */}
          <Card className="border-2 border-blue-500 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Auto-Import: 10 Best
              </CardTitle>
              <CardDescription>
                Automatycznie skonfiguruj wszystkie kategorie z najlepiej sprzedającymi się produktami (bestseller)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={handleAutoImportBest}
                disabled={loading}
              >
                <Zap className="mr-2 h-5 w-5" />
                {categoryConfigs.filter(c => c.enabled).length === 0
                  ? 'Skonfiguruj i Generuj Podgląd'
                  : 'Generuj Podgląd AI'
                }
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {categoryConfigs.length} kategorii × 10 produktów = {categoryConfigs.length * 10} produktów (przed filtrowaniem AI)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kategorie ({categoryConfigs.filter(c => c.enabled).length} zaznaczonych)</CardTitle>
              <CardDescription>
                Zaznacz kategorie i wpisz search queries dla każdej (lub użyj Auto-Import powyżej)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {categoryConfigs.map((config, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded">
                  <Checkbox
                    checked={config.enabled}
                    onCheckedChange={() => toggleCategory(index)}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium">
                      {config.mainName} → {config.subName}
                      {config.subSubName && ` → ${config.subSubName}`}
                    </div>
                    <div className="grid md:grid-cols-2 gap-2">
                      <Input
                        placeholder="Search query (np. smartphone)"
                        value={config.searchQuery}
                        onChange={e => updateSearchQuery(index, e.target.value)}
                        disabled={!config.enabled}
                      />
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={config.productsCount}
                        onChange={e => updateProductsCount(index, parseInt(e.target.value) || 10)}
                        disabled={!config.enabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            onClick={handleGeneratePreview}
            disabled={loading || categoryConfigs.filter(c => c.enabled && c.searchQuery).length === 0}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
            Generate AI Preview
          </Button>
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preview ({previewProducts.filter(p => p.selected).length} zaznaczonych)</CardTitle>
                  <CardDescription>Sprawdź wyniki AI przed zapisem do bazy</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectAllByQuality(80)}>
                    Tylko score ≥80
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectAllByQuality(70)}>
                    Tylko score ≥70
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewProducts(prev => prev.map(p => ({ ...p, selected: !p.selected })))}
                  >
                    Toggle All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {previewProducts.map(product => (
                <div key={product.id} className="flex items-start gap-3 p-4 border rounded">
                  <Checkbox
                    checked={product.selected}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                  />
                  <img src={product.image} alt="" className="w-20 h-20 object-cover rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground line-through">
                          {product.title.slice(0, 80)}...
                        </div>
                        <div className="font-medium">{product.normalizedTitle}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.categoryPath.join(' → ')}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-lg font-bold">{Number.isFinite(product.price) ? product.price.toFixed(2) : '—'} PLN</div>
                        <Badge
                          variant={
                            product.aiQuality.recommendation === 'approve'
                              ? 'default'
                              : product.aiQuality.recommendation === 'review'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {product.aiQuality.recommendation === 'approve' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {product.aiQuality.recommendation === 'review' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {product.aiQuality.recommendation === 'reject' && <XCircle className="h-3 w-3 mr-1" />}
                          Score: {product.aiQuality.score}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {product.seoDescription}
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600">AI Reasoning</summary>
                      <p className="mt-1 text-muted-foreground">{product.aiQuality.reasoning}</p>
                    </details>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('config')}>
              Wstecz
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={importing || previewProducts.filter(p => p.selected).length === 0}
              size="lg"
              className="flex-1"
            >
              {importing ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              Import {previewProducts.filter(p => p.selected).length} produktów
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-2xl font-bold">Import zakończony!</h3>
            <p className="text-muted-foreground">
              Produkty zostały zapisane do bazy i dodane do kolejki indeksowania
            </p>
            <Button onClick={() => {
              setStep('config');
              setPreviewProducts([]);
              setCategoryConfigs(prev => prev.map(c => ({ ...c, enabled: false, searchQuery: '' })));
            }}>
              Nowy Import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default withAuth(BulkImportPage);
