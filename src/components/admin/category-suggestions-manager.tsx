'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { listCategorySuggestions, approveCategorySuggestion, rejectCategorySuggestion } from '@/lib/data';
import { CategorySuggestion } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Clock } from 'lucide-react';

export function CategorySuggestionsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean;
    suggestionId: string;
    reason: string;
  }>({ open: false, suggestionId: '', reason: '' });

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const data = await listCategorySuggestions();
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować propozycji',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleApprove = async (suggestionId: string) => {
    try {
      await approveCategorySuggestion(suggestionId, user?.uid || '');
      toast({
        title: 'Sukces',
        description: 'Kategoria została utworzona',
      });
      loadSuggestions();
    } catch (error) {
      console.error('Error approving suggestion:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zatwierdzić propozycji',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!rejectionDialog.reason.trim()) {
      toast({
        title: 'Błąd',
        description: 'Podaj powód odrzucenia',
        variant: 'destructive',
      });
      return;
    }

    try {
      await rejectCategorySuggestion(
        rejectionDialog.suggestionId,
        user?.uid || '',
        rejectionDialog.reason
      );
      toast({
        title: 'Sukces',
        description: 'Propozycja została odrzucona',
      });
      setRejectionDialog({ open: false, suggestionId: '', reason: '' });
      loadSuggestions();
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się odrzucić propozycji',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="gap-1">
            <Clock className="h-3 w-3" />
            Oczekująca
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <Check className="h-3 w-3" />
            Zatwierdzona
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            Odrzucona
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const reviewedSuggestions = suggestions.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Oczekujące propozycje */}
      <div>
        <h2 className="text-2xl font-bold mb-4">
          Propozycje kategorii do zatwierdzenia ({pendingSuggestions.length})
        </h2>
        {pendingSuggestions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Brak oczekujących propozycji
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingSuggestions.map(suggestion => (
              <Card key={suggestion.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{suggestion.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Zaproponowana przez: {suggestion.suggestedByName || 'Anonimowy'}</span>
                        <span>•</span>
                        <span>
                          {new Date(suggestion.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(suggestion.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Zatwierdź
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setRejectionDialog({
                            open: true,
                            suggestionId: suggestion.id,
                            reason: '',
                          })
                        }
                      >
                        <X className="h-4 w-4 mr-1" />
                        Odrzuć
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Historia propozycji */}
      {reviewedSuggestions.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Historia propozycji</h2>
          <div className="space-y-3">
            {reviewedSuggestions.map(suggestion => (
              <Card key={suggestion.id} className="opacity-75">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{suggestion.name}</h3>
                        {getStatusBadge(suggestion.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        <div>
                          Zaproponowana przez: {suggestion.suggestedByName || 'Anonimowy'} (
                          {new Date(suggestion.createdAt).toLocaleDateString('pl-PL')})
                        </div>
                        {suggestion.reviewedAt && (
                          <div>
                            Rozpatrzona: {new Date(suggestion.reviewedAt).toLocaleDateString('pl-PL')}
                          </div>
                        )}
                        {suggestion.rejectionReason && (
                          <div className="bg-red-50 dark:bg-red-950 p-2 rounded mt-2">
                            <span className="font-medium">Powód odrzucenia:</span> {suggestion.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialog odrzucenia */}
      <Dialog open={rejectionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRejectionDialog({ open: false, suggestionId: '', reason: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odrzuć propozycję kategorii</DialogTitle>
            <DialogDescription>
              Podaj powód odrzucenia propozycji
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Podaj powód odrzucenia..."
              value={rejectionDialog.reason}
              onChange={(e) =>
                setRejectionDialog({
                  ...rejectionDialog,
                  reason: e.target.value,
                })
              }
              className="min-h-24"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setRejectionDialog({ open: false, suggestionId: '', reason: '' })
                }
              >
                Anuluj
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                Odrzuć
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
