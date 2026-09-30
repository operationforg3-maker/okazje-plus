/**
 * Server Actions: Wędkarski Autopilot FB & Portal ("Wędkarskie Promocje Żona nie widzi")
 * Obsługa autonomicznego publikowania, generowania postów przez AI i moderacji.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { 
  FishingAutopilotConfig, 
  FishingBotPersona, 
  FishingPostQueueItem, 
  FishingBotRole,
  FishingDealItem 
} from '@/lib/types';
import { ai } from '@/ai/genkit';
import { applyFishingTracking, resolveFishingAffiliateUrl } from '@/lib/fishing-utils';
import { sanitizeSocialPostText } from '@/lib/social-growth-types';
import {
  diversifyDealsList,
  detectDealCategory,
  pickDiverseRecommendation,
} from '@/lib/deal-diversity';

const CONFIG_DOC_ID = 'fishing-autopilot-settings';

const DEFAULT_CONFIG: FishingAutopilotConfig = {
  id: CONFIG_DOC_ID,
  enabled: true,
  mode: 'moderation', // 'moderation' = posty trafiają do kolejki, 'autopilot' = publikacja automatyczna
  fb: {
    pageId: '982464291620541',
    pageName: 'Wędkarskie Promocje Żona nie widzi',
    groupId: '',
    accessToken: 'EAAW0YiYKc1UBSqk0PnvZAA3e6apGNih3FNSnaGIZAyk1UIQ6Mk2LyijrCDbwWVWXkEVloT95ueQyZB2e2DkKSkCXWOvLWvPxKQfWd1WKkjcpKSWn5WyCTzVEmSnZC2vtcjltW1zoPH0phxUYZCbPcdEgOXMQdIVL850EGkcbr84ID3owNZCqZBstxqvK5ztCfKJZB1SZBx2RZCqoO3vYuzdn2gJdKEfhucHDUh5NZAb5ZCUOm7pKZAd5c3CAsWzU8',
    postTarget: 'both',
    autoPostFirstComment: true,
    includePhoto: true,
  },
  portal: {
    autoPublish: true,
    categorySlug: 'sport-turystyka',
    defaultStatus: 'approved',
    authorName: 'Wędkarskie Promocje (Żona nie widzi)',
    createTags: true,
  },
  schedule: {
    intervalHours: 4,
    dailyLimit: 4,
    scheduleTimes: ['06:30', '12:00', '17:30', '21:30'],
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  },
  filters: {
    minDiscountPercent: 15,
    minTemperature: 20,
    keywords: [
      'wędka', 'kołowrotek', 'spinning', 'feeder', 'karpiowe', 'plecionka', 
      'żyłka', 'przynęty', 'woblery', 'zanęta', 'sygnalizator', 'echosonda', 
      'ponton', 'namiot wędkarski', 'fotel wędkarski', 'wodery', 'shimano', 'daiwa'
    ],
    negativeKeywords: ['zabawka', 'akwarium domowe'],
  },
  partners: {
    aliexpress: true,
    convertiser: true,
    tradetracker: true,
    convertiserToken: process.env.CONVERTISER_API_TOKEN || 'sE1vVgCO6U7zfl3pN7XsPFFY4Uu9L0',
    tradeTrackerCustomerId: process.env.TRADETRACKER_CUSTOMER_ID || '',
    tradeTrackerPassphrase: process.env.TRADETRACKER_PASSPHRASE || '',
    tradeTrackerSiteId: process.env.TRADETRACKER_SITE_ID || '',
    tradeTrackerFeedUrl: process.env.TRADETRACKER_FEED_URL || '',
  },
  tracking: {
    campaign: 'Fishing_2',
    subId: 'Fishing_2',
    utmSource: 'facebook',
    utmMedium: 'social',
  },
  stats: {
    totalGenerated: 0,
    totalPublishedFb: 0,
    totalPublishedPortal: 0,
  },
  updatedAt: new Date().toISOString(),
};

const DEFAULT_FISHING_BOTS: FishingBotPersona[] = [
  {
    id: 'bot-wife-secret',
    name: 'Żona Nie Widzi (Alibi & Humor)',
    role: 'wife_secret',
    avatar: '🤫',
    badge: 'Żona nie widzi',
    description: 'Posty w kultowym klimacie: oficjalne alibi cenowe dla żony, żarty z kurierów i paczkomatów o północy oraz viralowy humor wędkarski.',
    humorLevel: 'legendary',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions: 'Koniecznie podawaj oficjalną wymówkę dla żony i "paragonową cenę alibi" (np. 35 zł z wyprzedaży garażowej). Zawsze z przymrużeniem oka!',
    scheduleDescription: 'Wieczorny chillout (21:30) oraz weekendowe wypady',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-deal-hunter',
    name: 'Łowca Okazji Wędkarskich',
    role: 'deal_hunter',
    avatar: '🎣',
    badge: 'Czysty Deal',
    description: 'Błyskawiczne alerty o kołowrotkach, wędkach, plecionkach i sprzęcie biwakowym w bezkonkurencyjnych cenach z wyliczoną oszczędnością.',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: true,
    target: 'both',
    customInstructions: 'Podkreślaj parametry techniczne (łożyska, przełożenie, gramaturę, materiał) i realną oszczędność względem regularnej ceny w polskich sklepach.',
    scheduleDescription: 'Około południa (12:00) i po pracy (17:30)',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-angler-chatter',
    name: 'Wędkarz Gawędziarz (Społeczność)',
    role: 'angler_chatter',
    avatar: '🐟',
    badge: 'Angażujący',
    description: 'Buduje zasięgi organiczne grupy FB: zadaje gorące pytania sprzętowe, prowokuje dyskusje (Shimano vs Daiwa) i zachęca do chwalenia się rybami.',
    humorLevel: 'high',
    enabled: true,
    autoApprove: false,
    target: 'facebook',
    customInstructions: 'Zadawaj otwarte pytania, prowokuj wymianę zdań, zachęcaj do wrzucania zdjęć w komentarzach.',
    scheduleDescription: 'Poranny wypad (06:30) przed pracą',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-gear-expert',
    name: 'Tester & Strażnik Portfela',
    role: 'gear_expert',
    avatar: '🧭',
    badge: 'Test & Poradnik',
    description: 'Miniporadniki i testy sprzętu: jaka plecionka na drapieżnika, demaskowanie fałszywych promocji na wędziska i doradztwo sezonowe.',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions: 'Krótko, rzeczowo, edukacyjnie. Wypunktuj 3 kluczowe zalety i na co uważać przed zakupem.',
    scheduleDescription: 'Raz na 2 dni lub na żądanie',
    totalGenerated: 0,
    totalPublished: 0,
  },
];

// ============================================================================
// KONFIGURACJA I ZARZĄDZANIE BOTAMI
// ============================================================================

export async function getFishingAutopilotConfig(skipAuth: boolean = false): Promise<{
  success: boolean;
  config: FishingAutopilotConfig;
  error?: string;
}> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, config: DEFAULT_CONFIG, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const docRef = adminDb.collection('systemSettings').doc(CONFIG_DOC_ID);
    const snap = await docRef.get();

    if (!snap.exists) {
      await docRef.set(DEFAULT_CONFIG);
      return { success: true, config: DEFAULT_CONFIG };
    }

    const data = snap.data() as Partial<FishingAutopilotConfig>;
    // Merge with defaults to ensure all keys are present
    const config: FishingAutopilotConfig = {
      ...DEFAULT_CONFIG,
      ...data,
      fb: { ...DEFAULT_CONFIG.fb, ...(data.fb || {}) },
      portal: { ...DEFAULT_CONFIG.portal, ...(data.portal || {}) },
      schedule: { ...DEFAULT_CONFIG.schedule, ...(data.schedule || {}) },
      filters: { ...DEFAULT_CONFIG.filters, ...(data.filters || {}) },
      partners: { ...DEFAULT_CONFIG.partners, ...(data.partners || {}) },
      tracking: { ...DEFAULT_CONFIG.tracking, ...(data.tracking || {}) },
      stats: { ...DEFAULT_CONFIG.stats, ...(data.stats || {}) },
    };

    return { success: true, config };
  } catch (error) {
    console.error('Error fetching fishing config:', error);
    return { success: false, config: DEFAULT_CONFIG, error: 'Błąd pobierania konfiguracji' };
  }
}

export async function getFishingAutopilotConfigAction(): Promise<{
  success: boolean;
  config: FishingAutopilotConfig;
  error?: string;
}> {
  return getFishingAutopilotConfig(false);
}

export async function saveFishingAutopilotConfigAction(
  config: Partial<FishingAutopilotConfig>
): Promise<{ success: boolean; resolvedPageToken?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const payload: any = { ...config };
    let resolvedPageToken: string | undefined = undefined;

    // Jeśli podano token i pageId, sprawdź czy to User Token i spróbuj automatycznie pobrać Page Token
    if (config.fb?.accessToken && config.fb?.pageId) {
      try {
        const pageRes = await fetch(
          `https://graph.facebook.com/v19.0/${config.fb.pageId}?fields=access_token,name&access_token=${encodeURIComponent(config.fb.accessToken)}`,
          { cache: 'no-store' }
        );
        const pageData = await pageRes.json();
        if (pageData.access_token) {
          resolvedPageToken = pageData.access_token;
          payload.fb = {
            ...payload.fb,
            accessToken: pageData.access_token,
          };
        }
      } catch (tokenErr) {
        console.warn('Auto-resolution of page access token during save failed:', tokenErr);
      }
    }

    const docRef = adminDb.collection('systemSettings').doc(CONFIG_DOC_ID);
    await docRef.set({
      ...payload,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    return { success: true, resolvedPageToken };
  } catch (error) {
    console.error('Error saving fishing config:', error);
    return { success: false, error: 'Nie udało się zapisać konfiguracji' };
  }
}

export async function getFishingBots(skipAuth: boolean = false): Promise<{
  success: boolean;
  bots: FishingBotPersona[];
  error?: string;
}> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, bots: [], error: 'Wymagane uprawnienia administratora' };
      }
    }

    const snap = await adminDb.collection('fishingBotPersonas').get();

    if (snap.empty) {
      const batch = adminDb.batch();
      for (const bot of DEFAULT_FISHING_BOTS) {
        batch.set(adminDb.collection('fishingBotPersonas').doc(bot.id), bot);
      }
      await batch.commit();
      return { success: true, bots: DEFAULT_FISHING_BOTS };
    }

    const bots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FishingBotPersona));
    return { success: true, bots };
  } catch (error) {
    console.error('Error fetching fishing bots:', error);
    return { success: false, bots: DEFAULT_FISHING_BOTS, error: 'Błąd pobierania botów' };
  }
}

export async function getFishingBotsAction(): Promise<{
  success: boolean;
  bots: FishingBotPersona[];
  error?: string;
}> {
  return getFishingBots(false);
}

export async function saveFishingBotAction(
  bot: FishingBotPersona
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('fishingBotPersonas').doc(bot.id).set(bot, { merge: true });
    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error saving fishing bot:', error);
    return { success: false, error: 'Błąd zapisu bota' };
  }
}

// ============================================================================
// TESTOWANIE POŁĄCZENIA META GRAPH API
// ============================================================================

export async function testFacebookApiAction(
  pageIdOverride?: string,
  tokenOverride?: string
): Promise<{
  success: boolean;
  pageName?: string;
  pageId?: string;
  link?: string;
  canPost?: boolean;
  recentPostsCount?: number;
  resolvedPageToken?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    let pageId = pageIdOverride;
    let token = tokenOverride;

    if (!pageId || !token) {
      const configRes = await getFishingAutopilotConfigAction();
      pageId = pageId || configRes.config.fb.pageId;
      token = token || configRes.config.fb.accessToken;
    }

    // Fallback do konfiguracji ogólnej socialConfig/facebook jeśli wciąż brak tokena lub pageId
    if (!pageId || !token) {
      try {
        const socialSnap = await adminDb.collection('socialConfig').doc('facebook').get();
        if (socialSnap.exists) {
          const socData = socialSnap.data();
          pageId = pageId || socData?.credentials?.pageId;
          token = token || socData?.credentials?.accessToken;
        }
      } catch (socErr) {
        console.warn('Could not read fallback socialConfig/facebook:', socErr);
      }
    }

    if (!pageId || !token) {
      return { success: false, error: 'Brak skonfigurowanego Page ID lub Access Tokena' };
    }

    let activeToken = token;
    let resolvedPageToken: string | undefined = undefined;

    // 1. Sprawdź podstawowe info o stronie
    let infoUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,link&access_token=${encodeURIComponent(activeToken)}`;
    let infoRes = await fetch(infoUrl, { cache: 'no-store' });
    let infoData = await infoRes.json();

    if (!infoRes.ok || infoData.error) {
      // Spróbujmy sprawdzić czy token to User Token i czy potrafi wygenerować Page Token
      try {
        const exchangeRes = await fetch(
          `https://graph.facebook.com/v19.0/${pageId}?fields=access_token,name&access_token=${encodeURIComponent(activeToken)}`,
          { cache: 'no-store' }
        );
        const exchangeData = await exchangeRes.json();
        if (exchangeData.access_token) {
          activeToken = exchangeData.access_token;
          resolvedPageToken = activeToken;
          infoUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,link&access_token=${encodeURIComponent(activeToken)}`;
          infoRes = await fetch(infoUrl, { cache: 'no-store' });
          infoData = await infoRes.json();
        }
      } catch (exErr) {
        console.warn('Exchange attempt failed:', exErr);
      }
    }

    if (!infoRes.ok || infoData.error) {
      return {
        success: false,
        error: infoData.error?.error_user_msg || infoData.error?.message || 'Błąd autoryzacji Facebook API',
      };
    }

    // 2. Sprawdź odczyt feedu
    const feedUrl = `https://graph.facebook.com/v19.0/${pageId}/feed?limit=5&access_token=${encodeURIComponent(activeToken)}`;
    const feedRes = await fetch(feedUrl, { cache: 'no-store' });
    const feedData = await feedRes.json();

    if (feedData.error) {
      // Jeśli błąd to "User access token is not supported" (subcode 2069032)
      if (feedData.error.error_subcode === 2069032 || feedData.error.code === 190) {
        try {
          const pageTokenRes = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}?fields=access_token,name&access_token=${encodeURIComponent(token)}`,
            { cache: 'no-store' }
          );
          const pageTokenData = await pageTokenRes.json();
          if (pageTokenData.access_token) {
            activeToken = pageTokenData.access_token;
            resolvedPageToken = activeToken;

            // Zapisz Page Token w ustawieniach bazy
            await adminDb.collection('systemSettings').doc(CONFIG_DOC_ID).set({
              fb: { accessToken: activeToken }
            }, { merge: true });

            // Ponowny test feedu z tokenem strony
            const reFeedRes = await fetch(
              `https://graph.facebook.com/v19.0/${pageId}/feed?limit=5&access_token=${encodeURIComponent(activeToken)}`,
              { cache: 'no-store' }
            );
            const reFeedData = await reFeedRes.json();
            if (!reFeedData.error) {
              const count = Array.isArray(reFeedData.data) ? reFeedData.data.length : 0;
              return {
                success: true,
                pageId: infoData.id,
                pageName: infoData.name,
                link: infoData.link || `https://www.facebook.com/${infoData.id}`,
                canPost: true,
                recentPostsCount: count,
                resolvedPageToken,
              };
            }
          }
        } catch (subErr) {
          console.warn('Page token resolution failed on feed error:', subErr);
        }

        return {
          success: false,
          error: 'Podany token to User Access Token. Meta wymaga Page Access Token dla tej strony (Nowe Środowisko Stron).',
        };
      }

      return {
        success: false,
        error: feedData.error.error_user_msg || feedData.error.message || 'Błąd odczytu strony na Facebooku',
      };
    }

    const count = Array.isArray(feedData.data) ? feedData.data.length : 0;

    // Jeśli udało się rozwiązać token, zapisz go w bazie
    if (resolvedPageToken) {
      await adminDb.collection('systemSettings').doc(CONFIG_DOC_ID).set({
        fb: { accessToken: resolvedPageToken }
      }, { merge: true });
    }

    return {
      success: true,
      pageId: infoData.id,
      pageName: infoData.name,
      link: infoData.link || `https://www.facebook.com/${infoData.id}`,
      canPost: true,
      recentPostsCount: count,
      resolvedPageToken,
    };
  } catch (error) {
    console.error('Error testing FB API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd podczas testu Meta API',
    };
  }
}

// ============================================================================
// WYSZUKIWANIE OKAZJI WĘDKARSKICH W BAZIE
// ============================================================================

export async function getFishingDeals(
  searchQuery?: string,
  limitCount: number = 150,
  partnerFilter?: string,
  skipAuth: boolean = false
): Promise<{
  success: boolean;
  deals: FishingDealItem[];
  error?: string;
}> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, deals: [], error: 'Wymagane uprawnienia administratora' };
      }
    }

    const configRes = await getFishingAutopilotConfig(true);
    const config = configRes.config;
    const trackingCampaign = config.tracking?.campaign || 'Fishing_2';

    const fishingKeywords = [
      'wędka', 'wędk', 'wędzisk', 'kołowrotek', 'feeder', 'spinning', 'karpiow', 'plecionka', 
      'haczyk', 'przynęt', 'wobler', 'zanęt', 'sygnalizator', 'echosond', 'ponton', 
      'namiot karpiowy', 'namiot wędkarski', 'fotel wędkarski', 'wodery', 'spodniobuty',
      'żyłka wędkarska', 'daiwa', 'mikado', 'shimano', 'caperlan', 'fox rage', 'lineaeffe',
      'aqua marina', 'savage gear', 'spławik', 'podbierak',
      // Słowa kluczowe angielskie (dla ofert z AliExpress i feedów globalnych)
      'fishing', 'fish rod', 'fishing rod', 'fishing reel', 'baitcasting',
      'fishing lure', 'crankbait', 'wobbler', 'fishing hook', 'fishing line',
      'fishing tackle', 'fishing bait', 'fishing net', 'fishing pliers',
      'carp fishing', 'fly fishing', 'ice fishing', 'swivel hook', 'treble hook',
      'minnow lure', 'popper bait', 'hard bait', 'artificial bait', 'lead sinker',
      'trolling lure', 'jig lure'
    ];

    const STRICT_NEGATIVE = [
      'pies', 'kot', 'koc', 'zwierz', 'gryzoń', 'szczur', 'mysz', 'chomik',
      'kuchenka', 'palnik', 'patelnia', 'garnek', 'rondel', 'talerz', 'sztućce',
      'kolczyki', 'pierścionek', 'naszyjnik', 'etui na telefon', 'joy-con', 'switch',
      'baby', 'kids', 'dzieci', 'niemowl', 'drewniana wędka', 'zabawk', 'stolik krab',
      'lego', 'klocki', 'narożnik', 'tapicerka', 'tkanina', 'lutowni', 'topnik', 'cyna',
      'wyciąg górny', 'wyciąg dolny', 'treningowy', 'siłowni', 'sukienka', 'biustonosz',
      'majtki', 'kurtka narciarska', 'narty', 'sunglasses', 'okulary', 'okular', 'lampenschirme',
      'obudowa', 'ładowarka', 'poliestrowa', 'legrand', 'düwi', 'kuszy', 'łowiectwa podwodnego',
      'kapelusz', 'czapka', 'topslang', 'koszulk', 'ssz 230v', 'eaton', 'greenblue', 'retoo',
      'satel', 'siemens', 'dahua', 'gazex', 'traktorek', 'napięcia',
      // Angielskie wykluczenia
      'dog', 'cat', 'dress', 'bra', 'bikini', 'underwear', 'earphone', 'headphone',
      'nail art', 'wig', 'hair bun', 'hair styling', 'wall mounted'
    ];

    // Pobierz konfigurację filtrów
    const configuredKeywords = config.filters.keywords || [];
    const allKeywords = Array.from(new Set([...fishingKeywords, ...configuredKeywords.map(k => k.toLowerCase())]));

    // Multi-query dla maksymalnej bazy ofert wędkarskich w Firestore
    const docsMap = new Map<string, any>();

    // 1. Zdedykowana podkategoria wedkarstwo
    const snapCategory = await adminDb
      .collection('deals')
      .where('status', '==', 'approved')
      .where('subCategorySlug', '==', 'wedkarstwo')
      .limit(200)
      .get();
    snapCategory.docs.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));

    // 2. Tagi wędkarskie
    const snapTags = await adminDb
      .collection('deals')
      .where('status', '==', 'approved')
      .where('tags', 'array-contains', 'wędkarstwo')
      .limit(200)
      .get();
    snapTags.docs.forEach(d => docsMap.set(d.id, { id: d.id, ...d.data() }));

    // 3. Oferty z AliExpress (zawsze pobieramy pulę, aby filtr AliExpress zwracał właściwe okazje)
    const snapAli = await adminDb
      .collection('deals')
      .where('status', '==', 'approved')
      .where('source', '==', 'aliexpress')
      .limit(partnerFilter === 'aliexpress' ? 500 : 250)
      .get();
    snapAli.docs.forEach(d => {
      if (!docsMap.has(d.id)) {
        docsMap.set(d.id, { id: d.id, ...d.data() });
      }
    });

    // 4. Ostatnie deale ze sportu i ogólne (dla wyłapania ofert z innych feedów)
    const snapRecent = await adminDb
      .collection('deals')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    snapRecent.docs.forEach(d => {
      if (!docsMap.has(d.id)) {
        docsMap.set(d.id, { id: d.id, ...d.data() });
      }
    });

    const matches: FishingDealItem[] = [];

    for (const [id, data] of docsMap.entries()) {
      let titleStr = '';
      if (typeof data.title === 'string') {
        titleStr = data.title;
      } else if (typeof data.title === 'object' && data.title !== null) {
        titleStr = data.title.pl || data.title.en || Object.values(data.title)[0] || '';
      }
      const titleEn = typeof data.title === 'object' && data.title !== null ? String(data.title.en || '') : '';
      const fullSearchTitle = `${titleStr} ${titleEn}`.toLowerCase();

      const descLower = (typeof data.description === 'string' ? data.description : (data.description?.pl || '')).toLowerCase();
      const tagsArray = Array.isArray(data.tags) ? data.tags.map((t: any) => String(t).toLowerCase()) : [];
      const rawSource = String(data.source || data.metadata?.source || 'okazjeplus').toLowerCase();

      // Odrzuć śmieci i oferty niespełniające kryteriów wędkarskich
      if (STRICT_NEGATIVE.some(neg => fullSearchTitle.includes(neg) || descLower.includes(neg))) {
        continue;
      }

      // Sprawdź czy to sprzęt wędkarski
      const isSubCat = data.subCategorySlug === 'wedkarstwo' || data.subCategorySlug === 'sporty-wodne';
      const hasFishingTag = tagsArray.some((t: string) => t.includes('wędk') || t.includes('wedk') || t.includes('fishing'));
      const matchesKeyword = allKeywords.some(k => fullSearchTitle.includes(k) || descLower.includes(k));

      if (isSubCat || hasFishingTag || matchesKeyword) {
        // Price parsing
        let currentPriceVal: number | undefined = undefined;
        if (typeof data.price === 'number') currentPriceVal = data.price;
        else if (data.price?.amount) currentPriceVal = data.price.amount;
        else if (typeof data.currentPrice === 'number') currentPriceVal = data.currentPrice;

        // Odrzuć oferty o cenie <= 0
        if (currentPriceVal !== undefined && currentPriceVal <= 0) {
          continue;
        }

        // Normalize source
        let sourceName = 'manual';
        if (rawSource.includes('convertiser')) sourceName = 'convertiser';
        else if (rawSource.includes('tradetracker')) sourceName = 'tradetracker';
        else if (rawSource.includes('aliexpress') || String(data.merchantName || '').toLowerCase().includes('aliexpress')) sourceName = 'aliexpress';
        else if (rawSource.includes('amazon')) sourceName = 'amazon';
        else if (rawSource.includes('allegro')) sourceName = 'allegro';

        let originalPriceVal: number | undefined = undefined;
        if (typeof data.originalPrice === 'number') originalPriceVal = data.originalPrice;
        else if (data.originalPrice?.amount) originalPriceVal = data.originalPrice.amount;

        const priceStr = currentPriceVal !== undefined ? `${currentPriceVal.toFixed(2)} zł` : '';
        const oldPriceStr = originalPriceVal && (!currentPriceVal || originalPriceVal > currentPriceVal)
          ? `${originalPriceVal.toFixed(2)} zł`
          : undefined;

        let discountStr: string | undefined = undefined;
        if (currentPriceVal && originalPriceVal && originalPriceVal > currentPriceVal) {
          discountStr = `-${Math.round(((originalPriceVal - currentPriceVal) / originalPriceVal) * 100)}%`;
        }

        const directAffiliateUrl = resolveFishingAffiliateUrl({
          id,
          ...data,
          source: sourceName,
        }, trackingCampaign);

        const rawDesc = typeof data.description === 'string'
          ? data.description
          : (data.description?.pl || data.description?.en || '');
        const cleanDesc = rawDesc
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        matches.push({
          id,
          title: titleStr || 'Sprzęt wędkarski',
          price: priceStr,
          oldPrice: oldPriceStr,
          discount: discountStr,
          merchant: data.merchantName || data.merchant || 'Sklep wędkarski',
          imageUrl: data.imageUrl || data.image || '',
          temperature: Number(data.temperature) || 20,
          dealUrl: directAffiliateUrl,
          portalUrl: `https://okazjeplus.pl/pl/deals/${id}`,
          rawLink: data.link || data.affiliateLink || '',
          source: sourceName,
          category: data.category || 'Wędkarstwo',
          description: cleanDesc,
          tags: tagsArray,
        });
      }
    }

    // Sortuj: najwyższa temperatura / atrakcyjność
    matches.sort((a, b) => (b.temperature || 0) - (a.temperature || 0));

    let finalDeals = matches;

    // Filtrowanie po partnerze (AliExpress, Convertiser, TradeTracker)
    if (partnerFilter && partnerFilter !== 'all') {
      finalDeals = finalDeals.filter(d => d.source.toLowerCase() === partnerFilter.toLowerCase());
    }

    // Filtrowanie zapytaniem użytkownika jeśli podano
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      finalDeals = finalDeals.filter(d => 
        d.title.toLowerCase().includes(q) || 
        (d.merchant && d.merchant.toLowerCase().includes(q))
      );
    }

    return {
      success: true,
      deals: diversifyDealsList(finalDeals, { niche: 'fishing' }).slice(0, limitCount),
    };
  } catch (error) {
    console.error('Error fetching fishing deals:', error);
    return { success: false, deals: [], error: 'Błąd pobierania ofert wędkarskich' };
  }
}

export async function getFishingDealsAction(
  searchQuery?: string,
  limitCount: number = 150,
  partnerFilter?: string
): Promise<{
  success: boolean;
  deals: FishingDealItem[];
  error?: string;
}> {
  return getFishingDeals(searchQuery, limitCount, partnerFilter, false);
}

// ============================================================================
// POMOCNIK: DYNAMICZNE HASHTAGI DLA SPRZĘTU WĘDKARSKIEGO
// ============================================================================

function buildFishingHashtags(title: string, merchant?: string, botRole?: string): string[] {
  const t = (title || '').toLowerCase();
  const m = (merchant || '').toLowerCase();
  const tags = new Set<string>([
    '#WędkarskiePromocje',
    '#ŻonaNieWidzi',
    '#OkazjePlus',
    '#Wędkarstwo',
    '#SprzętWędkarski',
  ]);

  // Marki
  if (t.includes('daiwa') || m.includes('daiwa')) tags.add('#Daiwa');
  if (t.includes('shimano') || m.includes('shimano')) tags.add('#Shimano');
  if (t.includes('fox rage') || t.includes('fox')) tags.add('#FoxRage');
  if (t.includes('mikado') || m.includes('mikado')) tags.add('#Mikado');
  if (t.includes('caperlan') || m.includes('caperlan')) tags.add('#Caperlan');
  if (t.includes('savage gear')) tags.add('#SavageGear');
  if (t.includes('aqua marina')) tags.add('#AquaMarina');
  if (t.includes('intex')) tags.add('#Intex');
  if (t.includes('humminbird') || t.includes('helix')) tags.add('#Humminbird');
  if (t.includes('lineaeffe')) tags.add('#Lineaeffe');
  if (t.includes('genlog')) tags.add('#Genlog');

  // Metody i kategorie
  if (t.includes('feeder') || t.includes('drgająca') || t.includes('koszyk')) {
    tags.add('#Feeder');
    tags.add('#MethodFeeder');
  }
  if (t.includes('spinning') || t.includes('spin') || t.includes('drapieżnik') || t.includes('szczupak') || t.includes('sandacz') || t.includes('okoń')) {
    tags.add('#Spinning');
    tags.add('#Drapieżnik');
    tags.add('#Szczupak');
  }
  if (t.includes('karp') || t.includes('carp')) {
    tags.add('#Karpiowanie');
    tags.add('#Karp');
  }
  if (t.includes('kołowrotek') || t.includes('kołowrot') || t.includes('szpul')) {
    tags.add('#Kołowrotek');
  }
  if (t.includes('wędk') || t.includes('wędzisk') || t.includes('kij')) {
    tags.add('#Wędka');
    tags.add('#Wędzisko');
  }
  if (t.includes('ponton') || t.includes('silnik') || t.includes('kajak') || t.includes('łódź')) {
    tags.add('#PontonWędkarski');
    tags.add('#Ponton');
  }
  if (t.includes('echosond') || t.includes('sonar') || t.includes('gps')) {
    tags.add('#Echosonda');
  }
  if (t.includes('wobler') || t.includes('przynęt') || t.includes('błystk') || t.includes('jig') || t.includes('twister') || t.includes('ripper')) {
    tags.add('#Woblery');
    tags.add('#Przynęty');
  }
  if (t.includes('plecionk') || t.includes('żyłk')) {
    tags.add('#Plecionka');
  }
  if (t.includes('fotel') || t.includes('namiot') || t.includes('krzesło') || t.includes('woder') || t.includes('spodniobuty')) {
    tags.add('#BiwakWędkarski');
  }

  // Sklep
  if (m.includes('decathlon')) tags.add('#Decathlon');
  if (m.includes('aliexpress')) tags.add('#AliExpress');
  if (m.includes('morele')) tags.add('#Morele');

  // Specyfika bota
  if (botRole === 'wife_secret') tags.add('#TajnaPrzesyłka');
  if (botRole === 'deal_hunter') tags.add('#ŁowcaOkazji');
  if (botRole === 'gear_expert') tags.add('#TestSprzętu');
  if (botRole === 'angler_chatter') tags.add('#WędkarskiePogaduchy');

  return Array.from(tags);
}

// ============================================================================
// GENEROWANIE POSTA PRZEZ AI BOTY
// ============================================================================

export async function generateFishingPost(
  params: {
    botRole: FishingBotRole;
    dealId?: string;
    customTopic?: string;
    targetDealData?: {
      title: string;
      price?: string;
      oldPrice?: string;
      discount?: string;
      merchant?: string;
      imageUrl?: string;
      dealUrl?: string;
      description?: string;
      specs?: string;
      tags?: string[];
    };
    humorLevel?: 'subtle' | 'high' | 'legendary' | 'none';
  },
  skipAuth: boolean = false
): Promise<{
  success: boolean;
  item?: Partial<FishingPostQueueItem>;
  error?: string;
}> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const { botRole, dealId, customTopic, targetDealData } = params;

    // Pobierz informacje o bocie
    const botsRes = await getFishingBots(true);
    const bot = botsRes.bots.find(b => b.role === botRole) || DEFAULT_FISHING_BOTS[0];

    const configRes = await getFishingAutopilotConfig(skipAuth);
    const trackingCampaign = configRes.config.tracking?.campaign || 'Fishing_2';

    // Pobierz pełne dane deala z bazy (lub targetDealData)
    let dealInfo: any = targetDealData ? { ...targetDealData } : {};
    let rawDescription = '';
    let extractedSpecs = '';
    let dealTags: string[] = [];

    if (dealId) {
      const docSnap = await adminDb.collection('deals').doc(dealId).get();
      if (docSnap.exists) {
        const d = docSnap.data()!;
        const dTitle = typeof d.title === 'string' ? d.title : (d.title?.pl || d.title?.en || Object.values(d.title || {})[0] || '');
        let curPrice = typeof d.price === 'number' ? d.price : d.price?.amount;
        let origPrice = typeof d.originalPrice === 'number' ? d.originalPrice : d.originalPrice?.amount;

        const directAffiliateUrl = resolveFishingAffiliateUrl({
          id: docSnap.id,
          ...d,
        }, trackingCampaign);

        const rawDesc = typeof d.description === 'string' 
          ? d.description 
          : (d.description?.pl || d.description?.en || '');
        rawDescription = rawDesc
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (Array.isArray(d.tags)) {
          dealTags = d.tags.map((t: any) => String(t));
        }

        if (d.specifications || d.metadata?.specifications) {
          const specsObj = d.specifications || d.metadata?.specifications;
          if (typeof specsObj === 'object') {
            extractedSpecs = Object.entries(specsObj)
              .map(([k, v]) => `• ${k}: ${v}`)
              .join('\n');
          }
        }

        dealInfo = {
          ...d,
          ...dealInfo,
          title: dealInfo.title || dTitle || 'Sprzęt wędkarski',
          price: dealInfo.price || (curPrice ? `${curPrice.toFixed(2)} zł` : ''),
          oldPrice: dealInfo.oldPrice || (origPrice ? `${origPrice.toFixed(2)} zł` : ''),
          discount: dealInfo.discount || (curPrice && origPrice && origPrice > curPrice ? `-${Math.round(((origPrice - curPrice) / origPrice) * 100)}%` : ''),
          merchant: dealInfo.merchant || d.merchantName || d.merchant || 'Sklep wędkarski',
          imageUrl: dealInfo.imageUrl || d.imageUrl || d.image || '',
          dealUrl: dealInfo.dealUrl || directAffiliateUrl,
          description: rawDescription || dealInfo.description || '',
          specs: extractedSpecs || dealInfo.specs || '',
          tags: dealTags.length > 0 ? dealTags : (dealInfo.tags || []),
        };
      }
    } else if (targetDealData) {
      const rawDesc = (targetDealData as any).description || '';
      rawDescription = typeof rawDesc === 'string'
        ? rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
        : '';
      dealInfo = {
        ...targetDealData,
        description: rawDescription,
        dealUrl: resolveFishingAffiliateUrl(targetDealData.dealUrl || '', trackingCampaign),
      };
    }

    // Dynamiczny zestaw hashtagów
    const dynamicHashtags = buildFishingHashtags(
      dealInfo?.title || customTopic || '',
      dealInfo?.merchant,
      botRole
    );

    // Treść posta i alibi
    let generatedTitle = dealInfo?.title || customTopic || 'Wędkarska Perełka Sprzętowa';
    let postText = '';
    let wifeAlibi = '';
    let firstComment = '';

    // Spróbuj wygenerować przez AI (Genkit / Vertex AI Gemini 2.5)
    let aiGenerated = false;
    try {
      const promptText = `
Jesteś profesjonalnym i charyzmatycznym AI Copywriterem dla kultowej społeczności wędkarskiej na Facebooku o nazwie "Wędkarskie Promocje Żona nie widzi" oraz portalu Okazje Plus.
Twoja rola: ${bot.name} (${bot.role}).
Instrukcje bota: ${bot.customInstructions}
Poziom humoru: ${params.humorLevel || bot.humorLevel}.

DANE SPRZĘTU I OKAZJI:
- Tytuł/Nazwa produktu: ${dealInfo?.title || customTopic || 'Sprzęt Wędkarski'}
- Cena promocyjna: ${dealInfo?.price || 'Świetna cena'}
- Cena regularna: ${dealInfo?.oldPrice || 'Standardowa cena rynkowa'}
- Zniżka: ${dealInfo?.discount || 'Rabat promocyjny'}
- Sklep: ${dealInfo?.merchant || 'Sklep Wędkarski'}
- Opis i szczegóły produktu: ${dealInfo?.description || 'Brak dodatkowego opisu'}
${dealInfo?.specs ? `- Parametry techniczne:\n${dealInfo.specs}` : ''}
- Dodatkowy kontekst/temat: ${customTopic || 'brak'}
- Sugerowane hashtagi: ${dynamicHashtags.join(' ')}

STRUKTURA I WYMOGI POSTA (BARDZO WAŻNE):
Napisz zwięzły, konkretny i naturalny post na Facebooka (około 90-150 słów - NIE PISZ TASIEMCÓW ANI ŚCIANY TEKSTU!).
Pisz jak żywy człowiek, pasjonat wędkarstwa i kumpel po kiju, a NIE jak chatbot AI czy reklama z telewizji!

BEZWZGLĘDNY ZAKAZ UŻYWANIA FORMATOWANIA MARKDOWN (**pogrubienie**, *kursywa*, # nagłówek)!
Facebook NIE interpretuje Markdownu i wyświetla brzydkie gwiazdki '**', co wkurza czytelników.
Jeśli chcesz coś zaakcentować, użyj WIELKICH LITER, czytelnej nowej linii lub emoji. NIGDY NIE UŻYWAJ ZNAKÓW '**' ANI '*' W TREŚCI!

Elementy posta:
1. 🎯 CHWYTLIWY NAGŁÓWEK Z TYTUŁEM OKAZJI (wielkimi literami z emoji, np. 🚨 OKAZJA DLA WĘDKARZY: ${dealInfo?.title || customTopic})
2. 🎣 KRÓTKI OPIS I ZASTOSOWANIE: Do jakiej metody (feeder, spinning, karp itp.) i dlaczego warto.
3. 🛠️ KLUCZOWE PARAMETRY: 2-3 najważniejsze cechy wypunktowane punktorami '• ' (bez '**').
4. 💰 CENY:
   • Cena promocyjna: ${dealInfo?.price || 'Okazyjna'}
   ${dealInfo?.oldPrice ? `• Cena regularna: ${dealInfo.oldPrice}` : ''}
   ${dealInfo?.discount ? `• Oszczędność: ${dealInfo.discount}` : ''}
   • Sklep: ${dealInfo?.merchant || 'Sklep Wędkarski'}
5. 🤫 SEKCJA SPECJALNA BOTA:
${botRole === 'wife_secret' ? '   Krótka, zabawna wymówka / alibi dla żony ("Kochanie, kumpel oddawał za 25 zł") i plan na paczkomat po 21:30.' : ''}
${botRole === 'deal_hunter' ? '   Krótkie, bezlitosne porównanie do cen sklepowych i wyliczenie oszczędności.' : ''}
${botRole === 'gear_expert' ? '   Jedna konkretna rada testerska jak wycisnąć z tego maksa nad wodą.' : ''}
${botRole === 'angler_chatter' ? '   Otwarte pytanie do grupy o ich doświadczenia z tym modelem.' : ''}
6. 🔗 CALL TO ACTION:
   "👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w PIERWSZYM KOMENTARZU ⬇️!"
7. #️⃣ HASHTAGI NA KOŃCU:
   Zakończ post hashtagami: ${dynamicHashtags.join(' ')}.

Pamiętaj: zero '**', zwięźle, ludzki język!
`;

      const aiResponse = await ai.generate({
        prompt: promptText,
        config: {
          temperature: botRole === 'wife_secret' || botRole === 'angler_chatter' ? 0.75 : 0.4,
          maxOutputTokens: 2500,
        },
      });

      if (aiResponse && aiResponse.text) {
        postText = sanitizeSocialPostText(aiResponse.text);
        aiGenerated = true;
      }
    } catch (aiErr) {
      console.warn('AI Genkit generation error, falling back to curated fishing templates:', aiErr);
    }

    // Gwarancja braku '**' i obecności hashtagów
    if (postText) {
      postText = sanitizeSocialPostText(postText);
      if (!postText.includes('#')) {
        postText = `${postText.trim()}\n\n${dynamicHashtags.join(' ')}`;
      }
    }

    // Jeśli AI było offline, użyj bogatych, sprawdzonych szablonów zawierających tytuł, parametry i hashtagi
    if (!aiGenerated || !postText) {
      const itemTitle = dealInfo?.title || customTopic || 'Wędka / Kołowrotek Wędkarski';
      const priceStr = dealInfo?.price || '99,00 zł';
      const oldPriceStr = dealInfo?.oldPrice ? ` (zamiast ${dealInfo.oldPrice})` : '';
      const discStr = dealInfo?.discount ? ` [Rabat ${dealInfo.discount}]` : '';
      const storeStr = dealInfo?.merchant ? ` w sklepie ${dealInfo.merchant}` : '';
      const descSnippet = dealInfo?.description 
        ? `\n\n📖 OPIS SPRZĘTU:\n${dealInfo.description}` 
        : '\n\n📖 OPIS SPRZĘTU:\nNiezawodny sprzęt wędkarski dla wymagających pasjonatów. Świetna praca blanku, wysoka odporność komponentów i doskonałe właściwości użytkowe nad wodą.';
      const specsSnippet = dealInfo?.specs
        ? `\n\n🛠️ PARAMETRY TECHNICZNE:\n${dealInfo.specs}`
        : '\n\n🛠️ PARAMETRY TECHNICZNE:\n• Sprawdzona konstrukcja odporna na wysokie obciążenia\n• Płynna i precyzyjna praca mechanizmów\n• Zoptymalizowana waga i doskonałe wyważenie w ręce';

      if (botRole === 'wife_secret') {
        wifeAlibi = '„Kochanie, kumpel z koła oddawał za 30 zł bo mu zawadzało w piwnicy!”';
        postText = `🤫 [ALIBI DLA ŻONY] ${itemTitle}! 🎣\n\n` +
          `Panowie, wjechała potężna przecena na sprzęt, którego żaden szanujący się wędkarz nie może przepuścić:\n` +
          `👉 ${itemTitle}\n` +
          `${descSnippet}` +
          `${specsSnippet}\n\n` +
          `💸 ZESTAWIENIE CENOWE:\n` +
          `• 💰 Prawdziwa cena dla nas: ${priceStr}${oldPriceStr}${discStr}${storeStr}\n` +
          `• 🧾 Oficjalna wersja dla żony: "Kochanie, kumpel oddał za 30 zł bo kończy z wędkarstwem!" 😉\n\n` +
          `📦 PLAN OPERACJI PACZKOMATOWEJ:\n` +
          `1️⃣ Paczkomat wybierasz najdalej od domu (najlepiej przy stacji paliw).\n` +
          `2️⃣ Odbiór po 21:30 pod pretekstem "muszę iść sprawdzić czy w aucie szyba domknięta".\n` +
          `3️⃣ Pudełko ląduje w bagażniku pod kołem zapasowym aż do weekendowego wypadu.\n\n` +
          `Łapcie póki promocja trwa i żona nie patrzy na stan konta!\n\n` +
          `👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w 1. KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      } else if (botRole === 'deal_hunter') {
        postText = `🔥 [ŁOWCA OKAZJI] ${itemTitle}! 🎣\n\n` +
          `Wytropiliśmy konkretną promocję sprzętową dla naszej wędkarskiej ekipy!\n` +
          `👉 ${itemTitle}\n` +
          `${descSnippet}` +
          `${specsSnippet}\n\n` +
          `💰 ZESTAWIENIE CENOWE & OSZCZĘDNOŚĆ:\n` +
          `• 💸 Cena promocyjna: ${priceStr}\n` +
          (dealInfo?.oldPrice ? `• 🏷️ Cena regularna: ${dealInfo.oldPrice}\n` : '') +
          (dealInfo?.discount ? `• 📉 Realny rabat: ${dealInfo.discount}\n` : '') +
          `• 🏬 Sklep: ${dealInfo?.merchant || 'Partner'}\n` +
          `• 🌡️ Ocena społeczności: 130° (Mega Hit)\n\n` +
          `Dlaczego to bezkonkurencyjna oferta?\n` +
          `✅ Bezkonkurencyjny stosunek ceny do jakości w tym segmencie\n` +
          `✅ Sprawdzona konstrukcja z bardzo dobrymi opiniami wędkarzy\n` +
          `✅ Realna obniżka bez sztucznego pompowania ceny wyjściowej\n\n` +
          `Taki sprzęt w tych pieniądzach znika błyskawicznie!\n\n` +
          `👉 Bezpośredni link do zakupu i kody rabatowe znajdziecie w 1. KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      } else if (botRole === 'angler_chatter') {
        postText = `🐟 [WĘDKARSKIE POGADUCHY] ${itemTitle} ☕🎣\n\n` +
          `Cześć ekipa! Rzućcie okiem na dzisiejszy sprzętowy temat:\n` +
          `👉 ${itemTitle}\n` +
          `${descSnippet}` +
          `${specsSnippet}\n\n` +
          `💰 Cena promocyjna: ${priceStr}${oldPriceStr}${discStr}${storeStr}\n\n` +
          `Pytanie za 100 punktów do naszej grupy:\n` +
          `${customTopic || 'Kto z Was już łowił na ten sprzęt lub podobny model? Jak oceniacie pracę pod obciążeniem i spasowanie elementów? Piszcie w komentarzach swoje opinie i wrzucajcie fotki z ostatnich wypraw! 📸⬇️'}\n\n` +
          `👉 Szczegóły oferty i bezpośredni link znajdziecie w 1. KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      } else {
        postText = `🧭 [TEST & RECENZJA TESTERA] ${itemTitle}! 🔍\n\n` +
          `Zanim klikniecie "Kup Teraz", sprawdźcie naszą szybką analizę opłacalności tego sprzętu:\n` +
          `👉 ${itemTitle}\n` +
          `${descSnippet}` +
          `${specsSnippet}\n\n` +
          `🔍 OCENA TESTERA:\n` +
          `1️⃣ Płynność pracy i spasowanie mechanizmów pod obciążeniem – wzorowe w tej klasie.\n` +
          `2️⃣ Odporność na trudne warunki atmosferyczne, piasek i wilgoć.\n` +
          `3️⃣ Cena promocyjna (${priceStr}${oldPriceStr}) bije na głowę oferty w sklepach stacjonarnych.\n\n` +
          `Werdykt końcowy: Zdecydowanie polecamy w tym budżecie!\n\n` +
          `👉 Bezpośredni link do produktu i kod rabatowy znajdziecie w 1. KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      }
    }

    const directAffiliateLink = dealInfo?.dealUrl || (dealInfo
      ? resolveFishingAffiliateUrl(dealInfo, trackingCampaign)
      : resolveFishingAffiliateUrl(params.targetDealData?.dealUrl || 'https://okazjeplus.pl', trackingCampaign));

    if (directAffiliateLink) {
      firstComment = `🔗 Bezpośredni link do okazji i kod rabatowy w sklepie:\n${directAffiliateLink}`;
    }

    const queueItem: Partial<FishingPostQueueItem> = {
      botId: bot.id,
      botRole,
      botName: bot.name,
      status: 'pending',
      dealId: dealId || undefined,
      title: generatedTitle,
      content: postText,
      wifeAlibi: wifeAlibi || undefined,
      realPrice: dealInfo?.price || undefined,
      discountStr: dealInfo?.discount || undefined,
      linkUrl: directAffiliateLink,
      imageUrl: dealInfo?.imageUrl || undefined,
      hashtags: dynamicHashtags,
      firstComment: firstComment || undefined,
      targets: {
        facebook: true,
        portal: bot.target === 'both' || bot.target === 'portal',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      item: queueItem,
    };
  } catch (error) {
    console.error('Error generating fishing post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Błąd generowania posta',
    };
  }
}

export async function generateFishingPostAction(
  params: {
    botRole: FishingBotRole;
    dealId?: string;
    customTopic?: string;
    targetDealData?: {
      title: string;
      description?: string;
      specs?: string;
      tags?: string[];
      price?: string;
      oldPrice?: string;
      discount?: string;
      merchant?: string;
      imageUrl?: string;
      dealUrl?: string;
    };
    humorLevel?: 'subtle' | 'high' | 'legendary' | 'none';
  }
): Promise<{
  success: boolean;
  item?: Partial<FishingPostQueueItem>;
  error?: string;
}> {
  return generateFishingPost(params, false);
}

// ============================================================================
// KOLEJKA MODERACJI I PUBLIKACJA
// ============================================================================

export async function addPostToFishingQueue(
  item: Omit<FishingPostQueueItem, 'id'>,
  skipAuth: boolean = false
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const ref = await adminDb.collection('fishingPostsQueue').add({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    } catch {}
    return { success: true, id: ref.id };
  } catch (error) {
    console.error('Error adding to queue:', error);
    return { success: false, error: 'Błąd dodawania do kolejki' };
  }
}

export async function addPostToFishingQueueAction(
  item: Omit<FishingPostQueueItem, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  return addPostToFishingQueue(item, false);
}

export async function getFishingQueueAction(statusFilter?: string): Promise<{
  success: boolean;
  items: FishingPostQueueItem[];
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, items: [], error: 'Wymagane uprawnienia administratora' };
    }

    let q = adminDb.collection('fishingPostsQueue').orderBy('createdAt', 'desc').limit(50);
    if (statusFilter && statusFilter !== 'all') {
      q = adminDb.collection('fishingPostsQueue').where('status', '==', statusFilter).orderBy('createdAt', 'desc').limit(50);
    }

    const snap = await q.get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FishingPostQueueItem));

    return { success: true, items };
  } catch (error) {
    console.error('Error fetching fishing queue:', error);
    return { success: false, items: [], error: 'Błąd pobierania kolejki' };
  }
}

export async function updateFishingQueueItemAction(
  id: string,
  updates: Partial<FishingPostQueueItem>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('fishingPostsQueue').doc(id).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error updating queue item:', error);
    return { success: false, error: 'Błąd aktualizacji posta' };
  }
}

export async function deleteFishingQueueItemAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('fishingPostsQueue').doc(id).delete();
    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error deleting queue item:', error);
    return { success: false, error: 'Błąd usuwania posta' };
  }
}

// ============================================================================
// PUBLIKACJA POSTA (FACEBOOK + PORTAL)
// ============================================================================

export async function publishFishingPost(
  postId: string,
  options?: {
    publishToFb?: boolean;
    publishToPortal?: boolean;
    customContent?: string;
  },
  skipAuth: boolean = false
): Promise<{
  success: boolean;
  fbPostId?: string;
  fbPostUrl?: string;
  portalDealId?: string;
  error?: string;
}> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const docRef = adminDb.collection('fishingPostsQueue').doc(postId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Post nie został znaleziony w kolejce' };
    }

    const post = { id: snap.id, ...snap.data() } as FishingPostQueueItem;
    const content = options?.customContent || post.content;
    const doPublishFb = options?.publishToFb !== undefined ? options.publishToFb : post.targets.facebook;
    const doPublishPortal = options?.publishToPortal !== undefined ? options.publishToPortal : post.targets.portal;

    const configRes = await getFishingAutopilotConfig(true);
    const config = configRes.config;

    let fbPostId: string | undefined;
    let fbPostUrl: string | undefined;
    let portalDealId: string | undefined;
    let publishError: string | undefined;

    const trackingCampaign = config.tracking?.campaign || 'Fishing_2';
    const finalTrackingLink = post.linkUrl
      ? resolveFishingAffiliateUrl(post.linkUrl, trackingCampaign)
      : undefined;

    // 1. Publikacja na Facebooku (Page / Group)
    if (doPublishFb && config.fb.accessToken && config.fb.pageId) {
      try {
        const pageId = config.fb.pageId;
        const token = config.fb.accessToken;

        // Jeśli post zawiera zdjęcie
        if (post.imageUrl && config.fb.includePhoto) {
          const photoUrl = `https://graph.facebook.com/v19.0/${pageId}/photos`;
          const photoRes = await fetch(photoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: post.imageUrl,
              caption: content,
              access_token: token,
            }),
          });

          const photoData = await photoRes.json();
          if (photoRes.ok && (photoData.post_id || photoData.id)) {
            fbPostId = photoData.post_id || photoData.id;
          } else {
            console.warn('[Facebook] Photo upload failed, trying feed:', photoData);
            // Fallback do feed
            const feedUrl = `https://graph.facebook.com/v19.0/${pageId}/feed`;
            const feedBody: any = {
              message: content,
              access_token: token,
            };
            if (finalTrackingLink) feedBody.link = finalTrackingLink;

            const feedRes = await fetch(feedUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(feedBody),
            });
            const feedData = await feedRes.json();
            if (feedRes.ok && feedData.id) {
              fbPostId = feedData.id;
            } else {
              throw new Error(feedData.error?.message || photoData.error?.message || 'Błąd publikacji na FB');
            }
          }
        } else {
          // Publikacja jako post tekstowy z linkiem
          const feedUrl = `https://graph.facebook.com/v19.0/${pageId}/feed`;
          const feedBody: any = {
            message: content,
            access_token: token,
          };
          if (finalTrackingLink) feedBody.link = finalTrackingLink;

          const feedRes = await fetch(feedUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedBody),
          });
          const feedData = await feedRes.json();
          if (feedRes.ok && feedData.id) {
            fbPostId = feedData.id;
          } else {
            throw new Error(feedData.error?.message || 'Błąd publikacji na FB');
          }
        }

        if (fbPostId) {
          fbPostUrl = `https://www.facebook.com/${fbPostId}`;

          // Dodaj pierwszy komentarz z bezpośrednim linkiem jeśli włączone
          if (config.fb.autoPostFirstComment && finalTrackingLink) {
            try {
              const commentUrl = `https://graph.facebook.com/v19.0/${fbPostId}/comments`;
              await fetch(commentUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: `🔗 Bezpośredni link do okazji i kod rabatowy:\n${finalTrackingLink}`,
                  access_token: token,
                }),
              });
            } catch (commentErr) {
              console.warn('[Facebook] First comment error:', commentErr);
            }
          }
        }
      } catch (fbErr: any) {
        console.error('FB publish error:', fbErr);
        publishError = fbErr.message;
      }
    }

    // 2. Publikacja w Portalu Okazje Plus
    if (doPublishPortal && !post.dealId) {
      try {
        const cleanPrice = post.realPrice ? parseFloat(post.realPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) : 99.0;
        const newDealDoc = {
          title: { pl: post.title },
          description: { pl: content },
          price: cleanPrice,
          legacyPrice: cleanPrice,
          link: post.linkUrl,
          image: post.imageUrl || '',
          imageHint: 'sprzęt wędkarski',
          category: 'sport-turystyka',
          mainCategorySlug: 'sport-turystyka',
          subCategorySlug: 'wedkarstwo',
          subSubCategorySlug: 'kolowrotki-wedki',
          merchant: 'Wędkarskie Promocje',
          status: config.portal.defaultStatus || 'approved',
          temperature: 20,
          voteCount: 1,
          commentsCount: 0,
          source: 'manual',
          dealType: 'sale',
          tags: ['wędkarstwo', 'sprzęt wędkarski', 'promocje wędkarskie', 'żona nie widzi'],
          postedBy: config.portal.authorName,
          postedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verified: true,
          verifiedAt: new Date().toISOString(),
        };

        const dealRef = await adminDb.collection('deals').add(newDealDoc);
        portalDealId = dealRef.id;
      } catch (portalErr) {
        console.error('Portal deal creation error:', portalErr);
      }
    } else if (post.dealId) {
      portalDealId = post.dealId;
    }

    // 3. Zaktualizuj stan posta w kolejce
    const hasSucceeded = Boolean(fbPostId || portalDealId);
    const updatedStatus = hasSucceeded ? 'posted' : 'failed';

    await docRef.set({
      content,
      status: updatedStatus,
      fbPostId: fbPostId || post.fbPostId,
      fbPostUrl: fbPostUrl || post.fbPostUrl,
      portalDealId: portalDealId || post.portalDealId,
      publishedAt: hasSucceeded ? new Date().toISOString() : undefined,
      errorMessage: publishError,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // 4. Zaktualizuj statystyki bota i konfiguracji
    if (hasSucceeded) {
      if (post.botId) {
        try {
          const botRef = adminDb.collection('fishingBotPersonas').doc(post.botId);
          const botSnap = await botRef.get();
          if (botSnap.exists) {
            const botData = botSnap.data()!;
            await botRef.update({
              totalPublished: (botData.totalPublished || 0) + 1,
            });
          }
        } catch {}
      }

      await adminDb.collection('systemSettings').doc(CONFIG_DOC_ID).set({
        stats: {
          totalGenerated: (config.stats.totalGenerated || 0) + 1,
          totalPublishedFb: (config.stats.totalPublishedFb || 0) + (fbPostId ? 1 : 0),
          totalPublishedPortal: (config.stats.totalPublishedPortal || 0) + (portalDealId ? 1 : 0),
          lastPublishedAt: new Date().toISOString(),
        },
      }, { merge: true });
    }

    try {
      revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    } catch {}

    if (!hasSucceeded && publishError) {
      return { success: false, error: publishError };
    }

    return {
      success: true,
      fbPostId,
      fbPostUrl,
      portalDealId,
    };
  } catch (error) {
    console.error('Error publishing fishing post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Błąd publikacji posta',
    };
  }
}

export async function publishFishingPostAction(
  postId: string,
  options?: {
    publishToFb?: boolean;
    publishToPortal?: boolean;
    customContent?: string;
  }
): Promise<{
  success: boolean;
  fbPostId?: string;
  fbPostUrl?: string;
  portalDealId?: string;
  error?: string;
}> {
  return publishFishingPost(postId, options, false);
}

// ============================================================================
// RĘCZNE DODAJE OKAZJI WĘDKARSKIEJ (DO PORTALU + NA FB)
// ============================================================================

export async function createManualFishingDealAndPostAction(params: {
  title: string;
  price: number;
  originalPrice?: number;
  dealUrl: string;
  imageUrl?: string;
  merchant?: string;
  description?: string;
  subCategory?: string;
  publishFbNow?: boolean;
  botRole?: FishingBotRole;
}): Promise<{
  success: boolean;
  dealId?: string;
  postId?: string;
  fbPostUrl?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const {
      title,
      price,
      originalPrice,
      dealUrl,
      imageUrl,
      merchant,
      description,
      subCategory = 'kolowrotki-wedki',
      publishFbNow = true,
      botRole = 'wife_secret',
    } = params;

    const directAffiliateUrl = resolveFishingAffiliateUrl(dealUrl, 'Fishing_2');

    // 1. Zapisz deal w Firestore
    const newDealDoc = {
      title: { pl: title },
      description: { pl: description || title },
      price: price,
      originalPrice: originalPrice,
      legacyPrice: price,
      link: directAffiliateUrl,
      affiliateLink: directAffiliateUrl,
      image: imageUrl || '',
      imageHint: 'sprzęt wędkarski',
      category: 'sport-turystyka',
      mainCategorySlug: 'sport-turystyka',
      subCategorySlug: 'wedkarstwo',
      subSubCategorySlug: subCategory,
      merchant: merchant || 'Sklep Wędkarski',
      merchantName: merchant || 'Sklep Wędkarski',
      status: 'approved',
      temperature: 20,
      voteCount: 1,
      commentsCount: 0,
      source: 'manual',
      dealType: 'sale',
      tags: ['wędkarstwo', 'sprzęt wędkarski', 'promocje wędkarskie', 'żona nie widzi'],
      postedBy: 'Wędkarskie Promocje (Żona nie widzi)',
      postedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verified: true,
      verifiedAt: new Date().toISOString(),
    };

    const dealRef = await adminDb.collection('deals').add(newDealDoc);
    const dealId = dealRef.id;

    // 2. Wygeneruj post AI
    const genRes = await generateFishingPostAction({
      botRole,
      dealId,
      targetDealData: {
        title,
        price: `${price.toFixed(2)} zł`,
        oldPrice: originalPrice ? `${originalPrice.toFixed(2)} zł` : undefined,
        discount: originalPrice && originalPrice > price ? `-${Math.round(((originalPrice - price) / originalPrice) * 100)}%` : undefined,
        merchant,
        imageUrl,
        dealUrl: directAffiliateUrl,
      },
    });

    if (!genRes.success || !genRes.item) {
      return { success: true, dealId };
    }

    // 3. Dodaj do kolejki
    const queueAddRes = await addPostToFishingQueueAction(genRes.item as any);
    const postId = queueAddRes.id;

    let fbPostUrl: string | undefined;

    // 4. Jeśli włączono natychmiastową publikację na FB
    if (publishFbNow && postId) {
      const pubRes = await publishFishingPostAction(postId, {
        publishToFb: true,
        publishToPortal: false, // portal deal już utworzony powyżej
      });
      fbPostUrl = pubRes.fbPostUrl;
    }

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    revalidatePath('/[locale]/deals', 'page');

    return {
      success: true,
      dealId,
      postId,
      fbPostUrl,
    };
  } catch (error) {
    console.error('Error creating manual fishing deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Błąd dodawania okazji',
    };
  }
}

// ============================================================================
// POBIERANIE OFERT OD PARTNERÓW (CONVERTISER, TRADETRACKER, ALIEXPRESS)
// ============================================================================

export async function harvestFishingPartnerOffers(
  options?: {
    sources?: ('convertiser' | 'tradetracker' | 'aliexpress')[];
    keywords?: string[];
    limitPerSource?: number;
  },
  skipAuth: boolean = false
): Promise<{
  success: boolean;
  importedCount: number;
  resultsBySource: Record<string, number>;
  message: string;
  error?: string;
}> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { 
          success: false, 
          importedCount: 0, 
          resultsBySource: {}, 
          message: '', 
          error: 'Wymagane uprawnienia administratora' 
        };
      }
    }

    const configRes = await getFishingAutopilotConfig(true);
    const config = configRes.config;

    const sources = options?.sources || (['convertiser', 'tradetracker', 'aliexpress'] as const);
    const keywords = options?.keywords || [
      'wędka spinningowa', 'wędka feeder', 'wędka karpiowa', 'kołowrotek wędkarski',
      'kołowrotek', 'ponton wędkarski', 'ponton', 'wobler', 'wodery wędkarskie',
      'echosonda wędkarska', 'echosonda', 'plecionka sumowa', 'sygnalizator brań',
      'fotel wędkarski', 'Daiwa', 'Caperlan', 'Fox Rage', 'Mikado', 'Shimano'
    ];
    const limitPerSource = options?.limitPerSource || 25;

    const resultsBySource: Record<string, number> = {
      convertiser: 0,
      tradetracker: 0,
      aliexpress: 0,
    };
    let totalImported = 0;

    // Deduplikacja: pobierz ostatnie 500 deali
    const existingSnap = await adminDb.collection('deals').orderBy('createdAt', 'desc').limit(500).get();
    const existingLinks = new Set(existingSnap.docs.map(d => d.data().link).filter(Boolean));
    const existingTitles = new Set(existingSnap.docs.map(d => (d.data().title?.pl || d.data().title || '').toLowerCase().trim()).filter(Boolean));

    const STRICT_NEGATIVE = [
      'pies', 'kot', 'koc', 'zwierz', 'gryzoń', 'szczur', 'mysz', 'chomik',
      'kuchenka', 'palnik', 'patelnia', 'garnek', 'rondel', 'talerz', 'sztućce',
      'kolczyki', 'pierścionek', 'naszyjnik', 'etui na telefon', 'joy-con', 'switch',
      'baby', 'kids', 'dzieci', 'niemowl', 'drewniana wędka', 'zabawk', 'stolik krab',
      'lego', 'klocki', 'narożnik', 'tapicerka', 'tkanina', 'lutowni', 'topnik', 'cyna',
      'wyciąg górny', 'wyciąg dolny', 'treningowy', 'siłowni', 'sukienka', 'biustonosz',
      'majtki', 'kurtka narciarska', 'narty', 'sunglasses', 'okulary', 'okular', 'lampenschirme',
      'obudowa', 'ładowarka', 'poliestrowa', 'legrand', 'düwi', 'kuszy', 'łowiectwa podwodnego',
      'kapelusz', 'czapka', 'topslang', 'koszulk', 'ssz 230v', 'eaton', 'greenblue', 'retoo',
      'satel', 'siemens', 'dahua', 'gazex', 'traktorek', 'napięcia'
    ];

    // 1. CONVERTISER PARTNER FETCH
    if (sources.includes('convertiser') && config.partners?.convertiser) {
      try {
        const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
        const client = getConvertiserClient();

        for (const kw of keywords) {
          if (resultsBySource.convertiser >= limitPerSource) break;
          try {
            const resp = await client.searchProducts(
              { title: kw, country: 'PL' },
              { page: 1, page_size: 20 }
            ) as any;
            const items = resp.data || resp.results || [];
            for (const item of items) {
              const title = (item.title || item.name || '').trim();
              if (!title) continue;
              const titleLower = title.toLowerCase();
              if (STRICT_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

              const priceNum = typeof item.price === 'number'
                ? item.price
                : parseFloat(String(item.price || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
              if (isNaN(priceNum) || priceNum < 15) continue;

              const rawLink = item.direct_link || item.tracking_link || item.url || `https://convertiser.com/products/${item.id}/`;
              const affiliateLink = resolveFishingAffiliateUrl(rawLink, config.tracking?.campaign || 'Fishing_2');
              if (existingLinks.has(affiliateLink) || existingTitles.has(titleLower)) continue;

              const origPriceNum = item.old_price 
                ? parseFloat(String(item.old_price).replace(/[^0-9.,]/g, '').replace(',', '.')) 
                : undefined;
              const merchant = item.offer || item.merchant || item.brand || (rawLink.includes('decathlon') ? 'Decathlon.pl' : 'Sklep partnerski');
              const imageUrl = item.images?.default || item.image_link || item.images?.thumb_180 || item.image_url || '';

              let subSubCategorySlug = 'kolowrotki-wedki';
              if (titleLower.includes('wobler') || titleLower.includes('przynęt') || titleLower.includes('błystk') || titleLower.includes('twister')) {
                subSubCategorySlug = 'przynety-zanety';
              } else if (titleLower.includes('plecionk') || titleLower.includes('żyłk')) {
                subSubCategorySlug = 'zylki-plecionki';
              } else if (titleLower.includes('ponton') || titleLower.includes('woder') || titleLower.includes('fotel') || titleLower.includes('namiot')) {
                subSubCategorySlug = 'biwak-wedkarski';
              } else if (titleLower.includes('echosond') || titleLower.includes('sygnalizator') || titleLower.includes('podbierak')) {
                subSubCategorySlug = 'akcesoria-wedkarskie';
              }

              const dealDoc = {
                title: { pl: title },
                description: { pl: item.description || title },
                price: priceNum,
                originalPrice: origPriceNum,
                legacyPrice: priceNum,
                link: affiliateLink,
                affiliateLink: affiliateLink,
                image: imageUrl,
                imageHint: 'sprzęt wędkarski',
                category: 'sport-turystyka',
                mainCategorySlug: 'sport-turystyka',
                subCategorySlug: 'wedkarstwo',
                subSubCategorySlug,
                merchant,
                merchantName: merchant,
                status: 'approved',
                temperature: Math.floor(Math.random() * 15) + 15,
                voteCount: 1,
                commentsCount: 0,
                source: 'convertiser',
                dealType: 'sale',
                tags: ['wędkarstwo', 'convertiser', 'promocje wędkarskie', 'żona nie widzi', merchant.toLowerCase()],
                postedBy: `Wędkarskie Promocje (${merchant})`,
                postedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                verified: true,
                verifiedAt: new Date().toISOString(),
              };

              await adminDb.collection('deals').add(dealDoc);
              existingLinks.add(affiliateLink);
              existingTitles.add(titleLower);
              resultsBySource.convertiser++;
              totalImported++;
              if (resultsBySource.convertiser >= limitPerSource) break;
            }
          } catch (cErr) {
            console.warn('[Convertiser] Keyword search failed for:', kw, cErr);
          }
        }
      } catch (convErr) {
        console.error('[Convertiser] Harvesting error:', convErr);
      }
    }

    // 2. TRADETRACKER PARTNER FETCH
    if (sources.includes('tradetracker') && config.partners?.tradetracker) {
      try {
        const { getTradeTrackerClient } = await import('@/lib/integrations/tradetracker-client');
        const ttClient = getTradeTrackerClient({
          customerId: config.partners.tradeTrackerCustomerId,
          passphrase: config.partners.tradeTrackerPassphrase,
          affiliateSiteId: config.partners.tradeTrackerSiteId,
          feedUrl: config.partners.tradeTrackerFeedUrl,
        });

        for (const kw of keywords.slice(0, 4)) {
          if (resultsBySource.tradetracker >= limitPerSource) break;
          try {
            const items = await ttClient.searchProducts({
              query: kw,
              limit: 12,
              feedUrl: config.partners.tradeTrackerFeedUrl,
              mode: 'products',
            });

            const { buildTradeTrackerTrackingLink } = await import('@/lib/integrations/tradetracker-affiliate-link');

            for (const item of items) {
              if (!item.name) continue;
              const rawLink = item.productURL;
              const link = buildTradeTrackerTrackingLink(rawLink, config.tracking?.campaign || 'Fishing_2', {
                affiliateSiteId: config.partners.tradeTrackerSiteId,
              });
              if (existingLinks.has(link) || existingTitles.has(item.name.toLowerCase().trim())) continue;

              const priceNum = item.price || 0;
              if (priceNum <= 0) continue;

              const dealDoc = {
                title: { pl: item.name },
                description: { pl: item.description || item.name },
                price: priceNum,
                originalPrice: item.fromPrice,
                legacyPrice: priceNum,
                link,
                affiliateLink: link,
                image: item.imageURL || '',
                imageHint: 'sprzęt wędkarski',
                category: 'sport-turystyka',
                mainCategorySlug: 'sport-turystyka',
                subCategorySlug: 'wedkarstwo',
                subSubCategorySlug: 'kolowrotki-wedki',
                merchant: item.merchantName || 'TradeTracker Partner',
                merchantName: item.merchantName || 'TradeTracker Partner',
                status: 'approved',
                temperature: Math.floor(Math.random() * 15) + 15,
                voteCount: 1,
                commentsCount: 0,
                source: 'tradetracker',
                dealType: 'sale',
                tags: ['wędkarstwo', 'tradetracker', 'promocje wędkarskie', 'żona nie widzi'],
                postedBy: 'Wędkarskie Promocje (TradeTracker Partner)',
                postedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                verified: true,
                verifiedAt: new Date().toISOString(),
              };

              await adminDb.collection('deals').add(dealDoc);
              existingLinks.add(link);
              existingTitles.add(item.name.toLowerCase().trim());
              resultsBySource.tradetracker++;
              totalImported++;
              if (resultsBySource.tradetracker >= limitPerSource) break;
            }
          } catch (ttErr) {
            console.warn('[TradeTracker] Search failed for:', kw, ttErr);
          }
        }
      } catch (ttMainErr) {
        console.error('[TradeTracker] Harvesting error:', ttMainErr);
      }
    }

    // 3. ALIEXPRESS PARTNER FETCH
    if (sources.includes('aliexpress') && (config.partners?.aliexpress ?? true)) {
      try {
        const aliLiveKeywords = [
          'fishing reel', 'spinning rod', 'fishing lure', 'wobbler crankbait',
          'braided fishing line', 'carp fishing', 'kołowrotek wędkarski', 'wędka spinningowa'
        ];

        // 3a. Wywołaj wyszukiwanie przez AliExpress API jeśli klient jest skonfigurowany
        try {
          const { createAliExpressClient } = await import('@/integrations/aliexpress/client');
          const aliClient = createAliExpressClient();
          for (const kw of aliLiveKeywords) {
            if (resultsBySource.aliexpress >= limitPerSource) break;
            try {
              const searchRes = await aliClient.searchProducts({
                q: kw,
                limit: Math.min(limitPerSource, 20),
                sort: 'orders',
                targetCurrency: 'PLN',
                targetLanguage: 'PL',
                shipToCountry: 'PL',
              });

              if (searchRes.success && Array.isArray(searchRes.products)) {
                for (const p of searchRes.products) {
                  if (resultsBySource.aliexpress >= limitPerSource) break;
                  const titleStr = p.title || '';
                  const titleLower = titleStr.toLowerCase();
                  if (STRICT_NEGATIVE.some(neg => titleLower.includes(neg))) continue;
                  const currentPrice = (p as any).price?.current ?? (p as any).salePrice ?? 0;
                  const priceNum = typeof currentPrice === 'number'
                    ? currentPrice
                    : parseFloat(String(currentPrice || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
                  if (isNaN(priceNum) || priceNum < 5) continue;
                  const origPrice = (p as any).price?.original ?? (p as any).originalPrice;
                  const origPriceNum = typeof origPrice === 'number'
                    ? origPrice
                    : (origPrice ? parseFloat(String(origPrice).replace(/[^0-9.,]/g, '').replace(',', '.')) : undefined);
                  const rawLink = (p as any).product_url || (p as any).promotionLink || (p as any).productUrl || `https://www.aliexpress.com/item/${(p as any).item_id || (p as any).productId}.html`;
                  const trackedLink = resolveFishingAffiliateUrl(rawLink, config.tracking?.campaign || 'Fishing_2');
                  if (existingLinks.has(trackedLink) || existingTitles.has(titleLower)) continue;

                  let subSubCat = 'kolowrotki-wedki';
                  if (titleLower.includes('wobbler') || titleLower.includes('lure') || titleLower.includes('przynęt') || titleLower.includes('crankbait')) {
                    subSubCat = 'przynety-zanety';
                  } else if (titleLower.includes('line') || titleLower.includes('plecionk') || titleLower.includes('żyłk')) {
                    subSubCat = 'zylki-plecionki';
                  }

                  const imageUrl = Array.isArray((p as any).image_urls) && (p as any).image_urls.length > 0
                    ? (p as any).image_urls[0]
                    : ((p as any).imageUrl || '');

                  const newDeal = {
                    title: { pl: titleStr, en: titleStr },
                    description: { pl: titleStr, en: titleStr },
                    price: priceNum,
                    originalPrice: origPriceNum,
                    legacyPrice: priceNum,
                    link: trackedLink,
                    affiliateLink: trackedLink,
                    image: imageUrl,
                    imageHint: 'sprzęt wędkarski aliexpress',
                    category: 'sport-turystyka',
                    mainCategorySlug: 'sport-turystyka',
                    subCategorySlug: 'wedkarstwo',
                    subSubCategorySlug: subSubCat,
                    merchant: 'AliExpress',
                    merchantName: 'AliExpress',
                    status: 'approved',
                    temperature: 20,
                    voteCount: 1,
                    commentsCount: 0,
                    source: 'aliexpress',
                    dealType: 'sale',
                    tags: ['wędkarstwo', 'aliexpress', 'promocje wędkarskie', 'żona nie widzi'],
                    postedBy: 'Wędkarskie Promocje (AliExpress)',
                    postedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    verified: true,
                    verifiedAt: new Date().toISOString(),
                  };

                  await adminDb.collection('deals').add(newDeal);
                  existingLinks.add(trackedLink);
                  existingTitles.add(titleLower);
                  resultsBySource.aliexpress++;
                  totalImported++;
                }
              }
            } catch (kwErr) {
              console.warn('[AliExpress API] Search error for kw:', kw, kwErr);
            }
          }
        } catch (apiErr) {
          console.warn('[AliExpress API] Client init error in harvest:', apiErr);
        }

        // 3b. Uzupełniająco: sprawdź istniejące oferty z AliExpress w Firestore i oznacz jako wędkarskie
        if (resultsBySource.aliexpress < limitPerSource) {
          const aliSnap = await adminDb
            .collection('deals')
            .where('source', '==', 'aliexpress')
            .where('status', '==', 'approved')
            .limit(500)
            .get();

          const batch = adminDb.batch();
          let batchCount = 0;

          const aliFishingKeywords = [
            'fishing', 'fish rod', 'fishing rod', 'fishing reel', 'baitcasting',
            'fishing lure', 'crankbait', 'wobbler', 'fishing hook', 'fishing line',
            'fishing tackle', 'fishing bait', 'fishing net', 'fishing pliers',
            'carp fishing', 'fly fishing', 'ice fishing', 'swivel hook', 'treble hook',
            'minnow lure', 'popper bait', 'hard bait', 'artificial bait', 'lead sinker',
            'trolling lure', 'jig lure', 'wędka', 'kołowrotek', 'plecionka'
          ];

          for (const doc of aliSnap.docs) {
            if (resultsBySource.aliexpress >= limitPerSource) break;
            const data = doc.data();
            const titlePl = (data.title?.pl || '').toLowerCase();
            const titleEn = (data.title?.en || '').toLowerCase();
            const titleStr = typeof data.title === 'string' ? data.title.toLowerCase() : '';
            const fullTitle = `${titlePl} ${titleEn} ${titleStr}`;
            const descStr = (typeof data.description === 'string' ? data.description : (data.description?.pl || '')).toLowerCase();
            const combined = `${fullTitle} ${descStr}`;

            if (STRICT_NEGATIVE.some(neg => combined.includes(neg))) continue;
            if (!aliFishingKeywords.some(kw => combined.includes(kw))) continue;

            const tags = Array.isArray(data.tags) ? [...data.tags] : [];
            let needsUpdate = false;

            if (!tags.includes('wędkarstwo')) { tags.push('wędkarstwo'); needsUpdate = true; }
            if (!tags.includes('aliexpress')) { tags.push('aliexpress'); needsUpdate = true; }
            if (!tags.includes('promocje wędkarskie')) { tags.push('promocje wędkarskie'); needsUpdate = true; }
            if (!tags.includes('żona nie widzi')) { tags.push('żona nie widzi'); needsUpdate = true; }

            if (data.subCategorySlug !== 'wedkarstwo') {
              needsUpdate = true;
            }

            if (needsUpdate) {
              const trackedLink = resolveFishingAffiliateUrl({
                id: doc.id,
                ...data,
                source: 'aliexpress',
              }, config.tracking?.campaign || 'Fishing_2');

              batch.update(doc.ref, {
                subCategorySlug: 'wedkarstwo',
                mainCategorySlug: 'sport-turystyka',
                category: 'sport-turystyka',
                tags,
                affiliateLink: trackedLink,
                verified: true,
                updatedAt: new Date().toISOString(),
              });

              batchCount++;
              resultsBySource.aliexpress++;
              totalImported++;

              if (batchCount >= 450) {
                await batch.commit();
                batchCount = 0;
              }
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }
        }
      } catch (aliErr) {
        console.error('[AliExpress] Harvesting error:', aliErr);
      }
    }

    try {
      revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
      revalidatePath('/[locale]/deals', 'page');
    } catch {}

    const message = `Pobrano/zaktualizowano łącznie ${totalImported} ofert wędkarskich (Convertiser: ${resultsBySource.convertiser}, TradeTracker: ${resultsBySource.tradetracker}, AliExpress: ${resultsBySource.aliexpress}).`;

    return {
      success: true,
      importedCount: totalImported,
      resultsBySource,
      message,
    };
  } catch (error) {
    console.error('Error harvesting partner fishing deals:', error);
    return {
      success: false,
      importedCount: 0,
      resultsBySource: {},
      message: 'Błąd pobierania ofert od partnerów',
      error: error instanceof Error ? error.message : 'Błąd serwera',
    };
  }
}

export async function harvestFishingPartnerOffersAction(options?: {
  sources?: ('convertiser' | 'tradetracker' | 'aliexpress')[];
  keywords?: string[];
  limitPerSource?: number;
}): Promise<{
  success: boolean;
  importedCount: number;
  resultsBySource: Record<string, number>;
  message: string;
  error?: string;
}> {
  return harvestFishingPartnerOffers(options, false);
}

// ============================================================================
// CYKL AUTOPILOTA (TRIGGER NA ŻĄDANIE LUB CRON)
// ============================================================================

export async function executeFishingAutopilotCycle(options?: {
  isSystemCron?: boolean;
  force?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  postId?: string;
  published?: boolean;
  error?: string;
}> {
  try {
    const configRes = await getFishingAutopilotConfig(true);
    const config = configRes.config;

    if (!config.enabled) {
      return { success: false, message: 'Autopilot wędkarski jest wyłączony w ustawieniach.' };
    }

    // Walidacja harmonogramu dla wywołań cronowych (jeśli nie wymuszone)
    if (options?.isSystemCron && !options?.force) {
      const timezone = 'Europe/Warsaw';

      // 1. Sprawdź limit dzienny
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayPostsSnap = await adminDb
        .collection('fishingPostsQueue')
        .where('status', '==', 'posted')
        .where('publishedAt', '>=', todayStart.toISOString())
        .limit(20)
        .get();

      const dailyLimit = config.schedule?.dailyLimit || 4;
      if (todayPostsSnap.size >= dailyLimit) {
        return {
          success: false,
          message: `Osiągnięto dzienny limit publikacji (${todayPostsSnap.size}/${dailyLimit} postów dzisiaj).`,
        };
      }

      // 2. Sprawdź interwał godzinowy
      const intervalHours = config.schedule?.intervalHours || 4;
      if (config.stats?.lastPublishedAt) {
        const diffMinutes = (Date.now() - new Date(config.stats.lastPublishedAt).getTime()) / (1000 * 60);
        if (diffMinutes < (intervalHours * 60 - 20)) {
          return {
            success: false,
            message: `Interwał publikacji (${intervalHours}h) jeszcze nie upłynął (${Math.round(diffMinutes)} min od ostatniej publikacji).`,
          };
        }
      }
    }

    // A. SPRAWDŹ CZY W KOLEJCE CZEKA JUŻ ZATWIERDZONY / OCZEKUJĄCY POST
    const pendingSnap = await adminDb
      .collection('fishingPostsQueue')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (!pendingSnap.empty && config.mode === 'autopilot') {
      const pendingDoc = pendingSnap.docs[0];
      const pubRes = await publishFishingPost(pendingDoc.id, undefined, true);
      return {
        success: pubRes.success,
        message: pubRes.success
          ? '🚀 Opublikowano oczekujący post z kolejki moderacji!'
          : `Błąd publikacji oczekującego posta: ${pubRes.error}`,
        postId: pendingDoc.id,
        published: pubRes.success,
        error: pubRes.error,
      };
    }

    // B. GENEROWANIE NOWEGO POSTA
    // 1. Pobierz najlepsze okazje wędkarskie
    let dealsRes = await getFishingDeals(undefined, 40, undefined, true);
    let deals = dealsRes.deals;

    // 2. Jeśli brakuje ofert, automatycznie wywołaj harvest z Convertiser / TradeTracker / AliExpress
    if (deals.length < 5) {
      await harvestFishingPartnerOffers(undefined, true);
      dealsRes = await getFishingDeals(undefined, 40, undefined, true);
      deals = dealsRes.deals;
    }

    // 3. Pobierz ostatnio opublikowane (ostatnie 7 dni), aby nie dublować
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentPostsSnap = await adminDb
      .collection('fishingPostsQueue')
      .where('createdAt', '>=', recentCutoff)
      .limit(100)
      .get();

    const postedDealIds = new Set(recentPostsSnap.docs.map(d => d.data().dealId).filter(Boolean));
    const unpostedDeals = deals.filter(d => !postedDealIds.has(d.id));

    // Sprawdź kategorie ostatnich postów, aby wykluczyć powtórzenia (np. kołowrotek po kołowrotku)
    const recentCategories = recentPostsSnap.docs.slice(0, 5).map(d => {
      const data = d.data();
      return detectDealCategory(data.title || '', data.content || '', 'fishing');
    }).filter(Boolean);

    const diverseRec = pickDiverseRecommendation(unpostedDeals.length > 0 ? unpostedDeals : deals, {
      niche: 'fishing',
      recentCategories,
      excludeDealIds: Array.from(postedDealIds) as string[],
    });

    const selectedDeal = diverseRec.deal || unpostedDeals[0] || deals[0] || null;

    // 4. Dobierz bota według pory dnia (Warszawa)
    const timezone = 'Europe/Warsaw';
    const nowWarsawHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date()),
      10
    );

    let selectedRole: FishingBotRole = 'wife_secret';
    if (nowWarsawHour >= 6 && nowWarsawHour < 10) {
      selectedRole = 'angler_chatter';
    } else if (nowWarsawHour >= 10 && nowWarsawHour < 17) {
      selectedRole = 'deal_hunter';
    } else if (nowWarsawHour >= 17 && nowWarsawHour < 21) {
      selectedRole = 'gear_expert';
    } else {
      selectedRole = 'wife_secret';
    }

    // 5. Wygeneruj post przez AI
    const genRes = await generateFishingPost({
      botRole: selectedRole,
      dealId: selectedDeal?.id,
      targetDealData: selectedDeal ? {
        title: selectedDeal.title,
        price: selectedDeal.price,
        oldPrice: selectedDeal.oldPrice,
        discount: selectedDeal.discount,
        merchant: selectedDeal.merchant,
        imageUrl: selectedDeal.imageUrl,
        dealUrl: selectedDeal.dealUrl,
      } : undefined,
    }, true);

    if (!genRes.success || !genRes.item) {
      return { success: false, message: 'Błąd generowania posta przez AI.', error: genRes.error };
    }

    // 6. Dodaj do kolejki
    const queueAddRes = await addPostToFishingQueue(genRes.item as any, true);
    const postId = queueAddRes.id!;

    // 7. W trybie autopilot opublikuj natychmiast
    let published = false;
    let pubError: string | undefined;

    if (config.mode === 'autopilot') {
      const pubRes = await publishFishingPost(postId, undefined, true);
      published = pubRes.success;
      pubError = pubRes.error;
    }

    return {
      success: config.mode === 'autopilot' ? published : true,
      message: published 
        ? '🚀 Wygenerowano i automatycznie opublikowano post na Facebooku!' 
        : (config.mode === 'autopilot' 
            ? `Błąd publikacji na Facebooku: ${pubError}` 
            : '✅ Wygenerowano post wędkarski i dodano do kolejki moderacji.'),
      postId,
      published,
      error: pubError,
    };
  } catch (error) {
    console.error('Error in executeFishingAutopilotCycle:', error);
    return {
      success: false,
      message: 'Błąd cyklu autopilota',
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd',
    };
  }
}

export async function runFishingAutopilotCycleAction(): Promise<{
  success: boolean;
  message: string;
  postId?: string;
  published?: boolean;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, message: '', error: 'Wymagane uprawnienia administratora' };
    }

    return await executeFishingAutopilotCycle({ isSystemCron: false, force: true });
  } catch (error) {
    console.error('Error in runFishingAutopilotCycleAction:', error);
    return {
      success: false,
      message: 'Błąd cyklu autopilota',
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd',
    };
  }
}
