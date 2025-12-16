/**
 * Bulk Post Creator Component
 * Create social media posts in bulk from hot deals
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { SocialPlatform } from '@/lib/types';
import { bulkCreatePosts, getPlatformDisplayName } from '@/lib/social-automation';
import { getHotDeals } from '@/lib/data';
import { toast } from 'sonner';
import { Send, Sparkles, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function BulkPostCreator({ userId }: { userId?: string }) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deals, setDeals] = useState<any[]>([]);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<SocialPlatform>>(
    new Set(['facebook', 'instagram'])
  );
  const [useAI, setUseAI] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [scheduleOptimal, setScheduleOptimal] = useState(true);
  const [results, setResults] = useState<{ success: string[]; failed: Array<{ id: string; error: string }> } | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      setLoading(true);
      const hotDeals = await getHotDeals(50);
      setDeals(hotDeals);
    } catch (error) {
      console.error('Error loading deals:', error);
      toast.error('Błąd wczytywania okazji');
    } finally {
      setLoading(false);
    }
  }

  function toggleDeal(dealId: string) {
    const newSelected = new Set(selectedDeals);
    if (newSelected.has(dealId)) {
      newSelected.delete(dealId);
    } else {
      newSelected.add(dealId);
    }
    setSelectedDeals(newSelected);
  }

  function togglePlatform(platform: SocialPlatform) {
    const newSelected = new Set(selectedPlatforms);
    if (newSelected.has(platform)) {
      newSelected.delete(platform);
    } else {
      newSelected.add(platform);
    }
    setSelectedPlatforms(newSelected);
  }

  function selectAll() {
    setSelectedDeals(new Set(deals.map(d => d.id)));
  }

  function deselectAll() {
    setSelectedDeals(new Set());
  }

  async function handleCreate() {
    if (selectedDeals.size === 0) {
      toast.error('Wybierz przynajmniej jedną okazję');
      return;
    }
    if (selectedPlatforms.size === 0) {
      toast.error('Wybierz przynajmniej jedną platformę');
      return;
    }

    try {
      setCreating(true);
      setResults(null);

      const items = deals
        .filter(d => selectedDeals.has(d.id))
        .map(d => ({
          id: d.id,
          type: 'deal' as const,
          data: {
            title: typeof d.title === 'string' ? d.title : d.title.pl,
            description: typeof d.description === 'string' ? d.description : d.description?.pl,
            price: d.price,
            originalPrice: d.originalPrice,
            discount: d.discount,
            temperature: d.temperature,
            merchant: d.merchant,
            imageUrl: d.imageUrl,
            url: d.url,
          },
        }));

      const result = await bulkCreatePosts(
        items,
        Array.from(selectedPlatforms),
        {
          useAI,
          autoApprove,
          scheduleOptimal,
          createdBy: userId || 'admin',
        }
      );

      setResults(result);
      
      if (result.success.length > 0) {
        toast.success(`Utworzono ${result.success.length} postów!`);
      }
      if (result.failed.length > 0) {
        toast.error(`Błędy: ${result.failed.length} postów`);
      }

      // Deselect created deals
      setSelectedDeals(new Set());
    } catch (error) {
      console.error('Error creating bulk posts:', error);
      toast.error('Błąd tworzenia postów');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Masowe Tworzenie Postów</CardTitle>
          <CardDescription>
            Wybierz okazje i platformy, aby utworzyć wiele postów jednocześnie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Platformy docelowe</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'] as SocialPlatform[]).map((platform) => (
                <div key={platform} className="flex items-center space-x-2">
                  <Checkbox
                    id={`platform-${platform}`}
                    checked={selectedPlatforms.has(platform)}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <Label htmlFor={`platform-${platform}`} className="cursor-pointer">
                    {getPlatformDisplayName(platform)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Options */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Opcje</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <Label htmlFor="use-ai" className="font-medium cursor-pointer">
                    <Sparkles className="h-4 w-4 inline mr-2 text-purple-500" />
                    Użyj AI do treści
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gemini 2.0 Flash wygeneruje unikalne opisy i hashtagi
                  </p>
                </div>
                <Switch id="use-ai" checked={useAI} onCheckedChange={setUseAI} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <Label htmlFor="auto-approve" className="font-medium cursor-pointer">
                    <CheckCircle2 className="h-4 w-4 inline mr-2 text-green-500" />
                    Automatyczne zatwierdzenie
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Posty będą od razu gotowe do publikacji
                  </p>
                </div>
                <Switch id="auto-approve" checked={autoApprove} onCheckedChange={setAutoApprove} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <Label htmlFor="schedule-optimal" className="font-medium cursor-pointer">
                    <Clock className="h-4 w-4 inline mr-2 text-blue-500" />
                    Optymalne harmonogramowanie
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Zaplanuj posty na najlepsze godziny dla każdej platformy
                  </p>
                </div>
                <Switch id="schedule-optimal" checked={scheduleOptimal} onCheckedChange={setScheduleOptimal} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Deal Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">
                Wybierz okazje ({selectedDeals.size}/{deals.length})
              </Label>
              <div className="flex gap-2">
                <Button onClick={selectAll} variant="outline" size="sm">
                  Zaznacz wszystkie
                </Button>
                <Button onClick={deselectAll} variant="outline" size="sm">
                  Odznacz wszystkie
                </Button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2 border rounded p-3">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-start gap-3 p-3 border rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`deal-${deal.id}`}
                    checked={selectedDeals.has(deal.id)}
                    onCheckedChange={() => toggleDeal(deal.id)}
                  />
                  <Label htmlFor={`deal-${deal.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">
                          {typeof deal.title === 'string' ? deal.title : deal.title.pl}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {deal.price} zł
                          </Badge>
                          {deal.temperature && (
                            <Badge variant="destructive" className="text-xs">
                              {Math.round(deal.temperature)}°
                            </Badge>
                          )}
                        </div>
                      </div>
                      {deal.imageUrl && (
                        <img
                          src={deal.imageUrl}
                          alt=""
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleCreate}
            disabled={creating || selectedDeals.size === 0 || selectedPlatforms.size === 0}
            className="w-full"
            size="lg"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Tworzenie postów...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Utwórz {selectedDeals.size * selectedPlatforms.size} postów
              </>
            )}
          </Button>

          {/* Results */}
          {results && (
            <div className="space-y-2">
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      Sukces
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {results.success.length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      Błędy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {results.failed.length}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {results.failed.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                  <p className="font-semibold mb-2">Błędy:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {results.failed.slice(0, 5).map((fail, i) => (
                      <li key={i} className="text-red-600 dark:text-red-400">
                        {fail.id}: {fail.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
