/**
 * AI Enrichment Flows (Genkit)
 * - Generate SEO descriptions
 * - Translate content to multiple languages
 * - Extract key features & tags
 * - Safety & moderation
 */

import { ai } from "../genkit";
import { logger } from "@/lib/logging";
import { parseJsonFromResponse, moderateText } from "@/lib/vertex";
import { z } from "zod";

type ProductDescriptionInput = {
  productTitle: string;
  productCategory: string;
  targetLocale: string;
};

type TranslateContentInput = {
  text: string;
  sourceLocale: string;
  targetLocales: string[];
};

type ProductTagsInput = {
  title: string;
  description: string;
  category: string;
};

type BatchEnrichInput = {
  products: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
  }>;
  targetLocales: string[];
};

const ProductDescriptionSchema = z.object({
  productTitle: z.string(),
  productCategory: z.string(),
  targetLocale: z.string(),
});

const ProductDescriptionOutputSchema = z.object({
  seoTitle: z.string(),
  seoDescription: z.string(),
  features: z.array(z.string()),
});

const TranslateContentSchema = z.object({
  text: z.string(),
  sourceLocale: z.string(),
  targetLocales: z.array(z.string()),
});

const TranslateContentOutputSchema = z.object({
  translations: z.record(z.string()),
});

const ProductTagsSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
});

const ProductTagsOutputSchema = z.object({
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
});

const BatchEnrichSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      category: z.string(),
    })
  ),
  targetLocales: z.array(z.string()),
});

const BatchEnrichOutputSchema = z.object({
  results: z.array(z.any()),
});

const CleanProductTitleOutputSchema = z.object({
  titlePL: z.string(),
  titleEN: z.string(),
  titleDE: z.string(),
  specsExtracted: z.record(z.string()).optional(),
});

// ===== Flow: Clean Product Title =====
// New flow to humanize and clean up spammy product titles
export const cleanProductTitle = ai.defineFlow(
  {
    name: "cleanProductTitle",
    inputSchema: z.object({
      originalTitle: z.string(),
      specs: z.record(z.string()).optional(),
    }),
    outputSchema: CleanProductTitleOutputSchema,
  },
  async (input) => {
    try {
      const specsStr = input.specs ? JSON.stringify(input.specs) : "";
      const prompt = `You are a professional copywriter for an e-commerce store.
Your task is to rewrite a messy product title (often from AliExpress) into a clear, concise, and human-readable title in Polish, English, and German.

Input Title: "${input.originalTitle}"
Known Specs: ${specsStr}

Guidelines:
1. Remove keyword stuffing (e.g., "Phone case iphone 13 14 15 soft silicone clear").
2. Format: [Product Name] [Key Model/Feature]. Keep it natural.
3. Example: "Silikonowe etui do iPhone 13/14/15" instead of "2024 New Arrive Case for Apple...".
4. If you identify new specs in the title that are missing from Known Specs (like Color, Size, Model), extract them.
5. Title length should be roughly 30-80 chars. 

Return JSON:
{
  "titlePL": "...",
  "titleEN": "...",
  "titleDE": "...",
  "specsExtracted": { "Key": "Value" } 
}`;

      const response = await ai.generate({
        model: 'vertexai/gemini-2.5-flash',
        prompt,
        config: { temperature: 0.4, maxOutputTokens: 2000 },
        output: { schema: CleanProductTitleOutputSchema },
      });

      const parsed = response.output;
      if (!parsed) {
        throw new Error("Empty structured output from gemini");
      }

      return {
        titlePL: parsed.titlePL || input.originalTitle,
        titleEN: parsed.titleEN || input.originalTitle,
        titleDE: parsed.titleDE || input.originalTitle,
        specsExtracted: parsed.specsExtracted || {},
      };
    } catch (error) {
      logger.error("cleanProductTitle flow failed", { error, input });
      // Fallback: return original as title for all langs
      return {
        titlePL: input.originalTitle,
        titleEN: input.originalTitle,
        titleDE: input.originalTitle,
      };
    }
  }
);

