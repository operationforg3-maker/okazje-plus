'use client';

import { useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Database,
  Play,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Package,
  Flame,
  RefreshCw
} from 'lucide-react';

function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [seedingStatus, setSeedingStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  const handleFillCatalog = async () => {
    if (!confirm('To wypełni bazę kategoriami i produktami z AliExpress. Kontynuować?')) return;
    
    setLoading(true);
    setSeedingStatus('running');
    setResult('🚀 Rozpoczynam wypełnianie katalogu...\n\nTo może zająć kilka minut. Proszę czekać...');
    
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'fillCategoriesWithProducts' })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.result || 'Nieznany błąd serwera'}`);
        setSeedingStatus('error');
        return;
      }
      
      const data = await res.json();
      setResult(data.result || '✅ Zakończono!');
      setSeedingStatus('success');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message || 'Sprawdź połączenie z internetem'}`);
      setSeedingStatus('error');
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDeals = async () => {
    if (!confirm('To pobierze deale (promocje >50% zniżki) z AliExpress API. Kontynuować?')) return;
    
    setLoading(true);
    setSeedingStatus('running');
    setResult('🔥 Pobieram deale z AliExpress...\n\nSzukam promocji >50% zniżki...');
    
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'fillCategoriesWithDeals' })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.result || 'Nieznany błąd serwera'}`);
        setSeedingStatus('error');
        return;
      }
      
      const data = await res.json();
      setResult(data.result || '✅ Deale pobrane z AliExpress!');
      setSeedingStatus('success');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message}`);
      setSeedingStatus('error');
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (!confirm('⚠️ UWAGA! To usunie WSZYSTKIE produkty i deale. Czy na pewno?')) return;
    if (!confirm('To jest nieodwracalne. Ostatnia szansa - kontynuować?')) return;
    
    setLoading(true);
    setSeedingStatus('running');
    setResult('🗑️ Czyszczenie bazy danych...\n\nUsuwam produkty i deale...');
    
    try {
      const res = await fetch('/api/admin/ai/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.message || 'Nieznany błąd serwera'}`);
        setSeedingStatus('error');
        return;
      }
      
      const data = await res.json();
      setResult(data.message || '✅ Baza danych wyczyszczona');
      setSeedingStatus('success');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message}`);
      setSeedingStatus('error');
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Konfiguracja i Seeding Platformy
        </h2>
        <p className="text-muted-foreground mt-2">
          Zarządzanie początkową konfiguracją, wypełnianie bazy danych i narzędzia deweloperskie
        </p>
      </div>

      <Tabs defaultValue="seeding" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="seeding" className="gap-2">
            <Database className="h-4 w-4" />
            Seeding Danych
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Konfiguracja
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Konserwacja
          </TabsTrigger>
        </TabsList>

        {/* SEEDING TAB */}
        <TabsContent value="seeding" className="space-y-6">
          {/* Status Alert */}
          {seedingStatus !== 'idle' && (
            <Alert variant={seedingStatus === 'error' ? 'destructive' : 'default'}>
              {seedingStatus === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
              {seedingStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {seedingStatus === 'error' && <AlertCircle className="h-4 w-4" />}
              <AlertDescription>
                {seedingStatus === 'running' && 'Operacja w toku... Proszę czekać.'}
                {seedingStatus === 'success' && 'Operacja zakończona pomyślnie!'}
                {seedingStatus === 'error' && 'Wystąpił błąd podczas operacji.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fill Catalog */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all border-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="secondary">~300 produktów</Badge>
                </div>
                <CardTitle className="text-xl">Wypełnij Katalog</CardTitle>
                <CardDescription>
                  Tworzy strukturę kategorii i pobiera produkty z AliExpress API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Kategorie jak Pepper.pl</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Produkty z AliExpress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>AI-enhanced metadata</span>
                  </li>
                </ul>
                <Button
                  onClick={handleFillCatalog}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Przetwarzam...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Uruchom
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Fetch Deals */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all border-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                    <Flame className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="secondary">~100 deali</Badge>
                </div>
                <CardTitle className="text-xl">Pobierz Deale</CardTitle>
                <CardDescription>
                  Agreguje gorące okazje (promocje &gt;50% zniżki) z AliExpress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span>Promocje &gt;50% zniżki</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span>Dla każdej kategorii</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span>Real-time z API</span>
                  </li>
                </ul>
                <Button
                  onClick={handleFetchDeals}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Pobieram...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Uruchom
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Wipe Database */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all border-2 border-red-200 dark:border-red-900/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-600/20 to-red-600/20 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg group-hover:bg-gradient-to-br group-hover:from-red-600 group-hover:to-red-800 transition-all">
                    <Trash2 className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="destructive">⚠️ Ostrożnie</Badge>
                </div>
                <CardTitle className="text-xl">Wyczyść Bazę</CardTitle>
                <CardDescription>
                  Usuwa WSZYSTKIE produkty i deale z bazy danych
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Nieodwracalne usunięcie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Wszystkie produkty i deale</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Przed re-seedowaniem</span>
                  </li>
                </ul>
                <Button
                  onClick={handleWipeDatabase}
                  disabled={loading}
                  variant="destructive"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Czyszczę...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Wyczyść
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Result Display */}
          {result && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Wynik operacji
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono overflow-x-auto">
                  {result}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="text-base">ℹ️ Jak to działa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Wypełnij Katalog:</strong> Tworzy strukturę kategorii (jak Pepper.pl) i pobiera produkty z AliExpress API</p>
              <p><strong>Pobierz Deale:</strong> Agreguje gorące okazje (promocje &gt; 50% zniżki) z AliExpress dla każdej kategorii</p>
              <p><strong>Wyczyść Bazę:</strong> Usuwa wszystkie produkty i deale (przydatne przed re-seedowaniem)</p>
              <p className="text-amber-700 dark:text-amber-400 flex items-start gap-2 mt-4">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span><strong>Ważne:</strong> To agregator - produkty i deale pochodzą z AliExpress, nie są generowane sztucznie. Proces może zająć kilka minut w zależności od ilości kategorii.</span>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Konfiguracja Firebase</CardTitle>
              <CardDescription>Ustawienia połączenia z Firebase i Google Cloud</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project ID</label>
                  <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                    okazje-plus
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Region</label>
                  <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                    europe-west1
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Storage Bucket</label>
                  <div className="p-3 bg-muted rounded-lg font-mono text-sm truncate">
                    okazje-plus.firebasestorage.app
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Auth Domain</label>
                  <div className="p-3 bg-muted rounded-lg font-mono text-sm truncate">
                    okazje-plus.firebaseapp.com
                  </div>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Zmiana konfiguracji Firebase wymaga aktualizacji zmiennych środowiskowych w pliku <code className="font-mono">.env.local</code>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integracje API</CardTitle>
              <CardDescription>Konfiguracja zewnętrznych serwisów</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">AliExpress API</div>
                    <div className="text-sm text-muted-foreground">Import produktów i deali</div>
                  </div>
                  <Badge variant="default">Aktywne</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">Google Analytics 4</div>
                    <div className="text-sm text-muted-foreground">G-4M4NQB0PQD</div>
                  </div>
                  <Badge variant="default">Aktywne</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">Typesense Search</div>
                    <div className="text-sm text-muted-foreground">AI-powered search</div>
                  </div>
                  <Badge variant="secondary">Opcjonalne</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">SendGrid Email</div>
                    <div className="text-sm text-muted-foreground">Notyfikacje email</div>
                  </div>
                  <Badge variant="default">Aktywne</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAINTENANCE TAB */}
        <TabsContent value="maintenance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Zadania konserwacyjne</CardTitle>
              <CardDescription>Rutynowe zadania i czyszczenie bazy danych</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Odśwież indeksy Firestore
                </Button>
                <Button variant="outline" className="justify-start">
                  <Database className="mr-2 h-4 w-4" />
                  Backup bazy danych
                </Button>
                <Button variant="outline" className="justify-start">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Usuń stare wersje
                </Button>
                <Button variant="outline" className="justify-start">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Weryfikuj linki produktów
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cloud Functions</CardTitle>
              <CardDescription>Status funkcji serverless</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">trackShareStats</div>
                    <div className="text-sm text-muted-foreground">Tracking udostępnień</div>
                  </div>
                  <Badge variant="secondary">Pending Deploy</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">checkSavedSearches</div>
                    <div className="text-sm text-muted-foreground">Alerty dla zapisanych wyszukiwań</div>
                  </div>
                  <Badge variant="secondary">Pending Deploy</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">sendWeeklyDigest</div>
                    <div className="text-sm text-muted-foreground">Cotygodniowy newsletter</div>
                  </div>
                  <Badge variant="secondary">Pending Deploy</Badge>
                </div>
              </div>
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aby wdrożyć funkcje, uruchom: <code className="font-mono">firebase deploy --only functions</code>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(SetupPage);
