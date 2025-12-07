"use client";

import { useState } from "react";
import { useAuth, isAdmin } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Zap, ShoppingBag, Package, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export default function AutoImportPage() {
  const { user, loading: authLoading } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [maxProductsPerCategory, setMaxProductsPerCategory] = useState(20);
  const [progress, setProgress] = useState<string[]>([]);
  
  // Advanced features toggles
  const [enableAdvancedFeatures, setEnableAdvancedFeatures] = useState(true);
  const [enableAIEnrichment, setEnableAIEnrichment] = useState(true);
  
  // Multi-source settings
  const [enabledSources, setEnabledSources] = useState({
    aliexpress: true,
    convertiser: true,
    allegro: false,
    amazon: false,
    ebay: false,
  });

  const onRunAutoImport = async () => {
    const sourcesEnabled = Object.entries(enabledSources).filter(([_, enabled]) => enabled);
    if (sourcesEnabled.length === 0) {
      toast.error('Wybierz przynajmniej jedno źródło!');
      return;
    }

    if (!confirm(`🤖 AUTO-IMPORT KOMBAJN wypełni WSZYSTKIE kategorie produktami z ${sourcesEnabled.length} źródeł: ${sourcesEnabled.map(([s]) => s).join(', ')}. To może zająć 10-30 minut. Kontynuować?`)) {
      return;
    }

    setIsRunning(true);
    setProgress([]);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      
      // Run multi-source import
      const response = await fetch('/api/admin/ai/auto-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          maxProductsPerCategory,
          sources: enabledSources,
          enableAdvancedFeatures,
          enableAIEnrichment,
        }),
      });

      if (!response.ok) {
        throw new Error('Auto-import failed');
      }

      const result = await response.json();
      toast.success(`✅ Auto-import ukończony! Zaimportowano ${result.totalProducts || 0} produktów z ${result.sourcesUsed || 0} źródeł.`);
      setProgress(result.log || []);
    } catch (error) {
      console.error('Auto-import error:', error);
      toast.error('❌ Błąd podczas auto-importu');
    } finally {
      setIsRunning(false);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user || !isAdmin(user)) {
    return <div className="text-center py-10">Brak uprawnień. Ta strona jest dostępna tylko dla administratorów.</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-600" />
            AUTO-IMPORT KOMBAJN
          </h1>
          <p className="text-muted-foreground mt-2">
            Automatyczne wypełnianie wszystkich kategorii produktami z wielu źródeł
          </p>
        </div>
      </div>

      {/* Main Configuration Card */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-600" />
            Konfiguracja Kombajnu
          </CardTitle>
          <CardDescription>
            Wybierz źródła i parametry automatycznego importu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sources Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Źródła produktów (wybierz co najmniej 1):</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* AliExpress */}
              <Card className={enabledSources.aliexpress ? 'border-purple-400 bg-purple-50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="source-aliexpress"
                      checked={enabledSources.aliexpress}
                      onCheckedChange={(checked) =>
                        setEnabledSources({ ...enabledSources, aliexpress: checked as boolean })
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="source-aliexpress" className="cursor-pointer font-semibold flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        AliExpress
                        <Badge variant="default">AI Enhanced</Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Główne źródło - największa baza produktów z AI enrichment (Quality Score + Copywriter + Librarian)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Convertiser */}
              <Card className={enabledSources.convertiser ? 'border-blue-400 bg-blue-50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="source-convertiser"
                      checked={enabledSources.convertiser}
                      onCheckedChange={(checked) =>
                        setEnabledSources({ ...enabledSources, convertiser: checked as boolean })
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="source-convertiser" className="cursor-pointer font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Convertiser
                        <Badge variant="secondary">Bulk Platform</Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        100k+ produktów, tracking prowizji afiliacyjnych, 30 produktów/stronę
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Allegro */}
              <Card className={enabledSources.allegro ? 'border-orange-400 bg-orange-50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="source-allegro"
                      checked={enabledSources.allegro}
                      onCheckedChange={(checked) =>
                        setEnabledSources({ ...enabledSources, allegro: checked as boolean })
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="source-allegro" className="cursor-pointer font-semibold flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Allegro
                        <Badge variant="outline">PL Market</Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Polski marketplace - lokalne oferty z szybką dostawą
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Amazon */}
              <Card className={enabledSources.amazon ? 'border-yellow-400 bg-yellow-50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="source-amazon"
                      checked={enabledSources.amazon}
                      onCheckedChange={(checked) =>
                        setEnabledSources({ ...enabledSources, amazon: checked as boolean })
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="source-amazon" className="cursor-pointer font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Amazon
                        <Badge variant="outline">USD→PLN</Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatyczna konwersja walut, wysokiej jakości produkty
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* eBay */}
              <Card className={enabledSources.ebay ? 'border-green-400 bg-green-50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="source-ebay"
                      checked={enabledSources.ebay}
                      onCheckedChange={(checked) =>
                        setEnabledSources({ ...enabledSources, ebay: checked as boolean })
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="source-ebay" className="cursor-pointer font-semibold flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        eBay
                        <Badge variant="secondary">Legacy</Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Aukcje i kup teraz - dodatkowe źródło dla niszowych produktów
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Max Products Setting */}
          <div className="space-y-2">
            <Label htmlFor="max-products">Maksymalna liczba produktów na kategorię:</Label>
            <Input
              id="max-products"
              type="number"
              min={5}
              max={100}
              value={maxProductsPerCategory}
              onChange={(e) => setMaxProductsPerCategory(parseInt(e.target.value) || 20)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Rekomendowane: 20-30 produktów. Więcej = dłuższy czas importu.
            </p>
          </div>

          {/* Advanced Features Toggles */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-semibold">⚡ Zaawansowane funkcje:</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="advanced-features"
                checked={enableAdvancedFeatures}
                onCheckedChange={(checked) => setEnableAdvancedFeatures(checked as boolean)}
              />
              <Label htmlFor="advanced-features" className="cursor-pointer flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="font-medium">SKU Details, Shipping, Variants</span>
                <Badge variant="default">Recommended</Badge>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              • AliExpress: Warianty produktów (rozmiary, kolory, SKU), koszty dostawy do Polski, specyfikacje, gwarancje, wymiary paczek<br/>
              • Convertiser: Tracking prowizji, statystyki produktów, proper affiliate links<br/>
              • Więcej danych = lepsza jakość ofert, ale wolniejszy import
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ai-enrichment"
                checked={enableAIEnrichment}
                onCheckedChange={(checked) => setEnableAIEnrichment(checked as boolean)}
              />
              <Label htmlFor="ai-enrichment" className="cursor-pointer flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="font-medium">AI Enhancement (3 agenty)</span>
                <Badge variant="secondary">AliExpress only</Badge>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              • Ruthless Auditor: Quality score 0-100, rekomendacja publikacji<br/>
              • Sales Copywriter: Polski marketing copy, HTML z bullet points<br/>
              • Librarian: 3-poziomowe mapowanie kategorii (confidence score)<br/>
              • Tylko dla AliExpress - pozostałe źródła mają basic import
            </p>
          </div>

          {/* Run Button */}
          <Button
            onClick={onRunAutoImport}
            disabled={isRunning}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg h-14"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Auto-Import w toku... ({progress.length} kroków)
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-6 w-6" />
                🚀 Uruchom AUTO-IMPORT KOMBAJN
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Jak działa AUTO-IMPORT KOMBAJN?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-2">🎯 Proces automatyczny:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Skanuje wszystkie kategorie w Firestore</li>
                <li>Dla każdej kategorii pobiera produkty z wybranych źródeł</li>
                <li>Wzbogaca opisy AI (AliExpress: 3 agenty)</li>
                <li>Deduplikacja (pomija duplikaty)</li>
                <li>Automatyczna kategoryzacja</li>
                <li>Zapis jako draft do moderacji</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">⚡ AI Enhancement (AliExpress):</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><strong>Quality Score:</strong> Ocena jakości 0-100</li>
                <li><strong>Sales Copywriter:</strong> Polskie opisy marketingowe</li>
                <li><strong>Librarian:</strong> Automatyczne kategorie</li>
                <li>Fallback: Rule-based scoring bez AI</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm">
              <strong>⏱️ Szacowany czas:</strong> 10-30 minut w zależności od liczby kategorii i źródeł.
              Proces działa w tle - możesz zamknąć kartę.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm">
              <strong>📊 Wyniki:</strong> Wszystkie produkty pojawią się w panelu <strong>Moderacji Produktów</strong> ze statusem <Badge variant="secondary">draft</Badge>.
              Przejrzyj i zatwierdź przed publikacją.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Progress Log */}
      {progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Log importu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
              {progress.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
