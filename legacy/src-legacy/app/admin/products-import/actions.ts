import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createProduct, updateProduct, findExistingProduct } from "@/lib/data-admin";
import { detectDuplicate } from "@/lib/deduplication-ai";
import { Product, ProductRatingCard, ProductRatingSources } from "@/lib/types";

const LocalizedTextSchema = z.object({
  pl: z.string().min(1),
  en: z.string().optional(),
  de: z.string().optional(),
  fr: z.string().optional(),
  es: z.string().optional(),
}).partial().refine((value) => typeof value.pl === "string" || typeof value.en === "string", {
  message: "Wymagany tytuł po polsku lub angielsku",
});

const SpecificationSchema = z.object({
  key: z.string().optional(),
  name: z.string().optional(),
  value: z.string().min(1),
  unit: z.string().optional(),
});

const RatingCardSchema = z.object({
  average: z.number().nonnegative().max(5).optional(),
  count: z.number().int().nonnegative().optional(),
  durability: z.number().nonnegative().max(5).optional(),
  easeOfUse: z.number().nonnegative().max(5).optional(),
  valueForMoney: z.number().nonnegative().max(5).optional(),
  versatility: z.number().nonnegative().max(5).optional(),
});

const RatingSourcesSchema = z.object({
  editorial: z.object({
    average: z.number().nonnegative().max(5),
    count: z.number().int().nonnegative().optional(),
    updatedAt: z.string().optional(),
  }).partial().optional(),
  users: z.object({
    average: z.number().nonnegative().max(5),
    count: z.number().int().nonnegative(),
    updatedAt: z.string().optional(),
  }).partial().optional(),
  external: z.object({
    average: z.number().nonnegative().max(5),
    count: z.number().int().nonnegative().optional(),
    source: z.string().optional(),
    updatedAt: z.string().optional(),
  }).partial().optional(),
}).partial();

const ProductInputSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.union([z.string(), LocalizedTextSchema]).optional(),
  longDescription: z.union([z.string(), LocalizedTextSchema]).optional(),
  title: z.union([z.string().min(2), LocalizedTextSchema]).optional(),
  shortDescription: z.union([z.string(), LocalizedTextSchema]).optional(),
  fullDescription: z.union([z.string(), LocalizedTextSchema]).optional(),
  seoDescription: z.union([z.string(), LocalizedTextSchema]).optional(),
  image: z.string().url().optional(),
  imageHint: z.string().optional(),
  affiliateUrl: z.string().url(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  mainCategorySlug: z.string(),
  subCategorySlug: z.string(),
  subSubCategorySlug: z.string().optional(),
  status: z.enum(["draft","approved","rejected"]).default("approved"),
  metadata: z.object({
    originalId: z.string().optional(),
    specifications: z.array(SpecificationSchema).optional(),
    evaluateRate: z.string().optional(),
    evaluateCount: z.number().int().nonnegative().optional(),
    merchantRating: z.number().nonnegative().max(5).optional(),
    sellerRating: z.number().nonnegative().max(5).optional(),
  }).partial().optional(),
  specifications: z.array(SpecificationSchema).optional(),
  ratingCard: RatingCardSchema.optional(),
  ratingSources: RatingSourcesSchema.optional(),
  externalRating: z.number().nonnegative().max(5).optional(),
  externalRatingCount: z.number().int().nonnegative().optional(),
}).refine((value) => Boolean(value.name || value.title), {
  message: "Wymagane jest pole name lub title",
});

export const ProductsPayloadSchema = z.object({
  products: z.array(ProductInputSchema),
  upsert: z.boolean().default(true),
  dedupe: z.boolean().default(true),
  batchSize: z.number().int().positive().max(1000).default(500),
  dryRun: z.boolean().default(true),
});

export type ProductsPayload = z.infer<typeof ProductsPayloadSchema>;

const DEFAULT_RATING_CARD: ProductRatingCard = {
  average: 0,
  count: 0,
  durability: 0,
  easeOfUse: 0,
  valueForMoney: 0,
  versatility: 0,
};

const normalizeLocalizedText = (value: unknown, fallback = ""): { pl: string; en: string; [key: string]: string | undefined } => {
  if (typeof value === "string") {
    return { pl: value, en: value };
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const pl = typeof input.pl === "string" && input.pl.trim().length > 0 ? input.pl : undefined;
    const en = typeof input.en === "string" && input.en.trim().length > 0 ? input.en : undefined;
    const base = pl || en || fallback;
    return {
      ...input,
      pl: pl || base,
      en: en || base,
    } as { pl: string; en: string; [key: string]: string | undefined };
  }
  return { pl: fallback, en: fallback };
};

