"use client";
import { useEffect, useState } from 'react';

export default function AiCommandHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai/history?limit=30');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Historia poleceń AI</h2>
        <button
          onClick={fetchHistory}
          className="inline-flex items-center px-3 py-1 text-xs font-medium bg-muted rounded hover:bg-primary/10 border border-border/40"
          disabled={loading}
        >
          {loading ? 'Odświeżanie...' : 'Odśwież'}
        </button>
      </div>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Polecenie</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Wynik</th>
            <th className="p-2 text-left">Czas</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Brak historii poleceń</td></tr>
          )}
          {history.map(h => (
            <tr key={h.id} className="border-t">
              <td className="p-2 font-mono whitespace-pre-wrap">{h.command}</td>
              <td className="p-2">{h.status}</td>
              <td className="p-2 whitespace-pre-wrap">{h.result}</td>
              <td className="p-2 text-xs text-gray-400">{h.createdAt ? new Date(h.createdAt).toLocaleString('pl-PL') : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
