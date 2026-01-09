'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThumbsUp, ThumbsDown, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReviewSummary, TopicTag } from '@/lib/types';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ReviewSummaryCardProps {
  productId: string;
}

export function ReviewSummaryCard({ productId }: ReviewSummaryCardProps) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const summaryRef = doc(db, 'review_summaries', productId);
        const summaryDoc = await getDoc(summaryRef);
        if (summaryDoc.exists()) {
          setSummary({ id: summaryDoc.id, ...summaryDoc.data() } as ReviewSummary);
        }
      } catch (error) {
        console.error('Error fetching review summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [productId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Podsumowanie AI recenzji
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ładowanie...</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Podsumowanie AI recenzji
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Brak dostępnych recenzji do analizy. Bądź pierwszą osobą, która doda recenzję!
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'mixed':
        return <Minus className="h-4 w-4 text-yellow-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'negative':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'mixed':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'Pozytywny';
      case 'negative':
        return 'Negatywny';
      case 'mixed':
        return 'Mieszany';
      default:
        return 'Neutralny';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Podsumowanie AI recenzji
        </CardTitle>
        <CardDescription>
          Analiza {summary.reviewCount} {summary.reviewCount === 1 ? 'recenzji' : 'recenzji'} •
          Pewność: {(summary.confidence * 100).toFixed(0)}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall sentiment */}
        <div className="flex items-center gap-3">
          <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${getSentimentColor(summary.overallSentiment)}`}>
            {getSentimentIcon(summary.overallSentiment)}
            <span className="font-semibold">{getSentimentLabel(summary.overallSentiment)}</span>
          </div>
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  summary.sentimentScore > 0
                    ? 'bg-green-500'
                    : summary.sentimentScore < 0
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}
                style={{
                  width: `${Math.abs(summary.sentimentScore) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary text */}
        <div>
          <p className="text-sm leading-relaxed">{summary.summary}</p>
        </div>

        <Separator />

        {/* Pros */}
        {summary.pros.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-500" />
              Zalety
            </h4>
            <ul className="space-y-1">
              {summary.pros.map((pro, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cons */}
        {summary.cons.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              Wady
            </h4>
            <ul className="space-y-1">
              {summary.cons.map((con, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Topic tags */}
        {summary.topicTags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Główne tematy</h4>
            <div className="flex flex-wrap gap-2">
              {summary.topicTags.map((tag, idx) => (
                <TopicBadge key={idx} tag={tag} />
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-muted-foreground pt-4 border-t">
          Wygenerowano: {new Date(summary.generatedAt).toLocaleDateString('pl-PL')} •
          Model: {summary.modelVersion}
        </div>
      </CardContent>
    </Card>
  );
}

function TopicBadge({ tag }: { tag: TopicTag }) {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'border-green-300 bg-green-50 text-green-700';
      case 'negative':
        return 'border-red-300 bg-red-50 text-red-700';
      default:
        return 'border-gray-300 bg-gray-50 text-gray-700';
    }
  };

  const getFrequencyOpacity = (frequency: number) => {
    if (frequency > 0.7) return 'font-bold';
    if (frequency > 0.4) return 'font-semibold';
    return 'font-normal';
  };

  return (
    <Badge variant="outline" className={`${getSentimentColor(tag.sentiment)} ${getFrequencyOpacity(tag.frequency)}`}>
      {tag.label}
      <span className="ml-1 text-xs opacity-70">({Math.round(tag.frequency * 100)}%)</span>
    </Badge>
  );
}
