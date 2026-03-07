/**
 * JSON-driven category seeding script.
 *
 * Source of truth:
 *   category-tree.full.json (repo root)
 *
 * Usage:
 *   npm run seed:categories
 *   CATEGORY_TREE_PATH=./path/to/tree.json npm run seed:categories
 */

import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from '../lib/firebase-admin';

type LocalePayload = {
  name?: string;
  description?: string;
  seoKeywords?: string[];
  metaTemplate?: { title?: string; description?: string };
};

type CategoryNode = {
  name?: string;
  slug: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  isHot?: boolean;
  isAdult?: boolean;
  media?: Record<string, any>;
  translations?: Record<string, LocalePayload>;
  importKeywords?: string[];
  aliexpressKeywords?: string[];
  aliexpressCategoryIds?: string[];
  googleCategoryId?: number;
  filterableAttributes?: string[];
  subcategories?: CategoryNode[];
};

type CategoryTreeFile = {
  generatedAt?: string;
  counts?: {
    main?: number;
    sub?: number;
    subSub?: number;
    total?: number;
  };
  tree: CategoryNode[];
};

const BATCH_LIMIT = 450;

function uniq(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0)
    )
  );
}

function getName(node: CategoryNode): string {
  return (
    node.translations?.pl?.name ||
    node.translations?.en?.name ||
    node.name ||
    node.slug
  );
}

function getDescription(node: CategoryNode): string {
  return (
    node.translations?.pl?.description ||
    node.translations?.en?.description ||
    node.description ||
    ''
  );
}

function computeCounts(tree: CategoryNode[]) {
  const main = tree.length;
  const sub = tree.reduce((acc, m) => acc + (m.subcategories?.length || 0), 0);
  const subSub = tree.reduce(
    (acc, m) =>
      acc +
      (m.subcategories || []).reduce(
        (inner, s) => inner + (s.subcategories?.length || 0),
        0
      ),
    0
  );
  return { main, sub, subSub, total: main + sub + subSub };
}

