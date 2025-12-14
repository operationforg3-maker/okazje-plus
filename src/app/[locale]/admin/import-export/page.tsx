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

export default function AdminImportExportPage() {
  const { getIdToken } = useAuth();
  const [loadingKill, setLoadingKill] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingDeleteProducts, setLoadingDeleteProducts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold">Import & Export — Konsola</h1>
        <Badge variant="secondary">Nowe</Badge>
      </div>

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4"/> Fetch & Save (draft)</CardTitle>
            <CardDescription>Pierwszy etap: pobierz i zapisz szkice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Wkrótce: wybór źródła (AliExpress/Allegro/Amazon) i słów kluczowych.</p>
            <p>Na razie użyj legacy: <Link href="/admin/harvester" className="text-primary underline">Kombajn</Link> lub <Link href="/admin/aliexpress-import" className="text-primary underline">AliExpress</Link>.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4"/> Dedupe / Enrich / Translate</CardTitle>
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
