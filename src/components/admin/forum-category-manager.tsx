'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  GripVertical,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  createdAt?: string;
}

export function ForumCategoryManager() {
  const { getIdToken } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; categoryId: string | null }>({
    open: false,
    categoryId: null,
  });
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/admin/forum/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load categories');

      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Load categories error:', error);
      toast.error('Błąd ładowania kategorii');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handleCreate() {
    if (!formData.name.trim()) {
      toast.error('Nazwa kategorii jest wymagana');
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/admin/forum/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create category');
      }

      toast.success('Kategoria utworzona');
      setFormData({ name: '', description: '' });
      setIsCreating(false);
      await loadCategories();
    } catch (error: any) {
      console.error('Create category error:', error);
      toast.error(error.message || 'Błąd tworzenia kategorii');
    }
  }

  async function handleUpdate(categoryId: string) {
    if (!formData.name.trim()) {
      toast.error('Nazwa kategorii jest wymagana');
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/admin/forum/categories/${categoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to update category');

      toast.success('Kategoria zaktualizowana');
      setEditingId(null);
      setFormData({ name: '', description: '' });
      await loadCategories();
    } catch (error) {
      console.error('Update category error:', error);
      toast.error('Błąd aktualizacji kategorii');
    }
  }

  async function handleDelete(categoryId: string) {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/admin/forum/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete category');
      }

      toast.success('Kategoria usunięta');
      setDeleteDialog({ open: false, categoryId: null });
      await loadCategories();
    } catch (error: any) {
      console.error('Delete category error:', error);
      toast.error(error.message || 'Błąd usuwania kategorii');
    }
  }

  async function handleReorder(index: number, direction: 'up' | 'down') {
    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newCategories.length) return;

    // Swap
    [newCategories[index], newCategories[targetIndex]] = [
      newCategories[targetIndex],
      newCategories[index],
    ];

    // Update sortOrder
    const reorderedCategories = newCategories.map((cat, idx) => ({
      id: cat.id,
      sortOrder: idx + 1,
    }));

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/admin/forum/categories/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ categories: reorderedCategories }),
      });

      if (!res.ok) throw new Error('Failed to reorder');

      setCategories(newCategories);
      toast.success('Kolejność zaktualizowana');
    } catch (error) {
      console.error('Reorder error:', error);
      toast.error('Błąd zmiany kolejności');
    }
  }

  function startEdit(category: ForumCategory) {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: '', description: '' });
  }

  if (loading) {
    return <div>Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kategorie forum</CardTitle>
              <CardDescription>
                Zarządzaj kategoriami - twórz, edytuj, usuwaj i zmieniaj kolejność
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nowa kategoria
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Formularz tworzenia */}
          {isCreating && (
            <Card className="border-2 border-primary">
              <CardContent className="pt-6 space-y-3">
                <div>
                  <label className="text-sm font-medium">Nazwa kategorii</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="np. Porady zakupowe"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Opis (opcjonalnie)</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Krótki opis kategorii..."
                    className="h-20"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} className="gap-2">
                    <Save className="h-4 w-4" />
                    Zapisz
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} className="gap-2">
                    <X className="h-4 w-4" />
                    Anuluj
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista kategorii */}
          {categories.length === 0 && !isCreating && (
            <p className="text-center text-muted-foreground py-8">
              Brak kategorii. Utwórz pierwszą kategorię.
            </p>
          )}

          {categories.map((category, index) => (
            <Card key={category.id} className={editingId === category.id ? 'border-2 border-primary' : ''}>
              <CardContent className="pt-6">
                {editingId === category.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Nazwa kategorii</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Opis</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="h-20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleUpdate(category.id)} size="sm" className="gap-2">
                        <Save className="h-4 w-4" />
                        Zapisz
                      </Button>
                      <Button variant="outline" onClick={cancelEdit} size="sm" className="gap-2">
                        <X className="h-4 w-4" />
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{category.name}</h3>
                          <Badge variant="outline">{category.slug}</Badge>
                        </div>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorder(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorder(index, 'down')}
                        disabled={index === categories.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => startEdit(category)} className="gap-2">
                        <Edit2 className="h-4 w-4" />
                        Edytuj
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, categoryId: category.id })}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Usuń
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Dialog usuwania */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, categoryId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potwierdź usunięcie</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć tę kategorię? Tej operacji nie można cofnąć.
              Kategoria nie może być usunięta jeśli ma przypisane wątki.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, categoryId: null })}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog.categoryId && handleDelete(deleteDialog.categoryId)}
            >
              Usuń
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
