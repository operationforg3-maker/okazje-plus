import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createCategory, createSubcategory } from "@/lib/data-admin";

const FlatCategorySchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2),
  parentSlug: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const CategoriesPayloadSchema = z.object({
  categories: z.array(FlatCategorySchema),
  dryRun: z.boolean().default(true),
});

export type CategoriesPayload = z.infer<typeof CategoriesPayloadSchema>;

export async function dryRunImportCategories(input: unknown) {
  const parsed = CategoriesPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten() };
  }
  const { categories } = parsed.data;
  const roots = categories.filter(c => !c.parentSlug);
  const children = categories.filter(c => !!c.parentSlug);
  const preview = [
    ...roots.slice(0, 5).map(c => ({ slug: c.slug, name: c.name, action: "create", level: "root" })),
    ...children.slice(0, 5).map(c => ({ slug: c.slug, name: c.name, action: "create", level: "subcategory", parentSlug: c.parentSlug })),
  ];
  return {
    ok: true,
    summary: { total: categories.length, roots: roots.length, children: children.length },
    preview,
  };
}

export async function runImportCategories(input: unknown) {
  const parsed = CategoriesPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten() };
  }
  const { categories } = parsed.data;
  const bySlug = new Map(categories.map(c => [c.slug, c]));
  const parentIdBySlug = new Map<string, string>();
  let created = 0, skipped = 0;

  // Najpierw utwórz kategorie główne
  for (const c of categories.filter(c => !c.parentSlug)) {
    try {
      const id = await createCategory({ name: c.name, slug: c.slug, sortOrder: c.sortOrder });
      parentIdBySlug.set(c.slug, id);
      created++;
    } catch {
      skipped++;
    }
  }
  // Następnie podkategorie (1 poziom)
  for (const c of categories.filter(c => !!c.parentSlug)) {
    const parentSlug = c.parentSlug!;
    const parentId = parentIdBySlug.get(parentSlug);
    if (!parentId) {
      // jeśli nie istnieje w bieżącym wsadzie, spróbuj stworzyć rodzica ad-hoc
      const parent = bySlug.get(parentSlug);
      if (parent && !parent.parentSlug) {
        const pid = await createCategory({ name: parent.name, slug: parent.slug, sortOrder: parent.sortOrder });
        parentIdBySlug.set(parent.slug, pid);
      }
    }
    const finalParentId = parentIdBySlug.get(parentSlug);
    if (!finalParentId) { skipped++; continue; }
    try {
      await createSubcategory(finalParentId, { name: c.name, slug: c.slug, sortOrder: c.sortOrder });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/admin/categories-import");
  return { ok: true, result: { created, skipped } };
}
