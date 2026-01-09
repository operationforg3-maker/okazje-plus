/**
 * Social Media Content Generation Flow
 * 
 * Generates optimized post content for each social platform using Gemini 2.0.
 * Creates engaging copy, relevant hashtags, and image prompts.
 */

'use server';

import { ai } from '@/ai/genkit';
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

const prompt = ai.definePrompt({
  name: 'generateSocialPostPrompt',
  input: { schema: GenerateSocialPostInputSchema },
  output: { schema: GenerateSocialPostOutputSchema },
  prompt: `Jesteś ekspertem od marketingu w social media. Twoim zadaniem jest stworzenie idealnego posta dla platformy {{{platform}}}.

**Dane produktu/okazji:**
- Tytuł: {{{itemData.title}}}
- Opis: {{{itemData.description}}}
- Cena: {{{itemData.price}}} zł
- Cena oryginalna: {{{itemData.originalPrice}}} zł  
- Rabat: {{{itemData.discount}}}%
- Temperatura: {{{itemData.temperature}}}°
- Sklep: {{{itemData.merchant}}}
- Kategoria: {{{itemData.category}}}

**Wymagania:**
Platforma: {{{platform}}}
Typ: {{{type}}}
Styl: {{{template.style}}}

**Zadanie:**
1. **Tytuł**: Krótki, chwytliwy hook (20-50 znaków)
2. **Opis**: Angażujący tekst główny (200-600 znaków w zależności od platformy)
3. **Hashtagi**: 3-10 relevantnych hashtagów po polsku
4. **CTA**: Krótkie wezwanie do działania (5-15 słów)
5. **Emoji**: 3-5 pasujących emoji
6. **Image prompt**: Opcjonalny prompt do AI image generation

**Wytyczne dla platform:**
- Facebook: 400 chars, 5 hashtags, casual/engaging
- Instagram: 300 chars, 10 hashtags, visual/trendy
- Twitter: 280 chars, 3 hashtags, concise/punchy
- LinkedIn: 600 chars, 5 hashtags, professional
- TikTok: 150 chars, 5 hashtags, fun/energetic

Język: Polski. Zachowaj autentyczność, unikaj clickbaitów.
`,
});

export const generateSocialPostFlow = ai.defineFlow(
  {
    name: 'generateSocialPost',
    inputSchema: GenerateSocialPostInputSchema,
    outputSchema: GenerateSocialPostOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      
      if (!output) {
        throw new Error('No output from AI');
      }
      
      const generated = output;
      
      // Platform-specific constraints
      const platformConstraints: Record<string, { maxLength: number; maxHashtags: number }> = {
        facebook: { maxLength: 400, maxHashtags: 5 },
        instagram: { maxLength: 300, maxHashtags: 10 },
        twitter: { maxLength: 280, maxHashtags: 3 },
        linkedin: { maxLength: 600, maxHashtags: 5 },
        tiktok: { maxLength: 150, maxHashtags: 5 },
      };
      
      const constraints = platformConstraints[input.platform];
      const includeHashtags = input.template?.includeHashtags !== false;
      const includeEmojis = input.template?.includeEmojis !== false;

      // Post-processing: ensure constraints
      if (generated.description.length > constraints.maxLength) {
        generated.description = generated.description.slice(0, constraints.maxLength - 3) + '...';
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
      const fallbackTitle = input.itemData.title.slice(0, 50);
      const fallbackDescription = input.itemData.description || `Sprawdź tę okazję: ${input.itemData.title}`;
      const fallbackHashtags = ['#okazje', '#promocje', '#zakupy'];
      const platformConstraints: Record<string, { maxLength: number }> = {
        facebook: { maxLength: 400 },
        instagram: { maxLength: 300 },
        twitter: { maxLength: 280 },
        linkedin: { maxLength: 600 },
        tiktok: { maxLength: 150 },
      };
      
      return {
        title: fallbackTitle,
        description: fallbackDescription.slice(0, platformConstraints[input.platform].maxLength),
        hashtags: input.template?.includeHashtags !== false ? fallbackHashtags : [],
        callToAction: 'Sprawdź teraz! 🔥',
        emojiSuggestions: input.template?.includeEmojis !== false ? ['🔥', '💰', '🎁'] : [],
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
): Promise<z.infer<typeof GenerateSocialPostOutputSchema>> {
  return generateSocialPostFlow({
    platform,
    type,
    itemData,
    template,
  });
}
