import { adminDb } from '@/lib/firebase-admin';

export type SocialNiche = 'general' | 'baby' | 'fishing' | 'all';

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

export interface DealCandidate {
  id?: string;
  title?: string | { pl?: string; en?: string };
  url?: string;
  dealUrl?: string;
  link?: string;
  affiliateLink?: string;
  rawLink?: string;
  category?: string;
  mainCategorySlug?: string;
  temperature?: number;
}

export interface RecentlyPostedDealsInfo {
  niche: SocialNiche;
  postedDealIds: Set<string>;
  postedTitles: Set<string>;
  postedUrls: Set<string>;
  dealPostTimestamps: Map<string, number>;
  dealPostCount24h: Map<string, number>;
  titlePostCount24h: Map<string, number>;
  urlPostCount24h: Map<string, number>;
  recentQueueDealIds: string[];
  recentQueueTitles: string[];
  recentQueueUrls: string[];
}

export interface CanPublishResult {
  allowed: boolean;
  reason?: string;
  postCount24h: number;
  isConsecutive: boolean;
  hoursSinceLastPost: number | null;
}

interface NormalizedQueueDoc {
  dealId?: string;
  normTitle?: string;
  normUrl?: string;
  createdAt: number;
  status: string;
}

/**
 * Pobiera zbiory ID, znormalizowanych tytułów i linków ofert opublikowanych/zaplanowanych w ostatnim okresie.
 * Obsługuje wszystkie nisze: general, baby, fishing lub all.
 * Dokonuje dokładnej analizy:
 * 1. Ostatnich 14 dni (dla unikania powtórek w długim terminie)
 * 2. Ostatnich 24 godzin (dla twardego limitu max 2 posty dziennie na ofertę)
 * 3. Ostatnich N postów w kolejce (dla bezwzględnego zakazu postów pod rząd)
 */
export async function getRecentlyPostedDealIdentifiers(options?: {
  niche?: SocialNiche;
  days?: number;
  maxItemsPerColl?: number;
  excludePostId?: string;
  excludePostIds?: string[];
}): Promise<RecentlyPostedDealsInfo> {
  const niche: SocialNiche = options?.niche ?? 'all';
  const days = options?.days ?? 14;
  const maxItems = options?.maxItemsPerColl ?? 300;
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const excludedDocIds = new Set<string>();
  if (options?.excludePostId) excludedDocIds.add(options.excludePostId);
  if (options?.excludePostIds) options.excludePostIds.forEach(id => excludedDocIds.add(id));

  const postedDealIds = new Set<string>();
  const postedTitles = new Set<string>();
  const postedUrls = new Set<string>();
  const dealPostTimestamps = new Map<string, number>();
  const dealPostCount24h = new Map<string, number>();
  const titlePostCount24h = new Map<string, number>();
  const urlPostCount24h = new Map<string, number>();

  let collectionsToQuery: string[] = [];
  if (niche === 'general') {
    collectionsToQuery = ['generalPostQueue', 'socialPosts'];
  } else if (niche === 'baby') {
    collectionsToQuery = ['babyPostQueue'];
  } else if (niche === 'fishing') {
    collectionsToQuery = ['fishingPostsQueue'];
  } else {
    collectionsToQuery = ['generalPostQueue', 'socialPosts', 'babyPostQueue', 'fishingPostsQueue'];
  }

  const rawDocs: NormalizedQueueDoc[] = [];

  try {
    const snaps = await Promise.all(
      collectionsToQuery.map((coll) =>
        adminDb.collection(coll).orderBy('createdAt', 'desc').limit(maxItems).get()
      )
    );

    snaps.forEach((snap, idx) => {
      const collName = collectionsToQuery[idx];
      snap.docs.forEach((doc) => {
        if (excludedDocIds.has(doc.id)) return;
        const data = doc.data();
        const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
        if (createdAt && createdAt < cutoffTime) return;
        if (data.status === 'failed' || data.status === 'rejected') return;

        let dealId: string | undefined = undefined;
        let rawTitle: any = undefined;
        let rawUrl: string | undefined = undefined;

        if (collName === 'socialPosts') {
          dealId = data.itemId || data.dealId;
          rawTitle = data.itemData?.title || data.title;
          rawUrl = data.itemData?.url || data.content?.linkUrl || data.linkUrl;
        } else {
          // generalPostQueue, babyPostQueue, fishingPostsQueue
          dealId = data.dealId;
          rawTitle = data.title;
          rawUrl = data.linkUrl;
        }

        const normTitle = rawTitle ? normalizeDealTitle(rawTitle) : undefined;
        const normUrl = rawUrl ? normalizeDealUrl(rawUrl) : undefined;

        rawDocs.push({
          dealId: dealId || undefined,
          normTitle: normTitle || undefined,
          normUrl: normUrl || undefined,
          createdAt: createdAt || Date.now(),
          status: data.status || 'pending',
        });
      });
    });
  } catch (err) {
    console.warn('[getRecentlyPostedDealIdentifiers] Error fetching posted deals history:', err);
  }

  // Posortuj wszystkie pobrane wpisy od najnowszego do najstarszego
  rawDocs.sort((a, b) => b.createdAt - a.createdAt);

  // Zbuduj ordered recent queue lists dla wykrywania postów pod rząd
  const recentQueueDealIds: string[] = [];
  const recentQueueTitles: string[] = [];
  const recentQueueUrls: string[] = [];

  for (const doc of rawDocs.slice(0, 20)) {
    if (doc.dealId) recentQueueDealIds.push(doc.dealId);
    if (doc.normTitle) recentQueueTitles.push(doc.normTitle);
    if (doc.normUrl) recentQueueUrls.push(doc.normUrl);
  }

  // Wypełnij zbiory, czasy i liczniki 24h
  for (const doc of rawDocs) {
    const isWithin24h = doc.createdAt >= cutoff24h;

    if (doc.dealId) {
      postedDealIds.add(doc.dealId);
      const prevTime = dealPostTimestamps.get(doc.dealId) || 0;
      if (doc.createdAt > prevTime) {
        dealPostTimestamps.set(doc.dealId, doc.createdAt);
      }
      if (isWithin24h) {
        dealPostCount24h.set(doc.dealId, (dealPostCount24h.get(doc.dealId) || 0) + 1);
      }
    }

    if (doc.normTitle) {
      postedTitles.add(doc.normTitle);
      if (isWithin24h) {
        titlePostCount24h.set(doc.normTitle, (titlePostCount24h.get(doc.normTitle) || 0) + 1);
      }
    }

    if (doc.normUrl) {
      postedUrls.add(doc.normUrl);
      if (isWithin24h) {
        urlPostCount24h.set(doc.normUrl, (urlPostCount24h.get(doc.normUrl) || 0) + 1);
      }
    }
  }

  return {
    niche,
    postedDealIds,
    postedTitles,
    postedUrls,
    dealPostTimestamps,
    dealPostCount24h,
    titlePostCount24h,
    urlPostCount24h,
    recentQueueDealIds,
    recentQueueTitles,
    recentQueueUrls,
  };
}

