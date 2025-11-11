'use client';
export const dynamic = 'force-dynamic';


import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable, FunctionsError } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ProductSuggestion from '@/components/product-suggestion';
import { toast } from 'sonner';

// Typ dla danych nowej okazji wysyłanych do Cloud Function
interface NewDealData {
  title: string;
  description: string;
  price: number;
  dealUrl: string;
  imageUrl: string;
}

const functions = getFunctions();
const createDealCallable = httpsCallable<NewDealData, { dealId: string }>(functions, 'createDeal');

export default function AddDealPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  // const [linkedProductId, setLinkedProductId] = useState<string | null>(null); // TODO: Implement product linking
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

    const newDealData: NewDealData = {
        title,
        description,
        price: parseFloat(price),
        dealUrl: link,
        imageUrl: image,
    };

    setIsLoading(true);
    toast.info('Przetwarzanie danych...');

    try {
        const result = await createDealCallable(newDealData);
        toast.success(`Okazja została pomyślnie dodana! ID: ${result.data.dealId}`);
        router.push('/deals');
    } catch (error) {
        console.error('Błąd podczas wywoływania funkcji createDeal: ', error);
        const httpsError = error as FunctionsError;
        // Wyświetlamy bardziej szczegółowy komunikat błędu zwrócony z funkcji
        toast.error(httpsError.message || 'Wystąpił nieoczekiwany błąd.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-2xl">
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
        <div>
            <Label>Połącz z produktem (opcjonalnie)</Label>
            <ProductSuggestion dealTitle={title} onProductSelect={setLinkedProductId} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? 'Dodawanie...' : 'Dodaj okazję'}
        </Button>
      </form>
    </div>
  );
}
