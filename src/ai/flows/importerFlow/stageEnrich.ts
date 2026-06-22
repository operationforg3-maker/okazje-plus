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

// Zod Schema for strict AI output (all 6 locales with record specs)
const LocaleOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  specs: z.record(z.string()).describe("Key-value specifications of the product (e.g. brand, model, color, battery, storage)"),
  seoTitle: z.string(),
  seoDescription: z.string(),
  keywords: z.array(z.string())
});

const RefinedOutputSchema = z.object({
  qualityScore: z.number().describe("0-100 score based on product completeness and attractiveness"),
  pl: LocaleOutputSchema,
  en: LocaleOutputSchema,
  de: LocaleOutputSchema,
  fr: LocaleOutputSchema,
  es: LocaleOutputSchema,
  uk: LocaleOutputSchema
});

function specsToHtmlList(specs: Record<string, string>): string {
  if (!specs || Object.keys(specs).length === 0) return '<ul><li>Specyfikacja nie jest dostępna</li></ul>';
  let html = '<ul>';
  for (const [k, v] of Object.entries(specs)) {
    html += `<li><strong>${k}</strong>: ${v}</li>`;
  }
  html += '</ul>';
  return html;
}

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
        const baseSpecs = raw.rawSpecs || raw.specs || {};
        if (Object.keys(baseSpecs).length > 0) {
          for (const [k, v] of Object.entries(baseSpecs)) {
            specsHtml += `<li><strong>${k}</strong>: ${v}</li>`;
          }
        } else {
          specsHtml += `<li>Specyfikacja nie jest dostępna</li>`;
        }
        specsHtml += '</ul>';

        const specsLocalized = {
          pl: { ...baseSpecs },
          en: { ...baseSpecs },
          de: { ...baseSpecs },
          fr: { ...baseSpecs },
          es: { ...baseSpecs },
          uk: { ...baseSpecs }
        };

        const refined: EnrichedProduct = {
          originalId: raw.id,
          link: raw.link,
          title: {
            pl: raw.title,
            en: raw.title,
            de: raw.title,
            fr: raw.title,
            es: raw.title,
            uk: raw.title
          },
          description: {
            pl: raw.description || raw.title,
            en: raw.description || raw.title,
            de: raw.description || raw.title,
            fr: raw.description || raw.title,
            es: raw.description || raw.title,
            uk: raw.description || raw.title
          },
          specs: {
            pl: specsHtml,
            en: specsHtml,
            de: specsHtml,
            fr: specsHtml,
            es: specsHtml,
            uk: specsHtml
          },
          specsLocalized,
          seo: {
            pl: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            en: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            de: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            fr: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            es: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] },
            uk: { title: raw.title, description: (raw.description || raw.title).slice(0, 150), keywords: [] }
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
          specifications: raw.specifications || [],
          variants: raw.variants || [],
          skuList: raw.skuList || [],
          videoUrl: raw.videoUrl,
          rawSpecs: baseSpecs,
          descriptionHtml: raw.descriptionHtml,
        };

        refinedProducts.push(refined);
        console.log(`  ✓ Bypassed AI Refinement for raw ID: ${raw.id}`);
        continue;
      }

      const prompt = `
        You are an elite e-commerce copywriter and SEO specialist writing for European shoppers.
        Analyze this raw product data from AliExpress:
        
        Title: ${raw.title}
        Raw Specs: ${JSON.stringify(raw.rawSpecs || raw.specs || {})}
        Category: ${categorySlugEN} > ${subcategorySlugEN}
        Description Snippet: ${(raw.description || '').slice(0, 500)}

        Your tasks:
        1. Calculate a Quality Score (0-100) based on e-commerce quality. Score low if the item looks like spam.
        2. Use Google Search to query this product to verify and enrich specifications, features, and pricing details.
        3. Generate clean, marketing-ready content for all 6 locales: Polish (pl), English (en), German (de), French (fr), Spanish (es), and Ukrainian (uk).
        4. Translate and output clean key-value specifications for each locale under 'specs' (keys should be localized e.g. 'Marka', 'Model', 'Kolor').
        5. Generate SEO metadata optimized for search engine and generative AI overview optimization (GEO/AIO).
      `;

      // Enable Google Search Grounding for live technical spec lookup
      const { output: result } = await ai.generate({
        model: 'vertexai/gemini-2.5-flash',
        prompt: prompt,
        output: { schema: RefinedOutputSchema },
        config: { 
          temperature: 0.3,
          maxOutputTokens: 8192,
          googleSearchRetrieval: {},
        }
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
          de: result.de.title,
          fr: result.fr.title,
          es: result.es.title,
          uk: result.uk.title
        },
        description: {
          pl: result.pl.description,
          en: result.en.description,
          de: result.de.description,
          fr: result.fr.description,
          es: result.es.description,
          uk: result.uk.description
        },
        specs: {
          pl: specsToHtmlList(result.pl.specs),
          en: specsToHtmlList(result.en.specs),
          de: specsToHtmlList(result.de.specs),
          fr: specsToHtmlList(result.fr.specs),
          es: specsToHtmlList(result.es.specs),
          uk: specsToHtmlList(result.uk.specs)
        },
        specsLocalized: {
          pl: result.pl.specs,
          en: result.en.specs,
          de: result.de.specs,
          fr: result.fr.specs,
          es: result.es.specs,
          uk: result.uk.specs
        },
        
        // Metadata
        seo: {
          pl: { title: result.pl.seoTitle, description: result.pl.seoDescription, keywords: result.pl.keywords },
          en: { title: result.en.seoTitle, description: result.en.seoDescription, keywords: result.en.keywords },
          de: { title: result.de.seoTitle, description: result.de.seoDescription, keywords: result.de.keywords },
          fr: { title: result.fr.seoTitle, description: result.fr.seoDescription, keywords: result.fr.keywords },
          es: { title: result.es.seoTitle, description: result.es.seoDescription, keywords: result.es.keywords },
          uk: { title: result.uk.seoTitle, description: result.uk.seoDescription, keywords: result.uk.keywords },
        },
        qualityScore: result.qualityScore,

        // Pricing (Preserve Source Currency)
        price: {
          amount: raw.price,
          currency: (raw.currency as any) || 'USD',
          originalPrice: raw.originalPrice,
          shippingCost: 0,
          totalPrice: raw.price,
          freeShipping: raw.freeShipping || false
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

        // Preserve raw source fields for save stage!
        rating: raw.rating,
        orders: raw.orders,
        storeName: raw.storeName,
        storeUrl: raw.storeUrl,
        shipping: raw.shipping,
        warehouse: raw.warehouse,
        deliveryTime: raw.deliveryTime,
        freeShipping: raw.freeShipping,
        attributes: raw.attributes || [],
        specifications: raw.specifications || [],
        variants: raw.variants || [],
        skuList: raw.skuList || [],
        videoUrl: raw.videoUrl,
        rawSpecs: raw.rawSpecs || raw.specs || {},
        descriptionHtml: raw.descriptionHtml,
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