/**
 * Sprawdza, czy dana oferta MOŻE zostać opublikowana zgodnie ze ścisłymi regułami:
 * 1. Maksymalnie 2 publikacje w ciągu 24 godzin (maxDailyPosts: 2).
 * 2. Zakaz publikacji tej samej oferty pod rząd (minConsecutiveGap: 3).
 * 3. Minimalny odstęp czasowy między publikacjami tej samej oferty (minHoursBetweenSameDeal: 4h).
 */
export function canPublishDeal(
  deal: DealCandidate,
  postedInfo: RecentlyPostedDealsInfo,
  options?: {
    maxDailyPosts?: number;
    minConsecutiveGap?: number;
    minHoursBetweenSameDeal?: number;
  }
): CanPublishResult {
  const maxDailyPosts = options?.maxDailyPosts ?? 2;
  const minConsecutiveGap = options?.minConsecutiveGap ?? 3;
  const minHoursBetweenSameDeal = options?.minHoursBetweenSameDeal ?? 4;

  const dealId = deal.id;
  const normTitle = normalizeDealTitle(deal.title);
  const rawUrl = deal.dealUrl || deal.affiliateLink || deal.link || deal.rawLink || deal.url;
  const normUrl = normalizeDealUrl(rawUrl);

  // 1. Oblicz liczbę publikacji w ciągu ostatnich 24h
  const idCount = dealId ? (postedInfo.dealPostCount24h.get(dealId) || 0) : 0;
  const titleCount = normTitle ? (postedInfo.titlePostCount24h.get(normTitle) || 0) : 0;
  const urlCount = normUrl ? (postedInfo.urlPostCount24h.get(normUrl) || 0) : 0;
  const postCount24h = Math.max(idCount, titleCount, urlCount);

  // 2. Sprawdź czy oferta była w ostatnich minConsecutiveGap postach kolejki (pod rząd)
  const recentSliceIds = postedInfo.recentQueueDealIds.slice(0, minConsecutiveGap);
  const recentSliceTitles = postedInfo.recentQueueTitles.slice(0, minConsecutiveGap);
  const recentSliceUrls = postedInfo.recentQueueUrls.slice(0, minConsecutiveGap);

  const isConsecutiveById = Boolean(dealId && recentSliceIds.includes(dealId));
  const isConsecutiveByTitle = Boolean(normTitle && recentSliceTitles.includes(normTitle));
  const isConsecutiveByUrl = Boolean(normUrl && recentSliceUrls.includes(normUrl));
  const isConsecutive = isConsecutiveById || isConsecutiveByTitle || isConsecutiveByUrl;

  // 3. Sprawdź czas od ostatniej publikacji
  const lastTimestamp = dealId ? postedInfo.dealPostTimestamps.get(dealId) : undefined;
  let hoursSinceLastPost: number | null = null;
  if (lastTimestamp) {
    hoursSinceLastPost = (Date.now() - lastTimestamp) / (1000 * 60 * 60);
  }

  // WERYFIKACJA REGUŁY 1: Zakaz więcej niż 2 razy dziennie
  if (postCount24h >= maxDailyPosts) {
    return {
      allowed: false,
      reason: `Osiągnięto dzienny limit (${postCount24h}/${maxDailyPosts} publikacji w ostatnich 24h)`,
      postCount24h,
      isConsecutive,
      hoursSinceLastPost,
    };
  }

  // WERYFIKACJA REGUŁY 2: Zakaz pod rząd (ostatnie 3 posty)
  if (isConsecutive) {
    return {
      allowed: false,
      reason: `Zakaz publikacji tej samej oferty pod rząd (znaleziona w ostatnich ${minConsecutiveGap} postach)`,
      postCount24h,
      isConsecutive,
      hoursSinceLastPost,
    };
  }

  // WERYFIKACJA REGUŁY 3: Minimalny odstęp między tą samą ofertą (min. 4 godziny)
  if (hoursSinceLastPost !== null && hoursSinceLastPost < minHoursBetweenSameDeal) {
    return {
      allowed: false,
      reason: `Zbyt krótki odstęp od poprzedniej publikacji tej oferty (${hoursSinceLastPost.toFixed(1)}h < ${minHoursBetweenSameDeal}h)`,
      postCount24h,
      isConsecutive,
      hoursSinceLastPost,
    };
  }

  return {
    allowed: true,
    postCount24h,
    isConsecutive: false,
    hoursSinceLastPost,
  };
}

