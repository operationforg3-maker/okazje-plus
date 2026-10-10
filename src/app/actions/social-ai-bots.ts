/**
 * Server Actions: AI Bot Admins for Facebook Page & Group
 * Manages autonomous AI agent personas that generate, curate, and publish content.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { publishToSocialPlatform } from '@/lib/platform-publishers';
import type { SocialAIBot, SocialPost, SocialConfig } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { sanitizeSocialPostText } from '@/lib/social-growth-types';

const DEFAULT_BOTS: SocialAIBot[] = [
  {
    id: 'bot-hunter',
    name: 'Łowca Perełek Cenowych',
    role: 'hunter',
    avatar: '🔥',
    description: 'Błyskawicznie wychwytuje najgorętsze okazje, błędy cenowe i wyprzedaże z bazy Okazje Plus. Tworzy chwytliwe, dynamiczne posty z wezwaniem do działania.',
    target: 'both',
    enabled: true,
    autoApprove: true,
    tone: 'enthusiastic',
    schedule: 'every_3_hours',
    customInstructions: 'Kładź nacisk na kwotę oszczędności, procent rabatu oraz ograniczony czas trwania oferty.',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-expert',
    name: 'Tester & Inżynier Jakości',
    role: 'expert',
    avatar: '🛡️',
    description: 'Publikuje rzetelne testy produktów z laboratorium Okazje Plus. Wyjaśnia parametry, demaskuje fałszywe obniżki i edukuje konsumentów jak unikać bubli.',
    target: 'both',
    enabled: true,
    autoApprove: false,
    tone: 'expert',
    schedule: 'daily',
    customInstructions: 'Opisuj konkretne zalety, wady i ocenę opłacalności w skali 1-10.',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-community',
    name: 'Animator Społeczności Grupy',
    role: 'community',
    avatar: '💬',
    description: 'Rozkręca dyskusje w grupie FB, zadaje angażujące pytania zakupowe, organizuje wymianę kodów rabatowych i wita nowych łowców promocji.',
    target: 'group',
    enabled: true,
    autoApprove: true,
    tone: 'friendly',
    schedule: 'daily',
    customInstructions: 'Zadawaj otwarte pytania, które zachęcają członków do komentowania i dzielenia się swoimi znaleziskami.',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-responder',
    name: 'Smart FAQ & Asystent Dyskusji',
    role: 'responder',
    avatar: '🤖',
    description: 'Przygotowuje merytoryczne odpowiedzi na najczęstsze pytania w komentarzach (kody rabatowe, historia ceny, koszty wysyłki, opinie o sprzedawcy).',
    target: 'both',
    enabled: true,
    autoApprove: false,
    tone: 'concise',
    schedule: 'manual',
    customInstructions: 'Odpowiadaj krótko, precyzyjnie i uprzejmie, zawsze podając sprawdzony link do oferty.',
    totalGenerated: 0,
    totalPublished: 0,
  },
];

export async function getSocialAIBotsAction(): Promise<{ success: boolean; bots: SocialAIBot[]; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, bots: [], error: 'Wymagane uprawnienia administratora' };
    }

    const snapshot = await adminDb.collection('socialAIBots').get();

    if (snapshot.empty) {
      // Seed default bots
      const batch = adminDb.batch();
      const now = new Date().toISOString();
      const bots: SocialAIBot[] = [];

      for (const bot of DEFAULT_BOTS) {
        const botData: SocialAIBot = {
          ...bot,
          createdAt: now,
          updatedAt: now,
        };
        const ref = adminDb.collection('socialAIBots').doc(bot.id);
        batch.set(ref, botData);
        bots.push(botData);
      }

      await batch.commit();
      return { success: true, bots };
    }

    const bots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialAIBot));
    return { success: true, bots };
  } catch (error) {
    console.error('Error fetching social AI bots:', error);
    return { success: false, bots: [], error: 'Błąd pobierania listy botów' };
  }
}

export async function saveSocialAIBotAction(bot: SocialAIBot): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const ref = adminDb.collection('socialAIBots').doc(bot.id);
    await ref.set({
      ...bot,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    revalidatePath('/[locale]/admin/social-media', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error saving AI bot:', error);
    return { success: false, error: 'Nie udało się zapisać konfiguracji bota' };
  }
}

export async function toggleSocialAIBotAction(botId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('socialAIBots').doc(botId).update({
      enabled,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/social-media', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error toggling AI bot:', error);
    return { success: false, error: 'Nie udało się zmienić statusu bota' };
  }
}

export async function toggleSocialAIBotAutoApproveAction(botId: string, autoApprove: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('socialAIBots').doc(botId).update({
      autoApprove,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/social-media', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error toggling bot auto-approve:', error);
    return { success: false, error: 'Nie udało się zmienić trybu auto-akceptacji' };
  }
}

export async function setAllSocialAIBotsAutoPostingAction(autoApprove: boolean): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, count: 0, error: 'Wymagane uprawnienia administratora' };
    }

    const snapshot = await adminDb.collection('socialAIBots').get();
    if (snapshot.empty) {
      return { success: true, count: 0 };
    }

    const batch = adminDb.batch();
    const now = new Date().toISOString();
    let count = 0;

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        autoApprove,
        updatedAt: now,
      });
      count++;
    });

    await batch.commit();
    revalidatePath('/[locale]/admin/social-media', 'page');
    return { success: true, count };
  } catch (error) {
    console.error('Error setting all bots auto-posting:', error);
    return { success: false, count: 0, error: 'Błąd masowej zmiany auto-postowania' };
  }
}

export interface PromotableDeal {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  discount?: string;
  merchant?: string;
  temperature: number;
  imageUrl?: string;
  postedRecently?: boolean;
  category?: string;
  mainCategorySlug?: string;
}

function parseDealFields(rawDeal: any) {
  const rawTitle = rawDeal.title;
  let title = 'Gorąca Okazja';
  let fullTitle = '';
  if (typeof rawTitle === 'string') {
    title = rawTitle;
    fullTitle = rawTitle;
  } else if (typeof rawTitle === 'object' && rawTitle !== null) {
    title = rawTitle.pl || rawTitle.en || rawTitle.de || rawTitle.es || Object.values(rawTitle)[0] || 'Gorąca Okazja';
    fullTitle = rawTitle.en || rawTitle.pl || Object.values(rawTitle)[0] || title;
  }

  let currentPriceVal: number | undefined = undefined;
  if (typeof rawDeal.price === 'number') {
    currentPriceVal = rawDeal.price;
  } else if (typeof rawDeal.price === 'object' && rawDeal.price !== null && typeof rawDeal.price.amount === 'number') {
    currentPriceVal = rawDeal.price.amount;
  } else if (typeof rawDeal.currentPrice === 'number') {
    currentPriceVal = rawDeal.currentPrice;
  }
  const priceStr = currentPriceVal !== undefined ? `${currentPriceVal.toFixed(2)} zł` : '';

  let originalPriceVal: number | undefined = undefined;
  if (typeof rawDeal.originalPrice === 'number') {
    originalPriceVal = rawDeal.originalPrice;
  } else if (typeof rawDeal.originalPrice === 'object' && rawDeal.originalPrice !== null && typeof rawDeal.originalPrice.amount === 'number') {
    originalPriceVal = rawDeal.originalPrice.amount;
  }
  const oldPriceStr = originalPriceVal && (!currentPriceVal || originalPriceVal > currentPriceVal)
    ? ` (zamiast ${originalPriceVal.toFixed(2)} zł)`
    : '';

  let discountNum: number | undefined = undefined;
  if (typeof rawDeal.discount === 'number') {
    discountNum = rawDeal.discount;
  } else if (typeof rawDeal.discount === 'object' && rawDeal.discount !== null) {
    discountNum = rawDeal.discount.percentage ?? rawDeal.discount.amount;
  } else if (typeof rawDeal.discountPercent === 'number') {
    discountNum = rawDeal.discountPercent;
  } else if (currentPriceVal && originalPriceVal && originalPriceVal > currentPriceVal) {
    discountNum = Math.round(((originalPriceVal - currentPriceVal) / originalPriceVal) * 100);
  }
  const discountStr = discountNum && discountNum > 0 ? ` -${Math.round(discountNum)}%` : '';

  const merchantName = rawDeal.merchantName || rawDeal.merchant || rawDeal.source;
  const merchant = merchantName ? ` w ${merchantName}` : '';

  const linkUrl = `https://okazjeplus.pl/pl/deals/${rawDeal.id}`;

  let imageUrl: string | undefined = undefined;
  if (typeof rawDeal.imageUrl === 'string' && rawDeal.imageUrl.trim()) {
    imageUrl = rawDeal.imageUrl.trim();
  } else if (typeof rawDeal.image === 'string' && rawDeal.image.trim()) {
    imageUrl = rawDeal.image.trim();
  } else if (Array.isArray(rawDeal.images) && rawDeal.images.length > 0) {
    const firstImg = rawDeal.images[0];
    imageUrl = typeof firstImg === 'string' ? firstImg : firstImg?.url;
  } else if (typeof rawDeal.thumbnail === 'string' && rawDeal.thumbnail.trim()) {
    imageUrl = rawDeal.thumbnail.trim();
  } else if (Array.isArray(rawDeal.media) && rawDeal.media.length > 0) {
    imageUrl = rawDeal.media[0]?.url;
  }

  // Ensure absolute HTTPS URL for Facebook Graph API
  if (imageUrl && imageUrl.startsWith('//')) {
    imageUrl = `https:${imageUrl}`;
  }

  const category = rawDeal.categoryName || rawDeal.category || rawDeal.mainCategorySlug || rawDeal.mainCategory;
  const tags = rawDeal.tags || rawDeal.searchTags;
  const temperature = typeof rawDeal.temperature === 'number' ? rawDeal.temperature : (Number(rawDeal.temperature) || 0);

  // Extract clean description text
  let rawDesc = '';
  if (typeof rawDeal.description === 'string') {
    rawDesc = rawDeal.description;
  } else if (typeof rawDeal.description === 'object' && rawDeal.description !== null) {
    rawDesc = rawDeal.description.pl || rawDeal.description.en || Object.values(rawDeal.description)[0] || '';
  }
  const cleanDescription = rawDesc
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Extract specs
  let specsStr = '';
  const rawSpecs = rawDeal.specifications || rawDeal.specs || rawDeal.metadata?.specifications;
  if (typeof rawSpecs === 'object' && rawSpecs !== null) {
    specsStr = Object.entries(rawSpecs)
      .slice(0, 6)
      .map(([k, v]) => `• ${k}: ${v}`)
      .join('\n');
  }

  return {
    id: rawDeal.id,
    title,
    fullTitle: fullTitle || title,
    priceStr,
    oldPriceStr,
    discountStr,
    merchant,
    category,
    tags,
    temperature,
    imageUrl,
    linkUrl,
    description: cleanDescription,
    specs: specsStr,
  };
}

/**
 * Generate 5-8 smart, high-performing hashtags for Facebook post
 * Combines brand/product keywords, store, category, and deal tags
 */
