'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ProductSuggestion from '@/components/product-suggestion';
import { toast } from 'sonner';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast.error('Musisz być zalogowany, aby dodać okazję.');
        return;
    }

    try {
        await addDoc(collection(db, 'deals'), {
            title,
            description,
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            link,
            image,
            linkedProductId,
            userId: user.uid,
            author: user.displayName || user.email,
            temperature: 0,
            createdAt: serverTimestamp(),
            status: 'pending', // lub 'approved' jeśli nie ma moderacji
        });
        toast.success('Okazja została dodana i czeka na zatwierdzenie.');
        router.push('/deals');
    } catch (error) {
        console.error('Błąd podczas dodawania okazji: ', error);
        toast.error('Wystąpił błąd podczas dodawania okazji.');
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
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="description">Opis</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="price">Cena</Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
                <Label htmlFor="originalPrice">Cena oryginalna (opcjonalnie)</Label>
                <Input id="originalPrice" type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
            </div>
        </div>
        <div>
          <Label htmlFor="link">Link do okazji</Label>
          <Input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="image">Link do obrazka</Label>
          <Input id="image" type="url" value={image} onChange={(e) => setImage(e.target.value)} required />
        </div>
        <div>
            <Label>Połącz z produktem (opcjonalnie)</Label>
            <ProductSuggestion dealTitle={title} onProductSelect={setLinkedProductId} />
        </div>
        <Button type="submit" size="lg" className="w-full">Dodaj okazję</Button>
      </form>
    </div>
  );
}
