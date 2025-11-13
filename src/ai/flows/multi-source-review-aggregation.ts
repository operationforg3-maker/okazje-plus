/**
 * Multi-Source Review Aggregation Flow
 * 
 * Aggregates and analyzes reviews from multiple marketplaces.
 * Provides unified sentiment analysis and pros/cons extraction.
 */

import { ai } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/google-genai';
import { logger } from '@/lib/logging';

/**
 * Review from a single source
 */
export interface SourceReview {
  marketplace: string;
  rating: number;
  text: string;
  date: string;
  verified: boolean;
  helpful?: number;
}

/**
 * Input for review aggregation
 */
export interface ReviewAggregationInput {
  productName: string;
  reviews: SourceReview[];
}

/**
 * Aggregated review result
 */
export interface ReviewAggregationResult {
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number; // -1 to 1
  averageRating: number;
  totalReviews: number;
  pros: Array<{
    text: string;
    frequency: number; // How many reviews mention this
    sources: string[]; // Which marketplaces mention this
  }>;
  cons: Array<{
    text: string;
    frequency: number;
    sources: string[];
  }>;
  summary: string; // 2-3 sentence summary
  sourceBreakdown: Record<
    string,
    {
      count: number;
      averageRating: number;
      sentiment: 'positive' | 'neutral' | 'negative';
    }
  >;
  topKeywords: string[];
  confidence: number; // 0-1
}

/**
 * Define the review aggregation flow
 */
export const aggregateMultiSourceReviews = ai.defineFlow(
  {
    name: 'aggregateMultiSourceReviews',
    inputSchema: ai.schema<ReviewAggregationInput>(),
    outputSchema: ai.schema<ReviewAggregationResult>(),
  },
  async (input) => {
    logger.info('Starting multi-source review aggregation', {
      productName: input.productName,
      reviewsCount: input.reviews.length,
    });

    // Group reviews by marketplace
    const reviewsBySource: Record<string, SourceReview[]> = {};
    input.reviews.forEach((review) => {
      if (!reviewsBySource[review.marketplace]) {
        reviewsBySource[review.marketplace] = [];
      }
      reviewsBySource[review.marketplace].push(review);
    });

    const reviewsText = input.reviews
      .slice(0, 50) // Limit to 50 reviews to avoid token limits
      .map(
        (r, i) =>
          `${i + 1}. [${r.marketplace}] ${r.rating}⭐ ${r.verified ? '✓' : ''} - ${r.text.substring(0, 200)}`
      )
      .join('\n');

    const prompt = `
Jesteś ekspertem w analizie opinii klientów o produktach.
Przeanalizuj poniższe recenzje produktu "${input.productName}" zebrane z różnych marketplace i stwórz kompleksową agregację.

RECENZJE (${input.reviews.length} total):
${reviewsText}

Zwróć odpowiedź w formacie JSON z następującymi polami:
{
  "overallSentiment": "positive" | "neutral" | "negative" | "mixed",
  "sentimentScore": number (-1 do 1),
  "averageRating": number (1-5),
  "totalReviews": ${input.reviews.length},
  "pros": [
    {
      "text": "konkretna zaleta produktu",
      "frequency": liczba recenzji wspominających o tym,
      "sources": ["marketplace1", "marketplace2"]
    }
  ],
  "cons": [
    {
      "text": "konkretna wada produktu",
      "frequency": liczba recenzji wspominających o tym,
      "sources": ["marketplace1", "marketplace2"]
    }
  ],
  "summary": "2-3 zdaniowe podsumowanie opinii klientów",
  "sourceBreakdown": {
    "marketplace1": {
      "count": liczba recenzji,
      "averageRating": średnia ocena,
      "sentiment": "positive" | "neutral" | "negative"
    }
  },
  "topKeywords": ["słowo1", "słowo2", "słowo3"],
  "confidence": number (0-1)
}

Kryteria analizy:
1. Plusy (pros) - maksymalnie 5 najczęściej wspominanych zalet
2. Minusy (cons) - maksymalnie 5 najczęściej wspominanych wad
3. Sentiment score: 1 = bardzo pozytywny, 0 = neutralny, -1 = bardzo negatywny
4. Uwzględnij różnice między marketplace (jeśli istnieją)
5. Priorytetyzuj zweryfikowane recenzje (verified = true)
6. Wyciągnij konkretne, użyteczne informacje (nie ogólniki)
7. Top keywords - najważniejsze słowa kluczowe z recenzji (po polsku)

Uwagi:
- Ignoruj spam i recenzje niezwiązane z produktem
- Jeśli opinie są bardzo różne między marketplace, zaznacz to w summary
- Confidence niższe jeśli recenzji jest mało (<10) lub są bardzo rozbieżne
`;

    try {
      const response = await ai.generate({
        model: gemini15Flash,
        prompt,
        config: {
          temperature: 0.3,
        },
      });

      const result = JSON.parse(response.text) as ReviewAggregationResult;

      // Ensure totalReviews matches input
      result.totalReviews = input.reviews.length;

      logger.info('Multi-source review aggregation completed', {
        productName: input.productName,
        sentiment: result.overallSentiment,
        sentimentScore: result.sentimentScore,
        prosCount: result.pros.length,
        consCount: result.cons.length,
      });

      return result;
    } catch (error) {
      logger.error('Multi-source review aggregation failed', { error });
      throw error;
    }
  }
);