export const generateProductDescription = ai.defineFlow(
  {
    name: "generateProductDescription",
    inputSchema: ProductDescriptionSchema,
    outputSchema: ProductDescriptionOutputSchema,
  },
  async (input: ProductDescriptionInput) => {
    try {
      const prompt = `You are a professional e-commerce copywriter.
Product: ${input.productTitle}
Category: ${input.productCategory}
Target language: ${input.targetLocale}

Write a description for this product in "${input.targetLocale}".
Guidelines:
1. Tone: Professional yet approachable, human-like. Avoid robotic repitition.
2. Structure: Start with a hook, followed by benefits, then specifications.
3. SEO: naturally include keywords but prioritize readability.
4. Output:
   - "seoTitle": Clear, concise title (max 60 chars).
   - "seoDescription": Meta description (max 160 chars).
   - "features": 4-6 bullet points focusing on benefits, not just specs.

Return as JSON: { "seoTitle": "...", "seoDescription": "...", "features": ["...", "..."] }`;

      const response = await ai.generate({
        model: 'vertexai/gemini-2.5-flash',
        prompt,
        config: { temperature: 0.5, maxOutputTokens: 3000 },
        output: { schema: ProductDescriptionOutputSchema },
      });

      const parsed = response.output;
      if (!parsed) {
        throw new Error("Empty structured output from gemini");
      }

      // Moderate output
      const modResult = await moderateText(parsed.seoDescription || "");
      if (!modResult.approved) {
        logger.warn("Generated description flagged by moderation", {
          productTitle: input.productTitle,
          flags: modResult.flags,
        });
      }

      return {
        seoTitle: parsed.seoTitle || input.productTitle,
        seoDescription: parsed.seoDescription || "",
        features: parsed.features || [],
      };
    } catch (error) {
      logger.error("generateProductDescription flow failed", { error, input });
      throw error;
    }
  }
);

// ===== Flow: Translate Content =====
export const translateContent = ai.defineFlow(
  {
    name: "translateContent",
    inputSchema: TranslateContentSchema,
    outputSchema: TranslateContentOutputSchema,
  },
  async (input: TranslateContentInput) => {
    try {
      const targetLocalesToTranslate = input.targetLocales.filter(l => l !== input.sourceLocale);
      const translations: Record<string, string> = {};
      translations[input.sourceLocale] = input.text;

      if (targetLocalesToTranslate.length > 0) {
        const TranslateModelOutputSchema = z.object({
          translations: z.array(z.object({
            locale: z.string(),
            text: z.string(),
          })),
        });

        const prompt = `You are a professional e-commerce translator.
Translate the following text from source language "${input.sourceLocale}" into these target languages: ${targetLocalesToTranslate.join(', ')}.
Maintain formatting, HTML tags, readability, and tone.

Return JSON in this format:
{
  "translations": [
    ${targetLocalesToTranslate.map(locale => `{"locale": "${locale}", "text": "translation in ${locale}"}`).join(',\n    ')}
  ]
}

Text to translate:
"${input.text}"`;

        const response = await ai.generate({
          model: 'vertexai/gemini-2.5-flash',
          prompt,
          config: { 
            temperature: 0.2, 
            maxOutputTokens: 5000,
          },
          output: {
            schema: TranslateModelOutputSchema,
          }
        });

        console.log("[translateContent] raw text:", response.text);
        const output = response.output;
        console.log("[translateContent] output:", JSON.stringify(output, null, 2));
        if (output && Array.isArray(output.translations)) {
          for (const item of output.translations) {
            if (item.locale && item.text) {
              translations[item.locale] = item.text.trim();
            }
          }
        }
      }

      // Fill in any missing target locales with fallback text (source text)
      for (const locale of input.targetLocales) {
        if (!translations[locale]) {
          translations[locale] = input.text;
        }
      }

      return { translations };
    } catch (error) {
      logger.error("translateContent flow failed", { error, input });
      throw error;
    }
  }
);

