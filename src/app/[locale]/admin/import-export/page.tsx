"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { JobsMonitor } from '@/components/admin/jobs-monitor';
import Link from 'next/link';
import { AlertTriangle, Database, Layers, ShieldAlert, Sparkles, Trash2, Upload, Wrench } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminImportExportPage() {
  const { getIdToken } = useAuth();
  const [loadingKill, setLoadingKill] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingDeleteProducts, setLoadingDeleteProducts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [fetchType, setFetchType] = useState<'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct'>('hot-products');
  const [fetchMaxItems, setFetchMaxItems] = useState(10);
  const [fetchMaxBatches, setFetchMaxBatches] = useState(3);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [summary, setSummary] = useState<{ products?: { draft: number; approved: number }; recentJobs?: any[] }>({});
  const [catTree, setCatTree] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [selectedSubSub, setSelectedSubSub] = useState<string>('');
  const [jobsFilter, setJobsFilter] = useState<'all' | 'running' | 'completed' | 'failed' | 'queued'>('all');
  const [fullImportType, setFullImportType] = useState<'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct'>('hot-products');
  const [fullImportMax, setFullImportMax] = useState(10);
  const [loadingFullImport, setLoadingFullImport] = useState(false);

  useEffect(() => {
    // Load dashboard summary and categories tree
    const load = async () => {
      try {
        const token = await getIdToken();
        const [s, t] = await Promise.all([
          fetch('/api/admin/import/dashboard/summary', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/categories/tree', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const sJson = await s.json();
        const tJson = await t.json();
        if (s.ok) setSummary(sJson);
        if (t.ok) setCatTree(tJson.tree || []);
      } catch {}
    };
    load();
  }, [getIdToken]);

  const killAll = async () => {
    if (!confirm('Na pewno zatrzymać WSZYSTKIE zadania importu?')) return;
    try {
      setLoadingKill(true);
      const token = await getIdToken();
      const res = await fetch('/api/admin/import/kill-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Kill all failed');
      const data = await res.json();
      toast.success(`Zatrzymano ${data.results?.killed ?? 0} zadań`);
    } catch (e:any) {
      toast.error(e.message || 'Kill all failed');
    } finally {
      setLoadingKill(false);
    }
  };
  const runFullImport = async () => {
    try {
      setLoadingFullImport(true);
      const token = await getIdToken();
      const res = await fetch('/api/admin/import/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'products', importerType: fullImportType, maxItemsPerSubcategory: fullImportMax })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Full import failed');
      toast.success(`Job uruchomiony: ${data.jobId}`);
    } catch (e:any) {
      toast.error(e.message || 'Full import failed');
    } finally {
      setLoadingFullImport(false);
    }
  };

  const runTranslateDrafts = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/products/translate-drafts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 100,
          mainCategorySlug: selectedCat || undefined,
          subCategorySlug: selectedSub || undefined,
          subSubCategorySlug: selectedSubSub || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Translate failed');
      toast.success(`Przetłumaczono szkice: ${data.updated}`);
    } catch (e:any) {
      toast.error(e.message || 'Translate failed');
    }
  };

  const runEnrichDrafts = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/products/enrich-drafts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 100,
          mainCategorySlug: selectedCat || undefined,
          subCategorySlug: selectedSub || undefined,
          subSubCategorySlug: selectedSubSub || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Enrich failed');
      toast.success(`Wzbogacono szkice: ${data.updated}`);
    } catch (e:any) {
      toast.error(e.message || 'Enrich failed');
    }
  };

  const Sparkline = ({ values = [], width = 120, height = 28 }: { values: number[]; width?: number; height?: number }) => {
    const max = Math.max(1, ...values);
    const points = values.map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * (width - 4) + 2;
      const y = height - 2 - (v / max) * (height - 4);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mt-2">
        <polyline fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" points={points} />
      </svg>
    );
  };

  const rebuildCategories = async () => {
    try {
      setLoadingCategories(true);
      const token = await getIdToken();
      const res = await fetch('/api/admin/categories/auto-build', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Auto-build failed');
      toast.success(data.message || 'Kategorie przebudowane');
    } catch (e:any) {
      toast.error(e.message || 'Auto-build failed');
    } finally {
      setLoadingCategories(false);
    }
  };

  const bulkDeleteProducts = async () => {
    if (confirmDelete !== 'DELETE_ALL_PRODUCTS') {
      toast.error('Wpisz dokładnie: DELETE_ALL_PRODUCTS');
      return;
    }
    if (!confirm('⚠️ NIEODWRACALNE: usunąć WSZYSTKIE produkty?')) return;
    try {
      setLoadingDeleteProducts(true);
      const token = await getIdToken();
      const res = await fetch('/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE_ALL_PRODUCTS' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Bulk delete failed');
      toast.success(`Usunięto ${data.deleted} produktów`);
      setConfirmDelete('');
    } catch (e:any) {
      toast.error(e.message || 'Bulk delete failed');
    } finally {
      setLoadingDeleteProducts(false);
    }
  };

  const runFetchSaveDrafts = async () => {
    try {
      setLoadingDrafts(true);
      const token = await getIdToken();
      const res = await fetch('/api/admin/import/fetch-save-drafts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importerType: fetchType,
          maxItemsPerSubcategory: fetchMaxItems,
          maxBatches: fetchMaxBatches,
          onlyCategorySlug: selectedCat || undefined,
          onlySubcategorySlug: selectedSub || undefined,
          onlySubSubcategorySlug: selectedSubSub || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Fetch+Save failed');
      toast.success(`Szkice: batch=${data.batches}, pobrane=${data.fetched}, zapisane=${data.saved}, pominiete=${data.skipped}`);
    } catch (e: any) {
      toast.error(e.message || 'Fetch+Save failed');
    } finally {
      setLoadingDrafts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold tracking-tight">Import & Export — Konsola</h1>
        <p className="text-sm text-muted-foreground mt-1">Zarządzanie importami, eksportami i zadaniami w tle</p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Produkty — Approved</CardTitle>
            <CardDescription>Opublikowane w serwisie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.products?.approved ?? '—'}</div>
            <Sparkline values={(summary.recentJobs||[]).map((j:any)=> j.logs?.reduce((acc:number,l:any)=>acc + (l?.stages?.saved||0),0) || 0)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Produkty — Draft</CardTitle>
            <CardDescription>Oczekujące na obróbkę</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.products?.draft ?? '—'}</div>
            <Sparkline values={(summary.recentJobs||[]).map((j:any)=> (j.itemsCreated?.length||0))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Ostatnie joby</CardTitle>
              <Badge variant="outline" className="ml-auto">Live</Badge>
            </div>
            <CardDescription className="flex items-center gap-2 text-xs mt-1">
              5 najnowszych
              <select className="ml-auto border rounded px-2 py-1 h-8 text-xs" value={jobsFilter} onChange={e=>setJobsFilter(e.target.value as any)}>
                <option value="all">Wszystkie</option>
                <option value="running">Running</option>
                <option value="queued">Queued</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {(summary.recentJobs || []).filter((j:any)=> jobsFilter==='all' ? true : j.status===jobsFilter).map((j: any) => (
              <div key={j.id} className="flex items-center justify-between">
                <span className="truncate max-w-[60%] font-mono">{j.id?.slice(0, 8)}...</span>
                <Badge variant={j.status === 'completed' ? 'default' : (j.status === 'running' ? 'secondary' : 'outline')} className="text-xs">{j.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top Tools Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => { document.querySelector('[data-tool="fetch-save"]')?.scrollIntoView({behavior:'smooth'}); }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              ⚡ Fetch & Save
              <Badge variant="outline" className="ml-auto text-xs">v1.8</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Pobierz produkty z marketplaces i zapisz jako drafty — najczęściej używane narzędzie</p>
            <Button variant="outline" size="sm" className="w-full">Otwórz Narzędzie</Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => { document.querySelector('[data-tool="full-import"]')?.scrollIntoView({behavior:'smooth'}); }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              🔄 Pełny Import
              <Badge variant="outline" className="ml-auto text-xs">v1.9</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Kompletny cykl: pobierz, kategoryzuj, przetłumacz, ubogać — od zera do hero</p>
            <Button variant="outline" size="sm" className="w-full">Otwórz Narzędzie</Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => { document.querySelector('[data-tool="enhance"]')?.scrollIntoView({behavior:'smooth'}); }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              ✨ Ubogacanie
              <Badge variant="outline" className="ml-auto text-xs">v1.5</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Dodaj opisy, cechy, obrazki do istniejących produktów — ostatni krok</p>
            <Button variant="outline" size="sm" className="w-full">Otwórz Narzędzie</Button>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">📋 Monitor Zadań Importu</CardTitle>
          <CardDescription>Podgląd statusu i szybkie akcje</CardDescription>
        </CardHeader>
        <CardContent>
          <JobsMonitor />
        </CardContent>
      </Card>

      <Separator />

      {/* Akcje krytyczne */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> Kill All</CardTitle>
            <CardDescription>Zatrzymaj wszystkie aktywne zadania importu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="destructive" onClick={killAll} disabled={loadingKill}>
              {loadingKill ? 'Zatrzymywanie…' : 'Kill All'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4"/> Kategorie</CardTitle>
            <CardDescription>Przebuduj drzewo kategorii (EN slugs, tłumaczenia)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={rebuildCategories} disabled={loadingCategories}>
              {loadingCategories ? 'Budowanie…' : 'Przebuduj kategorie'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trash2 className="h-4 w-4"/> Usuń produkty</CardTitle>
            <CardDescription>Masowe usunięcie WSZYSTKICH produktów</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="confirm">Potwierdzenie</Label>
            <Input id="confirm" placeholder="DELETE_ALL_PRODUCTS" value={confirmDelete} onChange={e=>setConfirmDelete(e.target.value)} />
            <Button variant="destructive" onClick={bulkDeleteProducts} disabled={loadingDeleteProducts}>
              {loadingDeleteProducts ? 'Usuwanie…' : 'Usuń wszystkie produkty'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Import — etapy (MVP: linki / placeholdery) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-tool="full-import">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4"/> Pełny import (5 etapów)</CardTitle>
            <CardDescription>Uruchom nowy pipeline importu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Źródło</Label>
                <select className="w-full border rounded px-2 py-1 h-9" value={fullImportType} onChange={e=>setFullImportType(e.target.value as any)}>
                  <option value="hot-products">AliExpress: Hot Products</option>
                  <option value="keyword-search">AliExpress: Keyword Search</option>
                  <option value="convertiser">Convertiser</option>
                  <option value="category-direct">AliExpress: Category Direct</option>
                </select>
              </div>
              <div>
                <Label>Maks. produktów/kategoria</Label>
                <Input type="number" min={1} max={100} value={fullImportMax} onChange={e=>setFullImportMax(parseInt(e.target.value || '1', 10))} />
              </div>
            </div>
            <Button onClick={runFullImport} disabled={loadingFullImport}>
              {loadingFullImport ? 'Uruchamianie…' : 'Uruchom pełny import'}
            </Button>
          </CardContent>
        </Card>
        <Card data-tool="fetch-save">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4"/> Fetch & Save (draft)</CardTitle>
            <CardDescription>Pierwszy etap: pobierz i zapisz szkice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Źródło</Label>
                <select className="w-full border rounded px-2 py-1 h-9" value={fetchType} onChange={e=>setFetchType(e.target.value as any)}>
                  <option value="hot-products">AliExpress: Hot Products</option>
                  <option value="keyword-search">AliExpress: Keyword Search</option>
                  <option value="convertiser">Convertiser</option>
                  <option value="category-direct">AliExpress: Category Direct</option>
                </select>
              </div>
              <div>
                <Label>Maks. produktów/kategoria</Label>
                <Input type="number" min={1} max={100} value={fetchMaxItems} onChange={e=>setFetchMaxItems(parseInt(e.target.value || '1', 10))} />
              </div>
              <div>
                <Label>Maks. batchy</Label>
                <Input type="number" min={1} max={50} value={fetchMaxBatches} onChange={e=>setFetchMaxBatches(parseInt(e.target.value || '1', 10))} />
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <div>
                  <Label>Kategoria (EN slug)</Label>
                  <select className="w-full border rounded px-2 py-1 h-9" value={selectedCat} onChange={e=>{setSelectedCat(e.target.value); setSelectedSub(''); setSelectedSubSub('');}}>
                    <option value="">— Wszystkie —</option>
                    {catTree.map(c => (
                      <option key={c.id} value={c.slug}>{c.name} ({c.slug})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Podkategoria</Label>
                  <select className="w-full border rounded px-2 py-1 h-9" value={selectedSub} onChange={e=>{setSelectedSub(e.target.value); setSelectedSubSub('');}} disabled={!selectedCat}>
                    <option value="">— Wszystkie —</option>
                    {catTree.find(c=>c.slug===selectedCat)?.subcategories?.map((s:any)=>(
                      <option key={s.id} value={s.slug}>{s.name} ({s.slug})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Pod-podkategoria</Label>
                  <select className="w-full border rounded px-2 py-1 h-9" value={selectedSubSub} onChange={e=>setSelectedSubSub(e.target.value)} disabled={!selectedSub}>
                    <option value="">— Wszystkie —</option>
                    {catTree.find(c=>c.slug===selectedCat)?.subcategories?.find((s:any)=>s.slug===selectedSub)?.subcategories?.map((ss:any)=>(
                      <option key={ss.id} value={ss.slug}>{ss.name} ({ss.slug})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={runFetchSaveDrafts} disabled={loadingDrafts}>
                {loadingDrafts ? 'Uruchamianie…' : 'Uruchom: Fetch & Save szkice'}
              </Button>
              <span className="text-xs text-muted-foreground self-center">Produkty trafią jako szkice (status: draft)</span>
            </div>
          </CardContent>
        </Card>
        <Card data-tool="enhance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4"/> Tłumaczenie & Ubogacanie</CardTitle>
            <CardDescription>Operacje na zapisanych szkicach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Wkrótce: osobne akcje per etap z batchingiem.</p>
            <p>Monitoruj postęp: <Link href="/admin/imports" className="text-primary underline">Import Monitor</Link>.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4"/> Kategoryzacja i publikacja</CardTitle>
            <CardDescription>Mapuj kategorie i zatwierdź</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Wkrótce: automaty/akcje do mapowania kategorii (EN slugs) i approve.</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Operacje na szkicach */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4"/> Operacje na szkicach</CardTitle>
          <CardDescription>Szybkie akcje na produktach w statusie draft</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Kategoria (EN slug)</Label>
              <select className="w-full border rounded px-2 py-1 h-9" value={selectedCat} onChange={e=>{setSelectedCat(e.target.value); setSelectedSub(''); setSelectedSubSub('');}}>
                <option value="">— Wszystkie —</option>
                {catTree.map(c => (
                  <option key={c.id} value={c.slug}>{c.name} ({c.slug})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Podkategoria</Label>
              <select className="w-full border rounded px-2 py-1 h-9" value={selectedSub} onChange={e=>{setSelectedSub(e.target.value); setSelectedSubSub('');}} disabled={!selectedCat}>
                <option value="">— Wszystkie —</option>
                {catTree.find(c=>c.slug===selectedCat)?.subcategories?.map((s:any)=>(
                  <option key={s.id} value={s.slug}>{s.name} ({s.slug})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Pod-podkategoria</Label>
              <select className="w-full border rounded px-2 py-1 h-9" value={selectedSubSub} onChange={e=>setSelectedSubSub(e.target.value)} disabled={!selectedSub}>
                <option value="">— Wszystkie —</option>
                {catTree.find(c=>c.slug===selectedCat)?.subcategories?.find((s:any)=>s.slug===selectedSub)?.subcategories?.map((ss:any)=>(
                  <option key={ss.id} value={ss.slug}>{ss.name} ({ss.slug})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async ()=>{
                try {
                  const token = await getIdToken();
                  const res = await fetch('/api/admin/products/approve-drafts', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      limit: 100,
                      mainCategorySlug: selectedCat || undefined,
                      subCategorySlug: selectedSub || undefined,
                      subSubCategorySlug: selectedSubSub || undefined,
                    })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || 'Approve failed');
                  toast.success(`Zmieniono status na approved: ${data.updated}`);
                } catch (e:any) {
                  toast.error(e.message || 'Approve failed');
                }
              }}
            >
              Zatwierdź 100 szkiców (filtered)
            </Button>
            <Button variant="outline" onClick={runTranslateDrafts}>Przetłumacz 100 szkiców</Button>
            <Button variant="outline" onClick={runEnrichDrafts}>Enrich 100 szkiców</Button>
          </div>
        </CardContent>
      </Card>

      {/* Monitor zadań */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4"/> Monitor zadań importu</CardTitle>
          <CardDescription>Podgląd statusu i szybkie akcje</CardDescription>
        </CardHeader>
        <CardContent>
          <JobsMonitor />
        </CardContent>
      </Card>

      {/* Legacy skróty */}
      <Card>
        <CardHeader>
          <CardTitle>Legacy — skróty</CardTitle>
          <CardDescription>Działające narzędzia z poprzednich wersji</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/harvester" className="underline text-primary">Kombajn</Link>
          <Link href="/admin/auto-import" className="underline text-primary">Auto-Import Kombajn</Link>
          <Link href="/admin/imports" className="underline text-primary">Import Monitor</Link>
          <Link href="/admin/aliexpress-import" className="underline text-primary">AliExpress</Link>
          <Link href="/admin/allegro-import" className="underline text-primary">Allegro</Link>
          <Link href="/admin/amazon-import" className="underline text-primary">Amazon</Link>
          <Link href="/admin/convertiser-import" className="underline text-primary">Convertiser</Link>
          <Link href="/admin/ebay-import" className="underline text-primary">eBay</Link>
          <Link href="/admin/bulk-import" className="underline text-primary">Bulk Import</Link>
          <Link href="/admin/batch-import" className="underline text-primary">Batch Import</Link>
        </CardContent>
      </Card>
    </div>
  );
}
