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
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPendingDuplicateGroups, rejectDuplicateGroup, mergeProducts } from '@/lib/deduplication';
import { DuplicateGroup } from '@/lib/types';

function DuplicatesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDuplicateGroups();
  }, []);

  const fetchDuplicateGroups = async () => {
    setLoading(true);
    try {
      const groups = await getPendingDuplicateGroups();
      setDuplicateGroups(groups);
    } catch (error) {
      console.error('Error fetching duplicate groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load duplicate groups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleMerge = async (
    groupId: string,
    strategy: 'keep_canonical' | 'merge_attributes' | 'keep_both'
  ) => {
    if (!confirm(`Are you sure you want to merge these products using "${strategy}" strategy?`)) {
      return;
    }

    setProcessingId(groupId);
    try {
      // TODO: Get user ID from auth
      const userId = 'admin-user';
      
      await mergeProducts(groupId, strategy, userId);
      
      toast({
        title: 'Success',
        description: 'Products merged successfully',
      });
      
      // Refresh list
      await fetchDuplicateGroups();
    } catch (error) {
      console.error('Error merging products:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to merge products',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (groupId: string) => {
    if (!confirm('Are you sure these products are NOT duplicates?')) {
      return;
    }

    setProcessingId(groupId);
    try {
      // TODO: Get user ID from auth
      const userId = 'admin-user';
      
      await rejectDuplicateGroup(groupId, userId, 'Manual review: not duplicates');
      
      toast({
        title: 'Success',
        description: 'Duplicate group rejected',
      });
      
      // Refresh list
      await fetchDuplicateGroups();
    } catch (error) {
      console.error('Error rejecting group:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject duplicate group',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getSimilarityBadge = (score: number) => {
    if (score >= 0.95) {
      return <Badge className="bg-red-600">Very High ({Math.round(score * 100)}%)</Badge>;
    } else if (score >= 0.90) {
      return <Badge className="bg-orange-600">High ({Math.round(score * 100)}%)</Badge>;
    } else if (score >= 0.85) {
      return <Badge className="bg-yellow-600">Medium ({Math.round(score * 100)}%)</Badge>;
    } else {
      return <Badge variant="secondary">Low ({Math.round(score * 100)}%)</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Duplicate Management</h2>
        <p className="text-muted-foreground">
          Review and manage duplicate product groups
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : duplicateGroups.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Duplicate groups to review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Confidence</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                `${Math.round(
                  (duplicateGroups.reduce(
                    (sum, g) => sum + (g.aiSuggestion?.confidence || 0),
                    0
                  ) /
                    (duplicateGroups.length || 1)) *
                    100
                )}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Average AI confidence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Affected</CardTitle>
            <GitMerge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                duplicateGroups.reduce(
                  (sum, g) => sum + 1 + g.alternativeProductIds.length,
                  0
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total products in groups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Groups List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Duplicate Groups</CardTitle>
          <CardDescription>
            Review and decide how to handle duplicate products
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No pending duplicate groups</p>
              <p className="text-sm">
                All duplicate product groups have been reviewed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const avgSimilarity =
                  Object.values(group.similarityScores).reduce((a, b) => a + b, 0) /
                  Object.values(group.similarityScores).length;

                return (
                  <div
                    key={group.id}
                    className="border rounded-lg p-4 space-y-4"
                  >
                    {/* Group Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            Duplicate Group {group.id.substring(0, 8)}
                          </h3>
                          {getSimilarityBadge(avgSimilarity)}
                          <Badge variant="outline">
                            {1 + group.alternativeProductIds.length} products
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          Detected: {formatDate(group.detectedAt)}
                        </div>

                        {group.aiSuggestion && (
                          <div className="p-3 bg-accent rounded-lg text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="font-semibold">AI Suggestion</span>
                              <Badge variant="outline">
                                {Math.round(group.aiSuggestion.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            <p>{group.aiSuggestion.reasoning}</p>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(group.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium">Canonical Product:</span>
                            <p className="text-sm text-muted-foreground">
                              {group.canonicalProductId}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Alternative Products:</span>
                            <div className="space-y-1">
                              {group.alternativeProductIds.map((id) => (
                                <p key={id} className="text-sm text-muted-foreground">
                                  {id} ({Math.round(group.similarityScores[id] * 100)}%)
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={processingId === group.id}
                        title="View products side by side"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Compare
                      </Button>
                      
                      <div className="flex-1" />
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMerge(group.id, 'keep_both')}
                        disabled={processingId === group.id}
                        title="Mark as variants, keep both products"
                      >
                        Keep Both
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMerge(group.id, 'keep_canonical')}
                        disabled={processingId === group.id}
                        title="Keep canonical, remove alternatives"
                      >
                        Keep Canonical
                      </Button>
                      
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMerge(group.id, 'merge_attributes')}
                        disabled={processingId === group.id}
                        title="Merge best attributes into canonical"
                      >
                        <GitMerge className="h-4 w-4 mr-1" />
                        Smart Merge
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(group.id)}
                        disabled={processingId === group.id}
                        title="These are not duplicates"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Not Duplicates
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Merge Strategies</CardTitle>
          <CardDescription>
            Understanding different merge strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Smart Merge (Recommended)</h4>
            <p className="text-sm text-muted-foreground">
              Intelligently merges the best attributes from all products into the canonical product.
              Keeps the best price, highest rating, and combines image galleries.
              Alternative products are marked as rejected duplicates.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Keep Canonical</h4>
            <p className="text-sm text-muted-foreground">
              Keeps the canonical product as-is and marks alternatives as rejected duplicates.
              Use this when the canonical product is clearly superior.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Keep Both</h4>
            <p className="text-sm text-muted-foreground">
              Marks products as variants of each other but keeps all active.
              Use this for products that are similar but legitimately different (e.g., color variants).
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Not Duplicates</h4>
            <p className="text-sm text-muted-foreground">
              Marks the group as a false positive. Use this when products appear similar but are
              actually different products that should remain separate.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(DuplicatesPage);