// ===== Flow: Extract Product Tags/Keywords =====
export const extractProductTags = ai.defineFlow(
  {
    name: "extractProductTags",
    inputSchema: ProductTagsSchema,
    outputSchema: ProductTagsOutputSchema,
  },
  async (input: ProductTagsInput) => {
    try {
      const prompt = `Analyze this product and extract tags and keywords for search indexing.
Title: ${input.title}
Description: ${input.description}
Category: ${input.category}

Return JSON: { "tags": ["tag1", "tag2", ...], "keywords": ["kw1", "kw2", ...] }
Tags: searchable categories/attributes (max 10)
Keywords: SEO-focused terms (max 10)`;

      const response = await ai.generate({
        model: 'vertexai/gemini-2.5-flash',
        prompt,
        config: { temperature: 0.4, maxOutputTokens: 2000 },
        output: { schema: ProductTagsOutputSchema },
      });

      const parsed = response.output;
      if (!parsed) {
        throw new Error("Empty structured output from gemini");
      }

      return {
        tags: parsed.tags || [],
        keywords: parsed.keywords || [],
      };
    } catch (error) {
      logger.error("extractProductTags flow failed", { error, input });
      throw error;
    }
  }
);

// ===== Flow: Batch Enrichment =====
export const batchEnrichProducts = ai.defineFlow(
  {
    name: "batchEnrichProducts",
    inputSchema: BatchEnrichSchema,
    outputSchema: BatchEnrichOutputSchema,
  },
  async (input: BatchEnrichInput) => {
    try {
      const enrichedProducts = [];

      for (const product of input.products) {
        logger.info("Enriching product", { productId: product.id });

        // Generate description for primary locale
        const descResult = await generateProductDescription({
          productTitle: product.title,
          productCategory: product.category,
          targetLocale: input.targetLocales[0] || "en",
        });

        // Extract tags
        const tagsResult = await extractProductTags({
          title: product.title,
          description: product.description,
          category: product.category,
        });

        // Translate (if multiple locales)
        let translations: Record<string, string> = {};
        if (input.targetLocales.length > 1) {
          const transResult = await translateContent({
            text: descResult.seoDescription,
            sourceLocale: input.targetLocales[0] || "en",
            targetLocales: input.targetLocales.slice(1),
          });
          translations = transResult.translations;
        }

        enrichedProducts.push({
          ...product,
          seoTitle: descResult.seoTitle,
          seoDescription: descResult.seoDescription,
          features: descResult.features,
          tags: tagsResult.tags,
          keywords: tagsResult.keywords,
          translations,
        });
      }

      logger.info("Batch enrichment completed", {
        count: enrichedProducts.length,
      });

      return { results: enrichedProducts };
    } catch (error) {
      logger.error("batchEnrichProducts flow failed", { error });
      throw error;
    }
  }
);

export const MarketingContentOutputSchema = z.object({
  title: z.object({
    pl: z.string().optional(),
    en: z.string().optional(),
    de: z.string().optional(),
    fr: z.string().optional(),
    es: z.string().optional(),
    uk: z.string().optional(),
  }),
  shortDescription: z.object({
    pl: z.string().optional(),
    en: z.string().optional(),
    de: z.string().optional(),
    fr: z.string().optional(),
    es: z.string().optional(),
    uk: z.string().optional(),
  }),
  fullDescription: z.object({
    pl: z.string().optional(),
    en: z.string().optional(),
    de: z.string().optional(),
    fr: z.string().optional(),
    es: z.string().optional(),
    uk: z.string().optional(),
  }),
  features: z.object({
    pl: z.array(z.string()).optional(),
    en: z.array(z.string()).optional(),
    de: z.array(z.string()).optional(),
    fr: z.array(z.string()).optional(),
    es: z.array(z.string()).optional(),
    uk: z.array(z.string()).optional(),
  }).optional(),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    faqItems: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  }).optional(),
  averageMarketPrice: z.object({
    amount: z.number().optional(),
    currency: z.string().optional(),
    range: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  }).optional(),
  specsAugmented: z.record(z.string()).optional(),
});