/**
 * Compare reviews across marketplaces
 */
export interface ReviewComparisonInput {
  productName: string;
  reviewsByMarketplace: Record<string, SourceReview[]>;
}

export interface ReviewComparisonResult {
  differences: Array<{
    aspect: string;
    marketplace1: string;
    marketplace1Opinion: string;
    marketplace2: string;
    marketplace2Opinion: string;
    significance: 'high' | 'medium' | 'low';
  }>;
  commonThemes: Array<{
    theme: string;
    allMarketplacesAgree: boolean;
    details: string;
  }>;
  qualityDifferences: Array<{
    marketplace: string;
    possibleReason: string;
    explanation: string;
  }>;
  recommendation: string;
}

/**
 * Compare reviews between marketplaces to find differences
 */
export const compareMarketplaceReviews = ai.defineFlow(
  {
    name: 'compareMarketplaceReviews',
    inputSchema: ai.schema<ReviewComparisonInput>(),
    outputSchema: ai.schema<ReviewComparisonResult>(),
  },
  async (input) => {
    logger.info('Starting marketplace review comparison', {
      productName: input.productName,
      marketplaces: Object.keys(input.reviewsByMarketplace),
    });

    const marketplaceSummaries = Object.entries(input.reviewsByMarketplace)
      .map(([marketplace, reviews]) => {
        const avgRating =
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        const sampleReviews = reviews
          .slice(0, 5)
          .map((r) => `  - ${r.rating}⭐: ${r.text.substring(0, 150)}`)
          .join('\n');
        return `${marketplace} (${reviews.length} recenzji, średnia ${avgRating.toFixed(1)}⭐):\n${sampleReviews}`;
      })
      .join('\n\n');

    const prompt = `
Jesteś ekspertem w analizie porównawczej opinii o produktach.
Przeanalizuj różnice w opiniach o "${input.productName}" między różnymi marketplace.

OPINIE WG MARKETPLACE:
${marketplaceSummaries}

Zwróć odpowiedź w formacie JSON z następującymi polami:
{
  "differences": [
    {
      "aspect": "aspekt produktu (np. jakość wykonania, dostawa)",
      "marketplace1": "nazwa marketplace",
      "marketplace1Opinion": "co mówią użytkownicy",
      "marketplace2": "nazwa marketplace",
      "marketplace2Opinion": "co mówią użytkownicy",
      "significance": "high" | "medium" | "low"
    }
  ],
  "commonThemes": [
    {
      "theme": "temat wspólny dla wszystkich marketplace",
      "allMarketplacesAgree": boolean,
      "details": "szczegóły"
    }
  ],
  "qualityDifferences": [
    {
      "marketplace": "nazwa",
      "possibleReason": "dlaczego opinie mogą się różnić",
      "explanation": "wyjaśnienie"
    }
  ],
  "recommendation": "syntetyczna rekomendacja dla kupujących"
}

Szukaj różnic w:
1. Jakość produktu
2. Szybkość dostawy
3. Obsługa klienta
4. Autentyczność produktu
5. Opakowanie
6. Cena vs jakość

Możliwe przyczyny różnic:
- Różne wersje produktu
- Różni sprzedawcy/dystrybucja
- Różne standardy marketplace
- Fałszerstwa vs oryginały
- Różne oczekiwania klientów
`;

    try {
      const response = await ai.generate({
        model: gemini15Flash,
        prompt,
        config: {
          temperature: 0.4,
        },
      });

      const result = JSON.parse(response.text) as ReviewComparisonResult;

      logger.info('Marketplace review comparison completed', {
        productName: input.productName,
        differencesFound: result.differences.length,
      });

      return result;
    } catch (error) {
      logger.error('Marketplace review comparison failed', { error });
      throw error;
    }
  }
);
