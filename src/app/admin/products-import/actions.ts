import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createProduct, updateProduct, findExistingProduct } from "@/lib/data-admin";
import { detectDuplicate } from "@/lib/deduplication-ai";
import { Product } from "@/lib/types";

const ProductInputSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  longDescription: z.string().optional(),
  image: z.string().url().optional(),
  imageHint: z.string().optional(),
  affiliateUrl: z.string().url(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  mainCategorySlug: z.string(),
  subCategorySlug: z.string(),
  subSubCategorySlug: z.string().optional(),
  status: z.enum(["draft","approved","rejected"]).default("approved"),
  metadata: z.object({ originalId: z.string().optional() }).partial().optional(),
});

export const ProductsPayloadSchema = z.object({
  products: z.array(ProductInputSchema),
  upsert: z.boolean().default(true),
  dedupe: z.boolean().default(true),
  batchSize: z.number().int().positive().max(1000).default(500),
  dryRun: z.boolean().default(true),
});

export type ProductsPayload = z.infer<typeof ProductsPayloadSchema>;

export async function dryRunImportProducts(input: unknown) {
  const parsed = ProductsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { products, upsert, dedupe } = parsed.data;
  let toCreate = 0, toUpdate = 0, duplicates = 0;
  const preview: Array<{ product: any; action: string; reason?: string; duplicateOf?: string; similarity?: number }> = [];
  
  for (const p of products.slice(0, 50)) {
    const existingId = await findExistingProduct({ originalId: p.metadata?.originalId, affiliateUrl: p.affiliateUrl });
    if (existingId) {
      if (upsert) {
        toUpdate++;
        preview.push({ product: { id: existingId, name: p.name }, action: "update", reason: "Existing product found" });
      } else {
        duplicates++;
        preview.push({ product: { name: p.name }, action: "skip", reason: "Duplicate (upsert=false)" });
      }
    } else if (dedupe) {
      try {
        const productMock = { ...p, id: "temp", ratingCard: { average: 0, count: 0, durability: 0, easeOfUse: 0, valueForMoney: 0, versatility: 0 } } as Product;
        const dupeCheck = await detectDuplicate(productMock, 0.85);
        if (dupeCheck.isDuplicate && dupeCheck.similarProduct) {
          duplicates++;
          preview.push({ product: { name: p.name }, action: "skip", reason: "AI detected duplicate", duplicateOf: dupeCheck.similarProduct.id, similarity: dupeCheck.similarity });
        } else {
          toCreate++;
          preview.push({ product: { name: p.name }, action: "create", reason: "No duplicate found" });
        }
      } catch {
        toCreate++;
        preview.push({ product: { name: p.name }, action: "create", reason: "Dedupe check failed (will create)" });
      }
    } else {
      toCreate++;
      preview.push({ product: { name: p.name }, action: "create" });
    }
  }
  return { ok: true, summary: { total: products.length, toCreate, toUpdate, duplicates }, preview: preview.slice(0, 10) };
}

export async function runImportProducts(input: unknown) {
  const parsed = ProductsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { products, upsert, dedupe } = parsed.data;
  let created = 0, updated = 0, skipped = 0;
  for (const p of products) {
    const existingId = await findExistingProduct({ originalId: p.metadata?.originalId, affiliateUrl: p.affiliateUrl });
    if (existingId) {
      if (upsert) { await updateProduct(existingId, p as any); updated++; } else { skipped++; }
    } else {
      if (dedupe) {
        try {
          const productMock = { ...p, id: "temp", ratingCard: { average: 0, count: 0, durability: 0, easeOfUse: 0, valueForMoney: 0, versatility: 0 } } as Product;
          const dupeCheck = await detectDuplicate(productMock, 0.85);
          if (dupeCheck.isDuplicate) { skipped++; continue; }
        } catch { /* proceed with creation if dedupe fails */ }
      }
      await createProduct(p as any); created++;
    }
  }
  revalidatePath("/admin/products-import");
  return { ok: true, result: { created, updated, skipped } };
}
