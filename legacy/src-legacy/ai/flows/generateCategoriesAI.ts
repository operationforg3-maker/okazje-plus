import { z } from "zod";
import { ai } from "../genkit";
import { CATEGORY_SEEDS } from "../../lib/category-seeds";
import { Category } from "../../lib/types";
import { db } from "../../lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

const InputSchema = z.object({
  mode: z.enum(["ai-only", "seeds-only", "hybrid"]).default("seeds-only"),
  prompt: z.string().min(10).optional(),
  locale: z.string().default("pl"),
});

const OutputSchema = z.object({
  createdCount: z.number(),
  mode: z.string(),
});

async function upsertCategory(cat: Omit<Category, "id">, parentPath: string[] = []) {
  const safeSlug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const path = [...parentPath, safeSlug].join("/");
  const ref = doc(collection(db, "categories"), path);
  await setDoc(ref, {
    name: cat.name,
    slug: safeSlug,
    icon: cat.icon ?? null,
    description: cat.description ?? null,
    sortOrder: cat.sortOrder ?? 0,
    parentSlug: parentPath[parentPath.length - 1] ?? null,
    mainCategorySlug: parentPath[0] ?? safeSlug,
    subCategorySlug: parentPath[1] ?? null,
  }, { merge: true });
  if (cat.subcategories && cat.subcategories.length) {
    for (const sub of cat.subcategories) {
      await upsertCategory(sub as Omit<Category, "id">, [...parentPath, safeSlug]);
    }
  }
}

export default async function generateCategoriesAI(input: z.infer<typeof InputSchema>) {
    let seeds: Omit<Category, "id">[] = [];
    if (input.mode === "seeds-only") {
      seeds = CATEGORY_SEEDS;
    } else if (input.mode === "ai-only" || input.mode === "hybrid") {
      const system = "Jesteś ekspertem e-commerce. Generuj kompletne drzewo kategorii (3 poziomy) po polsku z SEO-friendly slugami (kebab-case, bez polskich znaków). Zwróć JSON zgodny z typem Category (name, slug, icon?, description?, sortOrder?, subcategories[]).";
      const user = input.prompt ?? "Wygeneruj pełne drzewo kategorii marketplace na wzór Pepper/AliExpress. Priorytet: Elektronika, Dom, Moda, Sport, Zdrowie, Dziecko, Książki, Motoryzacja, Usługi, Zwierzęta, Biuro, Smart Home, Wearables, Hobby, Narzędzia.";
      const gen = await ai.generate({ prompt: `${system}\n\n${user}` });
      let aiJson: Omit<Category, "id">[] = [];
      try {
        const text = (gen as any)?.text?.() || (gen as any)?.outputText?.() || (gen as any)?.output?.[0]?.text || '';
        aiJson = JSON.parse(text);
      } catch {
        aiJson = [];
      }
      seeds = aiJson ?? [];
      if (input.mode === "hybrid") {
        // prosta fuzja: dołącz AI do seedów bazowych, unikaj duplikacji po slugach
        const existing = new Set<string>(CATEGORY_SEEDS.map(c => c.slug || ''));
        const merged = [...CATEGORY_SEEDS];
        for (const c of seeds) {
          const s = c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          if (!existing.has(s)) merged.push({ ...c, slug: s });
        }
        seeds = merged;
      }
    }

    let count = 0;
    for (const c of seeds) {
      await upsertCategory(c);
      count += 1;
    }

  return { createdCount: count, mode: input.mode };
}
