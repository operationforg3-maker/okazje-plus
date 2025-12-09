'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ZapOff,
  Zap,
  RefreshCw,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface FirebaseIndex {
  name: string;
  state: 'READY' | 'CREATING' | 'DELETING' | 'ERROR';
  fields: Array<{
    fieldPath: string;
    order?: 'ASCENDING' | 'DESCENDING';
  }>;
  collection: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  createdAt?: string;
  progress?: number; // 0-100 dla CREATING
}

interface FailedQuery {
  collection: string;
  filters: string;
  orderBy?: string;
  suggestion: string;
  firstSeen: string;
  occurrences: number;
  estimatedImpact: 'high' | 'medium' | 'low';
}

interface IndexDiagnosis {
  existing: FirebaseIndex[];
  suggested: FirebaseIndex[];
  failedQueries: FailedQuery[];
  stats: {
    totalIndices: number;
    readyIndices: number;
    creatingIndices: number;
    failedQueries: number;
    estimatedSize: string;
  };
}

interface FirebaseIndexManagerProps {
  onConsoleLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function FirebaseIndexManager({ onConsoleLog }: FirebaseIndexManagerProps) {
  const [diagnosis, setDiagnosis] = useState<IndexDiagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState('overview');

  const diagnoseIndexes = async () => {
    try {
      setLoading(true);
      onConsoleLog?.('🔍 Diagnozuję Firebase Indexes...', 'info');

      const response = await fetch('/api/admin/indexes/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Błąd diagnozy');

      const result = await response.json();
      setDiagnosis(result);

      onConsoleLog?.(
        `✅ Diagnoza ukończona: ${result.stats.readyIndices}/${result.stats.totalIndices} indeksów gotowych`,
        'success'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const createIndex = async (indexName: string) => {
    try {
      setCreating(prev => new Set([...prev, indexName]));
      onConsoleLog?.(`▶️ Tworzę index: ${indexName}...`, 'info');

      const response = await fetch('/api/admin/indexes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexName }),
      });

      if (!response.ok) throw new Error('Błąd tworzenia indexu');

      await diagnoseIndexes();
      onConsoleLog?.(`✅ Index ${indexName} został utworzony`, 'success');
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setCreating(prev => {
        const next = new Set(prev);
        next.delete(indexName);
        return next;
      });
    }
  };

  const createAllSuggestedIndexes = async () => {
    if (!diagnosis?.suggested.length) return;

    try {
      setLoading(true);
      onConsoleLog?.(`▶️ Tworzę ${diagnosis.suggested.length} sugerowanych indeksów...`, 'info');

      const response = await fetch('/api/admin/indexes/create-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexes: diagnosis.suggested.map(idx => idx.name),
        }),
      });

      if (!response.ok) throw new Error('Błąd tworzenia indeksów');

      const result = await response.json();
      await diagnoseIndexes();

      onConsoleLog?.(
        `✅ Wszystkie indeksy utworzone (${result.created}/${result.total})`,
        'success'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    diagnoseIndexes();
  }, []);

  if (!diagnosis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const getStateIcon = (state: FirebaseIndex['state']) => {
    const icons = {
      READY: <CheckCircle className="h-4 w-4 text-green-600" />,
      CREATING: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
      DELETING: <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />,
      ERROR: <XCircle className="h-4 w-4 text-red-600" />,
    };
    return icons[state];
  };

  const getStateLabel = (state: FirebaseIndex['state']) => {
    const labels = {
      READY: 'Gotowy ✓',
      CREATING: 'Tworzenie...',
      DELETING: 'Usuwanie...',
      ERROR: 'Błąd ✗',
    };
    return labels[state];
  };

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return colors[impact];
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Firebase Indexes - Naprawa</h3>
        <p className="text-sm text-muted-foreground">
          Diagnoza i inteligentne tworzenie brakujących indeksów Firestore
        </p>
      </div>

      {/* STATYSTYKI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{diagnosis.stats.totalIndices}</div>
            <div className="text-xs text-muted-foreground">Indeksów ogółem</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-700">
              {diagnosis.stats.readyIndices}
            </div>
            <div className="text-xs text-green-600">Gotowych ✓</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-700">
              {diagnosis.stats.creatingIndices}
            </div>
            <div className="text-xs text-blue-600">Tworzeniu</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-700">
              {diagnosis.stats.failedQueries}
            </div>
            <div className="text-xs text-red-600">Błąd zapytań</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-lg font-semibold">{diagnosis.stats.estimatedSize}</div>
            <div className="text-xs text-muted-foreground">Rozmiar</div>
          </CardContent>
        </Card>
      </div>

      {/* AKCJE */}
      <div className="flex flex-col md:flex-row gap-2">
        <Button
          onClick={diagnoseIndexes}
          disabled={loading}
          className="flex-1 gap-2"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Ponowna diagnoza
        </Button>
        {diagnosis.suggested.length > 0 && (
          <Button
            onClick={createAllSuggestedIndexes}
            disabled={loading}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Utwórz wszystkie sugerowane ({diagnosis.suggested.length})
          </Button>
        )}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          🔍 Inteligentna diagnoza skanuje ostatnie zapytania Firestore i sugeruje brakujące indeksy.
          Czytaj poniżej sugestie i utwórz je w jednym kliknięciu.
        </AlertDescription>
      </Alert>

      {/* TABS */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-xs">
            Przegląd
          </TabsTrigger>
          <TabsTrigger value="suggested" className="text-xs">
            Sugerowane ({diagnosis.suggested.length})
          </TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">
            Błędne zapytania ({diagnosis.failedQueries.length})
          </TabsTrigger>
        </TabsList>

        {/* PRZEGLĄD */}
        <TabsContent value="overview" className="space-y-2">
          <ScrollArea className="h-[400px] border rounded-lg p-4">
            <div className="space-y-2">
              {diagnosis.existing.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Brak istniejących indeksów
                </div>
              ) : (
                diagnosis.existing.map(idx => (
                  <Card key={idx.name}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="mt-1">{getStateIcon(idx.state)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-mono text-xs break-all">{idx.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {idx.collection}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {getStateLabel(idx.state)}
                              {idx.progress && ` (${idx.progress}%)`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Pola: {idx.fields.map(f => f.fieldPath).join(', ')}
                            </div>
                            {idx.createdAt && (
                              <div className="text-xs text-muted-foreground">
                                Utworzono: {new Date(idx.createdAt).toLocaleString('pl-PL')}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            idx.state === 'READY'
                              ? 'default'
                              : idx.state === 'ERROR'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-xs flex-shrink-0"
                        >
                          {getStateLabel(idx.state)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* SUGEROWANE */}
        <TabsContent value="suggested" className="space-y-2">
          {diagnosis.suggested.length === 0 ? (
            <Alert variant="default">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm">
                ✅ Wszystkie rekomendowane indeksy są już utworzone!
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-2">
                {diagnosis.suggested.map(idx => (
                  <Card key={idx.name} className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-mono text-xs break-all">{idx.name}</h4>
                            <Badge className="text-xs">SUGEROWANY</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            Kolekcja: {idx.collection}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Pola do indeksowania:
                            {idx.fields.map(f => (
                              <div key={f.fieldPath} className="ml-4">
                                • {f.fieldPath}
                                {f.order && ` (${f.order})`}
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => createIndex(idx.name)}
                          disabled={creating.has(idx.name)}
                          className="text-xs flex-shrink-0"
                        >
                          {creating.has(idx.name) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          Utwórz
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* BŁĘDNE ZAPYTANIA */}
        <TabsContent value="failed" className="space-y-2">
          {diagnosis.failedQueries.length === 0 ? (
            <Alert variant="default">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm">
                ✅ Brak błędnych zapytań!
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-2">
                {diagnosis.failedQueries.map((query, idx) => (
                  <Card key={idx} className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-4 pb-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <Badge className={`text-xs ${getImpactColor(query.estimatedImpact)}`}>
                              {query.estimatedImpact === 'high'
                                ? '🔴 Wysoki'
                                : query.estimatedImpact === 'medium'
                                  ? '🟡 Średni'
                                  : '🟢 Niski'}
                            </Badge>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {query.occurrences}x powtórzony
                          </Badge>
                        </div>

                        <div className="text-xs space-y-1">
                          <div className="font-semibold">Kolekcja: {query.collection}</div>
                          {query.filters && (
                            <div className="text-muted-foreground">
                              Filtry: <code className="bg-black/5 px-1">{query.filters}</code>
                            </div>
                          )}
                          {query.orderBy && (
                            <div className="text-muted-foreground">
                              Sortowanie: <code className="bg-black/5 px-1">{query.orderBy}</code>
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            💡 {query.suggestion}
                          </div>
                          <div className="text-muted-foreground">
                            Pierwsze: {new Date(query.firstSeen).toLocaleString('pl-PL')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <Alert variant="default">
        <Database className="h-4 w-4" />
        <AlertDescription className="text-xs">
          📊 Wskazówka: Indeksy mogą działać kilka minut do godziny. Monitoruj
          postęp w Firebase Console na karcie "Indexes".
        </AlertDescription>
      </Alert>
    </div>
  );
}
