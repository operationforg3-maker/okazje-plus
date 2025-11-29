import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createProduct, updateProduct, findExistingProduct } from "@/lib/data-admin";

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
  for (const p of products.slice(0, 200)) { // cap reads for performance
    const existingId = await findExistingProduct({ originalId: p.metadata?.originalId, affiliateUrl: p.affiliateUrl });
    if (existingId) {
      if (upsert) toUpdate++; else duplicates++;
    } else {
      toCreate++;
    }
  }
  return { ok: true, summary: { total: products.length, toCreate, toUpdate, duplicates }, preview: products.slice(0, 5) };
}

export async function runImportProducts(input: unknown) {
  const parsed = ProductsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { products, upsert } = parsed.data;
  let created = 0, updated = 0, skipped = 0;
  for (const p of products) {
    const existingId = await findExistingProduct({ originalId: p.metadata?.originalId, affiliateUrl: p.affiliateUrl });
    if (existingId) {
      if (upsert) { await updateProduct(existingId, p as any); updated++; } else { skipped++; }
    } else {
      await createProduct(p as any); created++;
    }
  }
  revalidatePath("/admin/products-import");
  return { ok: true, result: { created, updated, skipped } };
}
