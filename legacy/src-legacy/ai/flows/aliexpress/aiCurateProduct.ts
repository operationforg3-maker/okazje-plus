/**
 * AI Product Curator Pipeline (M4 Smart Importing)
 * 
 * "The Humanizer" - Transforms raw messy AliExpress data into high-quality,
 * multi-language product content optimized for search and conversion.
 * 
 * Input: Raw AliExpress product data (messy titles, HTML descriptions, specs)
 * Output: Structured, localized, SEO-optimized product data
 * 
 * Features:
 * ✅ Multi-language translation (PL, EN, DE extensible)
 * ✅ Title normalization (remove spam keywords, create human-readable)
 * ✅ SEO meta description generation focused on benefits
 * ✅ Specification structuring (clean JSON key-value pairs)
 * ✅ Description sanitization (HTML cleanup)
 * ✅ Keyword extraction for search indexing
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logger } from '@/lib/logging';

// Input schema
const RawProductDataSchema = z.object({
  title: z.string(),
  description: z.string(), // Can be HTML
  specifications: z.array(z.object({
    key: z.string().optional(),
    name: z.string().optional(),
    value: z.string(),
  })).optional(),
  price: z.number(),
  originalPrice: z.number().optional(),
  categoryPath: z.array(z.string()).optional(),
});

// Output schema
const CuratedProductSchema = z.object({
  // Multi-language content
  title: z.object({
    pl: z.string().describe('Polish product title - concise, human-readable, no spam'),
    en: z.string().describe('English product title - natural, benefit-focused'),
    de: z.string().describe('German product title - clear and descriptive'),
  }),
  
  shortDescription: z.object({
    pl: z.string().describe('Polish short description (1-2 sentences, key benefits)'),
    en: z.string().describe('English short description (value proposition)'),
    de: z.string().describe('German short description (main features)'),
  }),
  
  fullDescription: z.object({
    pl: z.string().describe('Polish full description (clean, structured, no HTML)'),
    en: z.string().describe('English full description (detailed, benefit-driven)'),
    de: z.string().describe('German full description (comprehensive, technical)'),
  }),
  
  seoDescription: z.object({
    pl: z.string().describe('Polish SEO meta description (150-160 chars, benefit-focused)'),
    en: z.string().describe('English SEO meta description (search-optimized)'),
    de: z.string().describe('German SEO meta description (conversion-focused)'),
  }),
  
  // Structured data
  specifications: z.array(z.object({
    name: z.string().describe('Specification name (e.g., Material, Color, Weight)'),
    value: z.string().describe('Specification value (e.g., Stainless Steel, Silver, 500g)'),
    unit: z.string().optional().describe('Unit of measurement if applicable (g, cm, etc.)'),
  })).describe('Clean, structured product specifications'),
  
  keywords: z.array(z.string()).describe('SEO keywords (5-10 relevant terms, Polish-focused)'),
  
  category: z.object({
    suggestedMain: z.string().optional().describe('Suggested main category slug'),
    suggestedSub: z.string().optional().describe('Suggested subcategory slug'),
    confidence: z.number().optional().describe('Classification confidence (0-1)'),
  }).optional(),
  
  quality: z.object({
    titleQuality: z.number().describe('Title quality score (0-100)'),
    contentQuality: z.number().describe('Content quality score (0-100)'),
    warnings: z.array(z.string()).describe('Quality warnings (spammy keywords, missing info, etc.)'),
  }),
});

type RawProductData = z.infer<typeof RawProductDataSchema>;
type CuratedProduct = z.infer<typeof CuratedProductSchema>;

/**
 * AI Product Curator Flow
 * 
 * Transforms raw AliExpress product data into structured, multi-language content
 */
