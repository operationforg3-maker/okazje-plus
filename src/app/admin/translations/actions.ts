import { z } from "zod";
import { revalidatePath } from "next/cache";
import { aiTranslateProduct, ProductTranslationInput } from "@/ai/flows/aiTranslateProduct";
import { adminDb } from "@/lib/firebase-admin";
import { Product } from "@/lib/types";

export const TranslationsPayloadSchema = z.object({
  scope: z.enum(["product", "deal"]).default("product"),
  mode: z.enum(["full", "short", "specs"]).default("full"),
  prompt: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export async function dryRunTranslate(input: unknown) {
  const parsed = TranslationsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { scope } = parsed.data;

  const collection = scope === "product" ? "products" : "deals";
  const snapshot = await adminDb.collection(collection).where("status", "==", "approved").limit(3).get();
  const preview: Array<{ id: string; name: string; translations?: any; error?: string }> = [];

  for (const doc of snapshot.docs) {
    const item = doc.data() as Product;
    if (scope === "product") {
      try {
        const translationInput: ProductTranslationInput = {
          name: item.name,
          description: item.description,
          longDescription: item.longDescription,
          seoKeywords: item.seoKeywords,
          metaTitle: item.metaTitle,
          metaDescription: item.metaDescription,
          targetLanguages: ["en", "de"],
        };
        const translations = await aiTranslateProduct(translationInput);
        preview.push({ id: doc.id, name: item.name, translations });
      } catch (e: any) {
        preview.push({ id: doc.id, name: item.name, error: e?.message || "Translation failed" });
      }
    }
  }

  return { ok: true, translated: snapshot.size, preview };
}

export async function runTranslate(input: unknown) {
  const parsed = TranslationsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { scope } = parsed.data;

  const collection = scope === "product" ? "products" : "deals";
  const snapshot = await adminDb.collection(collection).where("status", "==", "approved").limit(100).get();
  let translated = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const item = doc.data() as Product;
    if (scope === "product") {
      try {
        const translationInput: ProductTranslationInput = {
          name: item.name,
          description: item.description,
          longDescription: item.longDescription,
          seoKeywords: item.seoKeywords,
          metaTitle: item.metaTitle,
          metaDescription: item.metaDescription,
          targetLanguages: ["en", "de"],
        };
        const translations = await aiTranslateProduct(translationInput);
        await adminDb.collection(collection).doc(doc.id).update({ translations });
        translated++;
      } catch {
        failed++;
      }
    }
  }

  revalidatePath("/admin/translations");
  return { ok: true, translated, failed };
}
