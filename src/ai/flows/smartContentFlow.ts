/**
 * Smart Content Generation Flow
 * 
 * Uses Vertex AI Gemini 2.0 Flash for parallel multilingual content generation
 * - Translate product titles to PL/EN/DE
 * - Remove spam keywords and optimize for marketing
 * - Generate localized descriptions and feature bullets
 * - Create JSON-LD structured data for SEO
 * - Calculate AI quality score (0-100)
 */

import { ai } from '../genkit';
import { logger } from '@/lib/logging';
import { AIContent } from '@/lib/types';

const gemini20 = 'vertexai/gemini-2.0-flash-exp';

export interface SmartContentInput {
  originalTitle: string;       // English title from AliExpress
  originalDescription?: string; // English description (if available)
  specifications?: string[];    // Technical specs
  category: string;            // Product category
  price: number;               // Price in USD
  discount?: number;           // Discount percentage
}

export interface SmartContentOutput extends AIContent {
  warnings?: string[];         // Any issues detected (spam, low quality, etc.)
}

/**
 * Generate multilingual marketing content with AI
 * 
 * Parallel execution strategy:
 * 1. Main generation (PL/EN/DE titles + descriptions + bullets)
 * 2. SEO optimization (meta titles + descriptions)
 * 3. JSON-LD structured data generation
 * 4. Quality scoring
 */
export async function generateSmartContent(
  input: SmartContentInput
): Promise<SmartContentOutput> {
  const startTime = Date.now();
  
  logger.info('Generating smart content', {
    title: input.originalTitle,
    category: input.category,
  });
  
  try {
    // Phase 1: Main Content Generation (Parallel)
    const [contentResult, seoResult, jsonLdResult] = await Promise.all([
      generateMainContent(input),
      generateSEOContent(input),
      generateJSONLD(input),
    ]);
    
    // Phase 2: Quality Scoring
    const qualityScore = calculateQualityScore(contentResult, input);
    
    const result: SmartContentOutput = {
      titlePL: contentResult.titlePL,
      titleEN: contentResult.titleEN,
      titleDE: contentResult.titleDE,
      description: contentResult.description,
      bullets: contentResult.bullets,
      seoTitle: seoResult.seoTitle,
      seoDescription: seoResult.seoDescription,
      jsonLd: jsonLdResult,
      score: qualityScore,
      generatedAt: new Date().toISOString(),
      modelVersion: gemini20,
      warnings: contentResult.warnings,
    };
    
    const duration = Date.now() - startTime;
    logger.info('Smart content generated', {
      score: qualityScore,
      duration,
      warnings: result.warnings?.length || 0,
    });
    
    return result;
  } catch (error) {
    logger.error('Smart content generation failed', { error });
    
    // Fallback: Return basic content based on input
    return {
      titlePL: input.originalTitle,
      titleEN: input.originalTitle,
      titleDE: input.originalTitle,
      description: {
        pl: input.originalDescription || '',
        en: input.originalDescription || '',
        de: input.originalDescription || '',
      },
      bullets: {
        pl: input.specifications || [],
        en: input.specifications || [],
        de: input.specifications || [],
      },
      score: 30, // Low score for fallback content
      generatedAt: new Date().toISOString(),
      modelVersion: gemini20,
      warnings: ['AI generation failed - using fallback content'],
    };
  }
}

/**
 * Generate main product content (titles, descriptions, bullets)
 */
async function generateMainContent(input: SmartContentInput): Promise<{
  titlePL: string;
  titleEN: string;
  titleDE: string;
  description: Record<string, string>;
  bullets: Record<string, string[]>;
  warnings: string[];
}> {
  const prompt = `You are a professional e-commerce content writer. Generate compelling product content in 3 languages (Polish, English, German).

PRODUCT INFORMATION:
- Original Title: ${input.originalTitle}
- Description: ${input.originalDescription || 'N/A'}
- Specifications: ${input.specifications?.join(', ') || 'N/A'}
- Category: ${input.category}
- Price: $${input.price}
${input.discount ? `- Discount: ${input.discount}%` : ''}

TASKS:
1. Create catchy, marketing-optimized titles (remove spam keywords like "hot sale", "wholesale", "dropship")
2. Write engaging descriptions (2-3 sentences, focus on benefits)
3. Extract 5 key features as bullet points

REQUIREMENTS:
- Polish title: Natural, marketing-friendly, no English words
- English title: Professional, SEO-optimized
- German title: Formal, clear
- Remove spam: "NEW", "HOT", "SALE", "FREE SHIPPING", supplier jargon
- Focus on product value and benefits
- Keep technical accuracy

OUTPUT FORMAT (JSON):
{
  "titlePL": "Polish title here",
  "titleEN": "English title here",
  "titleDE": "German title here",
  "descriptionPL": "Polish description...",
  "descriptionEN": "English description...",
  "descriptionDE": "German description...",
  "bulletsPL": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "bulletsEN": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "bulletsDE": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "warnings": ["any issues detected"]
}`;

  try {
    const response = await ai.generate({
      model: gemini20,
      prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    });
    
    const text = response.text();
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    
    return {
      titlePL: parsed.titlePL || input.originalTitle,
      titleEN: parsed.titleEN || input.originalTitle,
      titleDE: parsed.titleDE || input.originalTitle,
      description: {
        pl: parsed.descriptionPL || '',
        en: parsed.descriptionEN || '',
        de: parsed.descriptionDE || '',
      },
      bullets: {
        pl: parsed.bulletsPL || [],
        en: parsed.bulletsEN || [],
        de: parsed.bulletsDE || [],
      },
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    logger.error('Main content generation failed', { error });
    throw error;
  }
}

/**
 * Generate SEO-optimized meta titles and descriptions
 */
async function generateSEOContent(input: SmartContentInput): Promise<{
  seoTitle: Record<string, string>;
  seoDescription: Record<string, string>;
}> {
  const prompt = `Generate SEO-optimized meta titles and descriptions for this product in Polish, English, and German.

PRODUCT: ${input.originalTitle}
CATEGORY: ${input.category}
PRICE: $${input.price}

REQUIREMENTS:
- Meta Title: 50-60 characters, include key product attribute
- Meta Description: 150-160 characters, compelling, include call-to-action
- Focus on search intent and conversions

OUTPUT FORMAT (JSON):
{
  "metaTitlePL": "...",
  "metaTitleEN": "...",
  "metaTitleDE": "...",
  "metaDescPL": "...",
  "metaDescEN": "...",
  "metaDescDE": "..."
}`;

  try {
    const response = await ai.generate({
      model: gemini20,
      prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 500,
      },
    });
    
    const text = response.text();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in SEO response');
    }
    
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    
    return {
      seoTitle: {
        pl: parsed.metaTitlePL || input.originalTitle,
        en: parsed.metaTitleEN || input.originalTitle,
        de: parsed.metaTitleDE || input.originalTitle,
      },
      seoDescription: {
        pl: parsed.metaDescPL || '',
        en: parsed.metaDescEN || '',
        de: parsed.metaDescDE || '',
      },
    };
  } catch (error) {
    logger.error('SEO content generation failed', { error });
    // Fallback to input title
    return {
      seoTitle: {
        pl: input.originalTitle,
        en: input.originalTitle,
        de: input.originalTitle,
      },
      seoDescription: {
        pl: input.originalDescription || '',
        en: input.originalDescription || '',
        de: input.originalDescription || '',
      },
    };
  }
}

