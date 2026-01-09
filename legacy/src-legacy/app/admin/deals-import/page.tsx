"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { auth } from "@/lib/firebase";

export default function DealsImportPage() {
  const [categoryIds, setCategoryIds] = useState(""); // comma-separated IDs
  const [minDiscount, setMinDiscount] = useState(30);
  const [maxDeals, setMaxDeals] = useState(100);
  const [sortBy, setSortBy] = useState<'discount' | 'orders' | 'rating'>('discount');
  const [autoApprove, setAutoApprove] = useState(false);
  const [translateToPolish, setTranslateToPolish] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken();
  };

  const runImportFromAliexpress = async () => {
    setIsImporting(true);
    setDryRunResult(null);
    try {
      const token = await getAuthToken();
      
      // Parse category IDs (comma-separated)
      const categoryIdArray = categoryIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      
      const payload = {
        categoryIds: categoryIdArray,
        minDiscount,
        maxDeals,
        sortBy,
        autoApprove,
        translateToPolish,
      };
      
      console.log('Starting AliExpress deals import...', payload);
      
      const res = await fetch("/api/admin/deals/import-aliexpress", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      setDryRunResult(data);
      
      if (data.success) {
        console.log(`✅ Import complete: ${data.imported} deals imported`);
      } else {
        console.error('❌ Import failed:', data.error);
      }
    } catch (e: any) {
      console.error('Import error:', e);
      setDryRunResult({ ok: false, error: e?.message || "Parse error" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold">Import okazji z AliExpress</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold mb-2">ℹ️ Jak to działa:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>Pobiera produkty z AliExpress z wysokim dyskontem (≥30%)</li>
          <li>Filtruje po jakości (min. 10 zamówień, ocena ≥3.5)</li>
          <li>Deduplikuje z istniejącymi okazjami</li>
          <li>Tłumaczy na polski (AI)</li>
          <li>Kategoryzuje automatycznie (AI)</li>
          <li>Zapisuje do Firestore jako deals</li>
        </ul>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Parametry importu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category IDs (opcjonalne, oddziel przecinkami)</label>
            <Input 
              placeholder="np. 509,1501,200000297" 
              value={categoryIds} 
              onChange={e=>setCategoryIds(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Zostaw puste aby szukać we wszystkich kategoriach</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min. zniżka (%)</label>
              <Input 
                type="number" 
                min="0" 
                max="100"
                value={minDiscount} 
                onChange={e=>setMinDiscount(parseInt(e.target.value||"30"))} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Max okazji</label>
              <Input 
                type="number" 
                min="1" 
                max="500"
                value={maxDeals} 
                onChange={e=>setMaxDeals(parseInt(e.target.value||"100"))} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Sortuj po</label>
              <select 
                className="w-full border rounded px-3 py-2"
                value={sortBy}
                onChange={e=>setSortBy(e.target.value as any)}
              >
                <option value="discount">Zniżce</option>
                <option value="orders">Zamówieniach</option>
                <option value="rating">Ocenie</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Opcje</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={autoApprove} onCheckedChange={(v)=>setAutoApprove(!!v)} />
                  <span className="text-sm">Auto-approve</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={translateToPolish} onCheckedChange={(v)=>setTranslateToPolish(!!v)} />
                  <span className="text-sm">Tłumacz na PL</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={runImportFromAliexpress}
              disabled={isImporting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isImporting ? '⏳ Importuję...' : '🔥 Importuj okazje z AliExpress'}
            </Button>
          </div>
          
          {dryRunResult && (
            <div className="mt-4">
              {dryRunResult.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">✅ Import zakończony sukcesem!</h3>
                  <p className="text-sm mb-2">Zaimportowano: <strong>{dryRunResult.imported}</strong> okazji</p>
                  {dryRunResult.failed > 0 && (
                    <p className="text-sm text-orange-600">Błędy: {dryRunResult.failed}</p>
                  )}
                  {dryRunResult.results && dryRunResult.results.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium mb-2">Przykładowe okazje:</p>
                      <div className="space-y-1">
                        {dryRunResult.results.slice(0, 5).map((r: any, idx: number) => (
                          <div key={idx} className="text-xs bg-white p-2 rounded border">
                            <strong>{r.title}</strong>
                            <span className="text-orange-600 ml-2">-{r.discount}%</span>
                            <span className="text-red-500 ml-2">🔥{r.temperature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">❌ Błąd importu</h3>
                  <pre className="text-xs">{JSON.stringify(dryRunResult, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
