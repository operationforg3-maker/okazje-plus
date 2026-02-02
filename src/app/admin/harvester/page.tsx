"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";

type SourceType = 'convertiser' | 'aliexpress' | 'amazon' | 'allegro';

export default function HarvesterPage() {
  const [source, setSource] = useState<SourceType>('convertiser');
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Nie zalogowany");
    return await user.getIdToken();
  };

  const startHarvest = async () => {
    if (!query.trim()) {
      alert('Wprowadź zapytanie wyszukiwania');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const token = await getAuthToken();
      
      const payload = {
        source,
        query: query.trim(),
        maxResults,
      };
      
      console.log('🚀 Starting harvest...', payload);
      
      const res = await fetch("/api/admin/harvester/start", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      setResult(data);
      
      if (data.success) {
        console.log(`✅ Harvest complete:`, data);
      } else {
        console.error('❌ Harvest failed:', data.error);
      }
    } catch (e: any) {
      console.error('❌ Error:', e);
      setResult({ success: false, error: e?.message || "Błąd połączenia" });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold">M6 Smart Harvester</h1>
        <Badge variant="outline">v6.0</Badge>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">ℹ️ M6 Harvester - Jak to działa:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li><strong>Convertiser:</strong> Multi-marketplace (Allegro, Empik, Douglas, etc.) - 419k produktów</li>
          <li><strong>AliExpress:</strong> Chiński marketplace z milionami produktów</li>
          <li><strong>Deduplication:</strong> SHA-256 identity hash (title + image)</li>
          <li><strong>AI Refinement:</strong> Automatyczne opisy, tłumaczenia, kategoryzacja</li>
          <li><strong>M6 Architecture:</strong> ProductCore (immutable) + Deal (mutable)</li>
        </ul>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Uruchom import produktów</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Źródło</label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="convertiser">🇵🇱 Convertiser (419k produktów PL)</SelectItem>
                <SelectItem value="aliexpress">🇨🇳 AliExpress</SelectItem>
                <SelectItem value="amazon">🛒 Amazon (wymaga OAuth)</SelectItem>
                <SelectItem value="allegro">🇵🇱 Allegro (wymaga OAuth)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Zapytanie wyszukiwania</label>
            <Input 
              placeholder="np. smartphones, laptops, buty sportowe" 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Maksymalna liczba produktów</label>
            <Input 
              type="number"
              min="1"
              max="100"
              value={maxResults} 
              onChange={e => setMaxResults(parseInt(e.target.value) || 20)}
              disabled={isRunning}
            />
          </div>

          <Button 
            onClick={startHarvest} 
            disabled={isRunning || !query.trim()}
            className="w-full"
          >
            {isRunning ? '⏳ Importuję...' : '🚀 Uruchom Harvest'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.success ? '✅ Sukces' : '❌ Błąd'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.success ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{result.result?.productsCreated || 0}</div>
                      <div className="text-sm text-muted-foreground">Produkty</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{result.result?.dealsCreated || 0}</div>
                      <div className="text-sm text-muted-foreground">Oferty</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{result.result?.duplicatesSkipped || 0}</div>
                      <div className="text-sm text-muted-foreground">Duplikaty</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Job ID: <code className="bg-gray-100 px-2 py-1 rounded">{result.result?.id}</code>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Status: <Badge>{result.result?.status}</Badge>
                  </div>
                </>
              ) : (
                <div className="text-red-600">
                  {result.error || 'Nieznany błąd'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
