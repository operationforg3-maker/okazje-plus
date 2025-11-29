import { z } from "zod";
import { revalidatePath } from "next/cache";

export const TranslationsPayloadSchema = z.object({
  scope: z.enum(["product", "deal"]).default("product"),
  mode: z.enum(["full", "short", "specs"]).default("full"),
  prompt: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export async function dryRunTranslate(input: unknown) {
  const parsed = TranslationsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  return { ok: true, translated: 0, preview: [] };
}

export async function runTranslate(input: unknown) {
  const parsed = TranslationsPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  revalidatePath("/admin/translations");
  return { ok: true, translated: 0 };
}