// ===== Flow: Generate Marketing Content (The "Creator" Flow) =====
// Replaces simple translation with intelligent content generation
export const generateMarketingContent = ai.defineFlow(
  {
    name: "generateMarketingContent",
    inputSchema: z.object({
      originalTitle: z.string(),
      specs: z.record(z.string()),
      category: z.string().optional(),
      source: z.string().optional(),
    }),
    outputSchema: MarketingContentOutputSchema,
  },
  async (input) => {
    try {
      const specsStr = Object.entries(input.specs).map(([k, v]) => `- ${k}: ${v}`).join('\n');

      const prompt = `You are a Senior E-commerce Copywriter and SEO Specialist writing for European shoppers.
You have access to Google Search — use it to verify product specs before writing. SEO is the highest priority for the Polish market (okazjeplus.pl).

INPUT DATA:
- Source: ${input.source || 'Unknown'}
- Original Title: "${input.originalTitle}"
- Category: ${input.category || 'General'}
- Technical Specs (may be incomplete):
${specsStr || '- none provided'}

STEP 1 — RESEARCH (use Google Search):
- Search for the product by its title/model number to find real specs, official product page, or trusted reviews.
- Verify: RAM, storage, battery, screen, weight, connectivity, materials, compatibility.
- Add confirmed data to specsAugmented. Mark web-sourced values with "(web)" prefix.
- If uncertain after research, omit the spec entirely.

STEP 2 — CONTENT RULES:
- Polish must sound native and persuasive. No machine-translation tone.
- Keep numbers and units explicit (e.g., "16GB RAM", "144 Hz", "5000 mAh").
- Never invent fake brands/models. If brand is missing, omit it.
- Keep claims realistic; avoid hype like "best in the world".
- Only use specs that were provided OR confirmed via search.

STEP 3 — SEO (highest priority for okazjeplus.pl):
- Target long-tail keywords (e.g. "etui do iPhone 15 Pro silikonowe przezroczyste" not just "case").
- Include primary keyword in title, first sentence of description, and at least 2 bullet points.
- seo.title: exactly 55-65 chars, start with main keyword, add 1-2 attributes. No keyword stuffing.
- seo.description: exactly 150-160 chars. Format: "[Hook] [Key Spec 1] + [Key Spec 2]. [CTA or category]".
- seo.keywords: 8-12 long-tail Polish search phrases (how users search, not product jargon).
- seo.faqItems: 2-3 frequently asked questions with concise answers (used for FAQ schema — boosts CTR in Google).

TITLES (pl/en/de/fr/es/uk):
- Format: Brand (if known) + Model + 1-2 killer attributes.
- Length target: 55-70 chars. Remove spammy keywords.

FULL DESCRIPTION (HTML per language):
- Structure with clear HTML tags only, no markdown.
- Layout:
  <p>Hook — 1 short sentence with primary keyword</p>
  <ul>
    <li>Confirmed spec or benefit with concrete value</li>
    <li>Confirmed spec or benefit with concrete value</li>
    <li>Confirmed spec or benefit with concrete value</li>
  </ul>
  <p>Closing reassurance (compatibility, ease of use, availability)</p>
- Polish description: naturally include 1-2 long-tail keyword phrases.

SHORT DESCRIPTION (pl/en/de/fr/es/uk):
- 2-3 sentences, max 320 chars, focused on key value propositions.

FEATURES (pl/en/de/fr/es/uk):
- 4-6 bullet-ready strings, each with a concrete value (number, material, dimension, or outcome).

MARKET PRICE:
- averageMarketPrice.amount in PLN, realistic current street price for Poland.
- If you find current Polish market prices via search, use those. Otherwise estimate.
- Include range {min, max} when possible.

OUTPUT STRICTLY AS JSON:
{
  "title": { "pl": "...", "en": "...", "de": "...", "fr": "...", "es": "...", "uk": "..." },
  "shortDescription": { "pl": "...", "en": "...", "de": "...", "fr": "...", "es": "...", "uk": "..." },
  "fullDescription": { "pl": "<p>...</p><ul>...</ul><p>...</p>", "en": "...", "de": "...", "fr": "...", "es": "...", "uk": "..." },
  "features": { "pl": ["..."], "en": ["..."], "de": ["..."], "fr": ["..."], "es": ["..."], "uk": ["..."] },
  "seo": {
    "title": "...",
    "description": "...",
    "keywords": ["...", "..."],
    "faqItems": [{ "question": "...", "answer": "..." }]
  },
  "averageMarketPrice": { "amount": 123.00, "currency": "PLN", "range": { "min": 100, "max": 150 } },
  "specsAugmented": { "RAM": "(web) 8GB", "Battery": "5000mAh" }
}`;

      // Używamy Google Search grounding — Gemini może sprawdzać specs/ceny w czasie rzeczywistym
      let response;
      try {
        response = await ai.generate({
          model: 'vertexai/gemini-2.5-flash',
          prompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            googleSearchRetrieval: {},
          },
          output: {
            schema: MarketingContentOutputSchema,
          }
        });
      } catch (groundingError) {
        // Fallback bez grounding (np. rate limit lub brak uprawnień do Google Search)
        logger.warn("Google Search grounding unavailable, falling back to knowledge-only generation", { error: groundingError });
        response = await ai.generate({
          model: 'vertexai/gemini-2.5-flash',
          prompt,
          config: { temperature: 0.4, maxOutputTokens: 8192 },
          output: {
            schema: MarketingContentOutputSchema,
          }
        });
      }

      const parsed = response.output;
      if (!parsed) {
        throw new Error("Empty structured output from gemini");
      }

      return {
        title: parsed.title || { pl: input.originalTitle, en: input.originalTitle, de: input.originalTitle, fr: input.originalTitle, es: input.originalTitle, uk: input.originalTitle },
        shortDescription: parsed.shortDescription || { pl: "", en: "", de: "", fr: "", es: "", uk: "" },
        fullDescription: parsed.fullDescription || { pl: "", en: "", de: "", fr: "", es: "", uk: "" },
        features: parsed.features || { pl: [], en: [], de: [], fr: [], es: [], uk: [] },
        seo: parsed.seo || { title: "", description: "", keywords: [], faqItems: [] },
        averageMarketPrice: parsed.averageMarketPrice || undefined,
        specsAugmented: parsed.specsAugmented || undefined,
      };

    } catch (error) {
      logger.error("generateMarketingContent flow failed", { error, input });
      throw error;
    }
  }
);

