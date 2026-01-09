/**
 * AI Enrichment Flows (Genkit)
 * - Generate SEO descriptions
 * - Translate content to multiple languages
 * - Extract key features & tags
 * - Safety & moderation
 */

import { gemini15Flash } from "@genkit-ai/vertexai";
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
  enrichedProducts: z.array(z.record(z.any())),
});

// ===== Flow: Generate Product Description =====
export const generateProductDescription = ai.defineFlow(
  {
    name: "generateProductDescription",
    inputSchema: ProductDescriptionSchema,
    outputSchema: ProductDescriptionOutputSchema,
  },
  async (input: ProductDescriptionInput) => {
    try {
      const prompt = `You are an e-commerce SEO specialist.
Product: ${input.productTitle}
Category: ${input.productCategory}
Target language: ${input.targetLocale}

Generate for locale "${input.targetLocale}":
1. SEO-optimized title (max 60 chars, include primary keyword)
2. Meta description (max 160 chars, compelling and keyword-rich)
3. Top 5 key features as bullet points

Return as JSON: { "seoTitle": "...", "seoDescription": "...", "features": ["...", "..."] }`;

      const response = await ai.generate({
        model: gemini15Flash,
        prompt,
        config: { temperature: 0.5, maxOutputTokens: 300 },
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
          model: gemini15Flash,
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
        model: gemini15Flash,
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

      return { enrichedProducts };
    } catch (error) {
      logger.error("batchEnrichProducts flow failed", { error });
      throw error;
    }
  }
);
