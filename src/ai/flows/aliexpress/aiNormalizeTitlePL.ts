'use server';

import { defineFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/vertexai';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

const ProductInputSchema = z.object({
  rawTitle: z.string(),
  attributes: z.array(z.any()).optional(),
});

export const aiNormalizeTitlePL = defineFlow(
  {
    name: 'aliexpress-normalizeTitlePL',
    inputSchema: ProductInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const prompt = `
      Act as an e-commerce expert for a Polish store "OkazjePlus".
      Transform the spammy AliExpress title into a professional, short Polish product title.

      RULES:
      1. Remove spam keywords (e.g. "free shipping", "2024", "hot sale", "summer").
      2. Format: [Brand] [Model/Name] [Key Feature].
      3. Max length: 60 chars.
      4. Keep model numbers specific (e.g. Xiaomi Mi Band 8).
      5. Output ONLY the cleaned title string.

      INPUT: "${input.rawTitle}"
    `;

    const llmResponse = await generate({
      model: gemini15Flash,
      prompt: prompt,
      config: { temperature: 0.3 },
    });

    return llmResponse.text().trim();
  }
);
 
