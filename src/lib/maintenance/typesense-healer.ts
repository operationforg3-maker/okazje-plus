/**
 * Typesense Healer
 * - Wipe & repopulate search index from Firestore
 * - Batch operations with retry
 * - Trigger endpoint for admin panel
 */

import { logger } from "../logger";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface TypesenseClient {
  collections: {
    retrieve: (name: string) => Promise<any>;
    delete: (name: string) => Promise<void>;
    create: (schema: any) => Promise<any>;
  };
  documents: {
    upsert: (collectionName: string, doc: any) => Promise<any>;
    search: (collectionName: string, params: any) => Promise<any>;
  };
}

// ===== Typesense Schema =====
const DEALS_SCHEMA = {
  name: "deals",
  fields: [
    { name: "id", type: "string" },
    { name: "title", type: "string" },
    { name: "description", type: "string", optional: true },
    { name: "price", type: "float32" },
    { name: "originalPrice", type: "float32", optional: true },
    { name: "discountPercent", type: "int32", optional: true },
    { name: "merchant", type: "string", optional: true },
    { name: "mainCategorySlug", type: "string", facet: true },
    { name: "subCategorySlug", type: "string", facet: true },
    { name: "tags", type: "string[]", facet: true, optional: true },
    { name: "keywords", type: "string[]", optional: true },
    { name: "temperature", type: "int32", facet: true },
    { name: "voteCount", type: "int32" },
    { name: "createdAt", type: "int64", sort: true },
    { name: "status", type: "string", facet: true },
    { name: "affiliate_url", type: "string" },
  ],
  default_sorting_field: "temperature",
};

export class TypesenseHealer {
  private client: TypesenseClient;
  private batchSize = 100;
  private retryAttempts = 3;
  private retryDelayMs = 1000;

  constructor(client: TypesenseClient) {
    this.client = client;
  }

  // ===== Wipe collection =====
  async wipeCollection(collectionName: string = "deals"): Promise<void> {
    try {
      logger.info("Wiping Typesense collection", { collectionName });
      await this.client.collections.delete(collectionName);
      logger.info("Collection wiped successfully", { collectionName });
    } catch (error) {
      // Collection might not exist; log but don't fail
      logger.warn("Collection wipe failed (may not exist)", { collectionName, error });
    }
  }

  // ===== Create collection =====
  async createCollection(collectionName: string = "deals"): Promise<void> {
    try {
      logger.info("Creating Typesense collection", { collectionName });
      await this.client.collections.create(DEALS_SCHEMA);
      logger.info("Collection created successfully", { collectionName });
    } catch (error) {
      logger.error("Collection creation failed", { collectionName, error });
      throw error;
    }
  }

  // ===== Fetch deals from Firestore =====
  private async fetchDealsFromFirestore(): Promise<any[]> {
    try {
      const dealsCollection = collection(db, "deals");
      const q = query(dealsCollection, where("status", "==", "approved"));
      const snapshot = await getDocs(q);

      const deals = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "",
          description: data.description || "",
          price: data.price?.amount || data.price || 0,
          originalPrice: data.originalPrice?.amount || data.originalPrice,
          discountPercent: data.discountPercent || 0,
          merchant: data.merchant || "",
          mainCategorySlug: data.mainCategorySlug || "",
          subCategorySlug: data.subCategorySlug || "",
          tags: data.tags || [],
          keywords: data.keywords || [],
          temperature: data.temperature || 0,
          voteCount: data.voteCount || 0,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
          status: data.status || "draft",
          affiliate_url: data.affiliateUrl || data.link || "",
        };
      });

      logger.info("Fetched deals from Firestore", { count: deals.length });
      return deals;
    } catch (error) {
      logger.error("Failed to fetch deals from Firestore", { error });
      throw error;
    }
  }

  // ===== Index batch with retry =====
  private async indexBatchWithRetry(
    collectionName: string,
    batch: any[],
    attempt = 1
  ): Promise<void> {
    try {
      for (const doc of batch) {
        await this.client.documents.upsert(collectionName, doc);
      }
      logger.debug("Batch indexed successfully", { batchSize: batch.length });
    } catch (error) {
      if (attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn("Batch indexing retry", { attempt, delay, error });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.indexBatchWithRetry(collectionName, batch, attempt + 1);
      }
      logger.error("Batch indexing failed permanently", { attempt, error });
      throw error;
    }
  }

  // ===== Index deals in batches =====
  private async indexDeals(
    collectionName: string,
    deals: any[]
  ): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    for (let i = 0; i < deals.length; i += this.batchSize) {
      const batch = deals.slice(i, i + this.batchSize);

      try {
        await this.indexBatchWithRetry(collectionName, batch);
        indexed += batch.length;
      } catch (error) {
        logger.error("Batch indexing failed", { batchIndex: i / this.batchSize, error });
        failed += batch.length;
      }

      // Rate limiting
      if (i % (this.batchSize * 5) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return { indexed, failed };
  }

  // ===== Full heal cycle =====
  async healCollection(collectionName: string = "deals"): Promise<{
    wiped: boolean;
    created: boolean;
    indexed: number;
    failed: number;
  }> {
    try {
      logger.info("Starting Typesense heal cycle", { collectionName });

      // Step 1: Wipe
      await this.wipeCollection(collectionName);

      // Step 2: Create collection
      await this.createCollection(collectionName);

      // Step 3: Fetch deals from Firestore
      const deals = await this.fetchDealsFromFirestore();

      // Step 4: Index deals in batches
      const result = await this.indexDeals(collectionName, deals);

      logger.info("Typesense heal cycle completed", {
        collectionName,
        indexed: result.indexed,
        failed: result.failed,
      });

      return {
        wiped: true,
        created: true,
        indexed: result.indexed,
        failed: result.failed,
      };
    } catch (error) {
      logger.error("Typesense heal cycle failed", { error });
      throw error;
    }
  }

  // ===== Verify index health =====
  async verifyHealth(collectionName: string = "deals"): Promise<{
    exists: boolean;
    documentCount: number;
  }> {
    try {
      const result = await this.client.collections.retrieve(collectionName);
      return {
        exists: true,
        documentCount: result.num_documents || 0,
      };
    } catch (error) {
      logger.warn("Collection does not exist or is unhealthy", { collectionName });
      return {
        exists: false,
        documentCount: 0,
      };
    }
  }
}

// ===== Singleton factory =====
let healerInstance: TypesenseHealer | null = null;

export function getTypesenseHealer(client?: TypesenseClient): TypesenseHealer {
  if (!healerInstance && client) {
    healerInstance = new TypesenseHealer(client);
  }
  if (!healerInstance) {
    throw new Error("TypesenseHealer not initialized. Provide client to getTypesenseHealer()");
  }
  return healerInstance;
}