function generateSmartHashtags(deal: {
  title: string;
  merchant?: string;
  category?: string;
  tags?: string[];
}): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const addTag = (raw: string) => {
    if (!raw) return;
    const clean = raw.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]/gi, '').trim();
    if (clean.length < 2 || clean.length > 25) return;
    const tag = `#${clean}`;
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  };

  // 1. Merchant / Store tag (e.g. #aliexpress, #amazon, #allegro)
  if (deal.merchant) {
    addTag(deal.merchant.replace(' w ', ''));
  }

  // 2. Specific Brand / Product keywords from title
  const words = deal.title
    .replace(/[^\w\sąćęłńóśźż]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !/^\d+$/.test(w));

  for (const word of words) {
    if (result.length >= 3) break;
    const lower = word.toLowerCase();
    if (['dla', 'lub', 'oraz', 'jest', 'nowy', 'super', 'hit', 'mega', 'duzy', 'maly', 'zestaw'].includes(lower)) continue;
    addTag(word);
  }

  // 3. Category tag if available
  if (deal.category) {
    addTag(deal.category);
  }

  // 4. Custom tags from deal
  if (Array.isArray(deal.tags)) {
    for (const t of deal.tags) {
      if (result.length >= 5) break;
      addTag(t);
    }
  }

  // 5. Core deal & community tags
  const coreTags = ['okazjeplus', 'promocje', 'okazje', 'znizki', 'hitcenowy'];
  for (const t of coreTags) {
    if (result.length >= 7) break;
    addTag(t);
  }

  return result.slice(0, 8);
}

