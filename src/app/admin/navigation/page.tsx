'use client';

import { useEffect, useMemo, useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { isAdmin, useAuth } from '@/lib/auth';
import { Category, CategoryTile } from '@/lib/types';
import { getCategories } from '@/lib/data';
import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function AdminNavigationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCatId, setActiveCatId] = useState<string>('');
  const activeCategory = useMemo(() => categories.find(c => c.id === activeCatId) || null, [categories, activeCatId]);

  // Formularze przypiętych ID
  const [topRatedIds, setTopRatedIds] = useState('');
  const [bestSellingIds, setBestSellingIds] = useState('');

  // Nowy/edytowany kafelek
  const emptyTile: CategoryTile = { title: '', subtitle: '', image: '', link: '', badge: '', color: '', type: 'custom' };
  const [editingTile, setEditingTile] = useState<CategoryTile>(emptyTile);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const cats = await getCategories();
        setCategories(cats);
        if (!activeCatId && cats.length) setActiveCatId(cats[0].id);
      } catch (e) {
        console.error(e);
        toast({ title: 'Błąd', description: 'Nie udało się wczytać kategorii', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (activeCategory) {
      setTopRatedIds((activeCategory.topRatedIds || []).join('\n'));
      setBestSellingIds((activeCategory.bestSellingIds || []).join('\n'));
    }
  }, [activeCategory?.id]);

  if (!isAdmin(user)) {
    return <div className="p-6">Brak uprawnień.</div>;
  }

  const handleSavePinned = async () => {
    if (!activeCategory) return;
    try {
      const catRef = doc(db, 'categories', activeCategory.id);
      await updateDoc(catRef, {
        topRatedIds: topRatedIds.split('\n').map(s => s.trim()).filter(Boolean),
        bestSellingIds: bestSellingIds.split('\n').map(s => s.trim()).filter(Boolean),
      });
      toast({ title: 'Zapisano', description: 'Przypięte ID zostały zaktualizowane.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Błąd', description: e?.message || 'Nie udało się zapisać.', variant: 'destructive' });
    }
  };

  const handleEditTile = (tile?: CategoryTile) => {
    if (tile) {
      setEditingTile({ ...tile });
      setIsEditing(true);
    } else {
      setEditingTile({ ...emptyTile });
      setIsEditing(true);
    }
  };

  const handleDeleteTile = async (tileId?: string) => {
    if (!activeCategory || !tileId) return;
    try {
      await deleteDoc(doc(db, 'categories', activeCategory.id, 'tiles', tileId));
      setCategories(prev => prev.map(c => c.id === activeCategory.id ? { ...c, tiles: (c.tiles || []).filter(t => t.id !== tileId) } : c));
      toast({ title: 'Usunięto kafelek' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Błąd', description: e?.message || 'Nie udało się usunąć kafelka.', variant: 'destructive' });
    }
  };

  const handleSaveTile = async () => {
    if (!activeCategory) return;
    try {
      const tilesCol = collection(db, 'categories', activeCategory.id, 'tiles');
      if (editingTile.id) {
        await updateDoc(doc(tilesCol, editingTile.id), {
          title: editingTile.title,
          subtitle: editingTile.subtitle || '',
          image: editingTile.image || '',
          link: editingTile.link || '',
          badge: editingTile.badge || '',
          color: editingTile.color || '',
          type: editingTile.type || 'custom',
        });
        setCategories(prev => prev.map(c => c.id === activeCategory.id ? {
          ...c,
          tiles: (c.tiles || []).map(t => t.id === editingTile.id ? { ...editingTile } : t)
        } : c));
      } else {
        const newDoc = await addDoc(tilesCol, {
          title: editingTile.title,
          subtitle: editingTile.subtitle || '',
          image: editingTile.image || '',
          link: editingTile.link || '',
          badge: editingTile.badge || '',
          color: editingTile.color || '',
          type: editingTile.type || 'custom',
        });
        const newTile = { ...editingTile, id: newDoc.id } as CategoryTile;
        setCategories(prev => prev.map(c => c.id === activeCategory.id ? {
          ...c,
          tiles: [newTile, ...(c.tiles || [])]
        } : c));
      }
      setIsEditing(false);
      setEditingTile(emptyTile);
      toast({ title: 'Zapisano kafelek' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Błąd', description: e?.message || 'Nie udało się zapisać kafelka.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-3xl font-headline font-bold tracking-tight">Nawigacja i kafelki kategorii</h2>
        <p className="text-muted-foreground">Zarządzaj kafelkami i przypiętymi ID dla sekcji dynamicznych.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wybierz kategorię</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xl">
            <Label className="mb-2 block">Kategoria</Label>
            <Select value={activeCatId} onValueChange={setActiveCatId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wybierz kategorię" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {activeCategory && (
        <>
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Kafelki (tiles)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => handleEditTile()} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Dodaj kafelek
                  </Button>
                </div>
                <div className="grid gap-3">
                  {(activeCategory.tiles || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Brak kafelków w tej kategorii.</p>
                  )}
                  {(activeCategory.tiles || []).map(tile => (
                    <div key={tile.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{tile.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{tile.subtitle}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {tile.type && <Badge variant="secondary">{tile.type}</Badge>}
                          {tile.badge && <Badge>{tile.badge}</Badge>}
                          {tile.link && <span className="text-xs text-muted-foreground truncate max-w-[240px]">{tile.link}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditTile(tile)}>Edytuj</Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteTile(tile.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Tytuł</Label>
                        <Input value={editingTile.title} onChange={(e) => setEditingTile({ ...editingTile, title: e.target.value })} />
                      </div>
                      <div>
                        <Label>Podtytuł</Label>
                        <Input value={editingTile.subtitle || ''} onChange={(e) => setEditingTile({ ...editingTile, subtitle: e.target.value })} />
                      </div>
                      <div>
                        <Label>Obraz URL</Label>
                        <Input value={editingTile.image || ''} onChange={(e) => setEditingTile({ ...editingTile, image: e.target.value })} />
                      </div>
                      <div>
                        <Label>Link</Label>
                        <Input value={editingTile.link || ''} onChange={(e) => setEditingTile({ ...editingTile, link: e.target.value })} />
                      </div>
                      <div>
                        <Label>Badge</Label>
                        <Input value={editingTile.badge || ''} onChange={(e) => setEditingTile({ ...editingTile, badge: e.target.value })} />
                      </div>
                      <div>
                        <Label>Kolor (hex/rgb)</Label>
                        <Input value={editingTile.color || ''} onChange={(e) => setEditingTile({ ...editingTile, color: e.target.value })} />
                      </div>
                      <div>
                        <Label>Typ</Label>
                        <Select value={editingTile.type || 'custom'} onValueChange={(v) => setEditingTile({ ...editingTile, type: v as CategoryTile['type'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">custom</SelectItem>
                            <SelectItem value="top-rated">top-rated</SelectItem>
                            <SelectItem value="best-selling">best-selling</SelectItem>
                            <SelectItem value="hot-deals">hot-deals</SelectItem>
                            <SelectItem value="category">category</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setIsEditing(false); setEditingTile(emptyTile); }}>Anuluj</Button>
                      <Button onClick={handleSaveTile}><Save className="h-4 w-4 mr-2" />Zapisz kafelek</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Przypięte ID (opcjonalne)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Top Rated Product IDs (po 1 w linii)</Label>
                  <Textarea className="min-h-[120px]" value={topRatedIds} onChange={(e) => setTopRatedIds(e.target.value)} placeholder={'prod_123\nprod_456'} />
                </div>
                <div>
                  <Label>Best Selling Product IDs (po 1 w linii)</Label>
                  <Textarea className="min-h-[120px]" value={bestSellingIds} onChange={(e) => setBestSellingIds(e.target.value)} placeholder={'prod_789'} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSavePinned}><Save className="h-4 w-4 mr-2" />Zapisz przypięte</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default withAuth(AdminNavigationPage);
