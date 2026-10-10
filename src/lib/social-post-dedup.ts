import { adminDb } from '@/lib/firebase-admin';

/**
 * Normalizuje tytuł okazji w celu wyłapywania duplikatów (nawet z różnymi ID lub lekko zmienionym tytułem).
 */
export function normalizeDealTitle(title: string | { pl?: string; en?: string } | undefined | null): string {
  if (!title) return '';
  let str = '';
  if (typeof title === 'string') {
    str = title;
  } else if (typeof title === 'object' && title !== null) {
    str = title.pl || title.en || Object.values(title)[0] || '';
  }
  return str
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]/gi, '')
    .slice(0, 45);
}

/**
 * Normalizuje URL oferty lub afiliacyjny w celu porównania.
 */
export function normalizeDealUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    // Wyciągnij kluczowe ID z typowych linków (AliExpress itemId, czy link bazowy bez parametrów sub/utm)
    const aliMatch = parsed.href.match(/(\d{10,20})\.html/);
    if (aliMatch) return `ali_${aliMatch[1]}`;
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.split('?')[0].toLowerCase();
  }
}

export interface RecentlyPostedDealsInfo {
  postedDealIds: Set<string>;
  postedTitles: Set<string>;
  postedUrls: Set<string>;
  dealPostTimestamps: Map<string, number>;
}

/**
 * Pobiera zbiory ID, znormalizowanych tytułów i linków ofert opublikowanych w ciągu ostatnich `days` dni.
 * Przeszukuje ZARÓWNO kolekcję `socialPosts` (social-ai-bots), jak i `generalPostQueue` (general-autopilot / kalendarz).
 * Używa poprawnego sortowania `orderBy('createdAt', 'desc')`, dzięki czemu pobiera NAJNOWSZE posty.
 */
export async function getRecentlyPostedDealIdentifiers(options?: {
  days?: number;
  maxItemsPerColl?: number;
}): Promise<RecentlyPostedDealsInfo> {
  const days = options?.days ?? 14;
  const maxItems = options?.maxItemsPerColl ?? 300;
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffTime).toISOString();

  const postedDealIds = new Set<string>();
  const postedTitles = new Set<string>();
  const postedUrls = new Set<string>();
  const dealPostTimestamps = new Map<string, number>();

  try {
    const [socialSnap, generalSnap] = await Promise.all([
      adminDb
        .collection('socialPosts')
        .orderBy('createdAt', 'desc')
        .limit(maxItems)
        .get(),
      adminDb
        .collection('generalPostQueue')
        .orderBy('createdAt', 'desc')
        .limit(maxItems)
        .get(),
    ]);

    // 1. Analiza socialPosts
    socialSnap.docs.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
      if (createdAt && createdAt < cutoffTime) return;
      if (data.status === 'failed' || data.status === 'rejected') return;

      const dealId = data.itemId || data.dealId;
      if (dealId) {
        postedDealIds.add(dealId);
        if (createdAt) {
          const prev = dealPostTimestamps.get(dealId) || 0;
          if (createdAt > prev) dealPostTimestamps.set(dealId, createdAt);
        }
      }

      const rawTitle = data.itemData?.title || data.title;
      if (rawTitle) {
        const normTitle = normalizeDealTitle(rawTitle);
        if (normTitle) postedTitles.add(normTitle);
      }

      const rawUrl = data.itemData?.url || data.content?.linkUrl || data.linkUrl;
      if (rawUrl) {
        const normUrl = normalizeDealUrl(rawUrl);
        if (normUrl) postedUrls.add(normUrl);
      }
    });

    // 2. Analiza generalPostQueue
    generalSnap.docs.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
      if (createdAt && createdAt < cutoffTime) return;
      if (data.status === 'failed' || data.status === 'rejected') return;

      const dealId = data.dealId;
      if (dealId) {
        postedDealIds.add(dealId);
        if (createdAt) {
          const prev = dealPostTimestamps.get(dealId) || 0;
          if (createdAt > prev) dealPostTimestamps.set(dealId, createdAt);
        }
      }

      const rawTitle = data.title;
      if (rawTitle) {
        const normTitle = normalizeDealTitle(rawTitle);
        if (normTitle) postedTitles.add(normTitle);
      }

      const rawUrl = data.linkUrl;
      if (rawUrl) {
        const normUrl = normalizeDealUrl(rawUrl);
        if (normUrl) postedUrls.add(normUrl);
      }
    });
  } catch (err) {
    console.warn('[getRecentlyPostedDealIdentifiers] Error fetching posted deals history:', err);
  }

  return {
    postedDealIds,
    postedTitles,
    postedUrls,
    dealPostTimestamps,
  };
}

/**
 * Sprawdza czy dany produkt/okazja został już opublikowany w ostatnim okresie.
 */
export function isDealRecentlyPosted(
  deal: {
    id?: string;
    title?: string | { pl?: string; en?: string };
    url?: string;
    dealUrl?: string;
    link?: string;
    affiliateLink?: string;
  },
  postedInfo: RecentlyPostedDealsInfo
): boolean {
  if (deal.id && postedInfo.postedDealIds.has(deal.id)) {
    return true;
  }

  const normTitle = normalizeDealTitle(deal.title);
  if (normTitle && postedInfo.postedTitles.has(normTitle)) {
    return true;
  }

  const rawUrl = deal.dealUrl || deal.affiliateLink || deal.link || deal.url;
  if (rawUrl) {
    const normUrl = normalizeDealUrl(rawUrl);
    if (normUrl && postedInfo.postedUrls.has(normUrl)) {
      return true;
    }
  }

  return false;
}

export { cleanPromptMetaHeaders, isValidSocialPost } from './social-growth-types';
