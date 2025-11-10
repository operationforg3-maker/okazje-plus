'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { submitProductRating } from '@/lib/data';
import { useAuth } from '@/lib/auth';

interface RatingInputProps {
  productId: string;
  existingRating?: {
    rating: number;
    durability: number;
    easeOfUse: number;
    valueForMoney: number;
    versatility: number;
    review?: string;
  } | null;
  onRatingSubmitted?: () => void;
}

export default function RatingInput({ productId, existingRating, onRatingSubmitted }: RatingInputProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [durability, setDurability] = useState(existingRating?.durability || 3);
  const [easeOfUse, setEaseOfUse] = useState(existingRating?.easeOfUse || 3);
  const [valueForMoney, setValueForMoney] = useState(existingRating?.valueForMoney || 3);
  const [versatility, setVersatility] = useState(existingRating?.versatility || 3);
  const [review, setReview] = useState(existingRating?.review || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Musisz być zalogowany, aby ocenić produkt.');
      return;
    }

    // Zabezpieczenie: waliduj ocenę główną
    if (!rating || rating === 0) {
      toast.error('Wybierz ocenę gwiazdkową (1-5).');
      return;
    }

    // Zabezpieczenie: waliduj wszystkie oceny szczegółowe
    if (!durability || durability === 0 || durability < 1 || durability > 5) {
      toast.error('Trwałość: Wybierz wartość od 1 do 5.');
      return;
    }

    if (!easeOfUse || easeOfUse === 0 || easeOfUse < 1 || easeOfUse > 5) {
      toast.error('Łatwość użycia: Wybierz wartość od 1 do 5.');
      return;
    }

    if (!valueForMoney || valueForMoney === 0 || valueForMoney < 1 || valueForMoney > 5) {
      toast.error('Stosunek jakości do ceny: Wybierz wartość od 1 do 5.');
      return;
    }

    if (!versatility || versatility === 0 || versatility < 1 || versatility > 5) {
      toast.error('Wszechstronność: Wybierz wartość od 1 do 5.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Fallback wartości — jeśli z jakiegoś powodu walidacja przejdzie, użyj domyślnych
      const safeRating = Math.max(1, Math.min(5, rating || 3));
      const safeDurability = Math.max(1, Math.min(5, durability || 3));
      const safeEaseOfUse = Math.max(1, Math.min(5, easeOfUse || 3));
      const safeValueForMoney = Math.max(1, Math.min(5, valueForMoney || 3));
      const safeVersatility = Math.max(1, Math.min(5, versatility || 3));

      await submitProductRating(productId, user.uid, {
        rating: safeRating,
        durability: safeDurability,
        easeOfUse: safeEaseOfUse,
        valueForMoney: safeValueForMoney,
        versatility: safeVersatility,
        review: review.trim() || undefined,
        userDisplayName: user.displayName || undefined,
      });

      toast.success(existingRating ? 'Ocena została zaktualizowana!' : 'Dziękujemy za ocenę!');
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error('Błąd podczas zapisywania oceny:', error);
      toast.error(`Błąd: ${error?.message || 'Nie udało się zapisać oceny.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Oceń ten produkt</CardTitle>
          <CardDescription>Zaloguj się, aby dodać swoją ocenę</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" />
          {existingRating ? 'Edytuj swoją ocenę' : 'Oceń ten produkt'}
        </CardTitle>
        <CardDescription>
          Twoja opinia pomoże innym użytkownikom w podjęciu decyzji
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Główna ocena gwiazdkowa */}
        <div className="space-y-2">
          <Label>Ogólna ocena *</Label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoverRating || rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-sm font-semibold">
              {rating > 0 ? `${rating}/5` : 'Wybierz ocenę'}
            </span>
          </div>
        </div>

        {/* Szczegółowe oceny */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Trwałość</Label>
              <span className="text-sm font-medium">{durability.toFixed(1)}/5.0</span>
            </div>
            <Slider
              value={[durability]}
              onValueChange={([value]) => setDurability(value)}
              min={1}
              max={5}
              step={0.5}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Łatwość użycia</Label>
              <span className="text-sm font-medium">{easeOfUse.toFixed(1)}/5.0</span>
            </div>
            <Slider
              value={[easeOfUse]}
              onValueChange={([value]) => setEaseOfUse(value)}
              min={1}
              max={5}
              step={0.5}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Stosunek jakości do ceny</Label>
              <span className="text-sm font-medium">{valueForMoney.toFixed(1)}/5.0</span>
            </div>
            <Slider
              value={[valueForMoney]}
              onValueChange={([value]) => setValueForMoney(value)}
              min={1}
              max={5}
              step={0.5}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Wszechstronność</Label>
              <span className="text-sm font-medium">{versatility.toFixed(1)}/5.0</span>
            </div>
            <Slider
              value={[versatility]}
              onValueChange={([value]) => setVersatility(value)}
              min={1}
              max={5}
              step={0.5}
              className="w-full"
            />
          </div>
        </div>

        {/* Opcjonalna recenzja */}
        <div className="space-y-2">
          <Label htmlFor="review">Twoja opinia (opcjonalnie)</Label>
          <Textarea
            id="review"
            placeholder="Podziel się swoimi wrażeniami o produkcie..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            !rating ||
            rating === 0 ||
            !durability ||
            !easeOfUse ||
            !valueForMoney ||
            !versatility ||
            durability < 1 ||
            durability > 5 ||
            easeOfUse < 1 ||
            easeOfUse > 5 ||
            valueForMoney < 1 ||
            valueForMoney > 5 ||
            versatility < 1 ||
            versatility > 5
          }
          className="w-full"
          size="lg"
        >
          {isSubmitting ? 'Zapisywanie...' : existingRating ? 'Zaktualizuj ocenę' : 'Wyślij ocenę'}
        </Button>
      </CardContent>
    </Card>
  );
}
