'use client';

import { useState, useEffect } from 'react';
import typesenseClient from '@/lib/typesense';

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

      if (!typesenseClient) {
        console.error("Klient Typesense nie jest zainicjowany.");
        setLoading(false);
        return;
      }

      try {
        const searchRequests = {
          searches: [
            { collection: 'deals', q: query, query_by: 'title,description,postedBy' },
            { collection: 'products', q: query, query_by: 'name,description,category' },
          ],
        };
        
        const searchResults = await typesenseClient.multiSearch.perform(searchRequests);
        const hits = searchResults.results.flatMap((result: any) => result.hits || []) as SearchHit[];
        setResults(hits);
        console.log('Wyniki wyszukiwania:', hits);

      } catch (error) {
        console.error('Błąd wyszukiwania:', error);
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
