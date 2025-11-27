'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { SavedSearch, SavedSearchFilters } from '@/lib/saved-searches';
import { useAuth } from '@/lib/auth';
import { getFirestore, collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { getApp } from 'firebase/app';

interface SavedSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSearch?: SavedSearch;
  initialFilters?: Partial<SavedSearchFilters>;
}

export default function SavedSearchDialog({
  open,
  onOpenChange,
  existingSearch,
  initialFilters,
}: SavedSearchDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState(existingSearch?.name || '');
  const [description, setDescription] = useState(existingSearch?.description || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    existingSearch?.notificationsEnabled ?? true
  );
  const [notificationFrequency, setNotificationFrequency] = useState<'instant' | 'daily' | 'weekly'>(
    existingSearch?.notificationFrequency || 'instant'
  );

  const handleSave = async () => {
    if (!user) {
      toast.error('Musisz być zalogowany');
      return;
    }

    if (!name.trim()) {
      toast.error('Nazwa wyszukiwania jest wymagana');
      return;
    }

    setLoading(true);

    try {
      const db = getFirestore(getApp());
      const searchData: Omit<SavedSearch, 'id'> = {
        userId: user.uid,
        name: name.trim(),
        description: description.trim() || undefined,
        filters: initialFilters || existingSearch?.filters || {},
        notificationsEnabled,
        notificationFrequency,
        createdAt: existingSearch?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        matchCount: existingSearch?.matchCount || 0,
        isPinned: existingSearch?.isPinned || false,
      };

      if (existingSearch?.id) {
        // Update
        await updateDoc(doc(db, 'saved_searches', existingSearch.id), {
          ...searchData,
        });
        toast.success('Zapisane wyszukiwanie zaktualizowane');
      } else {
        // Create
        await addDoc(collection(db, 'saved_searches'), searchData);
        toast.success('Wyszukiwanie zapisane');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving search:', error);
      toast.error('Nie udało się zapisać wyszukiwania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingSearch ? 'Edytuj wyszukiwanie' : 'Zapisz wyszukiwanie'}
          </DialogTitle>
          <DialogDescription>
            Otrzymuj powiadomienia gdy pojawią się nowe okazje pasujące do Twoich kryteriów
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa wyszukiwania</Label>
            <Input
              id="name"
              placeholder="np. Laptopy do 3000 zł"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis (opcjonalny)</Label>
            <Textarea
              id="description"
              placeholder="Dodatkowe szczegóły..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Powiadomienia</Label>
                <p className="text-sm text-muted-foreground">
                  Otrzymuj alerty o nowych okazjach
                </p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>

            {notificationsEnabled && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Częstotliwość powiadomień</Label>
                <Select
                  value={notificationFrequency}
                  onValueChange={(value: 'instant' | 'daily' | 'weekly') =>
                    setNotificationFrequency(value)
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Natychmiastowe</SelectItem>
                    <SelectItem value="daily">Codzienne podsumowanie</SelectItem>
                    <SelectItem value="weekly">Cotygodniowe podsumowanie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Zapisywanie...' : existingSearch ? 'Zapisz zmiany' : 'Zapisz wyszukiwanie'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
