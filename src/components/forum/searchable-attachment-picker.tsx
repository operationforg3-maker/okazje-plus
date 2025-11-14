"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { Deal, Product } from '@/lib/types';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SearchableAttachmentPickerProps {
  type: 'deal' | 'product';
  onSelect: (item: Deal | Product) => void;
  selected?: Deal | Product | null;
  onClear?: () => void;
}

export function SearchableAttachmentPicker({ type, onSelect, selected, onClear }: SearchableAttachmentPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<(Deal | Product)[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleSearch = async () => {
      setLoading(true);
      try {
        const collectionName = type === 'deal' ? 'deals' : 'products';
        const ref = collection(db, collectionName);
        
        // Firestore doesn't support full-text search, so we fetch approved items and filter client-side
        const q = query(ref, where('status', '==', 'approved'), limit(20));
        const snap = await getDocs(q);
        
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal | Product));
        const filtered = all.filter(item => {
          const title = type === 'deal' ? (item as Deal).title : (item as Product).name;
          return title.toLowerCase().includes(searchQuery.toLowerCase());
        });
        
        setResults(filtered.slice(0, 10));
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, type]);

  if (selected) {
    const title = type === 'deal' ? (selected as Deal).title : (selected as Product).name;
    const image = selected.image;
    const price = type === 'deal' ? (selected as Deal).price : (selected as Product).price;
    
    return (
      <Card className="p-3 flex items-center gap-3">
        <img src={image} alt={title} className="w-16 h-16 object-cover rounded" />
        <div className="flex-1">
          <div className="font-medium text-sm line-clamp-1">{title}</div>
          <Badge variant="outline">{price} zł</Badge>
        </div>
        {onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Szukaj ${type === 'deal' ? 'okazji' : 'produktu'}...`}
          className="pl-10"
        />
      </div>
      
      {loading && <div className="text-sm text-muted-foreground">Szukam...</div>}
      
      {results.length > 0 && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {results.map((item) => {
            const title = type === 'deal' ? (item as Deal).title : (item as Product).name;
            const image = item.image;
            const price = type === 'deal' ? (item as Deal).price : (item as Product).price;
            
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="p-3 flex items-center gap-3 hover:bg-muted/50 cursor-pointer"
              >
                <img src={image} alt={title} className="w-12 h-12 object-cover rounded" />
                <div className="flex-1">
                  <div className="text-sm font-medium line-clamp-1">{title}</div>
                  <Badge variant="outline" className="text-xs">{price} zł</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {searchQuery.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="text-sm text-muted-foreground">Brak wyników</div>
      )}
    </div>
  );
}
