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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('savedSearch');
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
      toast.error(t('mustBeLoggedIn'));
      return;
    }

    if (!name.trim()) {
      toast.error(t('nameRequired'));
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
        toast.success(t('updated'));
      } else {
        // Create
        await addDoc(collection(db, 'saved_searches'), searchData);
        toast.success(t('saved'));
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving search:', error);
      toast.error(t('saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingSearch ? t('editTitle') : t('save')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('notifications')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('notificationsDescription')}
                </p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>

            {notificationsEnabled && (
              <div className="space-y-2">
                <Label htmlFor="frequency">{t('frequency')}</Label>
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
                    <SelectItem value="instant">{t('instant')}</SelectItem>
                    <SelectItem value="daily">{t('daily')}</SelectItem>
                    <SelectItem value="weekly">{t('weekly')}</SelectItem>
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
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t('saving') : existingSearch ? t('saveChanges') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