const parseExternalRating = (raw?: string | number): number | undefined => {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const match = raw.match(/[0-9]+(?:\.[0-9]+)?/);
    if (match) return parseFloat(match[0]);
  }
  return undefined;
};

const normalizeProductInput = (input: z.infer<typeof ProductInputSchema>): Omit<Product, "id"> => {
  const { specifications, externalRating, externalRatingCount, ...rest } = input;
  const title = normalizeLocalizedText(rest.title || rest.name || "Produkt", rest.name || "Produkt");
  const shortDescription = normalizeLocalizedText(rest.shortDescription || rest.description || "", rest.description as string | undefined);
  const fullDescription = normalizeLocalizedText(rest.fullDescription || rest.longDescription || rest.description || "", rest.longDescription as string | undefined);
  const seoDescription = rest.seoDescription ? normalizeLocalizedText(rest.seoDescription, shortDescription.pl) : undefined;

  const specs = specifications || rest.metadata?.specifications;
  const externalAvg = rest.ratingSources?.external?.average ?? parseExternalRating(rest.metadata?.evaluateRate) ?? externalRating;
  const externalCount = rest.ratingSources?.external?.count ?? rest.metadata?.evaluateCount ?? externalRatingCount;

  const ratingSources: ProductRatingSources | undefined = (() => {
    if (!rest.ratingSources && !externalAvg) return undefined;
    const result: ProductRatingSources = {};
    if (rest.ratingSources?.editorial?.average !== undefined) {
      result.editorial = {
        average: rest.ratingSources.editorial.average,
        count: rest.ratingSources.editorial.count,
        updatedAt: rest.ratingSources.editorial.updatedAt,
      };
    }
    if (rest.ratingSources?.users?.average !== undefined && rest.ratingSources?.users?.count !== undefined) {
      result.users = {
        average: rest.ratingSources.users.average,
        count: rest.ratingSources.users.count,
        updatedAt: rest.ratingSources.users.updatedAt,
      };
    }
    const extAvg = rest.ratingSources?.external?.average ?? externalAvg;
    if (extAvg !== undefined) {
      result.external = {
        average: extAvg,
        count: rest.ratingSources?.external?.count ?? externalCount,
        source: rest.ratingSources?.external?.source ?? "external",
        updatedAt: rest.ratingSources?.external?.updatedAt,
      };
    }
    return Object.keys(result).length > 0 ? result : undefined;
  })();

  const ratingCard: ProductRatingCard = {
    ...DEFAULT_RATING_CARD,
    ...rest.ratingCard,
  };
  if (!ratingCard.average && ratingSources?.external?.average) {
    ratingCard.average = ratingSources.external.average;
    ratingCard.count = ratingSources.external.count ?? ratingCard.count;
  }

  return {
    ...rest,
    name: rest.name || title.pl,
    description: typeof rest.description === "string" ? rest.description : shortDescription.pl,
    longDescription: typeof rest.longDescription === "string" ? rest.longDescription : fullDescription.pl,
    title,
    shortDescription,
    fullDescription,
    seoDescription,
    ratingCard,
    ratingSources,
    metadata: rest.metadata 
      ? { ...rest.metadata, specifications: specs || rest.metadata.specifications } 
      : specs 
        ? ({ specifications: specs } as any)
        : undefined,
  } as Omit<Product, "id">;
};

