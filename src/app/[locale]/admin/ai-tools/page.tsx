'use client';

import { useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles,
  ShoppingCart,
  Flame,
  Database,
  Zap,
  Package,
  TrendingUp,
  FileSearch,
  Merge,
  Star,
  Link as LinkIcon,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// AI Flow Descriptions
const AI_FLOWS = {
  catalog: {
    icon: ShoppingCart,
    title: 'Wypełnij Katalog Produktami',
    description: 'Automatycznie tworzy kompletną strukturę kategorii i importuje produkty z AliExpress API',
    details: [
      'Tworzy 6 kategorii głównych (Elektronika, Dom i Ogród, Moda, Dziecko, Sport, Supermarket)',
      'Automatycznie generuje ~50 podkategorii i pod-podkategorii',
      'Pobiera ~300 produktów dopasowanych do każdej kategorii',
      'Wzbogaca produkty przez AI: polskie tytuły, opisy, SEO metatagi',
      'Przechwytuje wszystkie dane Advanced API: promocje, oceny sprzedawców, stany magazynowe, zwroty, specyfikacje'
    ],
    estimatedTime: '5-10 minut',
    productsCount: '~300 produktów',
    status: 'production',
    function: 'fillCategoriesWithProducts',
    gradient: 'from-blue-500 to-purple-600',
    hoverGradient: 'from-blue-600 to-purple-700'
  },
  deals: {
    icon: Flame,
    title: 'Pobierz Deale (Promocje)',
    description: 'Agreguje najlepsze okazje z AliExpress - produkty z promocjami >50% zniżki',
    details: [
      'Przeszukuje 10 kategorii w poszukiwaniu najlepszych promocji',
      'Filtruje tylko produkty z realną zniżką >50%',
      'Identyfikuje Flash Sale, Hot Deals, kupony i inne promocje',
      'Generuje atrakcyjne opisy deali przez AI (polski język)',
      'Zapisuje jako Deal (status: draft) z pełnymi metadanymi Advanced API'
    ],
    estimatedTime: '3-5 minut',
    productsCount: '~100 deali',
    status: 'production',
    function: 'fillCategoriesWithDeals',
    gradient: 'from-orange-500 to-red-600',
    hoverGradient: 'from-orange-600 to-red-700'
  },
  trending: {
    icon: TrendingUp,
    title: 'Predykcja Trendujących Deali',
    description: 'Algorytm AI przewiduje, które deale mają potencjał na viral (heat index 0-100)',
    details: [
      'Analizuje rating, liczbę ocen, temperaturę i status deala',
      'Generuje heat index (0-100) określający potencjał viralowy',
      'Wyjaśnia dlaczego deal może być popularny',
      'Pomaga priorytetować promocję najlepszych okazji'
    ],
    estimatedTime: '<1 sekunda/deal',
    productsCount: 'Analiza pojedynczych deali',
    status: 'available',
    function: 'trendingDealPrediction',
    gradient: 'from-green-500 to-emerald-600',
    hoverGradient: 'from-green-600 to-emerald-700'
  },
  linkDealProduct: {
    icon: LinkIcon,
    title: 'Linkowanie Deali z Produktami',
    description: 'Automatycznie łączy deale z odpowiadającymi im produktami w katalogu',
    details: [
      'Porównuje deale i produkty na podstawie nazwy, atrybutów i marketplace',
      'AI ocenia czy to ten sam produkt (confidence score)',
      'Aktualizuje powiązania Deal.linkedProductId',
      'Umożliwia wyświetlanie pełnych informacji o produkcie w widoku deala'
    ],
    estimatedTime: '<1 sekunda/deal',
    productsCount: 'Powiązania deal-produkt',
    status: 'available',
    function: 'aiLinkDealToProduct',
    gradient: 'from-purple-500 to-pink-600',
    hoverGradient: 'from-purple-600 to-pink-700'
  },
  canonical: {
    icon: Merge,
    title: 'Wykrywanie Duplikatów Produktów',
    description: 'AI identyfikuje ten sam produkt z różnych marketplace (canonical product detection)',
    details: [
      'Porównuje produkty z różnych źródeł (AliExpress, Amazon, itp.)',
      'Ocenia podobieństwo na podstawie nazwy, atrybutów, opisów',
      'Generuje confidence score i rekomendacje merge strategy',
      'Pomaga unikać duplikatów w katalogu'
    ],
    estimatedTime: '<1 sekunda/para',
    productsCount: 'Porównania par produktów',
    status: 'available',
    function: 'detectCanonicalProduct',
    gradient: 'from-indigo-500 to-blue-600',
    hoverGradient: 'from-indigo-600 to-blue-700'
  },
  categoryMapping: {
    icon: Package,
    title: 'Mapowanie Kategorii Marketplace',
    description: 'Automatycznie mapuje kategorie z marketplace na kategorie platformy',
    details: [
      'Analizuje nazwy, opisy i przykładowe produkty z marketplace',
      'Sugeruje najlepsze dopasowanie do kategorii platformy',
      'Generuje confidence score i alternatywne mapowania',
      'Przyspiesza import produktów z nowych źródeł'
    ],
    estimatedTime: '<1 sekunda/kategoria',
    productsCount: 'Mapowania kategorii',
    status: 'available',
    function: 'mapMarketplaceCategory',
    gradient: 'from-teal-500 to-cyan-600',
    hoverGradient: 'from-teal-600 to-cyan-700'
  },
  reviewAggregation: {
    icon: Star,
    title: 'Agregacja Opinii Multi-Source',
    description: 'Zbiera i analizuje opinie z wielu marketplace, generuje podsumowanie',
    details: [
      'Agreguje opinie z AliExpress, Amazon, itp.',
      'Analiza sentymentu i wyodrębnienie pros/cons',
      'Generuje podsumowanie w języku polskim',
      'Identyfikuje najważniejsze cechy produktu'
    ],
    estimatedTime: '2-3 sekundy/produkt',
    productsCount: 'Analiza opinii',
    status: 'available',
    function: 'aggregateMultiSourceReviews',
    gradient: 'from-amber-500 to-orange-600',
    hoverGradient: 'from-amber-600 to-orange-700'
  },
  wipeDatabase: {
    icon: Database,
    title: 'Wyczyść Bazę Danych',
    description: 'Usuwa wszystkie produkty i deale z Firestore (przydatne przed re-seedowaniem)',
    details: [
      '⚠️ UWAGA: To jest operacja nieodwracalna!',
      'Usuwa wszystkie dokumenty z kolekcji "products"',
      'Usuwa wszystkie dokumenty z kolekcji "deals"',
      'Kategorie pozostają nienaruszone',
      'Użyj przed ponownym wypełnieniem katalogu'
    ],
    estimatedTime: '1-2 minuty',
    productsCount: 'Reset bazy',
    status: 'dangerous',
    function: 'wipeDatabase',
    gradient: 'from-gray-600 to-gray-800',
    hoverGradient: 'from-red-600 to-red-800'
  }
};

function AiToolCard({ flowKey, flow, onExecute, isLoading }: any) {
  const Icon = flow.icon;
  const isDangerous = flow.status === 'dangerous';
  const isProduction = flow.status === 'production';
  
  return (
    <Card className={`border-2 transition-all hover:shadow-lg ${
      isDangerous ? 'border-red-200 dark:border-red-900' : 'border-border'
    }`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg bg-gradient-to-br ${flow.gradient} text-white`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">{flow.title}</CardTitle>
              <CardDescription className="mt-1">
                {flow.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge variant={isProduction ? 'default' : isDangerous ? 'destructive' : 'secondary'}>
              {isProduction ? 'Production' : isDangerous ? 'Ostrożnie' : 'Available'}
            </Badge>
            <span className="text-xs text-muted-foreground">{flow.estimatedTime}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Details List */}
        <div className="space-y-2">
          {flow.details.map((detail: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <CheckCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                isDangerous ? 'text-red-500' : 'text-green-500'
              }`} />
              <span className={isDangerous && idx === 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                {detail}
              </span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            {flow.productsCount}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {flow.estimatedTime}
          </div>
        </div>

        {/* Execute Button */}
        <Button
          onClick={() => onExecute(flowKey, flow)}
          disabled={isLoading}
          className={`w-full bg-gradient-to-r ${flow.gradient} hover:${flow.hoverGradient} text-white font-semibold transition-all`}
        >
          {isLoading ? (
            <>
              <Zap className="h-4 w-4 mr-2 animate-spin" />
              Przetwarzanie...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {isDangerous ? 'Wykonaj z Ostrożnością' : 'Uruchom'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function AIToolsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [activeFlow, setActiveFlow] = useState<string | null>(null);

  const handleExecute = async (flowKey: string, flow: any) => {
    const isDangerous = flow.status === 'dangerous';
    
    // Confirmation dialogs
    if (isDangerous) {
      if (!confirm('⚠️ UWAGA! To usunie WSZYSTKIE produkty i deale. Czy na pewno?')) return;
      if (!confirm('To jest nieodwracalne. Ostatnia szansa - kontynuować?')) return;
    } else {
      if (!confirm(`Czy na pewno chcesz uruchomić: ${flow.title}?`)) return;
    }

    setLoading(true);
    setActiveFlow(flowKey);
    setResult(`🚀 Rozpoczynam: ${flow.title}...\n\nProszę czekać (${flow.estimatedTime})...`);

    try {
      const endpoint = isDangerous ? '/api/admin/ai/wipe' : '/api/admin/ai/command';
      const body = isDangerous ? {} : { command: flow.function };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.result || errorData.message || 'Nieznany błąd serwera'}`);
        return;
      }

      const data = await res.json();
      setResult(data.result || data.message || '✅ Operacja zakończona pomyślnie!');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message}`);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
      setActiveFlow(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-headline tracking-tight">AI Tools</h2>
              <p className="text-muted-foreground mt-1">
                Zaawansowane narzędzia AI do automatyzacji i zarządzania platformą
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <Card className="border-2 border-primary bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Wynik operacji
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-white dark:bg-gray-900 p-4 rounded-lg border font-mono max-h-96 overflow-y-auto">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="automation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="automation">
            <Zap className="h-4 w-4 mr-2" />
            Automatyzacja
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <FileSearch className="h-4 w-4 mr-2" />
            Analiza i Wykrywanie
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Settings className="h-4 w-4 mr-2" />
            Konserwacja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automation" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <AiToolCard
              flowKey="catalog"
              flow={AI_FLOWS.catalog}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'catalog'}
            />
            <AiToolCard
              flowKey="deals"
              flow={AI_FLOWS.deals}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'deals'}
            />
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <AiToolCard
              flowKey="trending"
              flow={AI_FLOWS.trending}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'trending'}
            />
            <AiToolCard
              flowKey="linkDealProduct"
              flow={AI_FLOWS.linkDealProduct}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'linkDealProduct'}
            />
            <AiToolCard
              flowKey="canonical"
              flow={AI_FLOWS.canonical}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'canonical'}
            />
            <AiToolCard
              flowKey="categoryMapping"
              flow={AI_FLOWS.categoryMapping}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'categoryMapping'}
            />
            <AiToolCard
              flowKey="reviewAggregation"
              flow={AI_FLOWS.reviewAggregation}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'reviewAggregation'}
            />
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <AiToolCard
              flowKey="wipeDatabase"
              flow={AI_FLOWS.wipeDatabase}
              onExecute={handleExecute}
              isLoading={loading && activeFlow === 'wipeDatabase'}
            />
          </div>

          {/* Info Card */}
          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                <AlertCircle className="h-5 w-5" />
                Ważne informacje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
              <p>
                <strong>✨ Wszystkie narzędzia AI używają:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Gemini 2.0 Flash dla generacji treści</li>
                <li>AliExpress Advanced API dla danych produktów</li>
                <li>Firebase Admin SDK dla operacji na bazie</li>
              </ul>
              <p className="mt-4">
                <strong>⚡ Limity i performance:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Wypełnianie katalogu: max 300 produktów naraz</li>
                <li>Batch processing: 10 produktów jednocześnie</li>
                <li>Rate limiting: respektuje limity API</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(AIToolsPage);
