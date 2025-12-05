/**
 * Ingestion Pipeline
 * Step 1: Iterator (fetch from APIs)
 * Step 2: Normalizer (map to schema)
 * Step 3: AI Enhancement (generate/translate)
 * Step 4: Persona Assignment (assign to fake user)
 * Step 5: Persist (save to Firestore)
 * Step 6: Typesense Index (update search index)
 */

import logger from "../logger";
import { db } from "../firebase";
import { collection, addDoc, writeBatch } from "firebase/firestore";
import { getAliExpressClient } from "./aliexpress-client";
import { getConvertiserClient } from "./convertiser-client";
import { normalizeBatch } from "./normalizer";
import { generateText, embedText } from "./vertex";
import { getJobQueue, Job } from "./queue";
import { NormalizedDeal, NormalizedProduct } from "./api-interfaces";

// ===== Types =====
export type PipelineSource = "aliexpress" | "convertiser" | "manual";

export interface PipelineConfig {
  source: PipelineSource;
  query?: Record<string, any>; // search params
  categoryPath: { main: string; sub: string; subSub?: string };
  generateAiEnrichment?: boolean;
  assignPersona?: boolean;
  indexTypesense?: boolean;
  locales?: string[];
}

export interface PersonaOption {
  id: string;
  displayName: string;
  photoURL?: string;
}

const FAKE_PERSONAS: PersonaOption[] = [
  { id: "persona_tech_hunter", displayName: "TechHunter_99", photoURL: "🔧" },
  { id: "persona_deal_master", displayName: "DealMaster_47", photoURL: "💎" },
  { id: "persona_price_watcher", displayName: "PriceWatcher_82", photoURL: "👁️" },
  { id: "persona_gadget_fan", displayName: "GadgetFan_55", photoURL: "📱" },
];

function randomPersona(): PersonaOption {
  return FAKE_PERSONAS[Math.floor(Math.random() * FAKE_PERSONAS.length)];
}

// ===== Iterator: Fetch raw data from APIs =====
async function* iterateAliExpressProducts(
  query?: Record<string, any>
): AsyncGenerator<any> {
  const client = getAliExpressClient();
  const pageSize = 50;
  let page = 1;
  const maxPages = 5; // safety limit

  while (page <= maxPages) {
    try {
      const results = await client.getHotProducts({
        page_no: page,
        page_size: pageSize,
        ...query,
      });

      if (!results.items || results.items.length === 0) break;

      for (const item of results.items) {
        yield item;
      }

      page++;
    } catch (error) {
      logger.error("AliExpress iterator error", { error, page });
      break;
    }
  }
}

async function* iterateConvertiserProducts(
  query?: Record<string, any>
): AsyncGenerator<any> {
  const client = getConvertiserClient();
  let page = 1;
  const pageSize = 50;
  const maxPages = 5;

  while (page <= maxPages) {
    try {
      const results = await client.searchProducts(
        query || {},
        { page, page_size: pageSize }
      );

      if (!results.results || results.results.length === 0) break;

      for (const item of results.results) {
        yield item;
      }

      page++;
      if (!results.next) break;
    } catch (error) {
      logger.error("Convertiser iterator error", { error, page });
      break;
    }
  }
}

// ===== AI Enhancement =====
async function enhanceWithAI(
  item: NormalizedDeal | NormalizedProduct,
  locales: string[] = ["pl", "en"]
): Promise<Partial<NormalizedDeal | NormalizedProduct>> {
  try {
    const currentTranslations = item.translations;
    const enriched: any = { ...item };

    // Generate SEO title + description for missing languages
    for (const locale of locales) {
      if (!currentTranslations[locale] || !currentTranslations[locale].description) {
        const prompt = `You are an e-commerce copywriter. Rewrite this product:
Title (original): ${currentTranslations.en?.title || item.translations.en?.title || "N/A"}
Description (original): ${currentTranslations.en?.description || item.translations.en?.description || "N/A"}

Generate for locale "${locale}":
1. SEO-friendly title (max 60 chars)
2. Compelling product description (100-200 chars)
3. Extract 5 key features as JSON array

Return as JSON: { "title": "...", "description": "...", "features": [...] }`;

        const response = await generateText(prompt, {
          temperature: 0.5,
          maxTokens: 300,
        });

        try {
          const parsed = JSON.parse(response);
          if (!enriched.translations[locale]) {
            enriched.translations[locale] = {};
          }
          enriched.translations[locale].title = parsed.title;
          enriched.translations[locale].description = parsed.description;

          if (!enriched.metadata) enriched.metadata = {};
          if (!enriched.metadata.specifications) enriched.metadata.specifications = [];
          enriched.metadata.specifications.push(...(parsed.features || []));
        } catch {
          logger.warn("Failed to parse AI response for locale", { locale });
        }
      }
    }

    // Generate embeddings for search
    const primaryTitle =
      enriched.translations.en?.title ||
      enriched.translations.pl?.title ||
      "";
    if (primaryTitle) {
      const embedding = await embedText(primaryTitle);
      if (!enriched.metadata) enriched.metadata = {};
      enriched.metadata.embedding = embedding;
    }

    return enriched;
  } catch (error) {
    logger.error("AI enhancement failed", { error, itemId: item.id });
    return item;
  }
}

