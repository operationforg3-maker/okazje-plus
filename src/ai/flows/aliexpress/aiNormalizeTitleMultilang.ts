"use server";

import { z } from 'zod';
import { ai } from '@/ai/genkit';

const ProductInputSchema = z.object({
  rawTitle: z.string(),
  attributes: z.array(z.any()).optional(),
});

const OutputSchema = z.object({ pl: z.string(), en: z.string(), de: z.string() });

export const aiNormalizeTitleMultilang = ai.defineFlow(
  {
    name: 'aliexpress-normalizeTitleMultilang',
    inputSchema: ProductInputSchema,
    outputSchema: OutputSchema,
  },
  async (input: z.infer<typeof ProductInputSchema>) => {
    const prompt = `
Act as an e-commerce expert for the multi-language store "OkazjePlus".
Transform a spammy AliExpress product title into professional, short titles for PL, EN, and DE.

RULES:
1. Remove spam keywords (e.g., "free shipping", "2024", "hot sale", "summer").
2. Format: [Brand] [Model/Name] [Key Feature].
3. Max length per title: 60 chars.
4. Keep specific model identifiers (e.g., "Xiaomi Mi Band 8").
5. Output ONLY a valid JSON object with keys "pl", "en", "de".

INPUT_TITLE: "${input.rawTitle}"

Return JSON like:
{"pl":"...", "en":"...", "de":"..."}
    `;

    const llmResponse = await ai.generate({ model: 'vertexai/gemini-2.5-flash', prompt, config: { temperature: 0.3 } });
    const text = (llmResponse.text ?? '').trim();
    try {
      const parsed = JSON.parse(text);
      return { pl: String(parsed.pl || ''), en: String(parsed.en || ''), de: String(parsed.de || '') };
    } catch {
      return { pl: text, en: '', de: '' };
    }
  }
);
