'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';
import { type ProductEnrichmentInput } from './aiProductEnrichmentPL';

const BatchInputSchema = z.array(z.object({
  originalTitle: z.string().min(3),
  rawDescription: z.string().optional(),
  categoryPath: z.array(z.string()).nonempty(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  rating: z.number().optional(),
  orders: z.number().optional(),
  merchant: z.string().optional(),
}));

const BatchOutputSchema = z.array(z.object({
  normalizedName: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  features: z.array(z.string()),
  keywords: z.array(z.string()),
}));

const productEnrichmentBatchPrompt = ai.definePrompt({
  name: 'productEnrichmentBatchPromptPL',
  input: { schema: BatchInputSchema },
  output: { schema: BatchOutputSchema },
  prompt: `Jesteś ekspertem e-commerce. Otrzymasz listę produktów.
Dla każdego zwróć JSON z polami: normalizedName, shortDescription, longDescription, features[<=10], keywords[4-8].
Nie wymyślaj parametrów – korzystaj z tytułu/opisu. Język: polski.

{{#each input}}
ITEM {{@index}}:
TYTUŁ: {{{originalTitle}}}
KATEGORIA: {{#each categoryPath}}{{this}}/{{/each}}
{{#if rawDescription}}OPIS: {{{rawDescription}}}{{/if}}
{{#if price}}CENA: {{{price}}}{{/if}} {{#if originalPrice}}PRZED: {{{originalPrice}}}{{/if}}
{{/each}}
`,
});

const productEnrichmentBatchFlow = ai.defineFlow({
  name: 'productEnrichmentBatchFlowPL',
  inputSchema: BatchInputSchema,
  outputSchema: BatchOutputSchema,
}, async (input) => {
  const { output } = await productEnrichmentBatchPrompt(input as any);
  return output!;
});

export async function aiProductEnrichmentBatchPL(items: ProductEnrichmentInput[]): Promise<Array<{
  normalizedName: string;
  shortDescription: string;
  longDescription: string;
  features: string[];
  keywords: string[];
}>> {
  logger.debug('AI batch enrichment', { count: items.length });
  try {
    return await productEnrichmentBatchFlow(items as any);
  } catch (error) {
    logger.error('AI batch enrichment failed', { error });
    return items.map((i) => {
      const base = i.originalTitle.replace(/\s+/g, ' ').trim();
      const raw = (i.rawDescription || '').replace(/\s+/g, ' ').trim();
      return {
        normalizedName: base,
        shortDescription: raw ? raw.slice(0, 120) : base,
        longDescription: raw || base,
        features: [],
        keywords: [],
      };
    });
  }
}
