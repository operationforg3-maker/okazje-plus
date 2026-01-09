'use server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProductInputSchema = z.object({
  rawTitle: z.string().describe('Oryginalny tytuł z AliExpress'),
});

const ProductOutputSchema = z.string().describe('Znormalizowany, krótki tytuł PL bez spamu');

const normalizeTitlePrompt = ai.definePrompt({
  name: 'normalizeTitlePLPrompt',
  input: { schema: ProductInputSchema },
  output: { schema: z.object({ title: ProductOutputSchema }) },
  prompt: `Jesteś ekspertem e-commerce w Polsce.
Oczyść tytuł z AliExpress do profesjonalnej, zwięzłej formy po polsku.

Zasady:
1) Usuń spam (FREE, 2024, HOT SALE, emoji)
2) Format: [Marka] [Model] [Cecha kluczowa]
3) Maks 60 znaków
4) Tylko czysty tytuł – bez dodatkowych komentarzy

Wejście: {{{rawTitle}}}

Zwróć JSON: { "title": "..." }`,
});

const normalizeTitleFlow = ai.defineFlow({
  name: 'aliexpress-normalizeTitlePL',
  inputSchema: ProductInputSchema,
  outputSchema: ProductOutputSchema,
}, async (input) => {
  const { output } = await normalizeTitlePrompt(input);
  return output!.title.trim();
});

export async function aiNormalizeTitlePL(input: z.infer<typeof ProductInputSchema>): Promise<string> {
  return await normalizeTitleFlow(input);
}
 
