'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { createCategorySuggestion } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CategorySuggestionDialogProps {
  onSuggestionCreated?: () => void;
}

export function CategorySuggestionDialog({ onSuggestionCreated }: CategorySuggestionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useTranslations('forum');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Błąd',
        description: 'Musisz być zalogowany',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim() || !description.trim()) {
      toast({
        title: 'Błąd',
        description: 'Uzupełnij wszystkie pola',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await createCategorySuggestion({
        name: name.trim(),
        description: description.trim(),
        suggestedByUid: user.uid,
        suggestedByName: user.displayName || user.email,
      });

      toast({
        title: 'Sukces',
        description: 'Twoja propozycja kategorii została wysłana do admina',
      });

      setName('');
      setDescription('');
      setOpen(false);
      onSuggestionCreated?.();
    } catch (error) {
      console.error('Error creating suggestion:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się wysłać propozycji',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Zaproponuj kategorię
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zaproponuj nową kategorię forum</DialogTitle>
          <DialogDescription>
            Twoja propozycja zostanie wysłana do moderatora do zatwierdzenia
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazwa kategorii</label>
            <Input
              placeholder="np. Smartwatche i opaski fitness"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Opis</label>
            <Textarea
              placeholder="Opisz co będzie obejmować ta kategoria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Wysyłanie...' : 'Wyślij propozycję'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
