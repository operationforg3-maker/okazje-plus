'use client';

/**
 * Panel testów w panelu administracyjnym
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MinusCircle,
  Clock,
  TrendingUp,
  Settings,
  Code,
  Briefcase,
  Copy,
  Download
} from 'lucide-react';
import type { TestSuiteResult, TestResult } from '@/lib/test-service';
import { toast } from 'sonner';

export default function TestsTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestSuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSummaryReport = () => {
    if (!testResults) return '';
    
    const failedTests = testResults.results.filter(t => t.status === 'fail');
    const warningTests = testResults.results.filter(t => t.status === 'warning');
    const skippedTests = testResults.results.filter(t => t.status === 'skip');
    
    const report = `
# RAPORT TESTÓW - Okazje Plus
Data: ${new Date(testResults.timestamp).toLocaleString('pl-PL')}
URL: ${window.location.origin}

## PODSUMOWANIE
✅ Zaliczone: ${testResults.passed}/${testResults.totalTests} (${((testResults.passed/testResults.totalTests)*100).toFixed(1)}%)
❌ Niezaliczone: ${testResults.failed}
⚠️  Ostrzeżenia: ${testResults.warnings}
⏭️  Pominięte: ${testResults.skipped}
⏱️  Czas wykonania: ${(testResults.duration / 1000).toFixed(2)}s

${failedTests.length > 0 ? `## ❌ TESTY NIEZALICZONE (${failedTests.length})
${failedTests.map(t => `
### ${t.id}: ${t.name}
- **Kategoria:** ${t.category}
- **Komunikat:** ${t.message}
- **Czas:** ${t.duration}ms
${t.details ? `- **Szczegóły:** ${JSON.stringify(t.details, null, 2)}` : ''}
`).join('\n')}
` : ''}

${warningTests.length > 0 ? `## ⚠️  OSTRZEŻENIA (${warningTests.length})
${warningTests.map(t => `
### ${t.id}: ${t.name}
- **Kategoria:** ${t.category}
- **Komunikat:** ${t.message}
- **Czas:** ${t.duration}ms
`).join('\n')}
` : ''}

${skippedTests.length > 0 ? `## ⏭️  TESTY POMINIĘTE (${skippedTests.length})
${skippedTests.map(t => `- ${t.id}: ${t.message}`).join('\n')}
` : ''}

## 📊 SZCZEGÓŁOWA LISTA WSZYSTKICH TESTÓW
${testResults.results.map(t => {
  const icon = t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : t.status === 'warning' ? '⚠️' : '⏭️';
  return `${icon} [${t.category.toUpperCase()}] ${t.id}: ${t.name} - ${t.message} (${t.duration}ms)`;
}).join('\n')}

## 🔍 ANALIZA
- **Pass Rate:** ${((testResults.passed/testResults.totalTests)*100).toFixed(1)}%
- **Krytyczne problemy:** ${failedTests.filter(t => t.category === 'technical' || t.id.includes('sec')).length}
- **Wymagane akcje:** ${failedTests.length > 0 ? 'TAK - zobacz sekcję TESTY NIEZALICZONE' : 'NIE - wszystko działa poprawnie'}

---
Wygenerowano automatycznie przez panel administracyjny Okazje Plus
    `.trim();
    
    return report;
  };

  const copyReportToClipboard = () => {
    const report = generateSummaryReport();
    navigator.clipboard.writeText(report).then(() => {
      toast.success('Raport skopiowany do schowka!', {
        description: 'Możesz teraz wkleić go do narzędzia AI lub dokumentu'
      });
    }).catch((err) => {
      toast.error('Błąd kopiowania', { description: err.message });
    });
  };

  const downloadReport = () => {
    const report = generateSummaryReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Raport pobrany!');
  };
  const runTests = async () => {
    setIsRunning(true);
    setError(null);
    setTestResults(null);

    try {
      const response = await fetch('/api/admin/tests/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin' // TODO: Use real auth token
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTestResults(data.data);
      } else {
        setError(data.message || 'Test execution failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'skip':
        return <MinusCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pass: 'bg-green-100 text-green-800 border-green-200',
      fail: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-amber-100 text-amber-800 border-amber-200',
      skip: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    return (
      <Badge variant="outline" className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getCategoryIcon = (category: TestResult['category']) => {
    switch (category) {
      case 'technical':
        return <Code className="h-4 w-4" />;
      case 'functional':
        return <Settings className="h-4 w-4" />;
      case 'business':
        return <Briefcase className="h-4 w-4" />;
    }
  };

  const groupedResults = testResults?.results.reduce((acc, test) => {
    if (!acc[test.category]) {
      acc[test.category] = [];
    }
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, TestResult[]>);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>🧪 Testy Aplikacji</CardTitle>
              <CardDescription>
                Kompleksowe testy techniczne, funkcjonalne i biznesowe
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {testResults && (
                <>
                  <Button
                    onClick={copyReportToClipboard}
                    variant="outline"
                    size="lg"
                    className="gap-2"
                  >
                    <Copy className="h-5 w-5" />
                    Kopiuj Raport
                  </Button>
                  <Button
                    onClick={downloadReport}
                    variant="outline"
                    size="lg"
                    className="gap-2"
                  >
                    <Download className="h-5 w-5" />
                    Pobierz MD
                  </Button>
                </>
              )}
              <Button 
                onClick={runTests} 
                disabled={isRunning}
                size="lg"
                className="gap-2"
              >
                {isRunning ? (
                  <>
                    <Clock className="h-5 w-5 animate-spin" />
                    Wykonywanie testów...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5" />
                    Uruchom Testy
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Loading State */}
      {isRunning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Błąd wykonania testów</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {testResults && (
        <>
          {/* Quick Action Summary */}
          {(testResults.failed > 0 || testResults.warnings > 0) && (
            <Card className="border-2 border-amber-300 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Wymagane Działania
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResults.failed > 0 && (
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900">
                          {testResults.failed} {testResults.failed === 1 ? 'test niezaliczony' : 'testy niezaliczone'}
                        </p>
                        <p className="text-sm text-red-700">
                          Sprawdź szczegóły poniżej i popraw krytyczne problemy
                        </p>
                      </div>
                    </div>
                  )}
                  {testResults.warnings > 0 && (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900">
                          {testResults.warnings} {testResults.warnings === 1 ? 'ostrzeżenie' : 'ostrzeżenia'}
                        </p>
                        <p className="text-sm text-amber-700">
                          Przejrzyj i rozważ optymalizacje
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-amber-200">
                    <p className="text-sm text-amber-800">
                      💡 <strong>Wskazówka:</strong> Użyj przycisków "Kopiuj Raport" lub "Pobierz MD" aby przekazać wyniki do analizy AI
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Wszystkie testy</CardDescription>
                <CardTitle className="text-3xl">{testResults.totalTests}</CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-3">
                <CardDescription className="text-green-700">Zaliczone</CardDescription>
                <CardTitle className="text-3xl text-green-900">
                  {testResults.passed}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-3">
                <CardDescription className="text-red-700">Niezaliczone</CardDescription>
                <CardTitle className="text-3xl text-red-900">
                  {testResults.failed}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-3">
                <CardDescription className="text-amber-700">Ostrzeżenia</CardDescription>
                <CardTitle className="text-3xl text-amber-900">
                  {testResults.warnings}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Czas wykonania</CardDescription>
                <CardTitle className="text-3xl">
                  {(testResults.duration / 1000).toFixed(1)}s
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle>Szczegółowe Wyniki</CardTitle>
              <CardDescription>
                Ostatnie uruchomienie: {new Date(testResults.timestamp).toLocaleString('pl-PL')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  {/* Technical Tests */}
                  {groupedResults?.technical && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Code className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">Testy Techniczne</h3>
                        <Badge variant="secondary">{groupedResults.technical.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {groupedResults.technical.map((test) => (
                          <TestResultCard key={test.id} test={test} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Functional Tests */}
                  {groupedResults?.functional && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-semibold">Testy Funkcjonalne</h3>
                        <Badge variant="secondary">{groupedResults.functional.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {groupedResults.functional.map((test) => (
                          <TestResultCard key={test.id} test={test} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Business Tests */}
                  {groupedResults?.business && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="h-5 w-5 text-amber-600" />
                        <h3 className="text-lg font-semibold">Testy Biznesowe</h3>
                        <Badge variant="secondary">{groupedResults.business.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {groupedResults.business.map((test) => (
                          <TestResultCard key={test.id} test={test} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TestResultCard({ test }: { test: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  
  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'skip':
        return <MinusCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getBgColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200 hover:bg-green-100';
      case 'fail':
        return 'bg-red-50 border-red-200 hover:bg-red-100';
      case 'warning':
        return 'bg-amber-50 border-amber-200 hover:bg-amber-100';
      case 'skip':
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    }
  };

  return (
    <div 
      className={`border rounded-lg p-4 transition-colors cursor-pointer ${getBgColor(test.status)}`}
      onClick={() => test.details && setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {getStatusIcon(test.status)}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{test.name}</span>
              <span className="text-xs text-gray-500">#{test.id}</span>
            </div>
            <p className="text-sm text-gray-700">{test.message}</p>
            
            {/* Expanded Details */}
            {expanded && test.details && (
              <div className="mt-3 pt-3 border-t">
                <pre className="text-xs bg-white p-3 rounded overflow-x-auto">
                  {JSON.stringify(test.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-gray-500">{test.duration}ms</div>
        </div>
      </div>
    </div>
  );
}
