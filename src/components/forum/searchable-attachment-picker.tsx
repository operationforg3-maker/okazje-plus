// @ts-nocheck
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

// Helper to extract numeric price from either number or {amount, currency} object
function getPriceValue(price: any): number {
  if (typeof price === 'number') return price;
  if (price && typeof price === 'object' && typeof price.amount === 'number') return price.amount;
  return 0;
}

export function SearchableAttachmentPicker({ type, onSelect, selected, onClear }: SearchableAttachmentPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<(Deal | Product)[]>([]);
  const [loading, setLoading] = useState(false);

  const getTitleValue = (title: any): string => {
    if (typeof title === 'string') return title;
    if (title && typeof title === 'object') {
      return title.pl || title.en || title.de || 'N/A';
    }
    return 'N/A';
  };

  const getProductTitle = (item: any) => getTitleValue(item?.title ?? item?.name);
  const getProductImage = (item: any) => item?.image ?? item?.imageUrl ?? item?.images?.[0];
  const getProductPrice = (item: any) => item?.price ?? item?.bestPrice?.amount ?? item?.bestTotalPrice;

  useEffect(() => {
    const handleSearch = async () => {
      setLoading(true);
      try {
        const collectionName = type === 'deal' ? 'deals' : 'product_cores';
        const ref = collection(db, collectionName);
        
        // Firestore doesn't support full-text search, so we fetch approved items and filter client-side
        const q = query(ref, where('status', '==', 'approved'), limit(20));
        const snap = await getDocs(q);
        
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal | Product));
        const filtered = all.filter(item => {
          const titleStr = type === 'deal'
            ? getTitleValue((item as Deal).title)
            : getProductTitle(item);
          return titleStr.toLowerCase().includes(searchQuery.toLowerCase());
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
    const titleStr = type === 'deal'
      ? getTitleValue((selected as Deal).title)
      : getProductTitle(selected as any);
    const image = type === 'deal' ? (selected as Deal).image : getProductImage(selected as any);
    const price = type === 'deal' ? (selected as Deal).price : getProductPrice(selected as any);
    const priceValue = getPriceValue(price);
    
    return (
      <Card className="p-3 flex items-center gap-3">
        <img src={image} alt={titleStr} className="w-16 h-16 object-cover rounded" />
        <div className="flex-1">
          <div className="font-medium text-sm line-clamp-1">{titleStr}</div>
          <Badge variant="outline">{priceValue} zł</Badge>
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
            const titleStr = type === 'deal'
              ? getTitleValue((item as Deal).title)
              : getProductTitle(item as any);
            const image = type === 'deal' ? (item as Deal).image : getProductImage(item as any);
            const price = type === 'deal' ? (item as Deal).price : getProductPrice(item as any);
            const priceValue = getPriceValue(price);
            
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="p-3 flex items-center gap-3 hover:bg-muted/50 cursor-pointer"
              >
                <img src={image} alt={titleStr} className="w-12 h-12 object-cover rounded" />
                <div className="flex-1">
                  <div className="text-sm font-medium line-clamp-1">{titleStr}</div>
                  <Badge variant="outline" className="text-xs">{priceValue} zł</Badge>
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