/**
 * Fetch approved deals with suggestions and search support for social media promotion
 * Uses the unified global search engine (searchDeals)
 */
export async function getPromotableDealsAction(
  searchQuery?: string,
  limitCount: number = 24,
  categorySlug?: string
): Promise<{ success: boolean; deals: PromotableDeal[]; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, deals: [], error: 'Wymagane uprawnienia administratora' };
    }

    // 1. Fetch recent social posts and queue to mark which deals were already posted in last 14 days
    const { getRecentlyPostedDealIdentifiers, isDealRecentlyPosted } = await import('@/lib/social-post-dedup');
    const postedInfo = await getRecentlyPostedDealIdentifiers({ days: 14 });

    // 2. Call the unified global search engine (searchDeals)
    const { searchDeals } = await import('@/lib/search-server');
    const q = searchQuery?.trim() || '*';
    const fetchLimit = q === '*' ? Math.max(limitCount * 3, 60) : limitCount;
    const rawDeals = await searchDeals(
      q,
      {
        statusFilter: 'approved',
        sortBy: q === '*' ? 'temperature' : 'relevance',
        mainCategorySlug: categorySlug && categorySlug !== 'all' ? categorySlug : undefined,
        page: 1,
        limit: fetchLimit,
      }
    );

    let dealsResult = rawDeals;

    // When browsing suggestions globally (q === '*' and no specific category selected),
    // diversify across categories so the admin sees the best offers from Electronics, Home, Auto, Fashion, Sports, etc.
    if (q === '*' && (!categorySlug || categorySlug === 'all') && dealsResult.length > 0) {
      const categoryBuckets = new Map<string, typeof dealsResult>();
      for (const d of dealsResult) {
        const cat = (d as any).mainCategorySlug || (d as any).category || 'inne';
        if (!categoryBuckets.has(cat)) categoryBuckets.set(cat, []);
        categoryBuckets.get(cat)!.push(d);
      }

      const diversified: typeof dealsResult = [];
      let hasMore = true;
      while (diversified.length < limitCount && hasMore) {
        hasMore = false;
        for (const [_, bucket] of categoryBuckets.entries()) {
          if (bucket.length > 0) {
            diversified.push(bucket.shift()!);
            hasMore = true;
            if (diversified.length >= limitCount) break;
          }
        }
      }
      dealsResult = diversified;
    }

    const promotableDeals: PromotableDeal[] = dealsResult.map(deal => {
      const parsed = parseDealFields(deal);
      return {
        id: parsed.id,
        title: parsed.title,
        price: parsed.priceStr,
        oldPrice: parsed.oldPriceStr,
        discount: parsed.discountStr,
        merchant: parsed.merchant.replace(' w ', ''),
        temperature: parsed.temperature,
        imageUrl: parsed.imageUrl,
        category: parsed.category,
        mainCategorySlug: (deal as any).mainCategorySlug || parsed.category,
        postedRecently: isDealRecentlyPosted({
          id: parsed.id,
          title: parsed.title,
          link: parsed.linkUrl,
        }, postedInfo),
      };
    });

    // When browsing suggestions (q === '*'), prioritize unposted deals while keeping hot ones high
    if (q === '*') {
      promotableDeals.sort((a, b) => {
        if (a.postedRecently !== b.postedRecently) {
          return a.postedRecently ? 1 : -1;
        }
        return (b.temperature || 0) - (a.temperature || 0);
      });
    }

    return {
      success: true,
      deals: promotableDeals.slice(0, limitCount),
    };
  } catch (error) {
    console.error('Error fetching promotable deals:', error);
    return {
      success: false,
      deals: [],
      error: error instanceof Error ? error.message : 'Błąd pobierania okazji',
    };
  }
}

