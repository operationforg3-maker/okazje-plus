import { z } from 'zod';
import { generateObject } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/vertexai';
import { AliExpressProduct, EnrichedProduct, ImportStageConfig } from './types';
import { LocalizedText, SmartPrice } from '@/lib/types';

export interface RefineConfig extends ImportStageConfig {
  minQualityScore?: number;
}

const DEFAULT_CONFIG: RefineConfig = {
  name: 'refine',
  batchSize: 3,
  delayBetweenItems: 1000, // Throttling for AI
  delayBetweenBatches: 2000,
  maxRetries: 2,
  minQualityScore: 40,
};

// Zod Schema for strict AI output
const RefinedOutputSchema = z.object({
  qualityScore: z.number().describe("0-100 score based on product completeness and attractiveness"),
  pl: z.object({
    title: z.string(),
    description: z.string(),
    specs: z.string().describe("HTML <ul> list of specs"),
    seoTitle: z.string(),
    seoDescription: z.string(),
    keywords: z.array(z.string())
  }),
  en: z.object({
    title: z.string(),
    description: z.string(),
    specs: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    keywords: z.array(z.string())
  }),
  de: z.object({
    title: z.string(),
    description: z.string(),
    specs: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    keywords: z.array(z.string())
  })
});

export async function refineProductsBatch(
  products: AliExpressProduct[],
  categorySlugEN: string,
  subcategorySlugEN: string,
  subsubcategorySlugEN: string,
  config: Partial<RefineConfig> = {}
): Promise<EnrichedProduct[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[Importer:Refine] Processing ${products.length} products with AI...`);
  
  const refinedProducts: EnrichedProduct[] = [];

  for (let i = 0; i < products.length; i++) {
    const raw = products[i];
    
    try {
      console.log(`[Importer:Refine] [${i+1}/${products.length}] Refining: ${raw.title.slice(0, 40)}...`);

      const prompt = `
        You are an elite e-commerce data curator.
        Analyze this raw product data from AliExpress:
        
        Title: ${raw.title}
        Raw Specs: ${JSON.stringify(raw.rawSpecs || raw.specs || {})}
        Category: ${categorySlugEN} > ${subcategorySlugEN}
        Description Snippet: ${(raw.description || '').slice(0, 500)}

        Your tasks:
        1. Calculate a Quality Score (0-100). If it looks like junk/spam, score it low.
        2. Generate CLEAN, MARKETING-READY content for Polish (pl), English (en), and German (de).
        3. Format 'specs' as a clean HTML <ul><li>Key: Value</li></ul> list.
        4. Generate SEO metadata.
      `;

      const { object: result } = await generateObject({
        model: gemini15Flash,
        prompt: prompt,
        schema: RefinedOutputSchema,
        config: { temperature: 0.3 }
      });

      if (result.qualityScore < (finalConfig.minQualityScore || 40)) {
        console.warn(`  ⚠ Low quality (${result.qualityScore}), skipping.`);
        continue;
      }

      const refined: EnrichedProduct = {
        // ID & Source
        originalId: raw.id,
        link: raw.link,
        
        // Localized Content
        title: {
          pl: result.pl.title,
          en: result.en.title,
          de: result.de.title
        },
        description: {
          pl: result.pl.description,
          en: result.en.description,
          de: result.de.description
        },
        specs: {
          pl: result.pl.specs,
          en: result.en.specs,
          de: result.de.specs
        },
        
        // Metadata
        seo: {
          pl: { title: result.pl.seoTitle, description: result.pl.seoDescription, keywords: result.pl.keywords },
          en: { title: result.en.seoTitle, description: result.en.seoDescription, keywords: result.en.keywords },
          de: { title: result.de.seoTitle, description: result.de.seoDescription, keywords: result.de.keywords },
        },
        qualityScore: result.qualityScore,

        // Pricing (Preserve Source Currency)
        price: {
          amount: raw.price,
          currency: (raw.currency as any) || 'USD',
          baseAmount: raw.price
        },
        originalPriceValue: raw.originalPrice,
        discountValue: raw.discount,

        // Categorization
        categorySlugEN,
        subcategorySlugEN,
        subsubcategorySlugEN,

        // Media
        image: raw.image,
        gallery: raw.gallery || [],
      };

      refinedProducts.push(refined);
      console.log(`  ✓ Refined! Score: ${result.qualityScore}`);

      // Rate limiting
      if (finalConfig.delayBetweenItems) {
        await new Promise(r => setTimeout(r, finalConfig.delayBetweenItems));
      }

    } catch (error) {
      console.error(`  ✗ Failed to refine ${raw.id}:`, error);
    }
  }

  return refinedProducts;
}
