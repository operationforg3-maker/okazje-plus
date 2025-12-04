/**
 * AI-Powered Translation: English → Polish Product Descriptions
 * 
 * Translates product descriptions while preserving technical details and formatting
 */

import { defineFlow, run, model } from 'genkit';

export interface TranslateDescriptionRequest {
  descriptionEN: string;
  categoryEN?: string;
  subcategoryEN?: string;
  context?: 'product_description' | 'product_features' | 'deal_description';
}

export interface TranslateDescriptionResult {
  descriptionPL: string;
  confidence: number;
  hasManualReview?: boolean;
}

/**
 * Flow: AI Translate English Product Description to Polish
 */
export const aiTranslateDescriptionToPL = defineFlow(
  {
    name: 'aiTranslateDescriptionToPL',
    inputSchema: {
      type: 'object',
      properties: {
        descriptionEN: { type: 'string', description: 'English product description' },
        categoryEN: { type: 'string', description: 'Product category' },
        subcategoryEN: { type: 'string', description: 'Product subcategory' },
        context: { type: 'string', enum: ['product_description', 'product_features', 'deal_description'] },
      },
      required: ['descriptionEN'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        descriptionPL: { type: 'string', description: 'Translated Polish description' },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
        hasManualReview: { type: 'boolean' },
      },
      required: ['descriptionPL', 'confidence'],
    },
  },
  async (input: TranslateDescriptionRequest): Promise<TranslateDescriptionResult> => {
    const { descriptionEN, categoryEN, subcategoryEN, context = 'product_description' } = input;

    const prompt = buildDescriptionPrompt(descriptionEN, categoryEN, subcategoryEN, context);

    try {
      const response = await run('translate-description', async () => {
        const result = await model('vertexai/gemini-2.0-flash-exp').generate({
          prompt,
          config: {
            temperature: 0.4,
            maxOutputTokens: 500,
          },
        });
        return result;
      });

      const descriptionPL = response.text?.trim() || descriptionEN;
      const confidence = assessDescriptionConfidence(descriptionEN, descriptionPL);

      return {
        descriptionPL,
        confidence,
        hasManualReview: confidence < 65,
      };
    } catch (error: any) {
      console.error('[aiTranslateDescriptionToPL] Failed:', error.message);
      
      return {
        descriptionPL: descriptionEN,
        confidence: 0,
        hasManualReview: true,
      };
    }
  }
);

/**
 * Build prompt for description translation
 */
function buildDescriptionPrompt(
  descriptionEN: string,
  categoryEN?: string,
  subcategoryEN?: string,
  context: string = 'product_description'
): string {
  const categoryInfo = [categoryEN, subcategoryEN]
    .filter(Boolean)
    .join(' > ');

  const contextHints = {
    product_description: 'detailed product description',
    product_features: 'feature list or bullet points',
    deal_description: 'promotional offer description',
  }[context] || 'product description';

  return `You are a professional Polish translator for e-commerce product descriptions.

TASK: Translate the following English ${contextHints} to natural, fluent Polish.

ENGLISH TEXT:
${descriptionEN}

${categoryInfo ? `CATEGORY: ${categoryInfo}\n` : ''}

TRANSLATION GUIDE:
1. Preserve all technical specifications, model numbers, and formatting
2. Use professional Polish terminology for e-commerce
3. Maintain bullet points, line breaks, and structure
4. Keep brand names and model numbers unchanged
5. Translate common tech terms to Polish equivalents:
   - Features → Funkcje
   - Specifications → Specyfikacja
   - Warranty → Gwarancja
   - Compatibility → Kompatybilność
   - Performance → Wydajność
   - Quality → Jakość
   - Brand new → Nowy
   - Used → Używany
   - Condition → Stan
   - Shipping → Wysyłka
   - Free shipping → Darmowa wysyłka
   - Fast delivery → Szybka dostawa
   - 30-day return → 30 dni zwrotu
   - Official product → Oficjalny produkt
   - Authentic → Autentyczny

6. Make descriptions engaging but factual
7. Avoid marketing hype, focus on product value
8. If original has bullet points, preserve them

OUTPUT: Translated Polish text ONLY, maintaining original structure`;
}

/**
 * Assess confidence of description translation
 */
function assessDescriptionConfidence(
  descriptionEN: string,
  descriptionPL: string
): number {
  let confidence = 75;

  // Length sanity check
  const lengthRatio = descriptionPL.length / descriptionEN.length;
  
  // Polish tends to be slightly longer (10-40% more)
  if (lengthRatio < 0.8) {
    confidence -= 15; // Too short, likely truncated
  } else if (lengthRatio > 1.6) {
    confidence -= 10; // Too long, likely over-translated
  } else if (lengthRatio > 0.9 && lengthRatio < 1.5) {
    confidence += 5; // Reasonable length range
  }

  // Check if key tech terms were translated
  const hasPolishTerms = [
    'Funkcje', 'Specyfikacja', 'Gwarancja', 'Wysyłka',
    'Nowy', 'Stan', 'Jakość', 'Kompatybilność'
  ].some(term => descriptionPL.includes(term));
  
  if (hasPolishTerms) {
    confidence += 10;
  }

  // Check for untranslated English paragraphs (bad sign)
  const englishWordCount = (descriptionPL.match(/\b(the|and|or|with|from|to|for|of|in)\b/gi) || []).length;
  if (englishWordCount > descriptionPL.split(' ').length * 0.3) {
    confidence -= 20; // Too many English words
  }

  // Warn if description is empty or minimal
  if (descriptionPL.length < 20) {
    confidence -= 30;
  }

  // Check if it looks like a fallback (same as input)
  if (descriptionPL === descriptionEN) {
    confidence = 10;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Batch translation for descriptions
 */
export async function translateDescriptionToPLBatch(
  items: Array<{ descriptionEN: string; categoryEN?: string; subcategoryEN?: string }>,
  batchSize: number = 3,
  delayMs: number = 500
): Promise<Map<string, TranslateDescriptionResult>> {
  const results = new Map<string, TranslateDescriptionResult>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      const result = await aiTranslateDescriptionToPL({
        descriptionEN: item.descriptionEN,
        categoryEN: item.categoryEN,
        subcategoryEN: item.subcategoryEN,
        context: 'product_description',
      });

      results.set(item.descriptionEN, result);
    } catch (error: any) {
      console.error(`[translateDescriptionToPLBatch] Failed:`, error.message);
      results.set(item.descriptionEN, {
        descriptionPL: item.descriptionEN,
        confidence: 0,
        hasManualReview: true,
      });
    }

    // Rate limiting
    if ((i + 1) % batchSize === 0) {
      console.log(`[translateDescriptionToPLBatch] Processed ${i + 1}/${items.length}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