function loadTreeFromFile(): CategoryTreeFile {
  const inputPath = process.env.CATEGORY_TREE_PATH || 'category-tree.full.json';
  const absolutePath = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Category tree file not found: ${absolutePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as CategoryTreeFile;
  if (!parsed || !Array.isArray(parsed.tree) || parsed.tree.length === 0) {
    throw new Error(`Invalid category tree JSON in ${absolutePath} (missing non-empty tree[])`);
  }

  const computed = computeCounts(parsed.tree);
  if (parsed.counts) {
    const mismatch =
      parsed.counts.main !== undefined && parsed.counts.main !== computed.main ||
      parsed.counts.sub !== undefined && parsed.counts.sub !== computed.sub ||
      parsed.counts.subSub !== undefined && parsed.counts.subSub !== computed.subSub ||
      parsed.counts.total !== undefined && parsed.counts.total !== computed.total;

    if (mismatch) {
      console.warn('[seed-categories] WARNING: counts in JSON do not match tree shape.');
      console.warn('[seed-categories] counts field:', parsed.counts);
      console.warn('[seed-categories] computed:', computed);
    }
  }

  return parsed;
}

async function seedCategories() {
  const source = loadTreeFromFile();
  const computed = computeCounts(source.tree);

  console.log('Starting category seeding from JSON...');
  console.log(`generatedAt: ${source.generatedAt || 'n/a'}`);
  console.log(`counts: main=${computed.main}, sub=${computed.sub}, subSub=${computed.subSub}, total=${computed.total}`);

  let batch = adminDb.batch();
  let batchOps = 0;

  const commitBatch = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = adminDb.batch();
    batchOps = 0;
  };

  const queueSet = async (ref: FirebaseFirestore.DocumentReference, data: Record<string, any>) => {
    batch.set(ref, data);
    batchOps += 1;
    if (batchOps >= BATCH_LIMIT) await commitBatch();
  };

  const queueDelete = async (ref: FirebaseFirestore.DocumentReference) => {
    batch.delete(ref);
    batchOps += 1;
    if (batchOps >= BATCH_LIMIT) await commitBatch();
  };

  const mainRef = adminDb.collection('categories');

  const wantedMainSlugs = new Set(source.tree.map((m) => m.slug));
  const existingMainSnapshot = await mainRef.get();
  for (const doc of existingMainSnapshot.docs) {
    if (!wantedMainSlugs.has(doc.id)) {
      const subSnap = await doc.ref.collection('subcategories').get();
      for (const subDoc of subSnap.docs) {
        const subSubSnap = await subDoc.ref.collection('subcategories').get();
        for (const subSubDoc of subSubSnap.docs) {
          await queueDelete(subSubDoc.ref);
        }
        await queueDelete(subDoc.ref);
      }
      await queueDelete(doc.ref);
      console.log(`Deleted removed main category: ${doc.id}`);
    }
  }

  for (const main of source.tree) {
    const mainDoc = mainRef.doc(main.slug);
    const mainSub = main.subcategories || [];

    await queueSet(mainDoc, {
      name: getName(main),
      slug: main.slug,
      icon: main.icon || '📦',
      sortOrder: main.sortOrder || 0,
      description: getDescription(main),
      isHot: !!main.isHot,
      isAdult: !!main.isAdult,
      media: main.media || {},
      importKeywords: uniq([...(main.importKeywords || []), ...(main.aliexpressKeywords || []), getName(main), main.slug]),
      searchKeywords: uniq([...(main.importKeywords || []), ...(main.aliexpressKeywords || []), getName(main), main.slug]),
      translations: main.translations || {},
      subcategories: mainSub.map((s, idx) => ({
        name: getName(s),
        slug: s.slug,
        sortOrder: s.sortOrder || (idx + 1) * 10,
      })),
      createdAt: new Date().toISOString(),
    });

    const subCollection = mainDoc.collection('subcategories');
    const wantedSubSlugs = new Set(mainSub.map((s) => s.slug));
    const existingSubSnapshot = await subCollection.get();

    for (const existingSub of existingSubSnapshot.docs) {
      if (!wantedSubSlugs.has(existingSub.id)) {
        const existingSubSub = await existingSub.ref.collection('subcategories').get();
        for (const subSub of existingSubSub.docs) {
          await queueDelete(subSub.ref);
        }
        await queueDelete(existingSub.ref);
        console.log(`  Deleted removed subcategory: ${main.slug}/${existingSub.id}`);
      }
    }

    for (const sub of mainSub) {
      const subDoc = subCollection.doc(sub.slug);
      const subSubList = sub.subcategories || [];

      await queueSet(subDoc, {
        name: getName(sub),
        slug: sub.slug,
        icon: sub.icon || null,
        sortOrder: sub.sortOrder || 0,
        description: getDescription(sub),
        isHot: !!sub.isHot,
        isAdult: !!sub.isAdult,
        media: sub.media || {},
        importKeywords: uniq([...(sub.importKeywords || []), ...(sub.aliexpressKeywords || []), getName(sub), sub.slug]),
        searchKeywords: uniq([...(sub.importKeywords || []), ...(sub.aliexpressKeywords || []), getName(sub), sub.slug]),
        translations: sub.translations || {},
        subcategories: subSubList.map((ss, idx) => ({
          name: getName(ss),
          slug: ss.slug,
          sortOrder: ss.sortOrder || (idx + 1) * 10,
        })),
        createdAt: new Date().toISOString(),
      });

      const subSubCollection = subDoc.collection('subcategories');
      const wantedSubSubSlugs = new Set(subSubList.map((ss) => ss.slug));
      const existingSubSubSnapshot = await subSubCollection.get();

      for (const existingSubSub of existingSubSubSnapshot.docs) {
        if (!wantedSubSubSlugs.has(existingSubSub.id)) {
          await queueDelete(existingSubSub.ref);
          console.log(`    Deleted removed sub-subcategory: ${main.slug}/${sub.slug}/${existingSubSub.id}`);
        }
      }

      for (const subSub of subSubList) {
        const subSubDoc = subSubCollection.doc(subSub.slug);
        await queueSet(subSubDoc, {
          name: getName(subSub),
          slug: subSub.slug,
          sortOrder: subSub.sortOrder || 0,
          description: getDescription(subSub),
          isHot: !!subSub.isHot,
          isAdult: !!subSub.isAdult,
          media: subSub.media || {},
          googleCategoryId: subSub.googleCategoryId || null,
          filterableAttributes: subSub.filterableAttributes || [],
          aliexpressCategoryIds: subSub.aliexpressCategoryIds || [],
          aliexpressKeywords: subSub.aliexpressKeywords || [],
          importKeywords: uniq([
            ...(subSub.importKeywords || []),
            ...(subSub.aliexpressKeywords || []),
            getName(subSub),
            subSub.slug,
          ]),
          searchKeywords: uniq([
            ...(subSub.importKeywords || []),
            ...(subSub.aliexpressKeywords || []),
            getName(subSub),
            subSub.slug,
          ]),
          translations: subSub.translations || {},
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  await commitBatch();

  console.log('Category seeding completed.');
  console.log(`Main categories: ${computed.main}`);
  console.log(`Subcategories: ${computed.sub}`);
  console.log(`Sub-subcategories: ${computed.subSub}`);
  console.log(`Total: ${computed.total}`);
}

if (require.main === module) {
  seedCategories()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error seeding categories:', error);
      process.exit(1);
    });
}

export { seedCategories };
