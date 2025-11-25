"use client";
import { useState } from 'react';

export default function AiConsole() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleFillCatalog = async () => {
    if (!confirm('To wypełni bazę kategoriami i produktami z AliExpress. Kontynuować?')) return;
    
    setLoading(true);
    setResult('Rozpoczynam wypełnianie katalogu...');
    
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'fillCategoriesWithProducts' })
      });
      
      const data = await res.json();
      setResult(data.result || 'Zakończono!');
    } catch (e: any) {
      setResult(`Błąd: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (!confirm('To usunie WSZYSTKIE produkty i deale. Czy na pewno?')) return;
    
    setLoading(true);
    setResult('Czyszczenie bazy danych...');
    
    try {
      const res = await fetch('/api/admin/ai/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      setResult(data.message || 'Baza danych wyczyszczona');
    } catch (e: any) {
      setResult(`Błąd: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDeals = async () => {
    if (!confirm('To pobierze deale (promocje) z AliExpress API. Kontynuować?')) return;
    
    setLoading(true);
    setResult('Pobieram deale z AliExpress...');
    
    try {
      const res = await fetch('/api/admin/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'fillCategoriesWithDeals' })
      });
      
      const data = await res.json();
      setResult(data.result || 'Deale pobrane z AliExpress!');
    } catch (e: any) {
      setResult(`Błąd: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Konsola AI - Zarządzanie Katalogiem</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleFillCatalog}
          disabled={loading}
          className="p-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
        >
          {loading ? '⏳ Przetwarzam...' : '🚀 Wypełnij Katalog (AliExpress)'}
        </button>
        
        <button
          onClick={handleFetchDeals}
          disabled={loading}
          className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {loading ? '⏳ Pobieram...' : '🔥 Pobierz Deale (AliExpress)'}
        </button>
        
        <button
          onClick={handleWipeDatabase}
          disabled={loading}
          className="p-4 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 font-medium"
        >
          {loading ? '⏳ Czyszczę...' : '🗑️ Wyczyść Bazę Danych'}
        </button>
      </div>
      
      {result && (
        <div className="p-4 bg-muted rounded-lg border">
          <h3 className="font-medium mb-2">Wynik:</h3>
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
      
      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium mb-2">ℹ️ Jak to działa:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li><strong>Wypełnij Katalog:</strong> Tworzy strukturę kategorii (jak Pepper.pl) i pobiera produkty z AliExpress API</li>
          <li><strong>Pobierz Deale:</strong> Agreguje gorące okazje (promocje {'>'} 50% zniżki) z AliExpress dla każdej kategorii</li>
          <li><strong>Wyczyść Bazę:</strong> Usuwa wszystkie produkty i deale (przydatne przed re-seedowaniem)</li>
          <li>⚠️ <strong>Ważne:</strong> To agregator - produkty i deale pochodzą z AliExpress, nie są generowane sztucznie</li>
          <li>Proces może zająć kilka minut w zależności od ilości kategorii</li>
        </ul>
      </div>
    </div>
  );
}
