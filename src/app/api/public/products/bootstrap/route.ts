import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { cacheGet, cacheSet } from '@/lib/cache';
import { ensureCategoryTranslations } from '@/lib/category-translations';

const CACHE_TTL_SECONDS = 600;
const CACHE_KEY = 'public:products:bootstrap:v1';
const CONTENT_SAMPLE_LIMIT = 2500;

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  highlight?: boolean;
  image?: string;
  accentColor?: string;
  heroImage?: string;
  promo?: any;
  tiles?: any[];
  translations: Record<string, { name: string; description?: string }>;
  subcategories?: CategoryNode[];
};

type DealPreview = {
  id: string;
  title: string;
  image?: string;
  temperature?: number;
  price?: number | { amount: number; currency?: string };
};

async function buildProductContentIndex(): Promise<{ main: Set<string>; sub: Set<string> }> {
  const main = new Set<string>();
  const sub = new Set<string>();

  const snap = await adminDb
    .collection('product_cores')
    .where('status', '==', 'approved')
    .limit(CONTENT_SAMPLE_LIMIT)
    .get();

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as any;
    const mainSlug = String(data?.mainCategorySlug || '').trim();
    const subSlug = String(data?.subCategorySlug || '').trim();

    if (mainSlug) main.add(mainSlug);
    if (subSlug) sub.add(subSlug);
  }

  if (snap.size >= CONTENT_SAMPLE_LIMIT) {
    console.warn(
      `[api/public/products/bootstrap] Reached sample limit (${CONTENT_SAMPLE_LIMIT}) while indexing categories.`
    );
  }

  return { main, sub };
}

function toSorted<T extends { sortOrder?: number }>(items: T[]): T[] {
  return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function getDealOfTheDay(): Promise<DealPreview | null> {
  const showcaseSnap = await adminDb.collection('settings').doc('navigationShowcase').get();
  if (!showcaseSnap.exists) return null;

  const showcaseData = showcaseSnap.data() as any;
  const dealId = String(showcaseData?.dealOfTheDayId || '').trim();
  if (!dealId) return null;

  const dealSnap = await adminDb.collection('deals').doc(dealId).get();
  if (!dealSnap.exists) return null;

  const dealData = dealSnap.data() as any;
  if (String(dealData?.status || '') !== 'approved') return null;

  return {
    id: dealSnap.id,
    title: String(dealData?.title || ''),
    image: typeof dealData?.image === 'string' ? dealData.image : undefined,
    temperature: Number(dealData?.temperature || 0),
    price: typeof dealData?.price === 'number' ? dealData.price : dealData?.price,
  };
}

export async function GET() {
  try {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const contentIndex = await buildProductContentIndex();
    const mainSnap = await adminDb.collection('categories').get();

    const categories: CategoryNode[] = [];

    for (const mainDoc of mainSnap.docs) {
      const mainData = mainDoc.data() as any;
      const mainSlug = String(mainData?.slug || mainDoc.id);

      const subSnap = await mainDoc.ref.collection('subcategories').get();
      const subcategoriesRaw = await Promise.all(
        subSnap.docs.map(async (subDoc) => {
          const subData = subDoc.data() as any;
          const subSlug = String(subData?.slug || subDoc.id);

          const subSubSnap = await subDoc.ref.collection('subcategories').get();
          const subSubcategories: CategoryNode[] = toSorted(
            subSubSnap.docs.map((subSubDoc) => {
              const subSubData = subSubDoc.data() as any;
              return {
                id: subSubDoc.id,
                name: String(subSubData?.name || subSubDoc.id),
                slug: String(subSubData?.slug || subSubDoc.id),
                icon: subSubData?.icon,
                description: subSubData?.description,
                sortOrder: subSubData?.sortOrder,
                image: subSubData?.image,
                translations: ensureCategoryTranslations(
                  subSubData?.translations,
                  String(subSubData?.name || subSubDoc.id),
                  subSubData?.description
                ),
              } satisfies CategoryNode;
            })
          );

          const hasSubContent = subSlug ? contentIndex.sub.has(subSlug) : false;
          const hasChildren = subSubcategories.length > 0;
          if (!hasSubContent && !hasChildren) {
            return null;
          }

          return {
            id: subDoc.id,
            name: String(subData?.name || subDoc.id),
            slug: subSlug,
            icon: subData?.icon,
            description: subData?.description,
            sortOrder: subData?.sortOrder,
            highlight: !!subData?.highlight,
            image: subData?.image,
            translations: ensureCategoryTranslations(
              subData?.translations,
              String(subData?.name || subDoc.id),
              subData?.description
            ),
            subcategories: subSubcategories,
          } satisfies CategoryNode;
        })
      );

      const subcategories = toSorted(subcategoriesRaw.filter(Boolean) as CategoryNode[]);
      const hasMainContent = mainSlug ? contentIndex.main.has(mainSlug) : false;

      if (!hasMainContent && subcategories.length === 0) {
        continue;
      }

      categories.push({
        id: mainDoc.id,
        name: String(mainData?.name || mainDoc.id),
        slug: mainSlug,
        icon: mainData?.icon,
        description: mainData?.description,
        sortOrder: mainData?.sortOrder,
        accentColor: mainData?.accentColor,
        heroImage: mainData?.heroImage,
        promo: mainData?.promo,
        tiles: Array.isArray(mainData?.tiles) ? mainData.tiles : [],
        translations: ensureCategoryTranslations(
          mainData?.translations,
          String(mainData?.name || mainDoc.id),
          mainData?.description
        ),
        subcategories,
      });
    }

    const payload = {
      categories: toSorted(categories),
      dealOfTheDay: await getDealOfTheDay(),
      checkedAt: new Date().toISOString(),
    };

    await cacheSet(CACHE_KEY, payload, CACHE_TTL_SECONDS);
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      {
        categories: [],
        dealOfTheDay: null,
        error: String(error?.message || 'Internal error'),
      },
      { status: 500 }
    );
  }
}