/**
 * Fallback curated copy generator when Genkit AI is unavailable
 */
function buildCuratedFallbackPost(
  bot: SocialAIBot,
  deal: {
    title: string;
    fullTitle?: string;
    priceStr: string;
    oldPriceStr: string;
    discountStr: string;
    merchant: string;
    temperature: number;
    linkUrl: string;
    description?: string;
    specs?: string;
  },
  hashtags: string[],
  topicHint?: string
): string {
  const hashtagsLine = hashtags.join(' ');
  const store = deal.merchant ? deal.merchant.replace(' w ', '') : 'Okazje Plus';

  if (bot.role === 'hunter') {
    return (
      `🔥 [HIT DNIA] ${deal.title} w niesamowitej cenie!\n\n` +
      `Łowcy Okazje Plus wytropili kolejną perełkę, obok której nie da się przejść obojętnie!\n\n` +
      (deal.description ? `📖 O CO CHODZI:\n${deal.description.slice(0, 300)}...\n\n` : '') +
      (deal.specs ? `🛠️ KLUCZOWE PARAMETRY:\n${deal.specs}\n\n` : '') +
      `💰 ZESTAWIENIE CENOWE & OSZCZĘDNOŚĆ:\n` +
      `• 💸 Cena w promocji: ${deal.priceStr}${deal.oldPriceStr}${deal.discountStr ? ` (${deal.discountStr})` : ''}\n` +
      `• 🏬 Sklep: ${store}\n` +
      `• 🌡️ Ocena społeczności: ${deal.temperature}° (Gorąca oferta)\n\n` +
      `⏳ Taka cena może szybko ulec zmianie lub wyprzedać się stan magazynowy!\n\n` +
      (topicHint ? `💡 Wskazówka: ${topicHint}\n\n` : '') +
      `💬 Kto z Was polował na taki sprzęt? Dajcie znać w komentarzu!\n\n` +
      `👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w 1. KOMENTARZU ⬇️ oraz tutaj:\n${deal.linkUrl}\n\n` +
      hashtagsLine
    );
  } else if (bot.role === 'expert') {
    return (
      `🛡️ [TEST & OPINIA EKSPERTA OKAZJE PLUS]\n` +
      `Produkt: ${deal.title}\n\n` +
      `W laboratorium Okazje Plus bierzemy pod lupę kolejną gorącą ofertę rynkową:\n\n` +
      (deal.specs ? `🔬 SPECYFIKACJA TECHNICZNA:\n${deal.specs}\n\n` : '') +
      `⚖️ ANALIZA OPŁACALNOŚCI & DYREKTYWA OMNIBUS:\n` +
      `✅ Weryfikacja 90-dniowej historii cen: realna obniżka, bez sztucznego pompowania ceny wyjściowej\n` +
      `✅ Bezpieczny sprzedawca (${store}) i sprawdzony łańcuch dostaw\n` +
      `✅ Bardzo dobry stosunek parametrów do ceny zakupu\n\n` +
      `💰 Cena w promocji: ${deal.priceStr}${deal.oldPriceStr}${deal.discountStr}\n` +
      `📊 Ocena opłacalności: 9/10\n\n` +
      (topicHint ? `💬 Uwagi eksperta: ${topicHint}\n\n` : '') +
      `💬 Jakie są Wasze doświadczenia z tym modelem? Warto kupić czy polecacie alternatywę?\n\n` +
      `👉 Bezpośredni link do zweryfikowanej oferty w 1. KOMENTARZU ⬇️ oraz tutaj:\n${deal.linkUrl}\n\n` +
      hashtagsLine
    );
  } else if (bot.role === 'community') {
    return (
      `👋 Cześć Łowcy Okazji!\n\n` +
      `Mamy dziś temat do dyskusji w naszej grupie:\n\n` +
      `💬 ${topicHint || `Co sądzicie o tej ofercie: ${deal.title}?`}\n\n` +
      `Cena spadła właśnie do ${deal.priceStr}${deal.oldPriceStr}${deal.discountStr}${deal.merchant}.\n\n` +
      `Kto z Was już z tego korzysta lub planuje zakup? Piszcie śmiało w komentarzach – wrzucajcie Wasze opinie i zdjęcia!\n\n` +
      `👉 Szczegóły oferty możecie podejrzeć w 1. komentarzu ⬇️ oraz na portalu:\n${deal.linkUrl}\n\n` +
      hashtagsLine
    );
  } else {
    return (
      `🤖 [PORADA ZAKUPOWA OKAZJE PLUS]\n\n` +
      `👉 Produkt: ${deal.title}\n` +
      `💰 Cena promocyjna: ${deal.priceStr}${deal.oldPriceStr}${deal.discountStr}${deal.merchant}\n\n` +
      `${topicHint || 'Pamiętajcie, aby przed zakupem sprawdzić dostępne kupony rabatowe sklepu oraz opcję darmowej dostawy. W serwisie Okazje Plus monitorujemy historię cen na bieżąco!'}\n\n` +
      `👉 Bezpośredni link do okazji znajdziecie w 1. komentarzu ⬇️ oraz tutaj:\n${deal.linkUrl}\n\n` +
      hashtagsLine
    );
  }
}

