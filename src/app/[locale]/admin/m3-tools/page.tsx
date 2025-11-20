'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sparkles, TrendingDown } from 'lucide-react';
import { ReviewSummary } from '@/lib/types';
import { analyzeReviewsAction } from './actions';

export default function M3ToolsPage() {
  const [productId, setProductId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const handleAnalyzeReviews = async () => {
    if (!productId.trim()) {
      toast.error('Podaj ID produktu');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeReviewsAction(productId);

      if (result.success && result.summary) {
        setSummary(result.summary);
        toast.success('Analiza recenzji zakończona!');
      } else {
        toast.error(result.error || 'Błąd podczas analizy recenzji');
      }
    } catch (error) {
      console.error('Error analyzing reviews:', error);
      toast.error('Błąd podczas analizy recenzji');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Narzędzia M3</h1>
        <p className="text-muted-foreground">
          Testowanie funkcji: monitoring cen, podsumowania AI, gamifikacja
        </p>
      </div>

      {/* AI Review Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Analiza Recenzji AI
          </CardTitle>
          <CardDescription>
            Wygeneruj podsumowanie AI dla recenzji produktu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productId">ID Produktu</Label>
            <Input
              id="productId"
              placeholder="np. product123"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          </div>
          <Button onClick={handleAnalyzeReviews} disabled={analyzing}>
            {analyzing ? 'Analizowanie...' : 'Analizuj Recenzje'}
          </Button>

          {summary && (
            <div className="mt-6 p-4 border rounded-lg space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Wynik analizy:</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Sentyment:</strong> {summary.overallSentiment} (
                    {summary.sentimentScore.toFixed(2)})
                  </p>
                  <p>
                    <strong>Pewność:</strong> {(summary.confidence * 100).toFixed(0)}%
                  </p>
                  <p>
                    <strong>Podsumowanie:</strong> {summary.summary}
                  </p>
                </div>
              </div>

              {summary.pros.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Zalety:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {summary.pros.map((pro, idx) => (
                      <li key={idx}>{pro}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.cons.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Wady:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {summary.cons.map((con, idx) => (
                      <li key={idx}>{con}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.topicTags.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Tematy:</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.topicTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700"
                      >
                        {tag.label} ({Math.round(tag.frequency * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price Monitoring Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-green-500" />
            Monitoring Cen
          </CardTitle>
          <CardDescription>
            System monitoringu cen i alertów jest aktywny
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Użyj komponentu PriceHistoryChart i PriceAlertButton na stronach produktów, aby
            wyświetlić historię cen i ustawić alerty.
          </p>
        </CardContent>
      </Card>

      {/* Gamification Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏆 Gamifikacja
          </CardTitle>
          <CardDescription>
            System punktów, odznak i rankingów
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Funkcje dostępne:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Zdobywanie punktów za aktywność</li>
              <li>System odznak (badges) - 10 różnych odznak</li>
              <li>5 poziomów reputacji</li>
              <li>Rankingi (tygodniowy, miesięczny, całościowy)</li>
              <li>Historia aktywności użytkownika</li>
              <li>System zgłoszeń z nagrodami</li>
            </ul>
            <p className="mt-4">
              <strong>Komponenty:</strong> UserStatsCard, LeaderboardCard
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
