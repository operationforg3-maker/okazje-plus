'use client';

import { useState, useEffect } from 'react';
// Use server-side search proxy for production (safer and works when Typesense
// isn't exposed to the browser). We still support Typesense client via lib
// but prefer the API proxy for unified behavior.

// Definicja typów dla wyników wyszukiwania
interface DealHit {
  document: {
    id: string;
    title: string;
    description: string;
  };
}

interface ProductHit {
  document: {
    id: string;
    name: string;
    description: string;
  };
}

type SearchHit = DealHit | ProductHit;

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (!query) {
        setResults([]);
        return;
      }
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('limit', '12');
        params.set('type', 'all');
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) {
          setResults([]);
          setLoading(false);
          return;
        }
        const body = await res.json();
        const hits: SearchHit[] = [];
        (body.deals || []).forEach((d: any) => hits.push({ document: { id: d.id, title: d.title, description: d.description } } as DealHit));
        (body.products || []).forEach((p: any) => hits.push({ document: { id: p.id, name: p.name || p.title || '', description: p.description } } as ProductHit));
        setResults(hits);
        console.log('Wyniki wyszukiwania (proxy):', hits);
      } catch (error) {
        console.error('Błąd wyszukiwania (proxy):', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(() => {
      search();
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [query]);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj okazji i produktów..."
        className="border p-2 rounded w-full"
      />
      {loading && <p className="absolute top-full mt-2">Ładowanie...</p>}
      {query && !loading && (
        <ul className="absolute top-full mt-1 w-full bg-white border rounded shadow-lg z-10">
          {results.length > 0 ? (
            results.map((hit, index) => (
              <li key={index} className="p-2 hover:bg-gray-100 cursor-pointer">
                {'title' in hit.document ? (
                  // Wynik z kolekcji 'deals'
                  <div>
                    <p className="font-bold">Okazja: {hit.document.title}</p>
                    <p className="text-sm text-gray-600">{hit.document.description}</p>
                  </div>
                ) : (
                  // Wynik z kolekcji 'products'
                  <div>
                    <p className="font-bold">Produkt: {hit.document.name}</p>
                    <p className="text-sm text-gray-600">{hit.document.description}</p>
                  </div>
                )}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500">Brak wyników</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
