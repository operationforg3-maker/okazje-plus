'use client';

import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Deal } from '@/lib/types';
import { getCategories } from '@/lib/data';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DealFormProps {
  deal?: Deal; // Jeśli przekazane, tryb edycji
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface DealFormData {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  mainCategorySlug: string;
  subCategorySlug: string;
  merchant?: string;
  shippingCost?: number;
  status: 'draft' | 'approved' | 'rejected';
}

export function DealForm({ deal, onSuccess, onCancel }: DealFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [subcategories, setSubcategories] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<DealFormData>({
    defaultValues: deal
      ? {
          title: deal.title,
          description: deal.description,
          price: deal.price,
          originalPrice: deal.originalPrice,
          link: deal.link,
          image: deal.image,
          mainCategorySlug: deal.mainCategorySlug,
          subCategorySlug: deal.subCategorySlug,
          merchant: deal.merchant,
          shippingCost: deal.shippingCost,
          status: deal.status || 'draft',
        }
      : {
          status: 'draft',
          image: '',
          link: '',
        },
  });

  const mainCategorySlug = watch('mainCategorySlug');
  const price = watch('price');
  const originalPrice = watch('originalPrice');

  // Oblicz rabat
  const discount =
    originalPrice && price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  // Pobierz kategorie
  useEffect(() => {
    async function fetchCategories() {
      const cats = await getCategories();
      setCategories(cats);
      
      // Jeśli edytujemy, ustaw podkategorie dla wybranej kategorii głównej
      if (deal?.mainCategorySlug) {
        const mainCat = cats.find((c: any) => c.slug === deal.mainCategorySlug);
        if (mainCat?.subcategories) {
          setSubcategories(mainCat.subcategories);
        }
      }
    }
    fetchCategories();
  }, [deal]);

  // Aktualizuj podkategorie gdy zmieni się kategoria główna
  useEffect(() => {
    if (mainCategorySlug) {
      const mainCat = categories.find((c) => c.slug === mainCategorySlug);
      setSubcategories(mainCat?.subcategories || []);
      setValue('subCategorySlug', ''); // Reset podkategorii
    }
  }, [mainCategorySlug, categories, setValue]);

  const onSubmit = async (data: DealFormData) => {
    setIsSubmitting(true);

    try {
      const dealData = {
        ...data,
        temperature: deal?.temperature || 0,
        commentsCount: deal?.commentsCount || 0,
        voteCount: deal?.voteCount || 0,
        postedAt: deal?.postedAt || new Date().toISOString(),
        postedBy: deal?.postedBy || 'Administrator',
        imageHint: data.title,
        category: data.mainCategorySlug, // Dla kompatybilności
        createdBy: deal?.createdBy || 'admin', // TODO: Użyj rzeczywistego userId z auth
      };

      const url = deal
        ? `/api/admin/deals/${deal.id}`
        : '/api/admin/deals';
      
      const method = deal ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas zapisywania okazji');
      }

      toast({
        title: deal ? 'Okazja zaktualizowana' : 'Okazja dodana',
        description: deal
          ? 'Pomyślnie zaktualizowano okazję'
          : 'Nowa okazja została dodana do bazy',
      });

      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving deal:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać okazji. Spróbuj ponownie.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
          <CardDescription>
            Wprowadź podstawowe dane o okazji
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tytuł */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Tytuł okazji <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              {...register('title', {
                required: 'Tytuł jest wymagany',
                minLength: { value: 10, message: 'Tytuł musi mieć min. 10 znaków' },
              })}
              placeholder="np. iPhone 15 Pro Max 256GB - najniższa cena!"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Opis */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Opis <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              {...register('description', {
                required: 'Opis jest wymagany',
                minLength: { value: 20, message: 'Opis musi mieć min. 20 znaków' },
              })}
              placeholder="Szczegółowy opis okazji, co wyróżnia tę ofertę..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* URL okazji */}
          <div className="space-y-2">
            <Label htmlFor="link">
              Link do okazji <span className="text-destructive">*</span>
            </Label>
            <Input
              id="link"
              type="url"
              {...register('link', {
                required: 'Link jest wymagany',
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Podaj prawidłowy URL (zaczynający się od http:// lub https://)',
                },
              })}
              placeholder="https://example.com/product"
            />
            {errors.link && (
              <p className="text-sm text-destructive">{errors.link.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cena i rabat</CardTitle>
          <CardDescription>
            Podaj cenę promocyjną i regularną
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Cena promocyjna */}
            <div className="space-y-2">
              <Label htmlFor="price">
                Cena promocyjna (zł) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register('price', {
                  required: 'Cena jest wymagana',
                  min: { value: 0.01, message: 'Cena musi być większa od 0' },
                  valueAsNumber: true,
                })}
                placeholder="999.99"
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price.message}</p>
              )}
            </div>

            {/* Cena regularna */}
            <div className="space-y-2">
              <Label htmlFor="originalPrice">Cena regularna (zł)</Label>
              <Input
                id="originalPrice"
                type="number"
                step="0.01"
                {...register('originalPrice', {
                  min: { value: 0.01, message: 'Cena musi być większa od 0' },
                  valueAsNumber: true,
                })}
                placeholder="1299.99"
              />
              {errors.originalPrice && (
                <p className="text-sm text-destructive">
                  {errors.originalPrice.message}
                </p>
              )}
            </div>
          </div>

          {/* Wyświetl rabat */}
          {discount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-base px-3 py-1">
                -{discount}%
              </Badge>
              <span className="text-sm text-muted-foreground">
                Oszczędzasz: {(originalPrice! - price).toFixed(2)} zł
              </span>
            </div>
          )}

          {/* Merchant */}
          <div className="space-y-2">
            <Label htmlFor="merchant">Sklep</Label>
            <Input
              id="merchant"
              {...register('merchant')}
              placeholder="np. MediaMarkt, RTV Euro AGD"
            />
          </div>

          {/* Dostawa */}
          <div className="space-y-2">
            <Label htmlFor="shippingCost">Koszt dostawy (zł)</Label>
            <Input
              id="shippingCost"
              type="number"
              step="0.01"
              {...register('shippingCost', { valueAsNumber: true })}
              placeholder="0.00 (zostaw puste jeśli darmowa dostawa)"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kategoria i zdjęcie</CardTitle>
          <CardDescription>
            Wybierz kategorię i dodaj zdjęcie produktu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Kategoria główna */}
          <div className="space-y-2">
            <Label htmlFor="mainCategorySlug">
              Kategoria główna <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('mainCategorySlug')}
              onValueChange={(value) => setValue('mainCategorySlug', value)}
            >
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
            {errors.mainCategorySlug && (
              <p className="text-sm text-destructive">
                {errors.mainCategorySlug.message}
              </p>
            )}
          </div>

          {/* Podkategoria */}
          {subcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subCategorySlug">
                Podkategoria <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('subCategorySlug')}
                onValueChange={(value) => setValue('subCategorySlug', value)}
              >
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
              {errors.subCategorySlug && (
                <p className="text-sm text-destructive">
                  {errors.subCategorySlug.message}
                </p>
              )}
            </div>
          )}

          {/* URL zdjęcia */}
          <div className="space-y-2">
            <Label htmlFor="image">
              URL zdjęcia <span className="text-destructive">*</span>
            </Label>
            <Input
              id="image"
              type="url"
              {...register('image', {
                required: 'URL zdjęcia jest wymagany',
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Podaj prawidłowy URL',
                },
              })}
              placeholder="https://example.com/image.jpg"
            />
            {errors.image && (
              <p className="text-sm text-destructive">{errors.image.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Wklej link do zdjęcia produktu (format: JPG, PNG, WEBP)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status publikacji</CardTitle>
          <CardDescription>
            Wybierz status okazji
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(value: any) => setValue('status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Wersja robocza</SelectItem>
                <SelectItem value="approved">Zatwierdzona (widoczna publicznie)</SelectItem>
                <SelectItem value="rejected">Odrzucona</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Akcje */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {deal ? 'Zaktualizuj okazję' : 'Dodaj okazję'}
        </Button>
      </div>
    </form>
  );
}
