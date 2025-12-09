'use client';
export const dynamic = 'force-dynamic';


import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ProductSuggestion from '@/components/product-suggestion';
import { searchProductsForLinking, getCategories } from '@/lib/data';
import { linkDealToProduct } from '@/lib/data';
import { toast } from 'sonner';

// Typ dla danych nowej okazji wysyłanych do API endpoint
interface NewDealData {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
  merchant?: string;
  shippingCost?: number;
}

export default function AddDealPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  
  // Kategorie
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [subsubcategories, setSubsubcategories] = useState<any[]>([]);
  const [mainCategorySlug, setMainCategorySlug] = useState('');
  const [subCategorySlug, setSubCategorySlug] = useState('');
  const [subSubCategorySlug, setSubSubCategorySlug] = useState('');

  // Ładowanie kategorii
  useEffect(() => {
    async function fetchCategories() {
      const cats = await getCategories();
      setCategories(cats);
    }
    fetchCategories();
  }, []);

  // Aktualizuj podkategorie
  useEffect(() => {
    if (mainCategorySlug) {
      const mainCat = categories.find((c) => c.slug === mainCategorySlug);
      setSubcategories(mainCat?.subcategories || []);
      setSubCategorySlug('');
      setSubSubCategorySlug('');
      setSubsubcategories([]);
    }
  }, [mainCategorySlug, categories]);

  // Aktualizuj sub-subkategorie
  useEffect(() => {
    if (subCategorySlug) {
      const subCat = subcategories.find((c) => c.slug === subCategorySlug);
      setSubsubcategories(subCat?.subcategories || []);
      setSubSubCategorySlug('');
    } else {
      setSubsubcategories([]);
    }
  }, [subCategorySlug, subcategories]);

  useEffect(() => {
    const run = async () => {
      if (!productQuery.trim()) { setProductResults([]); return; }
      setProductSearchLoading(true);
      try {
        const results = await searchProductsForLinking(productQuery.trim());
        setProductResults(results.slice(0, 8));
      } catch (e) {
        console.warn('Search products failed', e);
      } finally {
        setProductSearchLoading(false);
      }
    };
    const t = setTimeout(run, 400); // debounce
    return () => clearTimeout(t);
  }, [productQuery]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast.error('Musisz być zalogowany, aby dodać okazję.');
        return;
    }

    // Prosta walidacja, można rozbudować
    if (!title.trim() || !price.trim() || !link.trim()) {
        toast.error("Tytuł, cena i link do okazji są wymagane.");
        return;
    }

    // Walidacja kategorii
    if (!mainCategorySlug || !subCategorySlug) {
        toast.error("Kategoria główna i podkategoria są wymagane.");
        return;
    }

    const newDealData: NewDealData = {
        title,
        description,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        link,
        image,
        mainCategorySlug,
        subCategorySlug,
        subSubCategorySlug: subSubCategorySlug || undefined,
    };

    setIsLoading(true);
    toast.info('Przetwarzanie danych...');

    try {
        const response = await fetch('/api/admin/deals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newDealData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Nie udało się utworzyć okazji');
        }

        const result = await response.json();
        const dealId = result.id;
        // Linkowanie z produktem jeśli wybrano
        if (dealId && linkedProductId) {
          try {
            await linkDealToProduct(dealId, linkedProductId);
            toast.success('Powiązano produkt z okazją');
          } catch (e) {
            console.error('Linking failed', e);
            toast.warning('Okazja dodana, ale powiązanie produktu nie powiodło się');
          }
        }
        toast.success(`Okazja została pomyślnie dodana! ID: ${dealId}`);
        router.push('/deals');
    } catch (error) {
        console.error('Błąd podczas tworzenia okazji:', error);
        const errorMessage = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.';
        toast.error(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="page-container py-8 md:py-12 max-w-2xl">
      <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-8">
        Dodaj nową okazję
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="title">Tytuł</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading} />
        </div>
        <div>
          <Label htmlFor="description">Opis</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required disabled={isLoading} />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="price">Cena</Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required disabled={isLoading} />
            </div>
            <div>
                <Label htmlFor="originalPrice">Cena oryginalna (opcjonalnie)</Label>
                <Input id="originalPrice" type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} disabled={isLoading} />
            </div>
        </div>
        <div>
          <Label htmlFor="link">Link do okazji</Label>
          <Input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} required disabled={isLoading} />
        </div>
        <div>
          <Label htmlFor="image">Link do obrazka</Label>
          <Input id="image" type="url" value={image} onChange={(e) => setImage(e.target.value)} required disabled={isLoading} />
        </div>
        
        {/* Kategorie - 3 poziomy */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="mainCategory">Kategoria główna *</Label>
            <Select value={mainCategorySlug} onValueChange={setMainCategorySlug} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię główną" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subcategories.length > 0 && (
            <div>
              <Label htmlFor="subCategory">Podkategoria *</Label>
              <Select value={subCategorySlug} onValueChange={setSubCategorySlug} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz podkategorię" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((subcat) => (
                    <SelectItem key={subcat.slug} value={subcat.slug}>
                      {subcat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {subsubcategories.length > 0 && (
            <div>
              <Label htmlFor="subSubCategory">Pod-podkategoria (opcjonalna)</Label>
              <Select value={subSubCategorySlug} onValueChange={setSubSubCategorySlug} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz pod-podkategorię" />
                </SelectTrigger>
                <SelectContent>
                  {subsubcategories.map((subsubcat) => (
                    <SelectItem key={subsubcat.slug} value={subsubcat.slug}>
                      {subsubcat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="linkedProduct">Połącz z produktem (opcjonalnie)</Label>
          <Input
            id="linkedProduct"
            placeholder="Wyszukaj produkt po nazwie..."
            value={productQuery}
            onChange={e => setProductQuery(e.target.value)}
            disabled={isLoading}
          />
          {productSearchLoading && <p className="text-xs text-muted-foreground">Szukam...</p>}
          {productResults.length > 0 && (
            <div className="border rounded-md divide-y">
              {productResults.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => { setLinkedProductId(p.id); setProductQuery(p.name); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between ${linkedProductId===p.id ? 'bg-primary/10' : ''}`}
                >
                  <span className="line-clamp-1">{p.name}</span>
                  {linkedProductId===p.id && <span className="text-primary text-xs">Wybrano</span>}
                </button>
              ))}
            </div>
          )}
          {linkedProductId && (
            <p className="text-xs text-green-600">Powiązany produkt ID: {linkedProductId}</p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? 'Dodawanie...' : 'Dodaj okazję'}
        </Button>
      </form>
    </div>
  );
}
