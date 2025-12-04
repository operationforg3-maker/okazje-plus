/**
 * AI-Powered Translation: English → Polish Product Titles
 * 
 * Uses Claude with context about product category for accurate technical terminology
 * Batch-friendly with configurable rate limiting
 */

import { defineFlow, run } from '@genkit-ai/flow';
import { openai } from '@genkit-ai/openai';

export interface TranslateTitleRequest {
  titleEN: string;
  categoryEN?: string;
  subcategoryEN?: string;
  context?: 'product_title' | 'product_description' | 'deal_title';
}

export interface TranslateTitleResult {
  titlePL: string;
  confidence: number; // 0-100
  hasManualReview?: boolean;
}

/**
 * Flow: AI Translate English Product Title to Polish
 * 
 * Context-aware translation using Claude, optimized for e-commerce product names
 */
export const aiTranslateTitleToPL = defineFlow(
  {
    name: 'aiTranslateTitleToPL',
    inputSchema: {
      type: 'object',
      properties: {
        titleEN: { type: 'string', description: 'English product title' },
        categoryEN: { type: 'string', description: 'Product category in English (e.g., "electronics")' },
        subcategoryEN: { type: 'string', description: 'Product subcategory in English (e.g., "smartphones")' },
        context: { type: 'string', enum: ['product_title', 'product_description', 'deal_title'] },
      },
      required: ['titleEN'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        titlePL: { type: 'string', description: 'Translated Polish title' },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
        hasManualReview: { type: 'boolean' },
      },
      required: ['titlePL', 'confidence'],
    },
  },
  async (input: TranslateTitleRequest): Promise<TranslateTitleResult> => {
    const { titleEN, categoryEN, subcategoryEN, context = 'product_title' } = input;

    // Build category context for better translation
    const categoryContext = [categoryEN, subcategoryEN].filter(Boolean).join(' → ');
    const contextHint = categoryContext ? `(Category: ${categoryContext})` : '';

    const prompt = buildTranslationPrompt(titleEN, categoryEN, subcategoryEN, context);

    try {
      // Call Claude for translation
      const response = await run('translate-title', async () => {
        const result = await openai.generateText({
          prompt,
          temperature: 0.3, // Low temperature for consistency
          maxOutputTokens: 150,
        });
        return result;
      });

      // Parse response
      const generatedText = response.text || '';
      
      // Extract Polish title (usually in quotes or first line)
      const titlePL = extractPolishTitle(generatedText);
      
      // Calculate confidence based on response quality
      const confidence = assessConfidence(titleEN, titlePL, generatedText);

      // Flag for manual review if confidence is low
      const hasManualReview = confidence < 70;

      return {
        titlePL,
        confidence,
        hasManualReview,
      };
    } catch (error: any) {
      console.error('[aiTranslateTitleToPL] Translation failed:', error.message);
      
      // Fallback: return English title if translation fails
      return {
        titlePL: titleEN,
        confidence: 0,
        hasManualReview: true,
      };
    }
  }
);

/**
 * Build detailed prompt for Claude to ensure high-quality translations
 */
function buildTranslationPrompt(
  titleEN: string,
  categoryEN?: string,
  subcategoryEN?: string,
  context: string = 'product_title'
): string {
  const categoryInfo = [categoryEN, subcategoryEN]
    .filter(Boolean)
    .join(' > ');

  const contextInfo = {
    product_title: 'concise e-commerce product name',
    product_description: 'detailed product description',
    deal_title: 'promotional offer headline',
  }[context] || 'product title';

  return `You are a professional Polish translator specializing in e-commerce product names.

TASK: Translate the following English ${contextInfo} to natural, professional Polish.

ENGLISH TEXT:
"${titleEN}"

${categoryInfo ? `PRODUCT CATEGORY: ${categoryInfo}\n` : ''}

REQUIREMENTS:
1. Maintain all technical specifications and model numbers (they don't translate)
2. Translate common tech terms to Polish equivalents:
   - smartphone → smartfon
   - laptop → laptop (common in Polish tech context)
   - tablet → tablet
   - headphones → słuchawki
   - monitor → monitor
   - processor → procesor
   - RAM → RAM
   - storage → pamięć
   - camera → kamera
   - battery → bateria
   - screen → ekran
   - display → wyświetlacz
   - wireless → bezprzewodowy
   - waterproof → wodoodporny
   - fast charging → szybkie ładowanie
   - 5G → 5G
   - USB-C → USB-C

3. Keep formatting consistent (sizes, colors, numbers remain the same)
4. Use natural Polish phrasing for adjectives and descriptions
5. Output ONLY the translated title, nothing else
6. If unsure about translation, keep English terms in place

TRANSLATED POLISH TEXT:`;
}

/**
 * Extract Polish title from Claude's response
 */
function extractPolishTitle(response: string): string {
  // Try to extract from quotes first
  const quoted = response.match(/"([^"]+)"/);
  if (quoted) return quoted[1].trim();

  // Try to extract from single quotes
  const singleQuoted = response.match(/'([^']+)'/);
  if (singleQuoted) return singleQuoted[1].trim();

  // Take first line if nothing is quoted
  const firstLine = response.split('\n')[0].trim();
  if (firstLine.length > 10 && firstLine.length < 500) {
    return firstLine;
  }

  // Fallback: return original response
  return response.trim().slice(0, 300);
}

/**
 * Assess confidence of translation quality
 */
function assessConfidence(
  titleEN: string,
  titlePL: string,
  response: string
): number {
  let confidence = 80; // Base score

  // Penalize if Polish is too short (likely incomplete)
  if (titlePL.length < titleEN.length * 0.6) {
    confidence -= 20;
  }

  // Penalize if output is too long (likely over-translated)
  if (titlePL.length > titleEN.length * 1.8) {
    confidence -= 15;
  }

  // Bonus if response includes expected Polish terms
  const polishTerms = ['smartfon', 'ekran', 'bateria', 'pamięć', 'procesor'];
  const hasPolishTerms = polishTerms.some(term => titlePL.toLowerCase().includes(term));
  if (hasPolishTerms) {
    confidence += 10;
  }

  // Penalize if response is very short (likely fallback to English)
  if (titlePL.length < 5) {
    confidence -= 30;
  }

  // If titlePL is identical to titleEN, it's likely not translated
  if (titlePL === titleEN) {
    confidence = 20;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Batch translation wrapper for import pipeline
 */
export async function translateTitleToPLBatch(
  titles: Array<{ titleEN: string; categoryEN?: string; subcategoryEN?: string }>,
  batchSize: number = 5,
  delayMs: number = 200
): Promise<Map<string, TranslateTitleResult>> {
  const results = new Map<string, TranslateTitleResult>();

  for (let i = 0; i < titles.length; i++) {
    const item = titles[i];
    
    try {
      const result = await aiTranslateTitleToPL({
        titleEN: item.titleEN,
        categoryEN: item.categoryEN,
        subcategoryEN: item.subcategoryEN,
        context: 'product_title',
      });

      results.set(item.titleEN, result);
    } catch (error: any) {
      console.error(`[translateTitleToPLBatch] Failed for "${item.titleEN}":`, error.message);
      results.set(item.titleEN, {
        titlePL: item.titleEN,
        confidence: 0,
        hasManualReview: true,
      });
    }

    // Rate limiting between items
    if ((i + 1) % batchSize === 0) {
      console.log(`[translateTitleToPLBatch] Processed ${i + 1}/${titles.length}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
