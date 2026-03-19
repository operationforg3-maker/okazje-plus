import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

const REQUIRED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

type Locale = (typeof REQUIRED_LOCALES)[number];

type CategoryNode = {
  id: string;
  path: string;
  level: 'main' | 'sub' | 'subsub';
  name: string;
  missingLocales: Locale[];
};

type HealthCounters = {
  main: number;
  sub: number;
  subsub: number;
  total: number;
  complete: number;
  incomplete: number;
};

function readString(value: unknown): string {
  return String(value || '').trim();
}

function findMissingLocales(translations: any): Locale[] {
  return REQUIRED_LOCALES.filter((locale) => {
    const value = readString(translations?.[locale]?.name);
    return value.length === 0;
  });
}

function parseLimit(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

/**
 * GET /api/admin/categories/translations-health
 *
 * Query params:
 * - includeComplete=true|false (default false)
 * - sampleLimit=number (default 100)
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const includeComplete = searchParams.get('includeComplete') === 'true';
    const sampleLimit = parseLimit(searchParams.get('sampleLimit'), 100);

    const counters: HealthCounters = {
      main: 0,
      sub: 0,
      subsub: 0,
      total: 0,
      complete: 0,
      incomplete: 0,
    };

    const missingByLocale: Record<Locale, number> = {
      pl: 0,
      en: 0,
      de: 0,
      fr: 0,
      es: 0,
      uk: 0,
    };

    const samples: CategoryNode[] = [];

    const mainSnap = await adminDb.collection('categories').get();

    for (const mainDoc of mainSnap.docs) {
      const mainData = mainDoc.data() as any;
      const mainName = readString(mainData?.name || mainDoc.id);
      const mainMissing = findMissingLocales(mainData?.translations);

      counters.main += 1;
      counters.total += 1;
      if (mainMissing.length === 0) {
        counters.complete += 1;
      } else {
        counters.incomplete += 1;
        mainMissing.forEach((locale) => {
          missingByLocale[locale] += 1;
        });
      }

      if ((includeComplete || mainMissing.length > 0) && samples.length < sampleLimit) {
        samples.push({
          id: mainDoc.id,
          path: mainDoc.id,
          level: 'main',
          name: mainName,
          missingLocales: mainMissing,
        });
      }

      const subSnap = await mainDoc.ref.collection('subcategories').get();
      for (const subDoc of subSnap.docs) {
        const subData = subDoc.data() as any;
        const subName = readString(subData?.name || subDoc.id);
        const subMissing = findMissingLocales(subData?.translations);

        counters.sub += 1;
        counters.total += 1;
        if (subMissing.length === 0) {
          counters.complete += 1;
        } else {
          counters.incomplete += 1;
          subMissing.forEach((locale) => {
            missingByLocale[locale] += 1;
          });
        }

        if ((includeComplete || subMissing.length > 0) && samples.length < sampleLimit) {
          samples.push({
            id: subDoc.id,
            path: `${mainDoc.id}/${subDoc.id}`,
            level: 'sub',
            name: subName,
            missingLocales: subMissing,
          });
        }

        const subSubSnap = await subDoc.ref.collection('subcategories').get();
        for (const subSubDoc of subSubSnap.docs) {
          const subSubData = subSubDoc.data() as any;
          const subSubName = readString(subSubData?.name || subSubDoc.id);
          const subSubMissing = findMissingLocales(subSubData?.translations);

          counters.subsub += 1;
          counters.total += 1;
          if (subSubMissing.length === 0) {
            counters.complete += 1;
          } else {
            counters.incomplete += 1;
            subSubMissing.forEach((locale) => {
              missingByLocale[locale] += 1;
            });
          }

          if ((includeComplete || subSubMissing.length > 0) && samples.length < sampleLimit) {
            samples.push({
              id: subSubDoc.id,
              path: `${mainDoc.id}/${subDoc.id}/${subSubDoc.id}`,
              level: 'subsub',
              name: subSubName,
              missingLocales: subSubMissing,
            });
          }
        }
      }
    }

    const completionRate = counters.total > 0
      ? Number(((counters.complete / counters.total) * 100).toFixed(2))
      : 0;

    return NextResponse.json({
      success: true,
      requiredLocales: REQUIRED_LOCALES,
      counters,
      completionRate,
      missingByLocale,
      sampledNodes: samples,
      sampledCount: samples.length,
      includeComplete,
      sampleLimit,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const message = String(error?.message || 'Unknown error');
    const status = message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('forbidden')
      ? 403
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
