/**
 * AI Enrichment Flows (Genkit)
 * - Generate SEO descriptions
 * - Translate content to multiple languages
 * - Extract key features & tags
 * - Safety & moderation
 */

import { gemini20Flash } from "@genkit-ai/vertexai";
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

// ===== Flow: Clean Product Title =====
// New flow to humanize and clean up spammy product titles
export const cleanProductTitle = ai.defineFlow(
  {
    name: "cleanProductTitle",
    inputSchema: z.object({
      originalTitle: z.string(),
      specs: z.record(z.string()).optional(),
    }),
    outputSchema: z.object({
      titlePL: z.string(),
      titleEN: z.string(),
      titleDE: z.string(),
      specsExtracted: z.record(z.string()).optional(),
    }),
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
        model: gemini20Flash,
        prompt,
        config: { temperature: 0.4, maxOutputTokens: 500 },
      });

      const text = response.text ?? "";
      const parsed = parseJsonFromResponse(text);

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
        model: gemini20Flash,
        prompt,
        config: { temperature: 0.5, maxOutputTokens: 1000 },
      });

      const text = response.text ?? "";
      const parsed = parseJsonFromResponse(text);

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
      const translations: Record<string, string> = {};

      for (const targetLocale of input.targetLocales) {
        if (targetLocale === input.sourceLocale) {
          translations[targetLocale] = input.text;
          continue;
        }

        const prompt = `Translate this text from ${input.sourceLocale} to ${targetLocale}.
Maintain SEO quality and readability. Return ONLY the translated text, no explanations.

Text: ${input.text}`;

        const response = await ai.generate({
          model: gemini20Flash,
          prompt,
          config: { temperature: 0.3, maxOutputTokens: 500 },
        });

        translations[targetLocale] = (response.text ?? "").trim();
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
        model: gemini20Flash,
        prompt,
        config: { temperature: 0.4, maxOutputTokens: 300 },
      });

      const text = response.text ?? "";
      const parsed = parseJsonFromResponse(text);

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
    outputSchema: z.object({
      title: z.object({
        pl: z.string(),
        en: z.string(),
        de: z.string(),
      }),
      shortDescription: z.object({
        pl: z.string(),
        en: z.string(),
        de: z.string(),
      }),
      fullDescription: z.object({
        pl: z.string(), // HTML format
        en: z.string(), // HTML format
        de: z.string(), // HTML format
      }),
      features: z.object({
        pl: z.array(z.string()),
        en: z.array(z.string()),
        de: z.array(z.string()),
      }),
      seo: z.object({
         title: z.string(), // SEO optimized title
         description: z.string(),
         keywords: z.array(z.string())
      })
    }),
  },
  async (input) => {
    try {
      const specsStr = Object.entries(input.specs).map(([k,v]) => `- ${k}: ${v}`).join('\n');
      
      const prompt = `You are a Senior E-commerce Copywriter and SEO Specialist.
Your task is to take raw product data (often spammy or incomplete) and create high-quality, professional listing content in Polish (PL), English (EN), and German (DE).

INPUT DATA:
- Source: ${input.source || 'Unknown'}
- Original Title: "${input.originalTitle}"
- Category: ${input.category || 'General'}
- Technical Specs:
${specsStr}

INSTRUCTIONS:
1. **TITLES**: Create concise, readable titles (Brand + Model + Key Feature). Remove spammy keywords.
2. **DESCRIPTIONS (HTML)**: Write persuasive, benefit-oriented product descriptions wrapped in <p> tags. 
   - **DO NOT TRANSLATE ITERATIVELY**. Write fresh content for each language based on the specs.
   - If specs are sparse, use your knowledge of this product type to fill in plausible generic benefits (e.g., "Durable material", "Easy to use").
   - Structure: A strong opening hook, followed by key capabilities.
3. **FEATURES**: Extract 3-5 key selling points as bullet points.
4. **SEO**: Generate one optimized SEO title and description (primary market PL).

OUTPUT SCHEMA (JSON):
{
  "title": { "pl": "...", "en": "...", "de": "..." },
  "shortDescription": { "pl": "...", "en": "...", "de": "..." },
  "fullDescription": { "pl": "<p>...</p>", "en": "<p>...</p>", "de": "<p>...</p>" },
  "features": { "pl": ["..."], "en": ["..."], "de": ["..."] },
  "seo": { "title": "For Google...", "description": "...", "keywords": ["..."] }
}`;

      const response = await ai.generate({
        model: gemini20Flash,
        prompt,
        config: { temperature: 0.5 }, // Slightly creative but grounded
      });

      const text = response.text ?? "";
      const parsed = parseJsonFromResponse(text);

      // Fallback/Validation defaults
      return {
        title: parsed.title || { pl: input.originalTitle, en: input.originalTitle, de: input.originalTitle },
        shortDescription: parsed.shortDescription || { pl: "", en: "", de: "" },
        fullDescription: parsed.fullDescription || { pl: "", en: "", de: "" },
        features: parsed.features || { pl: [], en: [], de: [] },
        seo: parsed.seo || { title: "", description: "", keywords: [] }
      };

    } catch (error) {
      logger.error("generateMarketingContent flow failed", { error, input });
      throw error; // Re-throw to handle in Refiner
    }
  }
);
