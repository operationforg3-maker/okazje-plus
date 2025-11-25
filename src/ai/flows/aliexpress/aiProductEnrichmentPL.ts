'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

// Dane wejściowe do wzbogacenia produktu
const ProductEnrichmentInputSchema = z.object({
  originalTitle: z.string().min(3),
  rawDescription: z.string().optional(),
  categoryPath: z.array(z.string()).nonempty(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  rating: z.number().optional(),
  orders: z.number().optional(),
  merchant: z.string().optional(),
});
export type ProductEnrichmentInput = z.infer<typeof ProductEnrichmentInputSchema>;

// Dane wyjściowe z AI
const ProductEnrichmentOutputSchema = z.object({
  normalizedName: z.string().describe('Poprawiona nazwa PL (bez spamu, czytelna)'),
  shortDescription: z.string().describe('Krótki opis 1-2 zdania po polsku'),
  longDescription: z.string().describe('Dłuższy opis 3-6 zdań z kluczowymi parametrami'),
  features: z.array(z.string()).describe('Lista cech / parametrów (max 10)'),
  keywords: z.array(z.string()).describe('Frazy kluczowe SEO (4-8)'),
});
export type ProductEnrichmentOutput = z.infer<typeof ProductEnrichmentOutputSchema>;

const productEnrichmentPrompt = ai.definePrompt({
  name: 'productEnrichmentPromptPL',
  input: { schema: ProductEnrichmentInputSchema },
  output: { schema: ProductEnrichmentOutputSchema },
  prompt: `Jesteś ekspertem ds. contentu e-commerce w Polsce.

Zadanie: Uporządkuj i wzbogac treść dla produktu.

TYTUŁ ORYGINALNY: {{{originalTitle}}}
KATEGORIA ŚCIEŻKA: {{#each categoryPath}}{{this}}/{{/each}}
{{#if rawDescription}}OPIS SUROWY: {{{rawDescription}}}{{/if}}
{{#if price}}CENA: {{{price}}} PLN{{/if}}
{{#if originalPrice}}CENA PRZED: {{{originalPrice}}} PLN{{/if}}
{{#if rating}}OCENA: {{{rating}}}{{/if}}
{{#if orders}}ZAMÓWIENIA: {{{orders}}}{{/if}}
{{#if merchant}}SKLEP: {{{merchant}}}{{/if}}

INSTRUKCJE:
1. Normalizuj nazwę do polskiego: usuń spam, emoji, ang. marketing (NEW, HOT etc.).
2. Jeśli tytuł zawiera specyfikacje (np. 128GB, 4K, RTX), zachowaj je.
3. shortDescription: korzyść + co to za produkt.
4. longDescription: 3-6 zdań: zastosowanie, główne funkcje, kluczowe parametry – tylko fakty widoczne z tytułu/ surowych danych.
5. features: wypunktowane krótkie cechy / parametry (max 10); każda zaczyna się od rzeczownika lub parametru.
6. keywords: krótkie frazy (bez powtórzeń; bez znaków specjalnych).
7. Zero pustych marketingowych obietnic. Nie wymyślaj parametrów których nie ma.
8. Język: naturalna polszczyzna, bez anglicyzmów jeśli istnieje polski odpowiednik.
`,
});

const productEnrichmentFlow = ai.defineFlow({
  name: 'productEnrichmentFlowPL',
  inputSchema: ProductEnrichmentInputSchema,
  outputSchema: ProductEnrichmentOutputSchema,
}, async (input) => {
  const { output } = await productEnrichmentPrompt(input);
  return output!;
});

export async function aiProductEnrichmentPL(input: ProductEnrichmentInput): Promise<ProductEnrichmentOutput> {
  logger.debug('AI product enrichment', { title: input.originalTitle, category: input.categoryPath });
  try {
    return await productEnrichmentFlow(input);
  } catch (error) {
    logger.error('AI product enrichment failed', { error });
    // Bezpieczny fallback – użyj tytułu i surowego opisu przyciętego
    const base = input.originalTitle.replace(/\s+/g, ' ').trim();
    const raw = (input.rawDescription || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    return {
      normalizedName: base,
      shortDescription: raw ? raw.slice(0, 120) : base,
      longDescription: raw || base,
      features: [],
      keywords: [],
    };
  }
}