// ===== Flow: Extract Specs from Text =====
export const extractSpecsFromText = ai.defineFlow(
  {
    name: "extractSpecsFromText",
    inputSchema: z.object({
      title: z.string(),
      description: z.string(),
      category: z.string().optional(),
    }),
    outputSchema: z.object({
      specs: z.record(z.string()),
    }),
  },
  async (input) => {
    try {
      const prompt = `Analyze the e-commerce product details below and extract all technical specifications, attributes, features, and catalog details (e.g., RAM, Storage, Screen size, Resolution, Color, Material, Battery capacity, Weight, Compatibility, Dimensions) into a list of name/value pairs.
If a parameter is not explicitly mentioned or cannot be inferred with certainty, do not include it.

Product Title: "${input.title}"
Category: "${input.category || 'General'}"
Description:
"${input.description}"

Return JSON object: { "specs": [ { "name": "RAM", "value": "16GB" } ] }`;

      const response = await ai.generate({
        model: 'vertexai/gemini-2.5-flash',
        prompt,
        config: { temperature: 0.1, maxOutputTokens: 2000 },
        output: {
          schema: z.object({
            specs: z.array(
              z.object({
                name: z.string(),
                value: z.string(),
              })
            ),
          }),
        },
      });

      const parsed = response.output;
      const specsRecord: Record<string, string> = {};
      if (parsed && Array.isArray(parsed.specs)) {
        for (const item of parsed.specs) {
          if (item.name && item.value) {
            specsRecord[item.name] = item.value;
          }
        }
      }

      return { specs: specsRecord };
    } catch (error) {
      logger.error("extractSpecsFromText flow failed", { error, input });
      return { specs: {} };
    }
  }
);
