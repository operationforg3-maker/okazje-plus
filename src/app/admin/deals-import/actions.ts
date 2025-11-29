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
  status: z.enum(["draft","approved","rejected"]).default("draft"),
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
  let toCreate = 0, toUpdate = 0;
  for (const d of deals.slice(0, 200)) {
    const existingId = await findExistingDeal({ externalOriginalId: d.externalOriginalId, link: d.link });
    if (existingId) toUpdate++; else toCreate++;
  }
  return { ok: true, summary: { total: deals.length, toCreate, toUpdate }, preview: deals.slice(0, 5) };
}

export async function runImportDeals(input: unknown) {
  const parsed = DealsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { deals, autoApprove } = parsed.data;
  let created = 0, updated = 0;
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