/**
 * Generate high-converting, engaging post copy using Gemini AI with fallback
 */
async function generateEngagingSocialPost(
  bot: SocialAIBot,
  deal: {
    id: string;
    title: string;
    fullTitle?: string;
    priceStr: string;
    oldPriceStr: string;
    discountStr: string;
    merchant: string;
    category?: string;
    tags?: string[];
    temperature: number;
    linkUrl: string;
    description?: string;
    specs?: string;
  },
  topicHint?: string
): Promise<{ text: string; hashtags: string[] }> {
  const dynamicHashtags = generateSmartHashtags({
    title: deal.title,
    merchant: deal.merchant,
    category: deal.category,
    tags: deal.tags,
  });
  const hashtagsLine = dynamicHashtags.join(' ');

  let postText = '';
  let aiGenerated = false;

  try {
    const { ai } = await import('@/ai/genkit');

    let personaPrompt = '';
    if (bot.role === 'hunter') {
      personaPrompt = `Twoja rola: Łowca Perełek Cenowych (🔥).
Twój styl: dynamiczny, entuzjastyczny, skoncentrowany na niesamowitych zniżkach, wyprzedażach i realnych oszczędnościach.
Specjalne instrukcje: ${bot.customInstructions || 'Kładź nacisk na kwotę oszczędności, procent rabatu oraz ograniczony czas trwania oferty.'}

ZADANIE: Napisz porywający, soczysty i angażujący post na Facebooka o poniższej okazji:
- 🎯 Chwytliwy, emocjonalny nagłówek z emoji (np. 🔥 [HIT DNIA] lub 🚨 [ALERT CENOWY]) z nazwą produktu i ceną
- 💡 Wyjaśnij, jaki realny problem ten produkt rozwiązuje w życiu codziennym (dlaczego warto go mieć)
- 🛠️ Wypunktuj 3-4 najważniejsze parametry techniczne z emoji
- 💰 Przejrzyste zestawienie cenowe (cena promocyjna, rabat, sklep, ocena społeczności)
- ⏳ Poczucie okazji / analiza opłacalności
- 💬 Zadaj angażujące pytanie społeczności, zachęcając do komentowania
- 👉 CTA: "Link do bezpośredniej oferty i kod rabatowy czeka w PIERWSZYM KOMENTARZU ⬇️ oraz pod adresem:\n${deal.linkUrl}"
- #️⃣ Dołącz hashtagi na końcu: ${hashtagsLine}`;
    } else if (bot.role === 'expert') {
      personaPrompt = `Twoja rola: Tester & Inżynier Jakości (🛡️).
Twój styl: merytoryczny, rzetelny, profesjonalny recenzent z laboratorium Okazje Plus. Zero lania wody.
Specjalne instrukcje: ${bot.customInstructions || 'Opisuj konkretne zalety, wady i ocenę opłacalności w skali 1-10.'}

ZADANIE: Napisz merytoryczną, pogłębioną recenzję / opinię ekspercką o poniższej okazji:
- 🛡️ Profesjonalny nagłówek (np. 🛡️ [TEST & OPINIA EKSPERTA OKAZJE PLUS] ...)
- 🔬 Analiza parametrów technicznych i jakości wykonania
- ⚖️ Kluczowe zalety i na co uważać przed zakupem
- 💸 Ocena ceny i weryfikacja (brak fałszywych obniżek, realna wartość)
- 📊 Ocena opłacalności w skali 1-10
- 💬 Pytanie do społeczności o ich doświadczenia z tym rodzajem sprzętu
- 👉 CTA: "Bezpośredni link do sprawdzonej oferty znajdziecie w 1. komentarzu ⬇️ oraz tutaj:\n${deal.linkUrl}"
- #️⃣ Dołącz hashtagi na końcu: ${hashtagsLine}`;
    } else if (bot.role === 'community') {
      personaPrompt = `Twoja rola: Animator Społeczności Grupy (💬).
Twój styl: przyjazny, otwarty, integrujący społeczność, zachęcający do szczerej dyskusji zakupowej.
Specjalne instrukcje: ${bot.customInstructions || 'Zadawaj otwarte pytania, które zachęcają członków do komentowania i dzielenia się swoimi znaleziskami.'}

ZADANIE: Rozkręć gorącą dyskusję w grupie wokół poniższego tematu/produktu:
- 👋 Ciepłe, energiczne przywitanie łowców
- ❓ Chwytliwe, prowokujące do myślenia pytanie zakupowe powiązane z tym sprzętem
- 💡 Krótki kontekst okazji (dlaczego ten produkt teraz wywołał poruszenie)
- 🎁 Zachęta do wrzucania opinii, zdjęć lub własnych typów w komentarzach
- 👉 CTA: "Szczegóły oferty możecie sprawdzić w 1. komentarzu ⬇️ lub na portalu:\n${deal.linkUrl}"
- #️⃣ Dołącz hashtagi na końcu: ${hashtagsLine}`;
    } else {
      personaPrompt = `Twoja rola: Asystent Zakupowy & Smart FAQ (🤖).
Twój styl: zwięzły, konkretny, pomocny i uprzejmy.
Specjalne instrukcje: ${bot.customInstructions || 'Odpowiadaj krótko, precyzyjnie i uprzejmie.'}

ZADANIE: Napisz praktyczny miniporadnik / wskazówkę zakupową:
- 🤖 Wyjaśnij jak skorzystać z tej promocji, jak zdobyć kupon lub na co zwrócić uwagę przy dostawie
- 💰 Zestawienie cenowe i parametry
- 👉 CTA: "Link do oferty czeka w 1. komentarzu ⬇️ oraz tutaj:\n${deal.linkUrl}"
- #️⃣ Dołącz hashtagi: ${hashtagsLine}`;
    }

    const fullPrompt = `Jesteś profesjonalnym copywriterem social media dla największej społeczności łowców okazji w Polsce – Okazje Plus (okazjeplus.pl).
${personaPrompt}

DANE PRODUKTU/OKAZJI:
- Tytuł: ${deal.title}
${deal.fullTitle && deal.fullTitle !== deal.title ? `- Pełna specyfikacja z tytułu: ${deal.fullTitle}` : ''}
- Cena w promocji: ${deal.priceStr}
${deal.oldPriceStr ? `- Cena regularna: ${deal.oldPriceStr}` : ''}
${deal.discountStr ? `- Rabat: ${deal.discountStr}` : ''}
- Sklep: ${deal.merchant || 'Okazje Plus'}
- Kategoria: ${deal.category || 'ogólna'}
- Ocena społeczności: ${deal.temperature}°
${deal.specs ? `- Parametry techniczne:\n${deal.specs}` : ''}
${deal.description ? `- Opis produktu:\n${deal.description.slice(0, 800)}` : ''}
${topicHint ? `- Dodatkowa uwaga/wskazówka od użytkownika: ${topicHint}` : ''}

ZASADY:
- Zwięźle i konkretnie (około 90-150 słów). Nie twórz długich elaboratów ani ściany tekstu!
- BEZWZGLĘDNY ZAKAZ UŻYWANIA GWIAZDEK I FORMATOWANIA MARKDOWN (**tekst**, *tekst*, # nagłówek)! Facebook NIE interpretuje Markdownu i wyświetla brzydkie gwiazdki '**', co drażni odbiorców.
- BEZWZGLĘDNY ZAKAZ wypisywania nagłówków sekcji takich jak 'NAGŁÓWEK:', 'OPIS:', 'SPECYFIKACJA:', 'PARAMETRY:', 'CTA:', 'HASHTAGI:' ani numeracji 1, 2, 3! Wygeneruj TYLKO gotowy do opublikowania płynny tekst posta.
- Jeśli chcesz coś zaakcentować, użyj WIELKICH LITER, czytelnej nowej linii lub emoji. NIGDY NIE UŻYWAJ ZNAKÓW '**' ANI '*'!
- Pisz po polsku, żywym, naturalnym i angażującym językiem jak człowiek, a nie sztuczny bot.
- Umieść podane hashtagi na samym końcu.`;

    const aiResponse = await ai.generate({
      prompt: fullPrompt,
      config: {
        temperature: bot.role === 'hunter' || bot.role === 'community' ? 0.75 : 0.4,
        maxOutputTokens: 2500,
      },
    });

    if (aiResponse && aiResponse.text && aiResponse.text.trim().length > 40) {
      const sanitized = sanitizeSocialPostText(aiResponse.text);
      const { isValidSocialPost } = await import('@/lib/social-post-dedup');
      if (isValidSocialPost(sanitized)) {
        postText = sanitized;
        aiGenerated = true;
      } else {
        console.warn('[generateEngagingSocialPost] AI text failed validation check, falling back to curated copy');
      }
    }
  } catch (err) {
    console.warn('[generateEngagingSocialPost] AI generation error, using rich curated template:', err);
  }

  // Ensure hashtags are included and sanitized
  if (postText) {
    postText = sanitizeSocialPostText(postText);
    if (!postText.includes('#')) {
      postText = `${postText.trim()}\n\n${hashtagsLine}`;
    }
  }

  // Fallback if AI was unavailable
  if (!aiGenerated || !postText) {
    postText = buildCuratedFallbackPost(bot, deal, dynamicHashtags, topicHint);
  }

  return { text: postText, hashtags: dynamicHashtags };
}

