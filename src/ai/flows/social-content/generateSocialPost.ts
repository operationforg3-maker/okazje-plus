/**
 * Social Media Content Generation Flow
 * 
 * Generates optimized post content for each social platform using Gemini 2.0.
 * Creates engaging copy, relevant hashtags, and image prompts.
 */

import { defineFlow, runFlow } from '@genkit-ai/core';
import { gemini20FlashExp } from '@genkit-ai/vertexai';
import { z } from 'zod';

// Input schema
const GenerateSocialPostInputSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok']),
  type: z.enum(['deal', 'product', 'article']),
  itemData: z.object({
    title: z.string(),
    description: z.string().optional(),
    price: z.number().optional(),
    originalPrice: z.number().optional(),
    discount: z.number().optional(),
    temperature: z.number().optional(),
    merchant: z.string().optional(),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    url: z.string(),
  }),
  template: z.object({
    style: z.enum(['casual', 'professional', 'enthusiastic', 'minimalist']).optional(),
    includeEmojis: z.boolean().optional(),
    includePrice: z.boolean().optional(),
    includeHashtags: z.boolean().optional(),
    maxLength: z.number().optional(),
  }).optional(),
});

// Output schema
const GenerateSocialPostOutputSchema = z.object({
  title: z.string().describe('Catchy title/headline for the post'),
  description: z.string().describe('Main post content optimized for platform'),
  hashtags: z.array(z.string()).describe('Relevant hashtags (3-10 depending on platform)'),
  callToAction: z.string().describe('CTA text (e.g., "Sprawdź ofertę", "Kup teraz")'),
  imagePrompt: z.string().optional().describe('Prompt for AI image generation if needed'),
  emojiSuggestions: z.array(z.string()).optional().describe('Suggested emojis to use'),
});

