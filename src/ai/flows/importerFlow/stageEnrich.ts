import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { AliExpressProduct, EnrichedProduct, ImportStageConfig } from './types';
import { LocalizedText, SmartPrice } from '@/lib/types';

export interface RefineConfig extends ImportStageConfig {
  minQualityScore?: number;
  bypassRefinement?: boolean;
}

const DEFAULT_CONFIG: RefineConfig = {
  name: 'refine',
  batchSize: 3,
  delayBetweenItems: 1000, // Throttling for AI
  delayBetweenBatches: 2000,
  maxRetries: 2,
  minQualityScore: 40,
  bypassRefinement: false,
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

      if (finalConfig.bypassRefinement) {
        // Build basic specs HTML list from raw specs
        let specsHtml = '<ul>';
        if (raw.rawSpecs) {
          for (const [k, v] of Object.entries(raw.rawSpecs)) {
            specsHtml += `<li><strong>${k}</strong>: ${v}</li>`;
          }
        } else if (raw.specs) {
          for (const [k, v] of Object.entries(raw.specs)) {
            specsHtml += `<li><strong>${k}</strong>: ${v}</li>`;
          }
        } else {
          specsHtml += `<li>Specyfikacja nie jest dostępna</li>`;
        }
        specsHtml += '</ul>';

        const refined: EnrichedProduct = {
          originalId: raw.id,
          link: raw.link,
          title: {
            pl: raw.title,
            en: raw.title,
            de: raw.title
          },
          description: {
            pl: raw.description || raw.title,
            en: raw.description || raw.title,
            de: raw.description || raw.title
          },
          specs: {
            pl: specsHtml,
            en: specsHtml,
            de: specsHtml
          },
          seo: {
            pl: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            en: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            de: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] }
          },
          qualityScore: 100,
          price: {
            amount: raw.price,
            currency: (raw.currency as any) || 'USD',
            originalPrice: raw.originalPrice || raw.price,
            shippingCost: 0,
            totalPrice: raw.price,
            freeShipping: raw.freeShipping || false
          },
          originalPriceValue: raw.originalPrice || raw.price,
          discountValue: raw.discount || 0,
          categorySlugEN,
          subcategorySlugEN,
          subsubcategorySlugEN,
          image: raw.image,
          gallery: raw.gallery || [],
          rating: raw.rating,
          orders: raw.orders,
          storeName: raw.storeName,
          storeUrl: raw.storeUrl,
          shipping: raw.shipping,
          warehouse: raw.warehouse,
          deliveryTime: raw.deliveryTime,
          freeShipping: raw.freeShipping,
          attributes: raw.attributes || [],
          specifications: raw.specifications || []
        };

        refinedProducts.push(refined);
        console.log(`  ✓ Bypassed AI Refinement for raw ID: ${raw.id}`);
        continue;
      }

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

      const { output: result } = await ai.generate({
        prompt: prompt,
        output: { schema: RefinedOutputSchema },
        config: { temperature: 0.3 }
      });

      if (!result) {
        console.warn('  ⚠ AI returned empty result, skipping.');
        continue;
      }

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
          originalPrice: raw.originalPrice,
          shippingCost: 0,
          totalPrice: raw.price,
          freeShipping: false
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