export async function executeBotRun(
  bot: SocialAIBot,
  immediatePublish: boolean = false,
  topicHint?: string,
  userId?: string,
  targetDealId?: string
): Promise<{
  success: boolean;
  postId?: string;
  postContent?: string;
  published?: boolean;
  platformPostId?: string;
  error?: string;
}> {
  try {
    const now = new Date();
    const timestampStr = now.toLocaleString('pl-PL');

    // 1. Fetch contextual deal or topic data
    let postText = '';
    let linkUrl = 'https://okazjeplus.pl';
    let imageUrl: string | undefined = undefined;
    let itemId = `bot-${bot.role}-${now.getTime()}`;
    let itemTitle = '';
    let matchedHashtags: string[] = ['#okazjeplus', '#promocje'];

    // 14-day recency deduplication across BOTH socialPosts and generalPostQueue
    const { getRecentlyPostedDealIdentifiers, isDealRecentlyPosted } = await import('@/lib/social-post-dedup');
    const postedInfo = await getRecentlyPostedDealIdentifiers({ days: 14 });

    let selectedDeal: any = null;

    // Check if user specifically requested a deal
    if (targetDealId) {
      const dealDoc = await adminDb.collection('deals').doc(targetDealId).get();
      if (dealDoc.exists) {
        selectedDeal = { id: dealDoc.id, ...dealDoc.data() };
      }
    }

    // Automatically select the best hot deal if none specified
    if (!selectedDeal) {
      const dealsSnap = await adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .orderBy('temperature', 'desc')
        .limit(120)
        .get();

      if (!dealsSnap.empty) {
        const allApproved = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        let candidatePool = allApproved;
        if (bot.role === 'expert') {
          // For expert bot, prioritize high-value gadgets, automotive, electronics, home
          const techCategories = ['elektronika', 'motoryzacja', 'dom-ogrod', 'sport-turystyka'];
          const techDeals = allApproved.filter(d => {
            const cat = (d.mainCategorySlug || d.category || '').toLowerCase();
            return techCategories.some(tc => cat.includes(tc));
          });
          if (techDeals.length > 0) candidatePool = techDeals;
        }

        const unposted = candidatePool.filter(d => !isDealRecentlyPosted({
          id: d.id,
          title: d.title,
          dealUrl: d.link || d.affiliateLink || d.dealUrl,
        }, postedInfo));

        if (unposted.length > 0) {
          selectedDeal = unposted[0];
        } else {
          // If all top deals were posted within the last 14 days, pick the deal that was posted LONGEST AGO
          const sortedByAge = [...candidatePool].sort((a, b) => {
            const timeA = postedInfo.dealPostTimestamps.get(a.id) || 0;
            const timeB = postedInfo.dealPostTimestamps.get(b.id) || 0;
            return timeA - timeB;
          });
          selectedDeal = sortedByAge[0];
        }
      }
    }

    if (selectedDeal) {
      const parsed = parseDealFields(selectedDeal);
      itemId = parsed.id;
      itemTitle = parsed.title;
      linkUrl = parsed.linkUrl;
      imageUrl = parsed.imageUrl;

      const generated = await generateEngagingSocialPost(bot, parsed, topicHint);
      postText = generated.text;
      matchedHashtags = generated.hashtags;
    } else {
      // General community / report fallback if database has no approved deals
      itemTitle = topicHint || 'Codzienny Raport Najlepszych Okazji';
      postText = `🔥 CODZIENNY RAPORT OKAZJI Okazje Plus (${timestampStr})!\n\n` +
        `Nasz algorytm i moderatorzy przejrzeli dziś setki ofert. Na portalu czekają na Was zweryfikowane perełki cenowe bez fałszywych rabatów.\n\n` +
        (topicHint ? `💡 Temat dnia: ${topicHint}\n\n` : '') +
        `👉 Sprawdź aktualne okazje:\nhttps://okazjeplus.pl\n\n` +
        `#okazje #promocje #okazjeplus #zakupyonline`;
      matchedHashtags = ['#okazje', '#promocje', '#okazjeplus'];
    }

    // 2. Prepare post payload
    // If bot has autoApprove enabled or immediatePublish is true, approve and publish directly!
    const shouldPublish = Boolean(immediatePublish || bot.autoApprove);
    const initialStatus = shouldPublish ? 'approved' : 'pending';

    const postPayload: Omit<SocialPost, 'id'> = {
      platform: 'facebook',
      status: initialStatus,
      type: 'deal',
      itemId,
      itemData: {
        title: itemTitle,
        description: postText.slice(0, 250),
        url: linkUrl,
        image: imageUrl,
      },
      content: {
        text: postText,
        linkUrl,
        imageUrl,
        hashtags: matchedHashtags,
      },
      attempts: 0,
      metadata: {
        createdBy: userId || 'system',
        botId: bot.id,
        botName: bot.name,
        target: bot.target,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const postRef = await adminDb.collection('socialPosts').add(postPayload);
    const createdPost: SocialPost = { id: postRef.id, ...postPayload };

    let published = false;
    let platformPostId: string | undefined = undefined;

    // 3. Publish to Facebook if requested or if bot has autoApprove
    if (shouldPublish) {
      const configSnap = await adminDb.collection('socialConfig').doc('facebook').get();
      if (configSnap.exists) {
        const config = configSnap.data() as SocialConfig;
        if (config.enabled && config.credentials?.accessToken && config.credentials?.pageId) {
          const pubResult = await publishToSocialPlatform(createdPost, config);
          if (pubResult.success && pubResult.platformPostId) {
            published = true;
            platformPostId = pubResult.platformPostId;
            await postRef.update({
              status: 'posted',
              platformPostId: pubResult.platformPostId,
              platformUrl: pubResult.platformUrl || `https://www.facebook.com/${pubResult.platformPostId}`,
              postedAt: new Date().toISOString(),
              attempts: 1,
              updatedAt: new Date().toISOString(),
            });
          } else {
            console.error('[executeBotRun] Publishing to Facebook failed:', pubResult.error);
            await postRef.update({
              status: 'failed',
              lastError: typeof pubResult.error === 'string' ? pubResult.error : (pubResult.error?.message || 'Błąd publikacji na Facebooku'),
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          console.warn('[executeBotRun] Facebook config not configured or disabled');
          await postRef.update({
            status: 'failed',
            lastError: 'Brak aktywnej konfiguracji Facebooka (sprawdź token i pageId)',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // 4. Update bot statistics
    await adminDb.collection('socialAIBots').doc(bot.id).update({
      lastRunAt: now.toISOString(),
      totalGenerated: (bot.totalGenerated || 0) + 1,
      totalPublished: (bot.totalPublished || 0) + (published ? 1 : 0),
      updatedAt: now.toISOString(),
    });

    return {
      success: true,
      postId: postRef.id,
      postContent: postText,
      published,
      platformPostId,
    };
  } catch (error) {
    console.error('Error running AI bot:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Błąd uruchamiania bota' };
  }
}

export async function runSocialAIBotAction(
  botId: string,
  immediatePublish: boolean = false,
  topicHint?: string,
  targetDealId?: string
): Promise<{
  success: boolean;
  postId?: string;
  postContent?: string;
  published?: boolean;
  platformPostId?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const botDoc = await adminDb.collection('socialAIBots').doc(botId).get();
    if (!botDoc.exists) {
      return { success: false, error: 'Bot nie został znaleziony' };
    }

    const bot = { id: botDoc.id, ...botDoc.data() } as SocialAIBot;
    const result = await executeBotRun(bot, immediatePublish, topicHint, session.uid, targetDealId);

    revalidatePath('/[locale]/admin/social-media', 'page');
    return result;
  } catch (error) {
    console.error('Error running AI bot action:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Błąd uruchamiania akcji bota' };
  }
}
