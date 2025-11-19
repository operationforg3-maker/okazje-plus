'use server';

/**
 * AI Deal Quality Score Flow
 * 
 * Evaluates the quality of a deal/product for automatic approval
 * or prioritization in moderation queue using Genkit AI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for deal quality scoring
 */
const DealQualityInputSchema = z.object({
  title: z.string().describe('Product title'),
  description: z.string().optional().describe('Product description'),
  price: z.number().describe('Current price in PLN'),
  originalPrice: z.number().optional().describe('Original price in PLN'),
  discountPercent: z.number().optional().describe('Discount percentage'),
  rating: z.number().optional().describe('Average rating (0-5)'),
  reviewCount: z.number().optional().describe('Number of reviews'),
  salesCount: z.number().optional().describe('Number of sales'),
  merchantName: z.string().optional().describe('Merchant/seller name'),
  category: z.string().optional().describe('Product category'),
});

export type DealQualityInput = z.infer<typeof DealQualityInputSchema>;

/**
 * Output schema from deal quality scoring
 */
const DealQualityOutputSchema = z.object({
  score: z
    .number()
    .describe('Overall quality score (0-100)'),
  recommendation: z
    .enum(['approve', 'review', 'reject'])
    .describe('Recommendation: approve (score >=70), review (40-69), reject (<40)'),
  factors: z.object({
    priceQuality: z.number().describe('Price reasonableness (0-100)'),
    discountLegitimacy: z.number().describe('Discount authenticity (0-100)'),
    merchantTrust: z.number().describe('Merchant reputation (0-100)'),
    productPopularity: z.number().describe('Product popularity (0-100)'),
    contentQuality: z.number().describe('Content quality (0-100)'),
  }),
  warnings: z
    .array(z.string())
    .describe('List of warnings/red flags detected'),
  reasoning: z
    .string()
    .describe('Brief explanation of the score and recommendation'),
});

export type DealQualityOutput = z.infer<typeof DealQualityOutputSchema>;

/**
 * AI prompt for quality scoring
 */
const qualityPrompt = ai.definePrompt({
  name: 'dealQualityScorePrompt',
  input: { schema: DealQualityInputSchema },
  output: { schema: DealQualityOutputSchema },
  prompt: `You are an expert e-commerce quality analyst for a Polish deals platform.

Analyze the following product and provide a quality score (0-100):

**Product Details:**
- Title: {{{title}}}
{{#if description}}- Description: {{{description}}}{{/if}}
- Price: {{{price}}} PLN
{{#if originalPrice}}- Original Price: {{{originalPrice}}} PLN{{/if}}
{{#if discountPercent}}- Discount: {{{discountPercent}}}%{{/if}}
{{#if rating}}- Rating: {{{rating}}}/5 ({{{reviewCount}}} reviews){{/if}}
{{#if salesCount}}- Sales: {{{salesCount}}}{{/if}}
{{#if merchantName}}- Merchant: {{{merchantName}}}{{/if}}
{{#if category}}- Category: {{{category}}}{{/if}}

**Evaluation Criteria:**

1. **Price Quality (0-100)**: Is the price reasonable for the product category?
2. **Discount Legitimacy (0-100)**: If discount exists, is it authentic (not fake inflated original price)?
3. **Merchant Trust (0-100)**: Does the merchant appear trustworthy based on name and reputation signals?
4. **Product Popularity (0-100)**: Based on ratings, reviews, and sales count.
5. **Content Quality (0-100)**: Title and description quality (clear, not spammy, professional).

**Red Flags to Check:**
- Unrealistic discounts (>90%)
- Very low price with no reviews/ratings (potential scam)
- Spammy title (excessive caps, emojis, "FREE!!!", etc.)
- Suspicious merchant names
- Missing critical product information

**Recommendation Guidelines:**
- **approve**: score >= 70 (high quality, auto-publish)
- **review**: score 40-69 (moderate quality, manual review)
- **reject**: score < 40 (low quality, likely spam/scam)

Provide detailed factor scores, list any warnings detected, and explain your reasoning in Polish.`,
});

/**
 * Genkit flow for deal quality scoring
 */
const qualityFlow = ai.defineFlow(
  {
    name: 'dealQualityScoreFlow',
    inputSchema: DealQualityInputSchema,
    outputSchema: DealQualityOutputSchema,
  },
  async (input) => {
    const { output } = await qualityPrompt(input);
    return output!;
  }
);

/**
 * Evaluate deal quality using AI
 * 
 * @param input Deal information
 * @returns Quality score and recommendation
 */
export async function aiDealQualityScore(
  input: DealQualityInput
): Promise<DealQualityOutput> {
  logger.debug('AI deal quality scoring', { title: input.title });
  
  try {
    const result = await qualityFlow(input);
    
    logger.info('Deal quality score completed', {
      title: input.title,
      score: result.score,
      recommendation: result.recommendation,
    });
    
    return result;
  } catch (error) {
    logger.error('AI deal quality scoring failed', { error, input });
    
    // Fallback: return conservative score requiring manual review
    return {
      score: 50,
      recommendation: 'review',
      factors: {
        priceQuality: 50,
        discountLegitimacy: 50,
        merchantTrust: 50,
        productPopularity: 50,
        contentQuality: 50,
      },
      warnings: ['AI scoring failed - manual review required'],
      reasoning: 'Błąd AI - produkt wymaga ręcznej weryfikacji',
    };
  }
}
