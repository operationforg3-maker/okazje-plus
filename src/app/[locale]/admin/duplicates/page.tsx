'use client';

/**
 * Duplicate Management Page (M2)
 * 
 * Admin interface for managing product duplicates
 * - View pending duplicate groups
 * - Review AI suggestions for canonical products
 * - Merge duplicates with different strategies
 * - Reject false positives
 */

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  GitMerge,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { getPendingDuplicateGroups, rejectDuplicateGroup, mergeProducts } from '@/lib/deduplication';
import { DuplicateGroup } from '@/lib/types';

function DuplicatesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const fetchDuplicateGroups = useCallback(async () => {
    setLoading(true);
    try {
      const groups = await getPendingDuplicateGroups();
      setDuplicateGroups(groups);
      setSelectedGroups(new Set()); // Reset selection
    } catch (error) {
      console.error('Error fetching duplicate groups:', error);
      toast({ title: 'Error', description: 'Failed to load duplicate groups', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDuplicateGroups(); }, [fetchDuplicateGroups]);

  const toggleExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) newExpanded.delete(groupId);
    else newExpanded.add(groupId);
    setExpandedGroups(newExpanded);
  };

  const toggleSelected = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) newSelected.delete(groupId);
    else newSelected.add(groupId);
    setSelectedGroups(newSelected);
  };

  const selectAll = () => {
    if (selectedGroups.size === duplicateGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(duplicateGroups.map(g => g.id)));
    }
  };

  const handleMerge = async (groupId: string, strategy: 'keep_canonical' | 'merge_attributes' | 'keep_both') => {
    if (!confirm(`Are you sure you want to merge these products using "${strategy}" strategy?`)) return;

    if (!user) {
      toast({ title: 'Błąd', description: 'Brak zalogowanego administratora', variant: 'destructive' });
      return;
    }

    setProcessingId(groupId);
    try {
      await mergeProducts(groupId, strategy, user.uid);
      toast({ title: 'Success', description: 'Products merged successfully' });
      await fetchDuplicateGroups();
    } catch (error) {
      console.error('Error merging products:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to merge products', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (groupId: string) => {
    if (!confirm('Are you sure these products are NOT duplicates?')) return;

    if (!user) {
      toast({ title: 'Błąd', description: 'Brak zalogowanego administratora', variant: 'destructive' });
      return;
    }

    setProcessingId(groupId);
    try {
      await rejectDuplicateGroup(groupId, user.uid, 'Manual review: not duplicates');
      toast({ title: 'Success', description: 'Duplicate group rejected' });
      await fetchDuplicateGroups();
    } catch (error) {
      console.error('Error rejecting group:', error);
      toast({ title: 'Error', description: 'Failed to reject duplicate group', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkReject = async () => {
    if (!user) {
      toast({ title: 'Błąd', description: 'Brak zalogowanego administratora', variant: 'destructive' });
      return;
    }
    if (selectedGroups.size === 0) return;
    if (!confirm(`Odrzucić ${selectedGroups.size} grup? (Nie są to duplikaty)`)) return;

    setProcessingId('bulk-reject');
    try {
      const promises = Array.from(selectedGroups).map(id => 
        rejectDuplicateGroup(id, user.uid, 'Bulk review: not duplicates')
      );
      await Promise.all(promises);
      toast({ title: 'Sukces', description: `Odrzucono ${selectedGroups.size} grup.` });
      await fetchDuplicateGroups();
    } catch (error) {
      console.error('Error bulk rejecting:', error);
      toast({ title: 'Error', description: 'Failed to process some groups', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const getSimilarityBadge = (score: number) => {
    if (score >= 0.95) return <Badge className="bg-red-600">Very High ({Math.round(score * 100)}%)</Badge>;
    if (score >= 0.90) return <Badge className="bg-orange-600">High ({Math.round(score * 100)}%)</Badge>;
    if (score >= 0.85) return <Badge className="bg-yellow-600">Medium ({Math.round(score * 100)}%)</Badge>;
    return <Badge variant="secondary">Low ({Math.round(score * 100)}%)</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Wykrywanie duplikatów</h2>
        <p className="text-muted-foreground">Przeglądaj i zarządzaj zduplikowanymi produktami</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Do sprawdzenia</CardTitle>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : duplicateGroups.length}
            </div>
            <p className="text-xs text-muted-foreground">Grupy oczekujące na moderację</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pewność AI</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : `${Math.round(
                  (duplicateGroups.reduce((sum, g) => sum + (g.aiSuggestion?.confidence || 0), 0) /
                    (duplicateGroups.length || 1)) * 100
                )}%`}
            </div>
            <p className="text-xs text-muted-foreground">Średnia pewność sztucznej inteligencji</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkty</CardTitle>
            <GitMerge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : duplicateGroups.reduce((sum, g) => sum + 1 + g.alternativeProductIds.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Objęte detekcją duplikatów</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Wykryte Grupy</CardTitle>
              <CardDescription>Podejmij decyzję o łączeniu lub odrzuceniu</CardDescription>
            </div>
            {selectedGroups.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkReject} disabled={processingId !== null}>
                {processingId === 'bulk-reject' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Odrzuć zaznaczone ({selectedGroups.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : duplicateGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Brak podejrzanych duplikatów</p>
              <p className="text-sm">Wszystkie grupy zostały już sprawdzone.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center mb-4 text-sm gap-2 bg-muted/50 p-2 rounded">
                <input 
                  type="checkbox" 
                  checked={selectedGroups.size === duplicateGroups.length && duplicateGroups.length > 0} 
                  onChange={selectAll} 
                  className="w-4 h-4 rounded ml-2" 
                />
                <span className="font-medium cursor-pointer" onClick={selectAll}>Zaznacz wszystkie</span>
              </div>
              
              {duplicateGroups.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                const isSelected = selectedGroups.has(group.id);
                const avgSimilarity = Object.values(group.similarityScores).reduce((a, b) => a + b, 0) / Object.values(group.similarityScores).length;

                return (
                  <div key={group.id} className={`border rounded-lg p-4 space-y-4 transition-colors ${isSelected ? 'border-blue-400 bg-blue-50/20' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelected(group.id)} 
                          className="w-4 h-4 rounded mt-1.5" 
                        />
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">Grupa {group.id.substring(0, 8)}</h3>
                            {getSimilarityBadge(avgSimilarity)}
                            <Badge variant="outline">{1 + group.alternativeProductIds.length} produkty</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">Wykryto: {formatDate(group.detectedAt)}</div>

                          {group.aiSuggestion && (
                            <div className="p-3 bg-accent rounded-lg text-sm mt-2">
                              <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="font-semibold">Sugestia AI</span>
                                <Badge variant="outline">{Math.round(group.aiSuggestion.confidence * 100)}% pewności</Badge>
                              </div>
                              <p className="text-xs">{group.aiSuggestion.reasoning}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button variant="ghost" size="sm" onClick={() => toggleExpanded(group.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Główny produkt</span>
                            <p className="text-sm font-mono mt-1">{group.canonicalProductId}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alternatywy</span>
                            <div className="space-y-1 mt-1">
                              {group.alternativeProductIds.map(id => (
                                <p key={id} className="text-sm font-mono">
                                  {id} <span className="text-muted-foreground">({Math.round(group.similarityScores[id] * 100)}%)</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                      <Button variant="outline" size="sm" disabled={processingId === group.id}>
                        <Eye className="h-3.5 w-3.5 mr-1" />Porównaj
                      </Button>
                      <div className="flex-1" />
                      <Button variant="outline" size="sm" onClick={() => handleMerge(group.id, 'keep_both')} disabled={processingId === group.id}>
                        Zostaw oba
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleMerge(group.id, 'keep_canonical')} disabled={processingId === group.id}>
                        Zostaw główny
                      </Button>
                      <Button variant="default" size="sm" onClick={() => handleMerge(group.id, 'merge_attributes')} disabled={processingId === group.id}>
                        <GitMerge className="h-3.5 w-3.5 mr-1" />Smart Merge
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleReject(group.id)} disabled={processingId === group.id}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />To nie duplikat
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(DuplicatesPage);
