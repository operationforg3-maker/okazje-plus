'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

const DealDescriptionInputSchema = z.object({
  title: z.string().min(3),
  discount: z.number().min(0).max(100).optional(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  merchant: z.string().optional(),
});

export type DealDescriptionInput = z.infer<typeof DealDescriptionInputSchema>;

const DealDescriptionOutputSchema = z.object({
  shortDescription: z.string().describe('Zwięzły opis 1-2 zdania, PL'),
  mediumDescription: z.string().describe('Średniej długości opis 2-4 zdania, PL'),
  keywords: z.array(z.string()).describe('Słowa kluczowe dla tagów i SEO'),
});

export type DealDescriptionOutput = z.infer<typeof DealDescriptionOutputSchema>;

const dealDescriptionPrompt = ai.definePrompt({
  name: 'dealDescriptionPromptPL',
  input: { schema: DealDescriptionInputSchema },
  output: { schema: DealDescriptionOutputSchema },
  prompt: `Jesteś redaktorem polskiego serwisu z okazjami.

Zadanie: Napisz krótki i średni opis okazji w języku polskim, na podstawie danych.

Tytuł: {{{title}}}
{{#if discount}}Zniżka: {{{discount}}}%{{/if}}
{{#if price}}Cena: {{{price}}} PLN{{/if}}
{{#if originalPrice}}Cena przed: {{{originalPrice}}} PLN{{/if}}
{{#if merchant}}Sklep: {{{merchant}}}{{/if}}

Zasady:
- PL, naturalny styl, zero spamu i emotikon.
- W short podkreśl korzyść/znaczenie zniżki.
- W medium dodaj 1-2 najważniejsze atuty/parametry i warunki (jeśli jasno wynikają z tytułu).
- Nie obiecuj rzeczy niepewnych. Nie dodawaj kodów/terminów jeśli nie podane.
- Słowa kluczowe: 4-6 krótkich fraz.
`,
});

const dealDescriptionFlow = ai.defineFlow(
  {
    name: 'dealDescriptionFlowPL',
    inputSchema: DealDescriptionInputSchema,
    outputSchema: DealDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await dealDescriptionPrompt(input);
    return output!;
  }
);

export async function aiGenerateDealDescriptionPL(
  input: DealDescriptionInput
): Promise<DealDescriptionOutput> {
  logger.debug('AI deal description', { title: input.title, discount: input.discount });
  try {
    return await dealDescriptionFlow(input);
  } catch (error) {
    logger.error('AI deal description failed', { error });
    const base = `${input.title}`.replace(/\s+/g, ' ').trim();
    const discountInfo = input.discount ? ` Zniżka ${input.discount}%` : '';
    return {
      shortDescription: `${base}.${discountInfo}`.trim(),
      mediumDescription: `${base}.${discountInfo}`.trim(),
      keywords: [],
    };
  }
}
