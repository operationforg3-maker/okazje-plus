'use server';

/**
 * AI Deal Quality Score Flow - "The Ruthless Auditor"
 * 
 * Simplified quality assessment focusing on:
 * - Shipping cost penalties (>20% of price)
 * - Merchant rating penalties (<90%)
 * - Sales volume penalties (<10 sold)
 * - Rating bonuses (>4.8 stars)
 * - Free shipping bonuses
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

const DealQualityInputSchema = z.object({
  price: z.number().describe('Product price in PLN'),
  originalPrice: z.number().optional().describe('Original price before discount'),
  shippingCost: z.number().describe('Shipping cost (0 for free shipping)'),
  rating: z.number().optional().describe('Product rating 0-5 stars'),
  soldCount: z.number().optional().describe('Number of items sold'),
  merchantRating: z.number().optional().describe('Merchant rating 0-100%'),
});

export type DealQualityInput = z.infer<typeof DealQualityInputSchema>;

const DealQualityOutputSchema = z.object({
  score: z.number().describe('Overall quality score 0-100'),
  recommendation: z.enum(['publish', 'reject', 'manual_review']).describe('Final recommendation'),
  reasoning: z.string().describe('Polish explanation of the decision'),
});

export type DealQualityOutput = z.infer<typeof DealQualityOutputSchema>;

const dealQualityPrompt = ai.definePrompt({
  name: 'dealQualityScorePrompt',
  input: { schema: DealQualityInputSchema },
  output: { schema: DealQualityOutputSchema },
  prompt: `Jesteś bezwzględnym audytorem okazji na polskim portalu e-commerce.

Zadanie: Oceń jakość oferty i zdecyduj czy publikować, odrzucić, czy wymaga ręcznej weryfikacji.

Dane produktu:
- Cena: {{{price}}} PLN
{{#if originalPrice}}- Cena przed: {{{originalPrice}}} PLN{{/if}}
- Koszt wysyłki: {{{shippingCost}}} PLN
{{#if rating}}- Ocena: {{{rating}}}/5 gwiazdek{{/if}}
{{#if soldCount}}- Sprzedanych: {{{soldCount}}} sztuk{{/if}}
{{#if merchantRating}}- Ocena sprzedawcy: {{{merchantRating}}}%{{/if}}

KRYTERIA OCENY (zastosuj bezwzględnie):

KARY (obniżają score):
1. Koszt wysyłki >20% ceny produktu → kara -25 pkt
2. Ocena sprzedawcy <90% → kara -20 pkt
3. Liczba sprzedanych <10 sztuk → kara -15 pkt
4. Brak danych o sprzedawcy → kara -10 pkt

BONUSY (podnoszą score):
1. Ocena produktu >4.8 gwiazdek → bonus +20 pkt
2. Darmowa wysyłka (shippingCost = 0) → bonus +15 pkt
3. Duża liczba sprzedanych (>100) → bonus +10 pkt
4. Wysoka zniżka (>50%) → bonus +10 pkt

BAZOWY SCORE: 60 punktów

REKOMENDACJE:
- score ≥80 → "publish" (automatyczna publikacja)
- score 50-79 → "manual_review" (wymaga ręcznej weryfikacji)
- score <50 → "reject" (automatyczne odrzucenie)

REASONING - napisz po polsku, zwięźle (2-3 zdania):
- Wymień najważniejsze kary/bonusy
- Uzasadnij końcową rekomendację
- Bądź konkretny (podaj liczby)

Przykład: "Wysoki koszt wysyłki (28% ceny) obniża atrakcyjność oferty. Niska liczba sprzedanych (5 szt) budzi wątpliwości co do popularności. Score 45/100 → odrzucam automatycznie."

Oblicz score i zwróć rekomendację.`,
});

const dealQualityFlow = ai.defineFlow(
  {
    name: 'dealQualityScoreFlow',
    inputSchema: DealQualityInputSchema,
    outputSchema: DealQualityOutputSchema,
  },
  async (input) => {
    const { output } = await dealQualityPrompt(input);
    return output!;
  }
);

export async function aiDealQualityScore(
  input: DealQualityInput
): Promise<DealQualityOutput> {
  logger.debug('AI deal quality score', { 
    price: input.price, 
    shippingCost: input.shippingCost,
    soldCount: input.soldCount 
  });
  
  try {
    const result = await dealQualityFlow(input);
    
    logger.info('Deal quality score completed', {
      price: input.price,
      score: result.score,
      recommendation: result.recommendation,
    });
    
    return result;
  } catch (error) {
    logger.error('AI deal quality score failed', { error, input });
    
    // Fallback: rule-based scoring
    let score = 60; // Base score
    const penalties: string[] = [];
    const bonuses: string[] = [];
    
    // Calculate shipping percentage
    const shippingPercent = (input.shippingCost / input.price) * 100;
    if (shippingPercent > 20) {
      score -= 25;
      penalties.push(`wysoki koszt wysyłki (${shippingPercent.toFixed(0)}% ceny)`);
    }
    
    // Merchant rating penalty
    if (input.merchantRating && input.merchantRating < 90) {
      score -= 20;
      penalties.push(`niska ocena sprzedawcy (${input.merchantRating}%)`);
    } else if (!input.merchantRating) {
      score -= 10;
      penalties.push('brak danych o sprzedawcy');
    }
    
    // Sales volume penalty
    if (input.soldCount !== undefined && input.soldCount < 10) {
      score -= 15;
      penalties.push(`niska sprzedaż (${input.soldCount} szt)`);
    }
    
    // Rating bonus
    if (input.rating && input.rating > 4.8) {
      score += 20;
      bonuses.push(`wysoka ocena (${input.rating}/5)`);
    }
    
    // Free shipping bonus
    if (input.shippingCost === 0) {
      score += 15;
      bonuses.push('darmowa wysyłka');
    }
    
    // High sales bonus
    if (input.soldCount && input.soldCount > 100) {
      score += 10;
      bonuses.push(`duża sprzedaż (${input.soldCount} szt)`);
    }
    
    // Discount bonus
    if (input.originalPrice && input.price) {
      const discount = ((input.originalPrice - input.price) / input.originalPrice) * 100;
      if (discount > 50) {
        score += 10;
        bonuses.push(`wysoka zniżka (${discount.toFixed(0)}%)`);
      }
    }
    
    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Determine recommendation
    let recommendation: 'publish' | 'reject' | 'manual_review';
    if (score >= 80) {
      recommendation = 'publish';
    } else if (score < 50) {
      recommendation = 'reject';
    } else {
      recommendation = 'manual_review';
    }
    
    // Build reasoning
    const penaltyText = penalties.length > 0 ? `Kary: ${penalties.join(', ')}.` : '';
    const bonusText = bonuses.length > 0 ? ` Bonusy: ${bonuses.join(', ')}.` : '';
    const reasoning = `${penaltyText}${bonusText} Score ${score}/100 → ${
      recommendation === 'publish' ? 'publikuj' : 
      recommendation === 'reject' ? 'odrzuć' : 
      'weryfikacja ręczna'
    }. (Fallback - AI niedostępne)`;
    
    return {
      score,
      recommendation,
      reasoning,
    };
  }
}
