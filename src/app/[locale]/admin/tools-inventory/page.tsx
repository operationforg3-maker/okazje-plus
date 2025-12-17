'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Tool {
  category: string;
  tool: string;
  hasUI: string;
  hasAPI: string;
  hasBackend: string;
  hasTests: string;
  lastModified: string;
  owner: string;
  ui: string;
  apiCount: string;
  apis: string;
  backendModules: string;
  testFiles: string;
  notes: string;
}

interface Stats {
  total: number;
  byCategory: Record<string, number>;
  coverage: {
    hasUI: number;
    hasAPI: number;
    hasBackend: number;
    hasTests: number;
  };
  fullyCovered: number;
}

interface InventoryData {
  tools: Tool[];
  stats: Stats;
}

export default function ToolsInventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/tools-inventory');
      if (!res.ok) throw new Error('Failed to load inventory');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Error loading inventory:', error);
      toast.error('Nie udało się załadować inwentarza');
    } finally {
      setLoading(false);
    }
  };

  const regenerateReport = async () => {
    try {
      setRegenerating(true);
      const res = await fetch('/api/admin/tools-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      toast.success('Raport wygenerowany pomyślnie');
      await loadData();
    } catch (error) {
      console.error('Error regenerating:', error);
      toast.error('Nie udało się wygenerować raportu');
    } finally {
      setRegenerating(false);
    }
  };

  const downloadCSV = () => {
    window.open('/api/admin/tools-inventory?format=csv', '_blank');
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Brak danych</p>
      </div>
    );
  }

  const filteredTools = selectedCategory === 'all' 
    ? data.tools 
    : data.tools.filter(t => t.category === selectedCategory);

  const categories = ['all', ...Object.keys(data.stats.byCategory)];

  const CoverageIcon = ({ value }: { value: string }) => {
    if (value === 'yes') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const coveragePercent = (count: number) => ((count / data.stats.total) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inwentarz Narzędzi</h1>
          <p className="text-muted-foreground">
            Przegląd wszystkich narzędzi importu, wzbogacania i tłumaczeń
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={downloadCSV}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Pobierz CSV
          </Button>
          <Button
            onClick={regenerateReport}
            disabled={regenerating}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
            Regeneruj
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie Narzędzia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ma UI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.coverage.hasUI}</div>
            <p className="text-xs text-muted-foreground">
              {coveragePercent(data.stats.coverage.hasUI)}% pokrycia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ma API</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.coverage.hasAPI}</div>
            <p className="text-xs text-muted-foreground">
              {coveragePercent(data.stats.coverage.hasAPI)}% pokrycia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ma Backend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.coverage.hasBackend}</div>
            <p className="text-xs text-muted-foreground">
              {coveragePercent(data.stats.coverage.hasBackend)}% pokrycia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ma Testy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.coverage.hasTests}</div>
            <p className="text-xs text-muted-foreground">
              {coveragePercent(data.stats.coverage.hasTests)}% pokrycia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Alert */}
      {data.stats.coverage.hasTests < data.stats.total / 2 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-900">Niska pokrycie testami</CardTitle>
            </div>
            <CardDescription className="text-yellow-700">
              Tylko {coveragePercent(data.stats.coverage.hasTests)}% narzędzi ma testy.
              Rozważ dodanie testów do zwiększenia niezawodności.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Category Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Narzędzia według Kategorii</CardTitle>
          <CardDescription>
            Kliknij kategorię aby filtrować
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="mb-4">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat}>
                  {cat === 'all' ? 'Wszystkie' : cat}
                  {cat !== 'all' && (
                    <Badge variant="secondary" className="ml-2">
                      {data.stats.byCategory[cat]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory}>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Narzędzie</TableHead>
                      <TableHead>Kategoria</TableHead>
                      <TableHead>Ostatnia Modyfikacja</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-center">UI</TableHead>
                      <TableHead className="text-center">API</TableHead>
                      <TableHead className="text-center">Backend</TableHead>
                      <TableHead className="text-center">Testy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTools.map((tool, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{tool.tool}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tool.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tool.lastModified}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tool.owner}
                        </TableCell>
                        <TableCell className="text-center">
                          <CoverageIcon value={tool.hasUI} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CoverageIcon value={tool.hasAPI} />
                            {tool.apiCount && tool.apiCount !== '0' && (
                              <span className="text-xs text-muted-foreground">
                                ({tool.apiCount})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <CoverageIcon value={tool.hasBackend} />
                        </TableCell>
                        <TableCell className="text-center">
                          <CoverageIcon value={tool.hasTests} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Fully Covered Tools */}
      {data.stats.fullyCovered > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <CardTitle>Narzędzia z Pełnym Pokryciem</CardTitle>
            </div>
            <CardDescription>
              {data.stats.fullyCovered} narzędzi ma UI, API, Backend i Testy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.tools
                .filter(t => 
                  t.hasUI === 'yes' && 
                  t.hasAPI === 'yes' && 
                  t.hasBackend === 'yes' && 
                  t.hasTests === 'yes'
                )
                .map((tool, i) => (
                  <Badge key={i} variant="default" className="bg-green-500">
                    {tool.tool}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