/**
 * Wybiera najlepszą kwalifikującą się ofertę z puli kandydatów.
 * Jeśli ŻADNA oferta nie spełnia warunków (np. wszystkie były publikowane 2 razy w 24h lub pod rząd):
 * ZWRACA NULL — NIGDY nie fallbackuje do deals[0]!
 */
export function selectBestEligibleDeal<T extends DealCandidate>(
  candidateDeals: T[],
  postedInfo: RecentlyPostedDealsInfo,
  options?: {
    maxDailyPosts?: number;
    minConsecutiveGap?: number;
    minHoursBetweenSameDeal?: number;
    excludeDealIds?: string[];
  }
): { deal: T | null; reason?: string; skippedCount: number } {
  const excludedIds = new Set<string>(options?.excludeDealIds || []);
  let skippedCount = 0;

  const validCandidates: { deal: T; postCount24h: number; hoursSince: number | null }[] = [];

  for (const candidate of candidateDeals) {
    if (candidate.id && excludedIds.has(candidate.id)) {
      skippedCount++;
      continue;
    }

    const check = canPublishDeal(candidate, postedInfo, options);
    if (!check.allowed) {
      skippedCount++;
      continue;
    }

    validCandidates.push({
      deal: candidate,
      postCount24h: check.postCount24h,
      hoursSince: check.hoursSinceLastPost,
    });
  }

  if (validCandidates.length === 0) {
    return {
      deal: null,
      reason: `Wszystkie ${candidateDeals.length} ofert zostały odrzucone przez filtr duplikatów (limit 2x/24h, zakaz pod rząd lub min. 4h odstępu).`,
      skippedCount,
    };
  }

  // Priorytetyzacja:
  // 1. Oferty, które w ogóle nie były publikowane w ostatnich 14 dniach (najświeższe!)
  const neverPosted = validCandidates.filter((c) => {
    const id = c.deal.id;
    const normTitle = normalizeDealTitle(c.deal.title);
    return (
      c.postCount24h === 0 &&
      (!id || !postedInfo.postedDealIds.has(id)) &&
      (!normTitle || !postedInfo.postedTitles.has(normTitle))
    );
  });

  if (neverPosted.length > 0) {
    return {
      deal: neverPosted[0].deal,
      skippedCount,
    };
  }

  // 2. Jeśli wszystkie oferty były już kiedyś publikowane, wybierz tę, która była publikowana NAJDAWNIEJ
  // (najdłuższy czas od ostatniej publikacji i mniej niż 2 razy w ciągu 24h)
  const sortedByAge = [...validCandidates].sort((a, b) => {
    const ageA = a.hoursSince !== null ? a.hoursSince : 9999;
    const ageB = b.hoursSince !== null ? b.hoursSince : 9999;
    return ageB - ageA; // im większa liczba godzin temu, tym lepiej!
  });

  return {
    deal: sortedByAge[0].deal,
    skippedCount,
  };
}

/**
 * Sprawdza czy dany produkt/okazja został już opublikowany w ostatnim okresie.
 * Zachowane dla kompatybilności wstecznej — zwraca true, jeśli oferta NIE może zostać opublikowana.
 */
export function isDealRecentlyPosted(
  deal: DealCandidate,
  postedInfo: RecentlyPostedDealsInfo
): boolean {
  return !canPublishDeal(deal, postedInfo).allowed;
}

export { cleanPromptMetaHeaders, isValidSocialPost } from './social-growth-types';