export async function dryRunImportProducts(input: unknown) {
  const parsed = ProductsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { products, upsert, dedupe } = parsed.data;
  const normalized = products.map(normalizeProductInput);
  let toCreate = 0, toUpdate = 0, duplicates = 0;
  const preview: Array<{ product: any; action: string; reason?: string; duplicateOf?: string; similarity?: number; flags?: { hasTranslations: boolean; hasEnrichment: boolean; importElements: string[] } }> = [];
  
  for (const p of normalized.slice(0, 50)) {
    const existingId = await findExistingProduct({ originalId: p.metadata?.originalId, affiliateUrl: p.affiliateUrl });
    if (existingId) {
      if (upsert) {
        toUpdate++;
        preview.push({ product: { id: existingId, name: p.name }, action: "update", reason: "Existing product found", flags: {
          hasTranslations: !!(p.title && typeof p.title === 'object' && (p.title.en || p.title.de || p.title.fr || p.title.es)),
          hasEnrichment: !!p.metadata?.specifications || !!p.seo || !!p.ai,
          importElements: [
            p.metadata?.specifications ? 'specifications' : '',
            p.ratingSources?.external ? 'externalRating' : '',
            p.metadata?.evaluateRate ? 'evaluateRate' : '',
            p.metadata?.evaluateCount ? 'evaluateCount' : '',
            p.seo ? 'seo' : '',
          ].filter(Boolean)
        }});
      } else {
        duplicates++;
        preview.push({ product: { name: p.name }, action: "skip", reason: "Duplicate (upsert=false)" });
      }
    } else if (dedupe) {
      try {
        const productMock = { ...p, id: "temp" } as Product;
        const dupeCheck = await detectDuplicate(productMock, 0.85);
        if (dupeCheck.isDuplicate && dupeCheck.similarProduct) {
          duplicates++;
          preview.push({ product: { name: p.name }, action: "skip", reason: "AI detected duplicate", duplicateOf: dupeCheck.similarProduct.id, similarity: dupeCheck.similarity, flags: {
            hasTranslations: !!(p.title && typeof p.title === 'object' && (p.title.en || p.title.de || p.title.fr || p.title.es)),
            hasEnrichment: !!p.metadata?.specifications || !!p.seo || !!p.ai,
            importElements: [
              p.metadata?.specifications ? 'specifications' : '',
              p.ratingSources?.external ? 'externalRating' : '',
              p.metadata?.evaluateRate ? 'evaluateRate' : '',
              p.metadata?.evaluateCount ? 'evaluateCount' : '',
              p.seo ? 'seo' : '',
            ].filter(Boolean)
          }});
        } else {
          toCreate++;
          preview.push({ product: { name: p.name }, action: "create", reason: "No duplicate found", flags: {
            hasTranslations: !!(p.title && typeof p.title === 'object' && (p.title.en || p.title.de || p.title.fr || p.title.es)),
            hasEnrichment: !!p.metadata?.specifications || !!p.seo || !!p.ai,
            importElements: [
              p.metadata?.specifications ? 'specifications' : '',
              p.ratingSources?.external ? 'externalRating' : '',
              p.metadata?.evaluateRate ? 'evaluateRate' : '',
              p.metadata?.evaluateCount ? 'evaluateCount' : '',
              p.seo ? 'seo' : '',
            ].filter(Boolean)
          }});
        }
      } catch {
        toCreate++;
        preview.push({ product: { name: p.name }, action: "create", reason: "Dedupe check failed (will create)", flags: {
          hasTranslations: !!(p.title && typeof p.title === 'object' && (p.title.en || p.title.de || p.title.fr || p.title.es)),
          hasEnrichment: !!p.metadata?.specifications || !!p.seo || !!p.ai,
          importElements: [
            p.metadata?.specifications ? 'specifications' : '',
            p.ratingSources?.external ? 'externalRating' : '',
            p.metadata?.evaluateRate ? 'evaluateRate' : '',
            p.metadata?.evaluateCount ? 'evaluateCount' : '',
            p.seo ? 'seo' : '',
          ].filter(Boolean)
        }});
      }
    } else {
      toCreate++;
      preview.push({ product: { name: p.name }, action: "create", flags: {
        hasTranslations: !!(p.title && typeof p.title === 'object' && (p.title.en || p.title.de || p.title.fr || p.title.es)),
        hasEnrichment: !!p.metadata?.specifications || !!p.seo || !!p.ai,
        importElements: [
          p.metadata?.specifications ? 'specifications' : '',
          p.ratingSources?.external ? 'externalRating' : '',
          p.metadata?.evaluateRate ? 'evaluateRate' : '',
          p.metadata?.evaluateCount ? 'evaluateCount' : '',
          p.seo ? 'seo' : '',
        ].filter(Boolean)
      }});
    }
  }
  const summaryFlags = normalized.reduce((acc, p) => {
    const hasTranslations = !!(p.title && typeof p.title === 'object' && (p.title.en || p.title.de || p.title.fr || p.title.es));
    const hasEnrichment = !!p.metadata?.specifications || !!p.seo || !!p.ai;
    if (hasTranslations) acc.translated++;
    if (hasEnrichment) acc.enriched++;
    if (p.metadata?.specifications) acc.specs++;
    if (p.ratingSources?.external) acc.externalRatings++;
    return acc;
  }, { translated: 0, enriched: 0, specs: 0, externalRatings: 0 });
  return { ok: true, summary: { total: normalized.length, toCreate, toUpdate, duplicates, flags: summaryFlags }, preview: preview.slice(0, 10) };
}

export async function runImportProducts(input: unknown) {
  const parsed = ProductsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { products, upsert, dedupe } = parsed.data;
  const normalized = products.map(normalizeProductInput);
  let created = 0, updated = 0, skipped = 0;
  for (const p of normalized) {
    const existingId = await findExistingProduct({ originalId: p.metadata?.originalId, affiliateUrl: p.affiliateUrl });
    if (existingId) {
      if (upsert) { await updateProduct(existingId, p as any); updated++; } else { skipped++; }
    } else {
      if (dedupe) {
        try {
          const productMock = { ...p, id: "temp" } as Product;
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