/**
 * Generate JSON-LD structured data for rich snippets
 */
async function generateJSONLD(input: SmartContentInput): Promise<string> {
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: input.originalTitle,
    description: input.originalDescription || input.originalTitle,
    offers: {
      '@type': 'Offer',
      price: input.price.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    ...(input.discount && {
      offers: {
        '@type': 'Offer',
        price: (input.price * (1 - input.discount / 100)).toFixed(2),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    }),
  };
  
  return JSON.stringify(jsonLd, null, 2);
}

/**
 * Calculate AI quality score (0-100)
 * 
 * Factors:
 * - Title quality (length, spam keywords)
 * - Description completeness
 * - Bullet points count and quality
 * - Multilingual consistency
 */
function calculateQualityScore(
  content: {
    titlePL: string;
    titleEN: string;
    titleDE: string;
    description: Record<string, string>;
    bullets: Record<string, string[]>;
    warnings: string[];
  },
  input: SmartContentInput
): number {
  let score = 100;
  
  // Title quality checks
  const spamKeywords = ['hot', 'sale', 'new', 'wholesale', 'dropship', 'free shipping', '!!!'];
  const titleLower = content.titlePL.toLowerCase();
  spamKeywords.forEach(keyword => {
    if (titleLower.includes(keyword)) {
      score -= 10;
    }
  });
  
  // Title length (optimal 30-60 chars)
  if (content.titlePL.length < 20) score -= 15;
  if (content.titlePL.length > 80) score -= 10;
  
  // Description completeness
  if (!content.description.pl || content.description.pl.length < 50) score -= 20;
  if (!content.description.en || content.description.en.length < 50) score -= 10;
  if (!content.description.de || content.description.de.length < 50) score -= 5;
  
  // Bullet points quality
  if (!content.bullets.pl || content.bullets.pl.length < 3) score -= 15;
  if (content.bullets.pl && content.bullets.pl.length >= 5) score += 10;
  
  // Warnings penalty
  score -= (content.warnings.length * 5);
  
  // Multilingual consistency bonus
  if (content.titlePL && content.titleEN && content.titleDE) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Batch generate content for multiple products (with retry logic)
 */
export async function batchGenerateSmartContent(
  inputs: SmartContentInput[],
  options: {
    batchSize?: number;
    delayMs?: number;
    maxRetries?: number;
  } = {}
): Promise<SmartContentOutput[]> {
  const { batchSize = 5, delayMs = 1000, maxRetries = 2 } = options;
  
  const results: SmartContentOutput[] = [];
  
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    
    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(inputs.length / batchSize)}`);
    
    const batchResults = await Promise.all(
      batch.map(async (input) => {
        let lastError: any;
        for (let retry = 0; retry <= maxRetries; retry++) {
          try {
            return await generateSmartContent(input);
          } catch (error) {
            lastError = error;
            logger.warn(`Retry ${retry + 1}/${maxRetries} for product`, { title: input.originalTitle });
            await new Promise(resolve => setTimeout(resolve, delayMs * (retry + 1)));
          }
        }
        
        // All retries failed - return fallback
        logger.error('All retries failed, using fallback', { title: input.originalTitle, error: lastError });
        return {
          titlePL: input.originalTitle,
          titleEN: input.originalTitle,
          titleDE: input.originalTitle,
          description: { pl: '', en: '', de: '' },
          bullets: { pl: [], en: [], de: [] },
          score: 20,
          generatedAt: new Date().toISOString(),
          modelVersion: gemini20,
          warnings: ['All AI generation attempts failed'],
        };
      })
    );
    
    results.push(...batchResults);
    
    // Delay between batches
    if (i + batchSize < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}
