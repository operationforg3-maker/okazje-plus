'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Bell, BellOff, Edit, Trash2, Search } from 'lucide-react';
import { SavedSearch, describeFilters } from '@/lib/saved-searches';
import { useAuth } from '@/lib/auth';
import { getFirestore, collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { toast } from 'sonner';
import SavedSearchDialog from './saved-search-dialog';

export default function SavedSearchesList() {
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchToDelete, setSearchToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchToEdit, setSearchToEdit] = useState<SavedSearch | undefined>();

  useEffect(() => {
    if (!user) {
      setSearches([]);
      setLoading(false);
      return;
    }

    const db = getFirestore(getApp());
    const q = query(
      collection(db, 'saved_searches'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const searchesData: SavedSearch[] = [];
      snapshot.forEach((doc) => {
        searchesData.push({ id: doc.id, ...doc.data() } as SavedSearch);
      });
      setSearches(searchesData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async () => {
    if (!searchToDelete) return;

    try {
      const db = getFirestore(getApp());
      await deleteDoc(doc(db, 'saved_searches', searchToDelete));
      toast.success('Wyszukiwanie usunięte');
    } catch (error) {
      console.error('Error deleting search:', error);
      toast.error('Nie udało się usunąć wyszukiwania');
    } finally {
      setDeleteDialogOpen(false);
      setSearchToDelete(null);
    }
  };

  const toggleNotifications = async (searchId: string, currentState: boolean) => {
    try {
      const db = getFirestore(getApp());
      await updateDoc(doc(db, 'saved_searches', searchId), {
        notificationsEnabled: !currentState,
      });
      toast.success(
        !currentState ? 'Powiadomienia włączone' : 'Powiadomienia wyłączone'
      );
    } catch (error) {
      console.error('Error toggling notifications:', error);
      toast.error('Nie udało się zmienić ustawień');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Ładowanie...</p>
        </CardContent>
      </Card>
    );
  }

  if (searches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <Search className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Nie masz jeszcze zapisanych wyszukiwań
            </p>
            <p className="text-sm text-muted-foreground">
              Zapisz swoje ulubione filtry aby otrzymywać powiadomienia o nowych okazjach
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {searches.map((search) => (
          <Card key={search.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{search.name}</CardTitle>
                  {search.description && (
                    <CardDescription>{search.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleNotifications(search.id!, search.notificationsEnabled)}
                  >
                    {search.notificationsEnabled ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchToEdit(search);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchToDelete(search.id!);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {describeFilters(search.filters)}
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {search.notificationsEnabled && (
                    <Badge variant="secondary">
                      Powiadomienia:{' '}
                      {search.notificationFrequency === 'instant'
                        ? 'natychmiastowe'
                        : search.notificationFrequency === 'daily'
                        ? 'codzienne'
                        : 'cotygodniowe'}
                    </Badge>
                  )}
                  {search.matchCount > 0 && (
                    <Badge variant="outline">
                      {search.matchCount} {search.matchCount === 1 ? 'dopasowanie' : 'dopasowań'}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Utworzono: {new Date(search.createdAt).toLocaleDateString('pl-PL')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno usunąć?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Zapisane wyszukiwanie zostanie trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editDialogOpen && (
        <SavedSearchDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          existingSearch={searchToEdit}
        />
      )}
    </>
  );
}