export const aiCurateProduct = ai.defineFlow(
  {
    name: 'aiCurateProduct',
    inputSchema: RawProductDataSchema,
    outputSchema: CuratedProductSchema,
  },
  async (input: RawProductData): Promise<CuratedProduct> => {
    logger.info('Starting AI product curation', {
      rawTitle: input.title,
      hasDescription: !!input.description,
      hasSpecs: !!input.specifications?.length,
    });

    const prompt = `
You are an expert e-commerce content curator specializing in transforming raw marketplace product data into high-quality, multi-language product listings.

TASK: Transform this raw AliExpress product data into clean, localized, SEO-optimized content.

RAW INPUT DATA:
- Title: "${input.title}"
- Description: ${input.description || 'N/A'}
- Specifications: ${input.specifications ? JSON.stringify(input.specifications) : 'N/A'}
- Price: ${input.price} PLN${input.originalPrice ? ` (was ${input.originalPrice} PLN)` : ''}
- Category: ${input.categoryPath?.join(' > ') || 'Unknown'}

TRANSFORMATION RULES:

1. TITLE NORMALIZATION:
   - Remove spam keywords: "2024", "Hot Sale", "New Arrival", "Best Seller", excessive emojis
   - Remove unnecessary details: SKU codes, seller names, promotional text
   - Keep essential: Brand (if reputable), key feature, product type
   - Make human-readable: "Vintage Summer Dress - Floral Pattern" not "2024 Hot Sale Women Vintage Dress Summer Floral Print Best Selling"
   - Polish should be natural, not direct translation
   - Ensure titles are concise (max 80 chars per language)

2. DESCRIPTIONS:
   - Short: 1-2 sentences highlighting key benefits and use case
   - Full: 3-5 paragraphs covering features, benefits, specifications, use cases
   - Remove HTML tags and clean up formatting
   - Focus on buyer benefits, not just features
   - Avoid marketing hype, be factual and helpful
   - Polish descriptions should feel native, not translated

3. SEO DESCRIPTIONS (Meta):
   - Exactly 150-160 characters
   - Include primary keyword naturally
   - Focus on benefits and value proposition
   - Call-to-action where appropriate
   - Optimized for Google Shopping and search

4. SPECIFICATIONS:
   - Extract from both title and description
   - Standardize names: "Material" not "materiat", "Color" not "kolor/colour"
   - Clean values: "Stainless Steel" not "stainless steel!!!"
   - Add units where logical: "500g" not just "500"
   - Remove duplicate or redundant specs
   - Typical specs: Material, Color, Size, Weight, Warranty, Brand, Model

5. KEYWORDS:
   - 5-10 relevant Polish keywords for search
   - Include product type, main feature, use case, material
   - Example: ["sukienka letnia", "wzór kwiatowy", "vintage", "bawełna"]
   - Avoid spam keywords

6. QUALITY SCORING:
   - Title: penalize spam keywords, reward clarity
   - Content: penalize missing info, reward completeness
   - Flag warnings: suspicious claims, poor translation, missing essential data

7. CATEGORY SUGGESTION:
   - Based on product analysis, suggest appropriate category
   - Use slugs like: "elektronika", "moda", "dom-ogrod", etc.
   - Provide confidence score (0-1)

OUTPUT REQUIREMENTS:
- All Polish text must be native-quality, not robotic translation
- English and German should be natural and localized
- Specifications must be actionable and complete
- SEO descriptions must be exactly 150-160 characters
- Quality scores should be realistic (most products: 60-80)

EXAMPLES:

BAD TITLE: "2024 New Hot Sale Women's Vintage Summer Floral Dress Fashion Casual Beach Party Maxi Long Dress Best Selling!!!"
GOOD TITLE (PL): "Sukienka Letnia Vintage z Kwiatowym Wzorem"
GOOD TITLE (EN): "Vintage Summer Dress - Floral Pattern"
GOOD TITLE (DE): "Vintage Sommerkleid mit Blumenmuster"

BAD SEO: "Buy this amazing dress now hot sale best price free shipping worldwide 2024 new fashion trend!!!"
GOOD SEO (PL): "Elegancka sukienka letnia w stylu vintage z kwiatowym wzorem. Idealna na lato, wykonana z przewiewnej bawełny. Zamów teraz!"

Now process the provided product data and output structured JSON.
`;

    try {
      const result = await ai.generate({
        model: 'vertexai/gemini-2.0-flash-exp',
        prompt,
        output: {
          schema: CuratedProductSchema,
        },
        config: {
          temperature: 0.3, // Lower for more consistent, factual output
          maxOutputTokens: 2048,
        },
      });

      const curated = result.output as CuratedProduct;

      logger.info('Product curation completed', {
        rawTitle: input.title,
        curatedTitlePL: curated.title.pl,
        titleQuality: curated.quality.titleQuality,
        contentQuality: curated.quality.contentQuality,
        warnings: curated.quality.warnings,
      });

      return curated;
    } catch (error) {
      logger.error('Product curation failed', {
        error,
        input,
      });

      // Return fallback with original data
      return {
        title: {
          pl: input.title,
          en: input.title,
          de: input.title,
        },
        shortDescription: {
          pl: input.description?.substring(0, 200) || 'Brak opisu',
          en: input.description?.substring(0, 200) || 'No description',
          de: input.description?.substring(0, 200) || 'Keine Beschreibung',
        },
        fullDescription: {
          pl: input.description || 'Brak pełnego opisu',
          en: input.description || 'No full description',
          de: input.description || 'Keine vollständige Beschreibung',
        },
        seoDescription: {
          pl: input.description?.substring(0, 155) || 'Produkt dostępny w naszym sklepie',
          en: input.description?.substring(0, 155) || 'Product available in our store',
          de: input.description?.substring(0, 155) || 'Produkt verfügbar in unserem Shop',
        },
        specifications: input.specifications?.map(spec => ({
          name: spec.name || spec.key || 'Unknown',
          value: spec.value,
        })) || [],
        keywords: [],
        quality: {
          titleQuality: 30,
          contentQuality: 30,
          warnings: ['AI curation failed - using raw data'],
        },
      };
    }
  }
);

/**
 * Convenience function to curate product with logging
 */
export async function curateProduct(rawData: RawProductData): Promise<CuratedProduct> {
  return await aiCurateProduct(rawData);
}
