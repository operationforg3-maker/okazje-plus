/**
 * AI Enrichment Flows (Genkit)
 * - Generate SEO descriptions
 * - Translate content to multiple languages
 * - Extract key features & tags
 * - Safety & moderation
 */

import { defineFlow, run } from "genkit";
import { generate } from "@genkit-ai/ai";
import { gemini15Flash } from "@genkit-ai/vertexai";
import logger from "../logger";
import { parseJsonFromResponse, moderateText } from "./vertex";

// ===== Flow: Generate Product Description =====
export const generateProductDescription = defineFlow(
  {
    name: "generateProductDescription",
    inputSchema: {
      type: "object" as const,
      properties: {
        productTitle: { type: "string", description: "Original product title" },
        productCategory: { type: "string", description: "Product category" },
        targetLocale: { type: "string", description: "Target language (pl, en, de)" },
      },
      required: ["productTitle", "productCategory", "targetLocale"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        seoTitle: { type: "string" },
        seoDescription: { type: "string" },
        features: { type: "array" as const, items: { type: "string" } },
      },
    },
  },
  async (input) => {
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

      const response = await run("genkit-ai/call", async () =>
        generate({
          model: gemini15Flash,
          prompt,
          config: { temperature: 0.5, maxOutputTokens: 300 },
        })
      );

      const text = response.text();
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
export const translateContent = defineFlow(
  {
    name: "translateContent",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text to translate" },
        sourceLocale: { type: "string", description: "Source language" },
        targetLocales: {
          type: "array" as const,
          items: { type: "string" },
          description: "Target languages",
        },
      },
      required: ["text", "sourceLocale", "targetLocales"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        translations: {
          type: "object" as const,
          additionalProperties: { type: "string" },
        },
      },
    },
  },
  async (input) => {
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

        const response = await run("genkit-ai/call", async () =>
          generate({
            model: gemini15Flash,
            prompt,
            config: { temperature: 0.3, maxOutputTokens: 500 },
          })
        );

        translations[targetLocale] = response.text().trim();
      }

      return { translations };
    } catch (error) {
      logger.error("translateContent flow failed", { error, input });
      throw error;
    }
  }
);

// ===== Flow: Extract Product Tags/Keywords =====
export const extractProductTags = defineFlow(
  {
    name: "extractProductTags",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
      },
      required: ["title", "description", "category"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        tags: {
          type: "array" as const,
          items: { type: "string" },
        },
        keywords: {
          type: "array" as const,
          items: { type: "string" },
        },
      },
    },
  },
  async (input) => {
    try {
      const prompt = `Analyze this product and extract tags and keywords for search indexing.
Title: ${input.title}
Description: ${input.description}
Category: ${input.category}

Return JSON: { "tags": ["tag1", "tag2", ...], "keywords": ["kw1", "kw2", ...] }
Tags: searchable categories/attributes (max 10)
Keywords: SEO-focused terms (max 10)`;

      const response = await run("genkit-ai/call", async () =>
        generate({
          model: gemini15Flash,
          prompt,
          config: { temperature: 0.4, maxOutputTokens: 300 },
        })
      );

      const text = response.text();
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
export const batchEnrichProducts = defineFlow(
  {
    name: "batchEnrichProducts",
    inputSchema: {
      type: "object" as const,
      properties: {
        products: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              category: { type: "string" },
            },
          },
        },
        targetLocales: {
          type: "array" as const,
          items: { type: "string" },
        },
      },
      required: ["products", "targetLocales"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        enrichedProducts: {
          type: "array" as const,
          items: { type: "object" },
        },
      },
    },
  },
  async (input) => {
    try {
      const enrichedProducts = [];

      for (const product of input.products) {
        logger.info("Enriching product", { productId: product.id });

        // Generate description for primary locale
        const descResult = await run("generateProductDescription", () =>
          generateProductDescription({
            productTitle: product.title,
            productCategory: product.category,
            targetLocale: input.targetLocales[0] || "en",
          })
        );

        // Extract tags
        const tagsResult = await run("extractProductTags", () =>
          extractProductTags({
            title: product.title,
            description: product.description,
            category: product.category,
          })
        );

        // Translate (if multiple locales)
        let translations: Record<string, string> = {};
        if (input.targetLocales.length > 1) {
          const transResult = await run("translateContent", () =>
            translateContent({
              text: descResult.seoDescription,
              sourceLocale: input.targetLocales[0] || "en",
              targetLocales: input.targetLocales.slice(1),
            })
          );
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
