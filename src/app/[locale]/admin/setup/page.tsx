'use client';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { auth } from '@/lib/firebase';
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
  RefreshCw,
  Clock,
  Calendar,
  Link2,
  ListTree,
  XCircle
} from 'lucide-react';
import { ImportSystemsComparison } from '@/components/admin/import-systems-comparison';
import { ImportProgress, ImportLog, ImportStats, ImportStatus } from '@/components/admin/import-progress';

function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [seedingStatus, setSeedingStatus] = useState<ImportStatus>('idle');
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [importStats, setImportStats] = useState<ImportStats>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Load auth token on mount
  useEffect(() => {
    const loadToken = async () => {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        setAuthToken(token);
      }
    };
    loadToken();
  }, []);
  
  // Scheduled import state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [nextRun, setNextRun] = useState<string | null>(null);
  
  // Indexes verification state
  const [indexesResult, setIndexesResult] = useState('');
  const [indexesLoading, setIndexesLoading] = useState(false);
  const [indexesScheduleEnabled, setIndexesScheduleEnabled] = useState(false);
  const [indexesScheduleFrequency, setIndexesScheduleFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [indexesScheduleTime, setIndexesScheduleTime] = useState('03:00');
  const [indexesAutoFix, setIndexesAutoFix] = useState(false);
  const [indexesLastRun, setIndexesLastRun] = useState<string | null>(null);
  const [indexesNextRun, setIndexesNextRun] = useState<string | null>(null);
  
  // Links verification state
  const [linksResult, setLinksResult] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksScheduleEnabled, setLinksScheduleEnabled] = useState(false);
  const [linksScheduleFrequency, setLinksScheduleFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [linksScheduleTime, setLinksScheduleTime] = useState('04:00');
  const [linksAutoDisable, setLinksAutoDisable] = useState(false);
  const [linksNotifyAdmin, setLinksNotifyAdmin] = useState(true);
  const [linksLastRun, setLinksLastRun] = useState<string | null>(null);
  const [linksNextRun, setLinksNextRun] = useState<string | null>(null);

  // Load indexes schedule on mount
  useEffect(() => {
    const loadIndexesSchedule = async () => {
      try {
        const res = await fetch('/api/admin/schedule/indexes', {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setIndexesScheduleEnabled(data.enabled || false);
          setIndexesScheduleFrequency(data.frequency || 'daily');
          setIndexesScheduleTime(data.time || '03:00');
          setIndexesAutoFix(data.autoFix || false);
          setIndexesLastRun(data.lastRun || null);
          setIndexesNextRun(data.nextRun || null);
        }
      } catch (e) {
        console.error('Failed to load indexes schedule:', e);
      }
    };
    if (authToken) loadIndexesSchedule();
  }, [authToken]);

  // Load links schedule on mount
  useEffect(() => {
    const loadLinksSchedule = async () => {
      try {
        const res = await fetch('/api/admin/schedule/links', {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setLinksScheduleEnabled(data.enabled || false);
          setLinksScheduleFrequency(data.frequency || 'daily');
          setLinksScheduleTime(data.time || '04:00');
          setLinksAutoDisable(data.autoDisable || false);
          setLinksNotifyAdmin(data.notifyAdmin || true);
          setLinksLastRun(data.lastRun || null);
          setLinksNextRun(data.nextRun || null);
        }
      } catch (e) {
        console.error('Failed to load links schedule:', e);
      }
    };
    if (authToken) loadLinksSchedule();
  }, [authToken]);

  const [categoryMode, setCategoryMode] = useState<'seeds-only' | 'ai-only' | 'hybrid'>('seeds-only');
  const [categoryPrompt, setCategoryPrompt] = useState('');

  const addLog = (level: ImportLog['level'], message: string, details?: string) => {
    setImportLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    }]);
  };

  const handleCreateCategories = async () => {
    if (!confirm('To utworzy strukturę kategorii. Kontynuować?')) return;
    
    setLoading(true);
    setSeedingStatus('running');
    setStartedAt(new Date().toISOString());
    setImportLogs([]);
    setImportStats({});
    setResult('📁 Tworzę strukturę kategorii...\n\nTo może zająć chwilę...');
    addLog('info', 'Rozpoczęto tworzenie struktury kategorii', `Tryb: ${categoryMode}`);
    
    try {
      const useAi = categoryMode !== 'seeds-only';
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify(
          useAi
            ? { command: 'generateCategoriesAI', params: { mode: categoryMode, prompt: categoryPrompt || undefined } }
            : { command: 'createCategoryStructure' }
        )
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.result || 'Nieznany błąd serwera'}`);
        setSeedingStatus('error');
        return;
      }
      
      const data = await res.json();
      setResult(data.result || '✅ Struktura kategorii utworzona!');
      setSeedingStatus('completed');
      addLog('success', 'Struktura kategorii utworzona pomyślnie');
      setImportStats({ saved: data.categoriesCreated || 0 });
    } catch (e: any) {
      const errorMsg = e.message || 'Sprawdź połączenie z internetem';
      setResult(`❌ Błąd połączenia: ${errorMsg}`);
      setSeedingStatus('failed');
      addLog('error', 'Błąd podczas tworzenia kategorii', errorMsg);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFillWithProducts = async () => {
    if (!confirm('To wypełni istniejące kategorie produktami z AliExpress API. Kontynuować?')) return;
    
    setLoading(true);
    setSeedingStatus('running');
    setStartedAt(new Date().toISOString());
    setImportLogs([]);
    setResult('📦 Pobieram produkty z AliExpress...\n\nTo może zająć kilka minut. Proszę czekać...');
    addLog('info', 'Rozpoczęto pobieranie produktów z AliExpress');
    
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({ command: 'fillCategoriesWithProducts' })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.result || 'Nieznany błąd serwera'}`);
        setSeedingStatus('error');
        return;
      }
      
      const data = await res.json();
      setResult(data.result || '✅ Produkty dodane!');
      setSeedingStatus('completed');
      addLog('success', 'Produkty dodane pomyślnie');
      setImportStats({ fetched: data.productsFetched || 0, saved: data.productsSaved || 0 });
    } catch (e: any) {
      const errorMsg = e.message || 'Sprawdź połączenie z internetem';
      setResult(`❌ Błąd połączenia: ${errorMsg}`);
      setSeedingStatus('failed');
      addLog('error', 'Błąd podczas pobierania produktów', errorMsg);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDeals = async () => {
    if (!confirm('To pobierze deale (promocje >50% zniżki) z AliExpress API. Kontynuować?')) return;
    
    setLoading(true);
    setSeedingStatus('running');
    setStartedAt(new Date().toISOString());
    setImportLogs([]);
    setResult('🔥 Pobieram deale z AliExpress...\n\nSzukam promocji >50% zniżki...');
    addLog('info', 'Rozpoczęto pobieranie deali z AliExpress', 'Promocje >50% zniżki');
    
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
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
      setSeedingStatus('completed');
      addLog('success', 'Deale pobrane pomyślnie');
      setImportStats({ fetched: data.dealsFetched || 0, saved: data.dealsSaved || 0 });
    } catch (e: any) {
      const errorMsg = e.message;
      setResult(`❌ Błąd połączenia: ${errorMsg}`);
      setSeedingStatus('failed');
      addLog('error', 'Błąd podczas pobierania deali', errorMsg);
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
    setStartedAt(new Date().toISOString());
    setImportLogs([]);
    setResult('🗑️ Czyszczenie bazy danych...\n\nUsuwam produkty i deale...');
    addLog('warning', 'Rozpoczęto czyszczenie bazy danych', 'NIEODWRACALNE');
    
    try {
      const res = await fetch('/api/admin/ai/wipe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.message || 'Nieznany błąd serwera'}`);
        setSeedingStatus('error');
        return;
      }
      
      const data = await res.json();
      setResult(data.message || '✅ Baza danych wyczyszczona');
      setSeedingStatus('completed');
      addLog('success', 'Baza danych wyczyszczona', `Usunięto: ${data.deleted || 0} elementów`);
    } catch (e: any) {
      const errorMsg = e.message;
      setResult(`❌ Błąd połączenia: ${errorMsg}`);
      setSeedingStatus('failed');
      addLog('error', 'Błąd podczas czyszczenia bazy', errorMsg);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async () => {
    const newEnabled = !scheduleEnabled;
    setScheduleEnabled(newEnabled);
    
    // TODO: Call backend API to save schedule config
    try {
      const res = await fetch('/api/admin/schedule/deals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          enabled: newEnabled,
          frequency: scheduleFrequency,
          time: scheduleTime
        })
      });
      
      if (!res.ok) {
        setScheduleEnabled(!newEnabled); // revert on error
        alert('Błąd zapisu harmonogramu');
        return;
      }
      
      const data = await res.json();
      if (data.nextRun) {
        setNextRun(data.nextRun);
      }
    } catch (e) {
      console.error('Schedule error:', e);
      setScheduleEnabled(!newEnabled); // revert on error
    }
  };

  const handleTestRun = async () => {
    if (!confirm('Uruchomić testowy import deals? To może zająć kilka minut.')) return;
    await handleFetchDeals();
  };

  const handleVerifyIndexes = async () => {
    setIndexesLoading(true);
    setIndexesResult('🔍 Weryfikacja indeksów Firestore...\n');
    
    try {
      const res = await fetch('/api/admin/indexes/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({ action: 'verify' })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setIndexesResult(`❌ Błąd ${res.status}: ${errorData.error || 'Nieznany błąd'}`);
        return;
      }
      
      const data = await res.json();
      
      let resultText = `${data.message}\n\n`;
      resultText += `📊 Podsumowanie:\n`;
      resultText += `  • Wszystkich indeksów: ${data.summary.total}\n`;
      resultText += `  • Istnieje: ${data.summary.existing}\n`;
      resultText += `  • Brakuje: ${data.summary.missing}\n\n`;
      
      if (data.summary.missing > 0) {
        resultText += `❌ Brakujące indeksy:\n`;
        data.indexes.filter((idx: any) => !idx.exists).forEach((idx: any) => {
          resultText += `  • ${idx.collection}: ${idx.fields}\n`;
          if (idx.consoleUrl) {
            resultText += `    👉 ${idx.consoleUrl}\n`;
          }
        });
        resultText += `\n💡 Kliknij linki powyżej aby utworzyć indeksy w konsoli Firebase.\n`;
      }
      
      setIndexesResult(resultText);
      
      // Update last run timestamp
      setIndexesLastRun(new Date().toISOString());
    } catch (e: any) {
      setIndexesResult(`❌ Błąd połączenia: ${e.message}`);
    } finally {
      setIndexesLoading(false);
    }
  };

  const handleToggleIndexesSchedule = async () => {
    const newEnabled = !indexesScheduleEnabled;
    setIndexesScheduleEnabled(newEnabled);
    
    try {
      const res = await fetch('/api/admin/schedule/indexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken && { 'Authorization': `Bearer ${authToken}` }) },
        body: JSON.stringify({
          enabled: newEnabled,
          frequency: indexesScheduleFrequency,
          time: indexesScheduleTime,
          autoFix: indexesAutoFix
        })
      });
      
      if (!res.ok) {
        setIndexesScheduleEnabled(!newEnabled); // revert on error
        alert('Błąd zapisu harmonogramu');
        return;
      }
      
      const data = await res.json();
      if (data.nextRun) {
        setIndexesNextRun(data.nextRun);
      }
    } catch (e) {
      console.error('Schedule error:', e);
      setIndexesScheduleEnabled(!newEnabled); // revert on error
    }
  };

  const handleVerifyLinks = async (updateLinks = false) => {
    setLinksLoading(true);
    setLinksResult(`🔍 ${updateLinks ? 'Aktualizacja' : 'Weryfikacja'} linków afiliacyjnych...\n`);
    
    try {
      const res = await fetch('/api/admin/links/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken && { 'Authorization': `Bearer ${authToken}` }) },
        body: JSON.stringify({ 
          action: updateLinks ? 'update' : 'verify',
          limit: 1000 // Check up to 1000 items
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setLinksResult(`❌ Błąd ${res.status}: ${errorData.error || 'Nieznany błąd'}`);
        return;
      }
      
      const data = await res.json();
      
      let resultText = `${data.message}\n\n`;
      resultText += `📊 Podsumowanie:\n`;
      resultText += `  • Sprawdzono: ${data.stats.total} linków\n`;
      resultText += `  • Linki afiliacyjne: ${data.stats.affiliate}\n`;
      resultText += `  • Bez afiliacji: ${data.stats.nonAffiliate}\n`;
      
      if (updateLinks && data.stats.updated > 0) {
        resultText += `  • ✅ Zaktualizowano: ${data.stats.updated}\n`;
      }
      
      if (data.stats.errors > 0) {
        resultText += `  • ⚠️ Błędy: ${data.stats.errors}\n`;
      }
      
      setLinksResult(resultText);
      
      // Update last run timestamp
      setLinksLastRun(new Date().toISOString());
    } catch (e: any) {
      setLinksResult(`❌ Błąd połączenia: ${e.message}`);
    } finally {
      setLinksLoading(false);
    }
  };

  const handleToggleLinksSchedule = async () => {
    const newEnabled = !linksScheduleEnabled;
    setLinksScheduleEnabled(newEnabled);
    
    try {
      const res = await fetch('/api/admin/schedule/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: newEnabled,
          frequency: linksScheduleFrequency,
          time: linksScheduleTime,
          autoDisable: linksAutoDisable,
          notifyAdmin: linksNotifyAdmin
        })
      });
      
      if (!res.ok) {
        setLinksScheduleEnabled(!newEnabled); // revert on error
        alert('Błąd zapisu harmonogramu');
        return;
      }
      
      const data = await res.json();
      if (data.nextRun) {
        setLinksNextRun(data.nextRun);
      }
    } catch (e) {
      console.error('Schedule error:', e);
      setLinksScheduleEnabled(!newEnabled); // revert on error
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
          {/* System Comparison */}
          <ImportSystemsComparison currentSystem="setup" variant="compact" />

          {/* Progress Tracker */}
          {seedingStatus !== 'idle' && (
            <ImportProgress
              status={seedingStatus}
              stats={importStats}
              logs={importLogs}
              startedAt={startedAt || undefined}
              completedAt={seedingStatus === 'completed' || seedingStatus === 'failed' ? new Date().toISOString() : undefined}
              systemType="setup"
            />
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Create Categories Structure */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all border-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="secondary">Krok 1</Badge>
                </div>
                <CardTitle className="text-xl">Utwórz Kategorie</CardTitle>
                <CardDescription>
                  Tworzy 3-poziomową strukturę kategorii (Seed/AI/Hybryda)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tryb tworzenia kategorii</label>
                  <select
                    value={categoryMode}
                    onChange={(e) => setCategoryMode(e.target.value as any)}
                    className="w-full p-2 text-sm border rounded-md bg-background"
                    disabled={loading}
                  >
                    <option value="seeds-only">Z seedów (statyczne)</option>
                    <option value="ai-only">AI (na podstawie promptu)</option>
                    <option value="hybrid">Hybryda (seedy + AI)</option>
                  </select>
                </div>
                {categoryMode !== 'seeds-only' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prompt dla AI</label>
                    <textarea
                      value={categoryPrompt}
                      onChange={(e) => setCategoryPrompt(e.target.value)}
                      placeholder="Np. Rozszerz elektronikę o smart home, wearables, narzędzia pomiarowe; dodaj zwierzęta i biuro"
                      className="w-full p-2 text-sm border rounded-md bg-background h-24"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">AI wygeneruje drzewo (3 poziomy) po polsku z poprawnymi slugami.</p>
                  </div>
                )}
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>15+ kategorii głównych (rozszerzone)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>70+ podkategorii</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>350+ sub-podkategorii</span>
                  </li>
                </ul>
                <Button
                  onClick={handleCreateCategories}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tworzę...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Utwórz
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Fill with Products */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all border-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="secondary">Krok 2</Badge>
                </div>
                <CardTitle className="text-xl">Wypełnij Produktami</CardTitle>
                <CardDescription>
                  Pobiera produkty z AliExpress API do istniejących kategorii
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>Produkty z AliExpress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>AI-enhanced metadata</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>~300 produktów</span>
                  </li>
                </ul>
                <Button
                  onClick={handleFillWithProducts}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Przetwarzam...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Wypełnij
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

            {/* Scheduled Import */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all border-2 border-purple-200 dark:border-purple-900/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-bl-full" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant={scheduleEnabled ? "default" : "secondary"} className={scheduleEnabled ? "bg-green-600" : ""}>
                    {scheduleEnabled ? '✓ Aktywny' : 'Nieaktywny'}
                  </Badge>
                </div>
                <CardTitle className="text-xl">Harmonogram Import</CardTitle>
                <CardDescription>
                  Automatyczny import deals według harmonogramu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {/* Frequency selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Częstotliwość</label>
                    <select 
                      value={scheduleFrequency}
                      onChange={(e) => setScheduleFrequency(e.target.value as any)}
                      className="w-full p-2 text-sm border rounded-md bg-background"
                      disabled={scheduleEnabled}
                    >
                      <option value="hourly">Co godzinę</option>
                      <option value="daily">Codziennie</option>
                      <option value="weekly">Co tydzień</option>
                    </select>
                  </div>
                  
                  {/* Time picker */}
                  {scheduleFrequency !== 'hourly' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Godzina uruchomienia</label>
                      <input 
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full p-2 text-sm border rounded-md bg-background"
                        disabled={scheduleEnabled}
                      />
                    </div>
                  )}
                  
                  {/* Status info */}
                  {lastRun && (
                    <div className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Ostatni: {new Date(lastRun).toLocaleString('pl-PL')}
                    </div>
                  )}
                  {nextRun && scheduleEnabled && (
                    <div className="text-xs text-green-600">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Następny: {new Date(nextRun).toLocaleString('pl-PL')}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Button
                    onClick={handleToggleSchedule}
                    disabled={loading}
                    className="w-full"
                    variant={scheduleEnabled ? "destructive" : "default"}
                  >
                    {scheduleEnabled ? (
                      <>
                        <Clock className="mr-2 h-4 w-4" />
                        Wyłącz
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Włącz
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleTestRun}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Test
                  </Button>
                </div>
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
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 mt-4">
                <p className="flex items-start gap-2 text-green-800 dark:text-green-300">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Treści po polsku:</strong> AI automatycznie tłumaczy wszystkie tytuły, opisy i cechy produktów z AliExpress na <strong>przyjazny język polski</strong> z zachowaniem dokładności specyfikacji technicznych.</span>
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 mt-2">
                <p className="flex items-start gap-2 text-blue-800 dark:text-blue-300">
                  <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Wyszukiwarka:</strong> Typesense Search jest <strong>aktywna</strong> i indeksuje polskie treści dla szybkiego wyszukiwania pełnotekstowego. Fallback do Firestore jeśli Typesense niedostępny.</span>
                </p>
              </div>
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
                    <div className="text-sm text-muted-foreground">
                      AI-powered search • Konfiguracja w Secret Manager
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    Aktywne
                  </Badge>
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
          {/* Indexes Verification */}
          <Card className="border-2 border-blue-200 dark:border-blue-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListTree className="h-5 w-5 text-blue-600" />
                    Weryfikacja Indeksów Firestore
                  </CardTitle>
                  <CardDescription>
                    Sprawdza czy wszystkie wymagane indeksy są utworzone w Firestore
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  10+ indeksów
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Indeksy Firestore są wymagane dla złożonych zapytań. Brak indeksów powoduje błędy w aplikacji.
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Deals (status, temperature, category)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Products (status, category, createdAt)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Comments, Votes, User Activity
                  </li>
                </ul>
              </div>
              
              {/* Scheduling Controls */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Harmonogram weryfikacji</label>
                  <Badge variant={indexesScheduleEnabled ? "default" : "secondary"}>
                    {indexesScheduleEnabled ? "Aktywny" : "Nieaktywny"}
                  </Badge>
                </div>
                
                <div className="grid gap-3">
                  {/* Frequency selector */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Częstotliwość</label>
                    <select
                      value={indexesScheduleFrequency}
                      onChange={(e) => setIndexesScheduleFrequency(e.target.value as 'hourly' | 'daily' | 'weekly')}
                      className="w-full p-2 text-sm border rounded-md bg-background"
                      disabled={indexesScheduleEnabled}
                    >
                      <option value="hourly">Co godzinę</option>
                      <option value="daily">Codziennie</option>
                      <option value="weekly">Co tydzień</option>
                    </select>
                  </div>
                  
                  {/* Time picker for daily/weekly */}
                  {(indexesScheduleFrequency === 'daily' || indexesScheduleFrequency === 'weekly') && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Godzina {indexesScheduleFrequency === 'weekly' ? '(poniedziałek)' : ''}
                      </label>
                      <input
                        type="time"
                        value={indexesScheduleTime}
                        onChange={(e) => setIndexesScheduleTime(e.target.value)}
                        className="w-full p-2 text-sm border rounded-md bg-background"
                        disabled={indexesScheduleEnabled}
                      />
                    </div>
                  )}
                  
                  {/* Auto-fix checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="indexesAutoFix"
                      checked={indexesAutoFix}
                      onChange={(e) => setIndexesAutoFix(e.target.checked)}
                      disabled={indexesScheduleEnabled}
                      className="h-4 w-4"
                    />
                    <label htmlFor="indexesAutoFix" className="text-sm">
                      Automatycznie generuj brakujące indeksy
                    </label>
                  </div>
                  
                  {/* Status info */}
                  {indexesLastRun && (
                    <div className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Ostatni: {new Date(indexesLastRun).toLocaleString('pl-PL')}
                    </div>
                  )}
                  {indexesNextRun && indexesScheduleEnabled && (
                    <div className="text-xs text-green-600">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Następny: {new Date(indexesNextRun).toLocaleString('pl-PL')}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Button
                  onClick={handleToggleIndexesSchedule}
                  disabled={indexesLoading}
                  className="w-full"
                  variant={indexesScheduleEnabled ? "destructive" : "default"}
                >
                  {indexesScheduleEnabled ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Wyłącz harmonogram
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Włącz harmonogram
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleVerifyIndexes}
                  disabled={indexesLoading}
                  variant="outline"
                  className="w-full"
                >
                  {indexesLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sprawdzam...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Test weryfikacji
                    </>
                  )}
                </Button>
              </div>
              
              {indexesResult && (
                <div className="mt-4">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    {indexesResult}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Links Verification */}
          <Card className="border-2 border-green-200 dark:border-green-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-green-600" />
                    Weryfikacja Linków Afiliacyjnych
                  </CardTitle>
                  <CardDescription>
                    Sprawdza i aktualizuje linki do produktów/deals na afiliacyjne
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  Auto-update
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Wszystkie linki powinny być linkami afiliacyjnymi aby generować przychód z prowizji.
                </p>
                <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <strong>Ważne:</strong> Linki afiliacyjne zawierają parametry trackingowe (aff_, tag=, ref=). 
                    Narzędzie automatycznie konwertuje standardowe linki na afiliacyjne.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Scheduling Section */}
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium">Harmonogram automatycznej weryfikacji</h4>
                  </div>
                  <Button
                    onClick={handleToggleLinksSchedule}
                    variant={linksScheduleEnabled ? "destructive" : "default"}
                    size="sm"
                  >
                    {linksScheduleEnabled ? (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Wyłącz
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Włącz
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Częstotliwość</label>
                    <select
                      value={linksScheduleFrequency}
                      onChange={(e) => setLinksScheduleFrequency(e.target.value as 'hourly' | 'daily' | 'weekly')}
                      disabled={linksScheduleEnabled}
                      className="w-full p-2 border rounded-md bg-background"
                    >
                      <option value="hourly">Co godzinę</option>
                      <option value="daily">Codziennie</option>
                      <option value="weekly">Co tydzień</option>
                    </select>
                  </div>

                  {(linksScheduleFrequency === 'daily' || linksScheduleFrequency === 'weekly') && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Godzina wykonania</label>
                      <input
                        type="time"
                        value={linksScheduleTime}
                        onChange={(e) => setLinksScheduleTime(e.target.value)}
                        disabled={linksScheduleEnabled}
                        className="w-full p-2 border rounded-md bg-background"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="linksAutoDisable"
                      checked={linksAutoDisable}
                      onChange={(e) => setLinksAutoDisable(e.target.checked)}
                      disabled={linksScheduleEnabled}
                      className="w-4 h-4"
                    />
                    <label htmlFor="linksAutoDisable" className="text-sm">
                      Automatycznie wyłączaj zepsute linki
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="linksNotifyAdmin"
                      checked={linksNotifyAdmin}
                      onChange={(e) => setLinksNotifyAdmin(e.target.checked)}
                      disabled={linksScheduleEnabled}
                      className="w-4 h-4"
                    />
                    <label htmlFor="linksNotifyAdmin" className="text-sm">
                      Powiadom admina o zepsutych linkach
                    </label>
                  </div>
                </div>

                {linksScheduleEnabled && linksNextRun && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                    <Clock className="h-4 w-4" />
                    <span>Następne uruchomienie: {new Date(linksNextRun).toLocaleString('pl-PL')}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => handleVerifyLinks(false)}
                  disabled={linksLoading}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                >
                  {linksLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sprawdzam...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Tylko Weryfikuj
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => handleVerifyLinks(true)}
                  disabled={linksLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {linksLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aktualizuję...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Weryfikuj i Aktualizuj
                    </>
                  )}
                </Button>
              </div>
              
              {linksResult && (
                <div className="mt-4">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono overflow-x-auto">
                    {linksResult}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zadania konserwacyjne</CardTitle>
              <CardDescription>Rutynowe zadania i czyszczenie bazy danych</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start" disabled>
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
