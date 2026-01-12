'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
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
  keywordsEN: z.array(z.string()),
}));

const productEnrichmentBatchPrompt = ai.definePrompt({
  name: 'productEnrichmentBatchPromptPL',
  input: { schema: BatchInputSchema },
  output: { schema: BatchOutputSchema },
  prompt: `Jesteś ekspertem e-commerce dla polskiego marketplace. Otrzymasz listę produktów.

PRIORYTET: DOKŁADNOŚĆ I PRECYZJA tłumaczenia. Używaj przyjaznego, konwersacyjnego języka polskiego (nie literalnych tłumaczeń).

Dla każdego produktu zwróć JSON z polami:
- normalizedName: Przyjazna polska nazwa (naturalna, bez spam)
- shortDescription: Krótki opis 1-2 zdania (przyjazny język, najważniejsze cechy)
- longDescription: Szczegółowy opis 3-5 zdań (przyjazny język, dokładne specyfikacje, korzyści)
- features: Lista 5-10 cech (konkretne parametry, bez wymyślania)
- keywords: 4-8 słów kluczowych po POLSKU (SEO-friendly dla polskiego rynku)
- keywordsEN: 4-8 słów kluczowych po ANGIELSKU (dla AliExpress API - muszą być wyszukiwalne!)

NIE WYMYŚLAJ parametrów – korzystaj tylko z tytułu/opisu. Język: przyjazny polski (konwersacyjny styl).

{{#each input}}
PRODUKT {{@index}}:
TYTUŁ: {{{originalTitle}}}
KATEGORIA: {{#each categoryPath}}{{this}}/{{/each}}
{{#if rawDescription}}OPIS: {{{rawDescription}}}{{/if}}
{{#if price}}CENA: {{{price}}}{{/if}} {{#if originalPrice}}PRZED: {{{originalPrice}}}{{/if}}
{{#if rating}}OCENA: {{{rating}}}{{/if}} {{#if orders}}ZAMÓWIENIA: {{{orders}}}{{/if}}
{{/each}}

PAMIĘTAJ: 
- Przyjazny, naturalny polski (keywords i shortDescription/longDescription)
- English keywords muszą być przydatne do AliExpress API search
- Dokładność i precyzja tłumaczenia. Brak literalnych tłumaczeń.`,
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
  keywordsEN: string[];
}>> {
  logger.debug('AI batch enrichment', { count: items.length });
  try {
    const output = await productEnrichmentBatchFlow(items as any);
    return output.map((item, idx) => {
      const fallbackBase = items[idx]?.originalTitle?.trim() || `Produkt ${idx + 1}`;
      const fallbackDesc = (items[idx]?.rawDescription || '').trim();
      const baseShort = fallbackDesc ? fallbackDesc.slice(0, 120) : fallbackBase;
      const baseLong = fallbackDesc || fallbackBase;
      const fallbackKeywordsEN = fallbackBase.toLowerCase().split(/\s+/).slice(0, 3);

      const safeFeatures = Array.isArray(item?.features) ? item.features.filter(Boolean) : [];
      const safeKeywords = Array.isArray(item?.keywords) ? item.keywords.filter(Boolean) : [];
      const safeKeywordsEN = Array.isArray(item?.keywordsEN) ? item.keywordsEN.filter(Boolean) : fallbackKeywordsEN;

      const normalizedName = (item?.normalizedName || '').trim() || fallbackBase;
      const shortDescription = (item?.shortDescription || '').trim() || baseShort;
      const longDescription = (item?.longDescription || '').trim() || baseLong;

      return {
        normalizedName,
        shortDescription,
        longDescription,
        features: safeFeatures,
        keywords: safeKeywords,
        keywordsEN: safeKeywordsEN,
      };
    });
  } catch (error) {
    logger.error('AI batch enrichment failed', { error });
    return items.map((i) => {
      const base = i.originalTitle.replace(/\s+/g, ' ').trim();
      const raw = (i.rawDescription || '').replace(/\s+/g, ' ').trim();
      const enKeywords = base.toLowerCase().split(/\s+/).slice(0, 3);
      return {
        normalizedName: base,
        shortDescription: raw ? raw.slice(0, 120) : base,
        longDescription: raw || base,
        features: [],
        keywords: [],
        keywordsEN: enKeywords,
      };
    });
  }
}