export const generateSocialPostFlow = defineFlow(
  {
    name: 'generateSocialPost',
    inputSchema: GenerateSocialPostInputSchema,
    outputSchema: GenerateSocialPostOutputSchema,
  },
  async (input) => {
    const { platform, type, itemData, template } = input;

    // Platform-specific constraints
    const platformConstraints: Record<string, { maxLength: number; maxHashtags: number; tone: string }> = {
      facebook: { maxLength: 400, maxHashtags: 5, tone: 'casual and engaging' },
      instagram: { maxLength: 300, maxHashtags: 10, tone: 'visual and trendy' },
      twitter: { maxLength: 280, maxHashtags: 3, tone: 'concise and punchy' },
      linkedin: { maxLength: 600, maxHashtags: 5, tone: 'professional and informative' },
      tiktok: { maxLength: 150, maxHashtags: 5, tone: 'fun and energetic' },
    };

    const constraints = platformConstraints[platform];
    const maxLength = template?.maxLength || constraints.maxLength;
    const includeEmojis = template?.includeEmojis !== false;
    const includePrice = template?.includePrice !== false;
    const includeHashtags = template?.includeHashtags !== false;
    const style = template?.style || 'casual';

    // Build prompt
    const prompt = `
Jesteś ekspertem od marketingu w social media. Twoim zadaniem jest stworzenie idealnego posta dla platformy ${platform.toUpperCase()}.

**Dane produktu/okazji:**
- Tytuł: ${itemData.title}
- Opis: ${itemData.description || 'brak'}
- Cena: ${itemData.price ? `${itemData.price} zł` : 'brak'}
- Cena oryginalna: ${itemData.originalPrice ? `${itemData.originalPrice} zł` : 'brak'}
- Rabat: ${itemData.discount ? `${itemData.discount}%` : 'brak'}
- Temperatura: ${itemData.temperature ? `${itemData.temperature}°` : 'brak'}
- Sklep: ${itemData.merchant || 'brak'}
- Kategoria: ${itemData.category || 'brak'}

**Wymagania platformy:**
- Maksymalna długość: ${maxLength} znaków
- Maksymalna liczba hashtagów: ${constraints.maxHashtags}
- Ton komunikacji: ${constraints.tone}
- Styl: ${style}
- Emoji: ${includeEmojis ? 'tak, używaj emotikonów' : 'nie, bez emotikonów'}
- Cena w poście: ${includePrice ? 'tak, podkreśl cenę' : 'nie, skupij się na produkcie'}
- Hashtagi: ${includeHashtags ? 'tak, dodaj relevantne hashtagi' : 'nie, bez hashtagów'}

**Zadanie:**
1. **Tytuł/nagłówek**: Krótki, chwytliwy hook (20-50 znaków)
2. **Opis**: Angażujący tekst główny zgodny z tonem platformy
   - Podkreśl unikalną wartość oferty
   - Jeśli jest wysoka temperatura/rabat, zaakcentuj to
   - Dodaj emocjonalny element (ekscytacja, pilność, wartość)
   - ${includePrice && itemData.price ? 'Wyraźnie podaj cenę' : ''}
3. **Hashtagi**: ${constraints.maxHashtags} relevantnych hashtagów po polsku
   - Mix popularnych (#okazje, #promocje) i niszowych
   - Hashtagi kategorii produktu
   - Bez nadmiernego spamu
4. **CTA**: Krótkie, konkretne wezwanie do działania (5-15 słów)
5. **Emoji suggestions**: ${includeEmojis ? '3-5 pasujących emoji do użycia w tekście' : 'pusta lista'}
6. **Image prompt**: Opcjonalny prompt do generowania obrazu AI (jeśli brak zdjęcia produktu)

**Ważne:**
- Język: Polski
- Nie przekraczaj limitu ${maxLength} znaków dla opisu
- Zachowaj autentyczność i unikaj clickbaitów
- Dla LinkedIn: bardziej merytoryczny, wartościowy content
- Dla Instagram/TikTok: wizualny, dynamiczny, młodzieżowy
- Dla Twitter: zwięzły, na temat, z wyraźnym CTA
- Dla Facebook: ciepły, społecznościowy, angażujący

Zwróć TYLKO JSON zgodny ze schematem outputowym.
`;

    try {
      // Generate content using Gemini 2.0 Flash
      const result = await gemini20FlashExp.generate({
        prompt,
        config: {
          temperature: 0.8, // Creative but controlled
          maxOutputTokens: 1024,
        },
        output: {
          format: 'json',
          schema: GenerateSocialPostOutputSchema,
        },
      });

      const generated = result.output as z.infer<typeof GenerateSocialPostOutputSchema>;

      // Post-processing: ensure constraints
      if (generated.description.length > maxLength) {
        generated.description = generated.description.slice(0, maxLength - 3) + '...';
      }

      if (generated.hashtags.length > constraints.maxHashtags) {
        generated.hashtags = generated.hashtags.slice(0, constraints.maxHashtags);
      }

      // Add platform-specific adjustments
      if (!includeHashtags) {
        generated.hashtags = [];
      }

      if (!includeEmojis) {
        generated.emojiSuggestions = [];
        // Remove emojis from text
        generated.description = generated.description.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
        generated.title = generated.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      }

      return generated;
    } catch (error) {
      console.error('Error generating social post content:', error);
      
      // Fallback: basic template
      const fallbackTitle = itemData.title.slice(0, 50);
      const fallbackDescription = itemData.description || `Sprawdź tę okazję: ${itemData.title}`;
      const fallbackHashtags = ['#okazje', '#promocje', '#zakupy'];
      
      return {
        title: fallbackTitle,
        description: fallbackDescription.slice(0, maxLength),
        hashtags: includeHashtags ? fallbackHashtags : [],
        callToAction: 'Sprawdź teraz! 🔥',
        emojiSuggestions: includeEmojis ? ['🔥', '💰', '🎁'] : [],
      };
    }
  }
);

/**
 * Helper function to run the flow from other services
 */
export async function generateSocialContent(
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok',
  type: 'deal' | 'product' | 'article',
  itemData: any,
  template?: any
) {
  return runFlow(generateSocialPostFlow, {
    platform,
    type,
    itemData,
    template,
  });
}