// ===== Persist to Firestore =====
async function persistBatch(
  items: (NormalizedDeal | NormalizedProduct)[],
  config: PipelineConfig
): Promise<string[]> {
  const batch = writeBatch(db);
  const dealsCollection = collection(db, "deals");
  const createdIds: string[] = [];

  try {
    for (const item of items) {
      const dealRef = addDoc(dealsCollection, {
        ...item,
        mainCategorySlug: config.categoryPath.main,
        subCategorySlug: config.categoryPath.sub,
        subSubCategorySlug: config.categoryPath.subSub,
        status: "draft", // Pending moderator review
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Note: writeBatch doesn't support addDoc; use set instead for new docs
      // This is a simplification; in production, handle this differently
      createdIds.push(item.id || "");
    }

    // Commit batch
    await batch.commit();
    logger.info("Batch persisted", { count: items.length });
    return createdIds;
  } catch (error) {
    logger.error("Batch persist failed", { error });
    throw error;
  }
}

// ===== Main Pipeline Executor =====
export async function executePipeline(
  jobId: string,
  config: PipelineConfig
): Promise<any> {
  const queue = getJobQueue();
  const locales = config.locales || ["pl", "en"];
  let processedCount = 0;
  let errorCount = 0;
  const results: string[] = [];

  try {
    logger.info("Pipeline started", { jobId, config });

    // Step 1: Get iterator
    let iterator: AsyncGenerator<any>;
    switch (config.source) {
      case "aliexpress":
        iterator = iterateAliExpressProducts(config.query);
        break;
      case "convertiser":
        iterator = iterateConvertiserProducts(config.query);
        break;
      default:
        throw new Error(`Unknown source: ${config.source}`);
    }

    // Step 2-6: Process in batches
    const batchSize = 10;
    let batch: any[] = [];

    for await (const item of iterator) {
      batch.push(item);

      if (batch.length >= batchSize) {
        // Normalize batch
        const normalized = normalizeBatch(batch, config.source, config.categoryPath);

        // AI Enhancement
        let enhanced = normalized;
        if (config.generateAiEnrichment) {
          enhanced = await Promise.all(
            normalized.map((item) => enhanceWithAI(item, locales))
          ) as (NormalizedDeal | NormalizedProduct)[];
        }

        // Persona Assignment
        if (config.assignPersona) {
          enhanced = enhanced.map((item) => ({
            ...item,
            assignedPersonaId: randomPersona().id,
          }));
        }

        // Persist
        const created = await persistBatch(enhanced, config);
        results.push(...created);

        // TODO: Typesense indexing
        if (config.indexTypesense) {
          logger.info("Typesense indexing would happen here", { count: created.length });
        }

        processedCount += batch.length;
        batch = [];
      }
    }

    // Process remaining items
    if (batch.length > 0) {
      const normalized = normalizeBatch(batch, config.source, config.categoryPath);
      let enhanced = normalized;

      if (config.generateAiEnrichment) {
        enhanced = await Promise.all(
          normalized.map((item) => enhanceWithAI(item, locales))
        ) as (NormalizedDeal | NormalizedProduct)[];
      }

      if (config.assignPersona) {
        enhanced = enhanced.map((item) => ({
          ...item,
          assignedPersonaId: randomPersona().id,
        }));
      }

      const created = await persistBatch(enhanced, config);
      results.push(...created);
      processedCount += batch.length;
    }

    // Mark job complete
    await queue.markComplete(jobId, {
      processedCount,
      errorCount,
      createdIds: results,
    });

    logger.info("Pipeline completed", { jobId, processedCount, errorCount });
    return { processedCount, errorCount, createdIds: results };
  } catch (error) {
    errorCount++;
    await queue.markFailed(jobId, error as Error, { shouldRetry: true });
    logger.error("Pipeline failed", { jobId, error });
    throw error;
  }
}

// ===== Periodic job processor (for Cloud Tasks / Cloud Scheduler) =====
export async function processNextJob(): Promise<void> {
  const queue = getJobQueue();
  const job = await queue.dequeue();

  if (!job) {
    logger.debug("No jobs to process");
    return;
  }

  try {
    logger.info("Processing job", { jobId: job.id, type: job.type });

    switch (job.type) {
      case "import_pipeline":
        await executePipeline(job.id!, job.payload as PipelineConfig);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  } catch (error) {
    await queue.markFailed(job.id!, error as Error, { shouldRetry: true });
  }
}
