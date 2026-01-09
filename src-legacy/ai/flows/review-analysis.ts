'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

/**
 * Schema for review analysis input
 */
const reviewAnalysisInputSchema = z.object({
  productId: z.string(),
  reviews: z.array(
    z.object({
      text: z.string(),
      rating: z.number().min(1).max(5),
      date: z.string().optional(),
    })
  ),
  language: z.string().default('pl'),
});

/**
 * Schema for review analysis output
 */
const reviewAnalysisOutputSchema = z.object({
  overallSentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  sentimentScore: z.number().min(-1).max(1),
  pros: z.array(z.string()).max(5),
  cons: z.array(z.string()).max(5),
  topicTags: z.array(
    z.object({
      topic: z.string(),
      label: z.string(),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      frequency: z.number().min(0).max(1),
      keywords: z.array(z.string()),
    })
  ),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Genkit flow for analyzing product reviews
 */
export const analyzeReviewsFlow = ai.defineFlow(
  {
    name: 'analyzeReviews',
    inputSchema: reviewAnalysisInputSchema,
    outputSchema: reviewAnalysisOutputSchema,
  },
  async (input) => {
    const { reviews, language } = input;

    if (reviews.length === 0) {
      return {
        overallSentiment: 'neutral' as const,
        sentimentScore: 0,
        pros: [],
        cons: [],
        topicTags: [],
        summary: 'Brak recenzji do analizy.',
        confidence: 0,
      };
    }

    // Prepare review text for analysis
    const reviewTexts = reviews.map((r, idx) => `[Recenzja ${idx + 1}, ocena ${r.rating}/5]: ${r.text}`).join('\n\n');

    const prompt = `Jesteś ekspertem od analizy opinii klientów. Przeanalizuj poniższe recenzje produktu i wygeneruj:

1. Ogólny sentyment (positive/neutral/negative/mixed)
2. Wynik sentymentu od -1 (bardzo negatywny) do 1 (bardzo pozytywny)
3. Top 5 najczęściej wspominanych zalet (pros)
4. Top 5 najczęściej wspominanych wad (cons)
5. Główne tematy/aspekty (topics) z sentymentem i słowami kluczowymi
6. Krótkie podsumowanie 2-3 zdania
7. Poziom pewności analizy (0-1)

Recenzje:
${reviewTexts}

Odpowiedz w formacie JSON zgodnym z następującym schematem:
{
  "overallSentiment": "positive|neutral|negative|mixed",
  "sentimentScore": <number between -1 and 1>,
  "pros": ["plus1", "plus2", ...],
  "cons": ["minus1", "minus2", ...],
  "topicTags": [
    {
      "topic": "battery_life",
      "label": "Żywotność baterii",
      "sentiment": "positive|neutral|negative",
      "frequency": <0-1>,
      "keywords": ["bateria", "ładowanie", ...]
    }
  ],
  "summary": "Podsumowanie w 2-3 zdaniach",
  "confidence": <0-1>
}

Generuj etykiety po polsku. Bądź obiektywny i konkretny.`;

    const result = await ai.generate({
      model: 'gemini-1.5-flash', // Fixed: was gemini-2.5-flash
      prompt,
      output: {
        schema: reviewAnalysisOutputSchema,
      },
    });

    return result.output as z.infer<typeof reviewAnalysisOutputSchema>;
  }
);

/**
 * Helper function to run review analysis
 */
export async function analyzeProductReviews(
  productId: string,
  reviews: Array<{ text: string; rating: number; date?: string }>
): Promise<z.infer<typeof reviewAnalysisOutputSchema>> {
  return await analyzeReviewsFlow({
    productId,
    reviews,
    language: 'pl',
  });
}

/**
 * Schema for sentiment aspect analysis
 */
const sentimentAspectSchema = z.object({
  productId: z.string(),
  reviews: z.array(
    z.object({
      text: z.string(),
      rating: z.number(),
    })
  ),
});

const sentimentAspectOutputSchema = z.object({
  overall: z.number().min(-1).max(1),
  aspects: z.object({
    quality: z.number().min(-1).max(1),
    value: z.number().min(-1).max(1),
    shipping: z.number().min(-1).max(1),
    customerService: z.number().min(-1).max(1),
    accuracy: z.number().min(-1).max(1),
  }),
  distribution: z.object({
    positive: z.number().min(0).max(100),
    neutral: z.number().min(0).max(100),
    negative: z.number().min(0).max(100),
  }),
});

/**
 * Genkit flow for detailed sentiment analysis by aspect
 */
export const analyzeSentimentAspectsFlow = ai.defineFlow(
  {
    name: 'analyzeSentimentAspects',
    inputSchema: sentimentAspectSchema,
    outputSchema: sentimentAspectOutputSchema,
  },
  async (input) => {
    const { reviews } = input;

    if (reviews.length === 0) {
      return {
        overall: 0,
        aspects: {
          quality: 0,
          value: 0,
          shipping: 0,
          customerService: 0,
          accuracy: 0,
        },
        distribution: {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
      };
    }

    const reviewTexts = reviews.map((r, idx) => `[${idx + 1}]: ${r.text}`).join('\n');

    const prompt = `Przeanalizuj szczegółowo sentyment recenzji produktu w różnych aspektach.

Recenzje:
${reviewTexts}

Dla każdego aspektu podaj wynik od -1 (bardzo negatywny) do 1 (bardzo pozytywny):
- quality: jakość produktu
- value: stosunek jakości do ceny
- shipping: dostawa i opakowanie
- customerService: obsługa klienta
- accuracy: zgodność z opisem

Podaj również rozkład procentowy sentymentu (positive/neutral/negative) oraz ogólny wynik.

Odpowiedz w formacie JSON zgodnym ze schematem:
{
  "overall": <-1 to 1>,
  "aspects": {
    "quality": <-1 to 1>,
    "value": <-1 to 1>,
    "shipping": <-1 to 1>,
    "customerService": <-1 to 1>,
    "accuracy": <-1 to 1>
  },
  "distribution": {
    "positive": <0-100>,
    "neutral": <0-100>,
    "negative": <0-100>
  }
}`;

    const result = await ai.generate({
      model: 'gemini-1.5-flash', // Fixed: was gemini-2.5-flash
      prompt,
      output: {
        schema: sentimentAspectOutputSchema,
      },
    });

    return result.output as z.infer<typeof sentimentAspectOutputSchema>;
  }
);

/**
 * Helper function to run detailed sentiment analysis
 */
export async function analyzeSentimentByAspects(
  productId: string,
  reviews: Array<{ text: string; rating: number }>
): Promise<z.infer<typeof sentimentAspectOutputSchema>> {
  return await analyzeSentimentAspectsFlow({
    productId,
    reviews,
  });
}
