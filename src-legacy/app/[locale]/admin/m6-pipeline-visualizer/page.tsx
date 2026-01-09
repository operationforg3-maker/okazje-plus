"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  M6PipelineVisualizer,
  IdentityHashVisualizer,
  DeduplicationResult,
  DealComparisonGrid,
  RefinerProgressCard,
} from "@/components/m6-pipeline-visualizer";
import {
  BarChart3,
  Database,
  Zap,
  ArrowRight,
  TrendingUp,
  Layers,
  BookOpen,
  Settings,
  Play,
} from "lucide-react";

export default function M6PipelineVisualizerPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl">
              <ArrowRight className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                M6 Pipeline
              </h1>
              <p className="text-slate-600 mt-1">
                Product-Centric Architecture: Harvester → Dedup → Firestore → AI Enrichment
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Pipeline Przegląd
            </TabsTrigger>
            <TabsTrigger value="simulation" className="gap-2">
              <Play className="w-4 h-4" />
              Symulacja
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Dokumentacja
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Ustawienia
            </TabsTrigger>
          </TabsList>

          {/* TAB: Overview */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">
                  Jak działa M6 Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      Harvester (Pobieranie)
                    </h4>
                    <ul className="space-y-1 text-xs list-disc ml-4">
                      <li>Łączy się z AliExpress/Amazon/Allegro API</li>
                      <li>Pobiera surowe produkty (RawProduct)</li>
                      <li>Oblicza identity hash (SHA-256)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      Deduplication (Deduplikacja)
                    </h4>
                    <ul className="space-y-1 text-xs list-disc ml-4">
                      <li>Szuka istniejącego ProductCore po hash'u</li>
                      <li>
                        Jeśli znaleziony: tworzy tylko DealM6
                      </li>
                      <li>
                        Jeśli nie: tworzy ProductCore + DealM6
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      Firestore (Baza)
                    </h4>
                    <ul className="space-y-1 text-xs list-disc ml-4">
                      <li>ProductCore → immutable, deduplicated</li>
                      <li>DealM6 → price points, merchants</li>
                      <li>Status: draft → pending → approved</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      AI Refiner (Wzbogacanie)
                    </h4>
                    <ul className="space-y-1 text-xs list-disc ml-4">
                      <li>Czyści specs z surowych danych</li>
                      <li>Generuje PL/EN/DE opisy (Gemini)</li>
                      <li>Tworzy search tags</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <M6PipelineVisualizer stages={[
              {
                id: "source",
                title: "1. Fetch from Sources",
                description: "AliExpress/Amazon/Allegro API",
                icon: <Database className="w-6 h-6" />,
                status: "idle" as const,
              },
              {
                id: "identity",
                title: "2. Calculate Identity Hash",
                description: "SHA-256(title + image_hash)",
                icon: <Zap className="w-6 h-6" />,
                status: "idle" as const,
              },
              {
                id: "dedup",
                title: "3. Deduplication Check",
                description: "Find existing products by hash",
                icon: <Layers className="w-6 h-6" />,
                status: "idle" as const,
              },
            ]} />

            {/* Example: Product Deduplication */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">
                Jak działa deduplikacja?
              </h2>

              <Card className="bg-blue-50 border border-blue-300">
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-700 mb-4">
                    Ten panel pokazuje edukacyjny przykład M6 pipeline'u. Aby zobaczyć rzeczywiste dane z Twojej bazy:
                  </p>
                  <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-700">
                    <li>Wejdź do zakładki "Historia Jobów"</li>
                    <li>Uruchom Harvester z rzeczywistym zapytaniem</li>
                    <li>Obserwuj live progress i deduplicization</li>
                    <li>Po zakończeniu job'u - zobacz dokładne statystyki</li>
                  </ol>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Identity Hash */}
                <IdentityHashVisualizer
                  title="Przykład: USB-C Cable 2M Fast Charging"
                  imageUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' fill='%23ddd'%3E%3Crect width='150' height='150' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23999' text-anchor='middle' dy='.3em'%3EProduce Image%3C/text%3E%3C/svg%3E"
                  hash="a7f3b2c1d8e9f5g6h7j8k9l0m1n2o3p4q5r6s7t8u9v0"
                />

                {/* Deduplication Result */}
                <DeduplicationResult
                  found={true}
                  existingProductId="prod_xyz123_abc"
                  action="create_deal_only"
                />
              </div>
            </div>

            {/* Deal Comparison */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">
                Jak system zarządza Deal'ami?
              </h2>
              <Card className="bg-slate-50 border-0">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-slate-700">
                    M6 system pozwala na:
                  </p>
                  <ul className="space-y-2 text-sm text-slate-700 ml-4 list-disc">
                    <li><strong>1:N relacja</strong> - jeden ProductCore może mieć wiele Deal'i</li>
                    <li><strong>Różne źródła</strong> - AliExpress, Amazon, Allegro w tym samym produkcie</li>
                    <li><strong>Dynamiczne ceny</strong> - system śledzi historię cen</li>
                    <li><strong>Ranking ciepła</strong> - Deal'e ranglujemy po temperature (popularności)</li>
                    <li><strong>Real-time updates</strong> - ceny mogą się zmieniać w ciągu godzin</li>
                  </ul>
                </CardContent>
              </Card>
              <DealComparisonGrid deals={[
                {
                  id: "deal-1",
                  merchantName: "Merchant A",
                  price: 9.99,
                  shipping: 2.5,
                  currency: "USD",
                },
                {
                  id: "deal-2",
                  merchantName: "Merchant B",
                  price: 11.99,
                  shipping: 0,
                  currency: "USD",
                },
                {
                  id: "deal-3",
                  merchantName: "Merchant C",
                  price: 10.99,
                  shipping: 3.0,
                  currency: "USD",
                },
              ]} />
            </div>
          </TabsContent>

          {/* TAB: Education */}
          <TabsContent value="simulation" className="space-y-6">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Jak wygląda cały Pipeline?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-slate-700">
                    <strong>M6 Pipeline</strong> to sekwencja automatycznych operacji, która:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-blue-900 text-sm mb-2">1️⃣ Fetching</h4>
                      <p className="text-xs text-blue-800">Pobiera produkty z AliExpress, Amazon, Allegro APIs</p>
                    </div>
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="font-semibold text-purple-900 text-sm mb-2">2️⃣ Identity Hash</h4>
                      <p className="text-xs text-purple-800">SHA-256(title + image_hash) → jednoznaczna identyfikacja</p>
                    </div>
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <h4 className="font-semibold text-indigo-900 text-sm mb-2">3️⃣ Deduplication</h4>
                      <p className="text-xs text-indigo-800">Szuka istniejących produktów po hash'u → reuse lub create</p>
                    </div>
                    <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <h4 className="font-semibold text-cyan-900 text-sm mb-2">4️⃣ Firestore Persist</h4>
                      <p className="text-xs text-cyan-800">Zapisuje ProductCore + DealM6 documents</p>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <h4 className="font-semibold text-amber-900 text-sm mb-2">5️⃣ AI Enrichment</h4>
                      <p className="text-xs text-amber-800">Gemini 2.0 Flash generuje opisy, specs, tagi, quality score</p>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold text-green-900 text-sm mb-2">6️⃣ Ready for Users</h4>
                      <p className="text-xs text-green-800">Produkty dostępne na froncie z complete metadata</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Documentation */}
          <TabsContent value="docs" className="space-y-6">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Dokumentacja M6</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <h3>ProductCore</h3>
                <p>
                  Immutable, deduplicated product record. One per unique product identified by identity hash.
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto">
{`interface ProductCore {
  id: string;                    // Firestore doc ID
  identityHash: string;          // SHA-256(title + imageUrl)
  title: string;
  description: string;
  images: string[];
  specs: Record<string, string>; // {"RAM": "16GB", ...}
  rating: { score: number; count: number };
  bestPrice: { amount: number; currency: string };
  linkedDealIds: string[];       // Foreign keys to DealM6
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}`}
                </pre>

                <h3>DealM6</h3>
                <p>
                  Mutable deal/offer record. Multiple deals can link to one ProductCore (different merchants, prices).
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto">
{`interface DealM6 {
  id: string;
  productId: string;             // Foreign key to ProductCore
  price: { amount: number; currency: string };
  shipping: { cost: number; timeDays: number };
  merchantName: string;
  merchantRating?: number;
  priceHistory?: Array<{
    price: number;
    timestamp: string;
    source: 'import' | 'sync' | 'manual';
  }>;
  source: 'aliexpress' | 'amazon' | 'allegro';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Settings */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 bg-slate-50 rounded-lg border">
                    <p className="font-semibold text-slate-900 text-sm">
                      Harvester Settings
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>API Timeout</span>
                        <span className="font-mono">30s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Batch Size</span>
                        <span className="font-mono">50</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retry Count</span>
                        <span className="font-mono">3</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-4 bg-slate-50 rounded-lg border">
                    <p className="font-semibold text-slate-900 text-sm">
                      Refiner Settings
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>Model</span>
                        <span className="font-mono">Gemini 2.0 Flash</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Concurrency</span>
                        <span className="font-mono">5</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Languages</span>
                        <span className="font-mono">PL, EN, DE</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
