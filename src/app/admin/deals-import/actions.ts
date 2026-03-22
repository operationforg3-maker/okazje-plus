import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createDeal, updateDeal, findExistingDeal } from "@/lib/data-admin";

const DealInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  link: z.string().url(),
  image: z.string().url().optional(),
  imageHint: z.string().optional(),
  mainCategorySlug: z.string(),
  subCategorySlug: z.string(),
  subSubCategorySlug: z.string().optional(),
  merchant: z.string().optional(),
  status: z.enum(["draft", "approved", "rejected"]).default("draft"),
  externalOriginalId: z.string().optional(),
});

export const DealsPayloadSchema = z.object({
  deals: z.array(DealInputSchema),
  autoApprove: z.boolean().default(false),
  batchSize: z.number().int().positive().max(1000).default(500),
  dryRun: z.boolean().default(true),
});

export type DealsPayload = z.infer<typeof DealsPayloadSchema>;

export async function dryRunImportDeals(input: unknown) {
  const parsed = DealsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { deals } = parsed.data;
  let toCreate = 0;
  let toUpdate = 0;
  const preview: Array<{ deal: any; action: string; reason?: string; existingId?: string }> = [];
  for (const d of deals.slice(0, 50)) {
    const existingId = await findExistingDeal({ externalOriginalId: d.externalOriginalId, link: d.link });
    if (existingId) {
      toUpdate++;
      preview.push({ deal: { id: existingId, title: d.title }, action: "update", reason: "Existing deal found", existingId });
    } else {
      toCreate++;
      preview.push({ deal: { title: d.title }, action: "create" });
    }
  }
  return { ok: true, summary: { total: deals.length, toCreate, toUpdate }, preview: preview.slice(0, 10) };
}

export async function runImportDeals(input: unknown) {
  const parsed = DealsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { deals, autoApprove } = parsed.data;
  let created = 0;
  let updated = 0;
  for (const d of deals) {
    const existingId = await findExistingDeal({ externalOriginalId: d.externalOriginalId, link: d.link });
    if (existingId) {
      await updateDeal(existingId, d as any);
      updated++;
    } else {
      const doc = { ...d, status: autoApprove ? "approved" : d.status } as any;
      await createDeal(doc);
      created++;
    }
  }
  revalidatePath("/admin/deals-import");
  return { ok: true, result: { created, updated } };
}
