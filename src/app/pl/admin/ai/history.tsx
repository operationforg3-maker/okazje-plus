"use client";
import { useState } from 'react';

export default function AiCommandHistory() {
  // TODO: Zastąpić mock danymi z backendu/logów
  const [history, setHistory] = useState([
    { id: 1, command: 'wypełnij katalog', status: 'Zakończone', result: 'Katalog został wypełniony.' },
    { id: 2, command: 'wyszukaj produkt Xiaomi', status: 'Zakończone', result: 'Znaleziono 12 produktów.' },
    { id: 3, command: 'dodaj kategorię "Sport"', status: 'Błąd', result: 'Brak uprawnień.' },
  ]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Historia poleceń AI</h2>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Polecenie</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Wynik</th>
          </tr>
        </thead>
        <tbody>
          {history.map(h => (
            <tr key={h.id} className="border-t">
              <td className="p-2 font-mono whitespace-pre-wrap">{h.command}</td>
              <td className="p-2">{h.status}</td>
              <td className="p-2 whitespace-pre-wrap">{h.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
