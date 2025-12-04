/**
 * AI Content Generator for Draft Deals (Cloud Functions version)
 * 
 * Używa Gemini 2.0 Flash do:
 * 1. Parsing HTML/image i generowania pełnego opisu (PL)
 * 2. Kategorizacji automatycznej
 * 3. Estymacji ceny z tekstu
 * 4. Generowania attractive deal headline
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Minimal Deal type definition for this function
export interface DealMetadata {
  source?: string;
  importedAt?: string;
  originalUrl?: string;
  promotionId?: string;
  commissionRate?: number;
  draftDealId?: string;
  contentConfidence?: number;
  generationWarnings?: string[];
  [key: string]: any;
}

export interface GeneratedDeal {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  imageHint: string;
  postedBy: string;
  postedAt: string;
  voteCount: number;
  temperature: number;
  commentsCount: number;
  category: string;
  mainCategorySlug: string;
  subCategorySlug: string;
  status: 'draft' | 'approved' | 'rejected';
  createdBy?: string;
  createdAt?: string;
  source?: string;
  importMetadata?: DealMetadata;
  tags?: string[];
}

export interface DealContentInput {
  title: string;
  description: string;
  originalUrl: string;
  imageUrl?: string | null;
  price?: string | null;
  htmlContent?: string;
}

export interface GeneratedDealContent {
  title: string;
  description: string;
  categorySlug: string;
  price: number;
  originalPrice?: number;
  headline: string; // Attractive one-liner
  confidence: number; // 0.0 - 1.0
  warnings: string[];
}

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

/**
 * Generate complete deal content from scraped data using Gemini
 */
export async function generateDealContent(
  input: DealContentInput
): Promise<GeneratedDealContent> {
  const warnings: string[] = [];

  try {
    const prompt = buildContentPrompt(input);
    console.log('[AI] Generating deal content with Gemini...');

    // Use Gemini 2.0 Flash (or 1.5 Pro if 2.0 unavailable)
    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2000,
      },
    });

    const responseText =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[AI] Raw response:', responseText.substring(0, 200));

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }

    const generated = JSON.parse(jsonMatch[0]) as GeneratedDealContent;

    // Validate generated content
    if (!generated.title || generated.title.length < 10) {
      warnings.push('Generated title is too short, using original');
      generated.title = input.title;
    }

    if (!generated.description || generated.description.length < 20) {
      warnings.push('Generated description is too short, using original');
      generated.description = input.description;
    }

    if (!generated.categorySlug || generated.categorySlug.length === 0) {
      warnings.push('Category could not be determined, marking as "other"');
      generated.categorySlug = 'other';
    }

    if (generated.price <= 0) {
      warnings.push('Price extraction failed, using 0');
      generated.price = 0;
    }

    // Ensure confidence is valid
    if (
      typeof generated.confidence !== 'number' ||
      generated.confidence < 0 ||
      generated.confidence > 1
    ) {
      generated.confidence = 0.5;
    }

    console.log(
      '[AI] ✓ Generated content with confidence:',
      generated.confidence
    );

    return {
      ...generated,
      warnings,
    };
  } catch (error: any) {
    console.error('[AI] Failed to generate content:', error.message);
    throw error;
  }
}

/**
 * Build detailed prompt for Gemini
 */
function buildContentPrompt(input: DealContentInput): string {
  const imageContext = input.imageUrl
    ? `\nProduct image available at: ${input.imageUrl}`
    : '';

  return `You are an expert e-commerce content analyzer for a Polish deals platform (okazje-plus).

TASK: Analyze the following product information and generate professional deal content.

PRODUCT TITLE: ${input.title}
PRODUCT DESCRIPTION: ${input.description}
ORIGINAL URL: ${input.originalUrl}
PRICE INFO: ${input.price || 'Not found'}${imageContext}

${
  input.htmlContent
    ? `\nRaw HTML context (first 5000 chars):\n${input.htmlContent.substring(0, 5000)}`
    : ''
}

REQUIREMENTS:
1. Generate an improved Polish title (max 100 chars) - compelling and SEO-friendly
2. Generate a complete Polish description (200-400 chars) - focus on benefits and unique selling points
3. Categorize into one of: "elektronika", "moda", "dom", "sport", "ksiazki", "zabawki", "automotive", "other"
4. Extract or estimate price in PLN (if price in USD, multiply by 4.0; if EUR, multiply by 4.5)
5. Extract original/list price if available
6. Generate a short, catchy headline (max 50 chars) that makes the deal sound attractive
7. Confidence score 0.0-1.0 (1.0 = very confident about the data)
8. List any warnings or issues

RESPONSE FORMAT (JSON):
{
  "title": "Ulepszona polska nazwa produktu",
  "description": "Pełny opis korzyści i specyfiki produktu w języku polskim",
  "categorySlug": "elektronika",
  "price": 299.99,
  "originalPrice": 499.99,
  "headline": "🔥 Mega okazja! Oszczędź 40%",
  "confidence": 0.85,
  "warnings": []
}

Be precise and professional. Focus on value and appeal for Polish customers.`;
}

/**
 * Convert generated content to Deal document structure
 */
export function contentToDeal(
  input: DealContentInput,
  generated: GeneratedDealContent,
  draftDealId: string,
  userId: string
): Omit<GeneratedDeal, 'id'> {
  return {
    title: generated.title,
    description: generated.description,
    price: generated.price,
    originalPrice: generated.originalPrice,
    link: input.originalUrl,
    image: input.imageUrl || '',
    imageHint: '',
    postedBy: userId,
    postedAt: new Date().toISOString(),
    voteCount: 0,
    temperature: 0,
    commentsCount: 0,
    category: generated.categorySlug,
    mainCategorySlug: generated.categorySlug,
    subCategorySlug: 'other',
    status: 'draft', // Set to draft so admin reviews before publishing
    createdBy: userId,
    createdAt: new Date().toISOString(),
    source: 'auto-scraped',
    importMetadata: {
      source: 'draft-deal-auto-filler',
      importedAt: new Date().toISOString(),
      originalUrl: input.originalUrl,
      draftDealId,
      contentConfidence: generated.confidence,
      generationWarnings: generated.warnings,
    },
    tags: ['auto-generated', 'ai-filled'],
  };
}
