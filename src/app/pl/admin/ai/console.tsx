"use client";
import { useState } from 'react';

export default function AiConsole() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleFillCatalog = async () => {
    if (!confirm('To wypełni bazę kategoriami i produktami z AliExpress. Kontynuować?')) return;
    
    setLoading(true);
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
        return;
      }
      
      const data = await res.json();
      setResult(data.result || '✅ Zakończono!');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message || 'Sprawdź połączenie z internetem'}`);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (!confirm('⚠️ UWAGA! To usunie WSZYSTKIE produkty i deale. Czy na pewno?')) return;
    if (!confirm('To jest nieodwracalne. Ostatnia szansa - kontynuować?')) return;
    
    setLoading(true);
    setResult('🗑️ Czyszczenie bazy danych...\n\nUsuwam produkty i deale...');
    
    try {
      const res = await fetch('/api/admin/ai/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Błąd połączenia' }));
        setResult(`❌ Błąd ${res.status}: ${errorData.error || errorData.message || 'Nieznany błąd serwera'}`);
        return;
      }
      
      const data = await res.json();
      setResult(data.message || '✅ Baza danych wyczyszczona');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message}`);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDeals = async () => {
    if (!confirm('To pobierze deale (promocje >50% zniżki) z AliExpress API. Kontynuować?')) return;
    
    setLoading(true);
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
        return;
      }
      
      const data = await res.json();
      setResult(data.result || '✅ Deale pobrane z AliExpress!');
    } catch (e: any) {
      setResult(`❌ Błąd połączenia: ${e.message}`);
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Command Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleFillCatalog}
          disabled={loading}
          className="group relative p-6 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="text-4xl">🚀</span>
            <span className="text-lg font-bold">Wypełnij Katalog</span>
            <span className="text-sm text-blue-100 text-center">
              {loading ? '⏳ Przetwarzam...' : 'Produkty z AliExpress API'}
            </span>
          </div>
          <div className="absolute top-2 right-2">
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">~300 produktów</span>
          </div>
        </button>
        
        <button
          onClick={handleFetchDeals}
          disabled={loading}
          className="group relative p-6 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="text-4xl">🔥</span>
            <span className="text-lg font-bold">Pobierz Deale</span>
            <span className="text-sm text-orange-100 text-center">
              {loading ? '⏳ Pobieram...' : 'Promocje {\'>\'}50% zniżki'}
            </span>
          </div>
          <div className="absolute top-2 right-2">
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">~100 deali</span>
          </div>
        </button>
        
        <button
          onClick={handleWipeDatabase}
          disabled={loading}
          className="group relative p-6 bg-gradient-to-br from-gray-600 to-gray-800 text-white rounded-xl hover:from-red-600 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="text-4xl">🗑️</span>
            <span className="text-lg font-bold">Wyczyść Bazę</span>
            <span className="text-sm text-gray-200 text-center">
              {loading ? '⏳ Czyszczę...' : 'Reset całej bazy'}
            </span>
          </div>
          <div className="absolute top-2 right-2">
            <span className="bg-red-500/50 text-xs px-2 py-1 rounded-full">⚠️ Ostrożnie</span>
          </div>
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-inner">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl">✨</span>
            Wynik operacji:
          </h3>
          <pre className="whitespace-pre-wrap text-sm bg-white dark:bg-gray-900 p-4 rounded-lg border font-mono">
            {result}
          </pre>
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
