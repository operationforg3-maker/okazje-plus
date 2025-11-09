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
import { Product } from '@/lib/types';
import { getCategories } from '@/lib/data';
import { Loader2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ProductFormData {
  name: string;
  description: string;
  longDescription: string;
  price: number;
  image: string;
  affiliateUrl: string;
  mainCategorySlug: string;
  subCategorySlug: string;
  status: 'draft' | 'approved' | 'rejected';
  // Rating fields
  ratingAverage: number;
  ratingCount: number;
  ratingDurability: number;
  ratingEaseOfUse: number;
  ratingValueForMoney: number;
  ratingVersatility: number;
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
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
  } = useForm<ProductFormData>({
    defaultValues: product
      ? {
          name: product.name,
          description: product.description,
          longDescription: product.longDescription,
          price: product.price,
          image: product.image,
          affiliateUrl: product.affiliateUrl,
          mainCategorySlug: product.mainCategorySlug,
          subCategorySlug: product.subCategorySlug,
          status: product.status,
          ratingAverage: product.ratingCard?.average || 0,
          ratingCount: product.ratingCard?.count || 0,
          ratingDurability: product.ratingCard?.durability || 0,
          ratingEaseOfUse: product.ratingCard?.easeOfUse || 0,
          ratingValueForMoney: product.ratingCard?.valueForMoney || 0,
          ratingVersatility: product.ratingCard?.versatility || 0,
        }
      : {
          status: 'draft',
          image: '',
          affiliateUrl: '',
          ratingAverage: 0,
          ratingCount: 0,
          ratingDurability: 0,
          ratingEaseOfUse: 0,
          ratingValueForMoney: 0,
          ratingVersatility: 0,
        },
  });

  const mainCategorySlug = watch('mainCategorySlug');

  // Pobierz kategorie
  useEffect(() => {
    async function fetchCategories() {
      const cats = await getCategories();
      setCategories(cats);
      
      if (product?.mainCategorySlug) {
        const mainCat = cats.find((c: any) => c.slug === product.mainCategorySlug);
        if (mainCat?.subcategories) {
          setSubcategories(mainCat.subcategories);
        }
      }
    }
    fetchCategories();
  }, [product]);

  // Aktualizuj podkategorie
  useEffect(() => {
    if (mainCategorySlug) {
      const mainCat = categories.find((c) => c.slug === mainCategorySlug);
      setSubcategories(mainCat?.subcategories || []);
      setValue('subCategorySlug', '');
    }
  }, [mainCategorySlug, categories, setValue]);

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);

    try {
      const productData = {
        name: data.name,
        description: data.description,
        longDescription: data.longDescription,
        price: data.price,
        image: data.image,
        imageHint: data.name,
        affiliateUrl: data.affiliateUrl,
        mainCategorySlug: data.mainCategorySlug,
        subCategorySlug: data.subCategorySlug,
        status: data.status,
        category: data.mainCategorySlug, // Dla kompatybilności
        ratingCard: {
          average: data.ratingAverage,
          count: data.ratingCount,
          durability: data.ratingDurability,
          easeOfUse: data.ratingEaseOfUse,
          valueForMoney: data.ratingValueForMoney,
          versatility: data.ratingVersatility,
        },
      };

      const url = product
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products';
      
      const method = product ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas zapisywania produktu');
      }

      toast({
        title: product ? 'Produkt zaktualizowany' : 'Produkt dodany',
        description: product
          ? 'Pomyślnie zaktualizowano produkt'
          : 'Nowy produkt został dodany do bazy',
      });

      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać produktu. Spróbuj ponownie.',
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
            Wprowadź podstawowe dane o produkcie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nazwa */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nazwa produktu <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name', {
                required: 'Nazwa jest wymagana',
                minLength: { value: 3, message: 'Nazwa musi mieć min. 3 znaki' },
              })}
              placeholder="np. Sony WH-1000XM5"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Krótki opis */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Krótki opis <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              {...register('description', {
                required: 'Opis jest wymagany',
                minLength: { value: 20, message: 'Opis musi mieć min. 20 znaków' },
              })}
              placeholder="Zwięzły opis produktu (1-2 zdania)"
              rows={2}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Długi opis */}
          <div className="space-y-2">
            <Label htmlFor="longDescription">
              Szczegółowy opis <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="longDescription"
              {...register('longDescription', {
                required: 'Szczegółowy opis jest wymagany',
                minLength: { value: 50, message: 'Opis musi mieć min. 50 znaków' },
              })}
              placeholder="Pełny opis produktu z funkcjami, specyfikacją, zastosowaniem..."
              rows={6}
            />
            {errors.longDescription && (
              <p className="text-sm text-destructive">{errors.longDescription.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cena i linki</CardTitle>
          <CardDescription>
            Podaj cenę i link afiliacyjny do produktu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cena */}
          <div className="space-y-2">
            <Label htmlFor="price">
              Cena (zł) <span className="text-destructive">*</span>
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

          {/* Link afiliacyjny */}
          <div className="space-y-2">
            <Label htmlFor="affiliateUrl">
              Link afiliacyjny <span className="text-destructive">*</span>
            </Label>
            <Input
              id="affiliateUrl"
              type="url"
              {...register('affiliateUrl', {
                required: 'Link jest wymagany',
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Podaj prawidłowy URL',
                },
              })}
              placeholder="https://example.com/product?ref=..."
            />
            {errors.affiliateUrl && (
              <p className="text-sm text-destructive">{errors.affiliateUrl.message}</p>
            )}
          </div>

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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kategoria</CardTitle>
          <CardDescription>
            Wybierz kategorię produktu
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Oceny produktu
          </CardTitle>
          <CardDescription>
            Wprowadź dane o ocenach (skala 0-5)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ratingAverage">Średnia ocena</Label>
              <Input
                id="ratingAverage"
                type="number"
                step="0.1"
                {...register('ratingAverage', {
                  min: { value: 0, message: 'Min. 0' },
                  max: { value: 5, message: 'Max. 5' },
                  valueAsNumber: true,
                })}
                placeholder="4.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratingCount">Liczba ocen</Label>
              <Input
                id="ratingCount"
                type="number"
                {...register('ratingCount', {
                  min: { value: 0, message: 'Min. 0' },
                  valueAsNumber: true,
                })}
                placeholder="125"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratingDurability">Trwałość</Label>
              <Input
                id="ratingDurability"
                type="number"
                step="0.1"
                {...register('ratingDurability', {
                  min: { value: 0, message: 'Min. 0' },
                  max: { value: 5, message: 'Max. 5' },
                  valueAsNumber: true,
                })}
                placeholder="4.2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratingEaseOfUse">Łatwość użycia</Label>
              <Input
                id="ratingEaseOfUse"
                type="number"
                step="0.1"
                {...register('ratingEaseOfUse', {
                  min: { value: 0, message: 'Min. 0' },
                  max: { value: 5, message: 'Max. 5' },
                  valueAsNumber: true,
                })}
                placeholder="4.8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratingValueForMoney">Stosunek jakości do ceny</Label>
              <Input
                id="ratingValueForMoney"
                type="number"
                step="0.1"
                {...register('ratingValueForMoney', {
                  min: { value: 0, message: 'Min. 0' },
                  max: { value: 5, message: 'Max. 5' },
                  valueAsNumber: true,
                })}
                placeholder="4.3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratingVersatility">Uniwersalność</Label>
              <Input
                id="ratingVersatility"
                type="number"
                step="0.1"
                {...register('ratingVersatility', {
                  min: { value: 0, message: 'Min. 0' },
                  max: { value: 5, message: 'Max. 5' },
                  valueAsNumber: true,
                })}
                placeholder="4.6"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status publikacji</CardTitle>
          <CardDescription>
            Wybierz status produktu
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
                <SelectItem value="approved">Zatwierdzony (widoczny publicznie)</SelectItem>
                <SelectItem value="rejected">Odrzucony</SelectItem>
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
          {product ? 'Zaktualizuj produkt' : 'Dodaj produkt'}
        </Button>
      </div>
    </form>
  );
}
