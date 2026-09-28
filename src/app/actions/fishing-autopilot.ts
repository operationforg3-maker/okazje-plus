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
  FishingBotRole 
} from '@/lib/types';
import { ai } from '@/ai/genkit';
import { applyFishingTracking } from '@/lib/fishing-utils';

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

export async function getFishingAutopilotConfigAction(): Promise<{
  success: boolean;
  config: FishingAutopilotConfig;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, config: DEFAULT_CONFIG, error: 'Wymagane uprawnienia administratora' };
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

export async function saveFishingAutopilotConfigAction(
  config: Partial<FishingAutopilotConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const docRef = adminDb.collection('systemSettings').doc(CONFIG_DOC_ID);
    await docRef.set({
      ...config,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error saving fishing config:', error);
    return { success: false, error: 'Nie udało się zapisać konfiguracji' };
  }
}

export async function getFishingBotsAction(): Promise<{
  success: boolean;
  bots: FishingBotPersona[];
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, bots: [], error: 'Wymagane uprawnienia administratora' };
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

    if (!pageId || !token) {
      return { success: false, error: 'Brak skonfigurowanego Page ID lub Access Tokena' };
    }

    // 1. Sprawdź podstawowe info o stronie
    const infoUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,link&access_token=${encodeURIComponent(token)}`;
    const infoRes = await fetch(infoUrl, { cache: 'no-store' });
    const infoData = await infoRes.json();

    if (!infoRes.ok || infoData.error) {
      return {
        success: false,
        error: infoData.error?.message || 'Błąd autoryzacji Facebook API',
      };
    }

    // 2. Sprawdź odczyt feedu
    const feedUrl = `https://graph.facebook.com/v19.0/${pageId}/feed?limit=5&access_token=${encodeURIComponent(token)}`;
    const feedRes = await fetch(feedUrl, { cache: 'no-store' });
    const feedData = await feedRes.json();
    const count = Array.isArray(feedData.data) ? feedData.data.length : 0;

    return {
      success: true,
      pageId: infoData.id,
      pageName: infoData.name,
      link: infoData.link || `https://www.facebook.com/${infoData.id}`,
      canPost: true,
      recentPostsCount: count,
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

export interface FishingDealItem {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  discount?: string;
  merchant?: string;
  imageUrl?: string;
  temperature: number;
  dealUrl: string;
  source: string;
  category?: string;
}

export async function getFishingDealsAction(
  searchQuery?: string,
  limitCount: number = 30,
  partnerFilter?: string
): Promise<{
  success: boolean;
  deals: FishingDealItem[];
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, deals: [], error: 'Wymagane uprawnienia administratora' };
    }

    const fishingKeywords = [
      'wędka', 'wędk', 'kołowrotek', 'feeder', 'spinning', 'karpiow', 'plecionka', 
      'haczyk', 'przynęt', 'wobler', 'zanęt', 'sygnalizator', 'echosond', 'ponton', 
      'namiot', 'fotel', 'wodery', 'fishing', 'lure', 'reel', 'tackle', 'hook'
    ];

    // Pobierz konfigurację filtrów
    const configRes = await getFishingAutopilotConfigAction();
    const configuredKeywords = configRes.config.filters.keywords || [];
    const allKeywords = Array.from(new Set([...fishingKeywords, ...configuredKeywords.map(k => k.toLowerCase())]));

    const snap = await adminDb
      .collection('deals')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get();

    const matches: FishingDealItem[] = [];

    snap.docs.forEach(doc => {
      const data = doc.data();
      let titleStr = '';
      if (typeof data.title === 'string') {
        titleStr = data.title;
      } else if (typeof data.title === 'object' && data.title !== null) {
        titleStr = data.title.pl || data.title.en || Object.values(data.title)[0] || '';
      }

      const titleLower = titleStr.toLowerCase();
      const descLower = (typeof data.description === 'string' ? data.description : (data.description?.pl || '')).toLowerCase();
      const catLower = (data.category || data.mainCategorySlug || '').toLowerCase();
      const rawSource = String(data.source || (data.metadata?.source) || 'okazjeplus').toLowerCase();

      // Check if matches fishing context
      const isFishing = allKeywords.some(k => titleLower.includes(k) || descLower.includes(k) || catLower.includes(k));

      if (isFishing) {
        // Normalize source
        let sourceName = 'manual';
        if (rawSource.includes('convertiser')) sourceName = 'convertiser';
        else if (rawSource.includes('tradetracker')) sourceName = 'tradetracker';
        else if (rawSource.includes('aliexpress')) sourceName = 'aliexpress';
        else if (rawSource.includes('amazon')) sourceName = 'amazon';
        else if (rawSource.includes('allegro')) sourceName = 'allegro';

        // Price parsing
        let currentPriceVal: number | undefined = undefined;
        if (typeof data.price === 'number') currentPriceVal = data.price;
        else if (data.price?.amount) currentPriceVal = data.price.amount;
        else if (typeof data.currentPrice === 'number') currentPriceVal = data.currentPrice;

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

        matches.push({
          id: doc.id,
          title: titleStr || 'Sprzęt wędkarski',
          price: priceStr,
          oldPrice: oldPriceStr,
          discount: discountStr,
          merchant: data.merchantName || data.merchant || 'Sklep wędkarski',
          imageUrl: data.imageUrl || data.image || '',
          temperature: Number(data.temperature) || 100,
          dealUrl: applyFishingTracking(`https://okazjeplus.pl/pl/deals/${doc.id}`, 'Fishing_2'),
          source: sourceName,
          category: data.category || 'Wędkarstwo',
        });
      }
    });

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
      deals: finalDeals.slice(0, limitCount),
    };
  } catch (error) {
    console.error('Error fetching fishing deals:', error);
    return { success: false, deals: [], error: 'Błąd pobierania ofert wędkarskich' };
  }
}

// ============================================================================
// GENEROWANIE POSTA PRZEZ AI BOTY
// ============================================================================

export async function generateFishingPostAction(params: {
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
  };
  humorLevel?: 'subtle' | 'high' | 'legendary' | 'none';
}): Promise<{
  success: boolean;
  item?: Partial<FishingPostQueueItem>;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { botRole, dealId, customTopic, targetDealData } = params;

    // Pobierz informacje o bocie
    const botsRes = await getFishingBotsAction();
    const bot = botsRes.bots.find(b => b.role === botRole) || DEFAULT_FISHING_BOTS[0];

    // Pobierz dane deala jeśli podano dealId
    let dealInfo = targetDealData;
    if (dealId && !dealInfo) {
      const docSnap = await adminDb.collection('deals').doc(dealId).get();
      if (docSnap.exists) {
        const d = docSnap.data()!;
        let title = typeof d.title === 'string' ? d.title : (d.title?.pl || d.title?.en || 'Okazja wędkarska');
        let curPrice = typeof d.price === 'number' ? d.price : d.price?.amount;
        let origPrice = typeof d.originalPrice === 'number' ? d.originalPrice : d.originalPrice?.amount;
        dealInfo = {
          title,
          price: curPrice ? `${curPrice.toFixed(2)} zł` : '',
          oldPrice: origPrice ? `${origPrice.toFixed(2)} zł` : '',
          discount: curPrice && origPrice ? `-${Math.round(((origPrice - curPrice) / origPrice) * 100)}%` : '',
          merchant: d.merchantName || d.merchant || 'Sklep wędkarski',
          imageUrl: d.imageUrl || d.image || '',
          dealUrl: `https://okazjeplus.pl/pl/deals/${docSnap.id}`,
        };
      }
    }

    // Treść posta i alibi
    let generatedTitle = dealInfo?.title || customTopic || 'Wędkarska Perełka Sprzętowa';
    let postText = '';
    let wifeAlibi = '';
    let firstComment = '';
    let hashtags: string[] = ['#WędkarskiePromocje', '#ŻonaNieWidzi', '#OkazjePlus', '#Wędkarstwo'];

    // Spróbuj wygenerować przez AI (Genkit / Gemini)
    let aiGenerated = false;
    try {
      const promptText = `
Jesteś AI Copywriterem dla kultowej społeczności wędkarskiej na Facebooku o nazwie "Wędkarskie Promocje Żona nie widzi" oraz portalu Okazje Plus.
Twoja rola: ${bot.name} (${bot.role}).
Instrukcje bota: ${bot.customInstructions}
Poziom humoru: ${params.humorLevel || bot.humorLevel}.

DANE OKAZJI LUB TEMATU:
- Tytuł/Sprzęt: ${dealInfo?.title || customTopic || 'Kołowrotek spinningowy / wędzisko'}
- Cena promocyjna: ${dealInfo?.price || '99 zł'}
- Cena regularna: ${dealInfo?.oldPrice || '249 zł'}
- Zniżka: ${dealInfo?.discount || '-60%'}
- Sklep: ${dealInfo?.merchant || 'Sklep Wędkarski'}
- Dodatkowy kontekst/temat: ${customTopic || 'brak'}

WYMAGANIA DOTYCZĄCE TREŚCI:
1. Napisz post na Facebooka dopasowany do wędkarzy.
2. ${botRole === 'wife_secret' ? 'Stwórz oficjalną wymówkę / alibi dla żony ("Kochanie, kupiłem za 30 zł na wyprzedaży garażowej"), żart o paczkomacie o 22:00 lub chowaniu sprzętu w bagażniku.' : ''}
3. ${botRole === 'deal_hunter' ? 'Skup się na parametrach technicznych, oszczędności w zł i dlaczego ta oferta bije na głowę polskie ceny regularne.' : ''}
4. ${botRole === 'angler_chatter' ? 'Zadaj mocne, prowokujące i angażujące pytanie do dyskusji wędkarskiej, zachęć do komentowania i wrzucania zdjęć.' : ''}
5. ${botRole === 'gear_expert' ? 'Wypunktuj 3 kluczowe zalety techniczne i radę ekspercką jak wykorzystać ten sprzęt nad wodą.' : ''}
6. Dodaj chwytliwe emoji wędkarskie (🎣, 🐟, 🤫, 🔥, 💰, ⚡).
7. Zakończ wezwaniem do sprawdzenia linku w pierwszym komentarzu oraz na portalu.
Zwróć odpowiedź w czystym formacie tekstu gotowego do wklejenia.
`;

      const aiResponse = await ai.generate({
        prompt: promptText,
        config: {
          temperature: botRole === 'wife_secret' || botRole === 'angler_chatter' ? 0.8 : 0.4,
          maxOutputTokens: 1200,
        },
      });

      if (aiResponse && aiResponse.text) {
        postText = aiResponse.text.trim();
        aiGenerated = true;
      }
    } catch (aiErr) {
      console.warn('AI Genkit generation error, falling back to curated fishing templates:', aiErr);
    }

    // Jeśli AI było offline, użyj bogatych, sprawdzonych szablonów
    if (!aiGenerated || !postText) {
      const itemTitle = dealInfo?.title || customTopic || 'Kołowrotek Shimano Stradic FL / Wędka Drapieżnik';
      const priceStr = dealInfo?.price || '119,00 zł';
      const oldPriceStr = dealInfo?.oldPrice ? ` (zamiast ${dealInfo.oldPrice})` : ' (zamiast 279,00 zł)';
      const discStr = dealInfo?.discount || '-57%';
      const storeStr = dealInfo?.merchant ? ` w ${dealInfo.merchant}` : '';

      if (botRole === 'wife_secret') {
        wifeAlibi = '„Kochanie, wygrałem w konkursie wędkarskim za 20 zł!”';
        postText = `🤫 Ciii... oficjalna wersja: to kosztowało grosze! 🎣\n\n` +
          `Panowie, wjechała potężna przecena na sprzęt, którego żaden wędkarz nie powinien przepuścić:\n` +
          `👉 ${itemTitle}\n\n` +
          `💸 Prawdziwa cena dla nas: ${priceStr}${oldPriceStr} ${discStr}${storeStr}\n` +
          `🧾 Oficjalna wersja dla żony: "Kochanie, kumpel z koła oddawał za 30 zł bo mu zawadzało w piwnicy!" 😉\n\n` +
          `📦 Instrukcja odbioru:\n` +
          `1. Paczkomat wybierasz najdalej od domu.\n` +
          `2. Odbiór po 21:30 pod pretekstem "muszę iść sprawdzić czy auto zamknięte".\n` +
          `3. Pudełko ląduje pod kołem zapasowym w bagażniku.\n\n` +
          `Łapcie póki cena nie wróciła do normy!\n\n` +
          `🔗 Bezpośredni link do okazji znajdziecie w 1. komentarzu ⬇️ oraz na Okazje Plus:\n${dealInfo?.dealUrl || 'https://okazjeplus.pl'}`;
      } else if (botRole === 'deal_hunter') {
        postText = `🔥 GORĄCA OKAZJA WĘDKARSKA: ${itemTitle}!\n\n` +
          `💰 Nowa cena: ${priceStr}${oldPriceStr} | Rabat: ${discStr}${storeStr}\n` +
          `🌡️ Ocena społeczności: 120° (Mega Hit)\n\n` +
          `Dlaczego warto rzucić okiem?\n` +
          `✅ Świetny stosunek ceny do jakości\n` +
          `✅ Sprawdzona konstrukcja i świetne opinie wędkarzy\n` +
          `✅ Realna obniżka bez pompowania ceny wyjściowej\n\n` +
          `Taki sprzęt w tej cenie wyprzedaje się błyskawicznie!\n\n` +
          `👉 Bezpośredni link i kody rabatowe w pierwszym komentarzu ⬇️ oraz tutaj:\n${dealInfo?.dealUrl || 'https://okazjeplus.pl'}`;
      } else if (botRole === 'angler_chatter') {
        postText = `🐟 PORANNA KAWA & WĘDKARSKA DEBATA ☕🎣\n\n` +
          `${customTopic || 'Pytanie za 100 punktów do naszej ekipy:\nJakie było Wasze najbardziej udane "zakupowe kłamstewko" przed drugą połówką, gdy do domu wjechał nowy kij albo kołowrotek?'}\n\n` +
          `Piszcie w komentarzach najciekawsze historie! Wrzucajcie też fotki sprzętu z którego jesteście najbardziej dumni w tym sezonie 📸⬇️\n\n` +
          `A jeśli szukacie świeżych promocji sprzętowych bez ściemy:\nhttps://okazjeplus.pl`;
      } else {
        postText = `🧭 TEST & PORADNIK SPRZĘTOWY: ${itemTitle}\n\n` +
          `Zanim klikniesz "Kup Teraz", sprawdź naszą szybką analizę opłacalności:\n\n` +
          `🔍 Na co warto zwrócić uwagę:\n` +
          `1️⃣ Płynność pracy i spasowanie elementów pod obciążeniem\n` +
          `2️⃣ Odporność na trudne warunki atmosferyczne i piasek\n` +
          `3️⃣ Cena promocyjna (${priceStr}) jest o ${discStr} niższa niż średnia rynkowa\n\n` +
          `Werdykt testera: Zdecydowanie warto w tym budżecie!\n\n` +
          `👉 Szczegółowa specyfikacja i link w pierwszym komentarzu ⬇️:\n${dealInfo?.dealUrl || 'https://okazjeplus.pl'}`;
      }
    }

    const rawLink = dealInfo?.dealUrl || 'https://okazjeplus.pl';
    const trackedLink = applyFishingTracking(rawLink, 'Fishing_2');

    if (dealInfo?.dealUrl || trackedLink) {
      firstComment = `🔗 Bezpośredni link do okazji i kod rabatowy znajdziesz tutaj:\n${trackedLink}`;
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
      linkUrl: trackedLink,
      imageUrl: dealInfo?.imageUrl || undefined,
      hashtags,
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

// ============================================================================
// KOLEJKA MODERACJI I PUBLIKACJA
// ============================================================================

export async function addPostToFishingQueueAction(
  item: Omit<FishingPostQueueItem, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const ref = await adminDb.collection('fishingPostsQueue').add({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    return { success: true, id: ref.id };
  } catch (error) {
    console.error('Error adding to queue:', error);
    return { success: false, error: 'Błąd dodawania do kolejki' };
  }
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
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
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

    const configRes = await getFishingAutopilotConfigAction();
    const config = configRes.config;

    let fbPostId: string | undefined;
    let fbPostUrl: string | undefined;
    let portalDealId: string | undefined;
    let publishError: string | undefined;

    const trackingCampaign = config.tracking?.campaign || 'Fishing_2';
    const finalTrackingLink = post.linkUrl
      ? applyFishingTracking(post.linkUrl, trackingCampaign)
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
          temperature: 100,
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

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');

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

    // 1. Zapisz deal w Firestore
    const newDealDoc = {
      title: { pl: title },
      description: { pl: description || title },
      price: price,
      originalPrice: originalPrice,
      legacyPrice: price,
      link: applyFishingTracking(dealUrl, 'Fishing_2'),
      image: imageUrl || '',
      imageHint: 'sprzęt wędkarski',
      category: 'sport-turystyka',
      mainCategorySlug: 'sport-turystyka',
      subCategorySlug: 'wedkarstwo',
      subSubCategorySlug: subCategory,
      merchant: merchant || 'Sklep Wędkarski',
      merchantName: merchant || 'Sklep Wędkarski',
      status: 'approved',
      temperature: 150,
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
        dealUrl: `https://okazjeplus.pl/pl/deals/${dealId}`,
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
  try {
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

    const configRes = await getFishingAutopilotConfigAction();
    const config = configRes.config;

    const sources = options?.sources || (['convertiser', 'tradetracker', 'aliexpress'] as const);
    const keywords = options?.keywords || [
      'kołowrotek', 'wędka spinningowa', 'feeder', 'plecionka wędkarska', 
      'wobler', 'namiot wędkarski', 'fotel wędkarski', 'wodery', 'sygnalizator brań'
    ];
    const limitPerSource = options?.limitPerSource || 8;

    const resultsBySource: Record<string, number> = {
      convertiser: 0,
      tradetracker: 0,
      aliexpress: 0,
    };
    let totalImported = 0;

    // Deduplikacja: pobierz ostatnie 300 deali
    const existingSnap = await adminDb.collection('deals').orderBy('createdAt', 'desc').limit(300).get();
    const existingLinks = new Set(existingSnap.docs.map(d => d.data().link).filter(Boolean));
    const existingTitles = new Set(existingSnap.docs.map(d => (d.data().title?.pl || d.data().title || '').toLowerCase().trim()).filter(Boolean));

    // 1. CONVERTISER PARTNER FETCH
    if (sources.includes('convertiser') && config.partners?.convertiser) {
      try {
        const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
        const client = getConvertiserClient();

        for (const kw of keywords.slice(0, 4)) {
          if (resultsBySource.convertiser >= limitPerSource) break;
          try {
            const resp = await client.searchProducts(
              { query: kw, country: 'PL' },
              { page: 1, page_size: 15 }
            );
            const items = (resp as any).results || (resp as any).data || [];
            for (const item of items) {
              const title = item.name || item.title;
              if (!title) continue;
              const rawLink = item.direct_link || item.tracking_link || item.url || `https://convertiser.com/products/${item.id}/`;
              const link = applyFishingTracking(rawLink, config.tracking?.campaign || 'Fishing_2');
              if (existingLinks.has(link) || existingTitles.has(title.toLowerCase().trim())) continue;

              const priceNum = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || 0));
              if (isNaN(priceNum) || priceNum <= 0) continue;

              const origPriceNum = item.old_price ? parseFloat(String(item.old_price)) : (item.original_price ? parseFloat(String(item.original_price)) : undefined);
              const merchant = item.merchant || item.shop || item.website?.name || 'Sklep Partnerski Convertiser';
              const imageUrl = item.image_url || item.image || item.photo || '';

              const dealDoc = {
                title: { pl: title },
                description: { pl: item.description || title },
                price: priceNum,
                originalPrice: origPriceNum,
                legacyPrice: priceNum,
                link,
                image: imageUrl,
                imageHint: 'sprzęt wędkarski',
                category: 'sport-turystyka',
                mainCategorySlug: 'sport-turystyka',
                subCategorySlug: 'wedkarstwo',
                subSubCategorySlug: 'kolowrotki-wedki',
                merchant,
                merchantName: merchant,
                status: 'approved',
                temperature: Math.floor(Math.random() * 40) + 80,
                voteCount: 1,
                commentsCount: 0,
                source: 'convertiser',
                dealType: 'sale',
                tags: ['wędkarstwo', 'convertiser', 'promocje wędkarskie', 'żona nie widzi'],
                postedBy: 'Wędkarskie Promocje (Convertiser Partner)',
                postedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                verified: true,
                verifiedAt: new Date().toISOString(),
              };

              await adminDb.collection('deals').add(dealDoc);
              existingLinks.add(link);
              existingTitles.add(title.toLowerCase().trim());
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
                image: item.imageURL || '',
                imageHint: 'sprzęt wędkarski',
                category: 'sport-turystyka',
                mainCategorySlug: 'sport-turystyka',
                subCategorySlug: 'wedkarstwo',
                subSubCategorySlug: 'kolowrotki-wedki',
                merchant: item.merchantName || 'TradeTracker Partner',
                merchantName: item.merchantName || 'TradeTracker Partner',
                status: 'approved',
                temperature: Math.floor(Math.random() * 40) + 85,
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

    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    revalidatePath('/[locale]/deals', 'page');

    const message = `Pobrano łącznie ${totalImported} nowych ofert wędkarskich (Convertiser: ${resultsBySource.convertiser}, TradeTracker: ${resultsBySource.tradetracker}).`;

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

// ============================================================================
// CYKL AUTOPILOTA (TRIGGER NA ŻĄDANIE LUB CRON)
// ============================================================================

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

    const configRes = await getFishingAutopilotConfigAction();
    const config = configRes.config;

    if (!config.enabled) {
      return { success: false, message: 'Autopilot wędkarski jest wyłączony w ustawieniach.' };
    }

    // 1. Pobierz najlepsze okazje wędkarskie
    let dealsRes = await getFishingDealsAction(undefined, 30);
    let deals = dealsRes.deals;

    // 2. Jeśli brakuje ofert, automatycznie wywołaj harvest z Convertiser / TradeTracker / AliExpress
    if (deals.length < 5) {
      await harvestFishingPartnerOffersAction();
      dealsRes = await getFishingDealsAction(undefined, 30);
      deals = dealsRes.deals;
    }

    // 3. Pobierz ostatnio opublikowane, aby nie powtarzać tego samego
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentPostsSnap = await adminDb
      .collection('fishingPostsQueue')
      .where('createdAt', '>=', recentCutoff)
      .limit(50)
      .get();

    const postedDealIds = new Set(recentPostsSnap.docs.map(d => d.data().dealId).filter(Boolean));
    const unpostedDeals = deals.filter(d => !postedDealIds.has(d.id));
    const selectedDeal = unpostedDeals.length > 0 ? unpostedDeals[0] : (deals[0] || null);

    // 3. Wybierz rolę bota naprzemiennie (np. rano gawędziarz, w południe łowca, wieczorem żona nie widzi)
    const currentHour = new Date().getHours();
    let selectedRole: FishingBotRole = 'wife_secret';
    if (currentHour >= 5 && currentHour < 10) {
      selectedRole = 'angler_chatter';
    } else if (currentHour >= 10 && currentHour < 18) {
      selectedRole = 'deal_hunter';
    } else if (currentHour >= 18 && currentHour < 21) {
      selectedRole = 'gear_expert';
    } else {
      selectedRole = 'wife_secret';
    }

    // 4. Wygeneruj post
    const genRes = await generateFishingPostAction({
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
    });

    if (!genRes.success || !genRes.item) {
      return { success: false, message: 'Błąd generowania posta przez AI.', error: genRes.error };
    }

    // 5. Dodaj do kolejki
    const queueAddRes = await addPostToFishingQueueAction(genRes.item as any);
    const postId = queueAddRes.id!;

    // 6. Jeśli tryb to autopilot (nie moderation), opublikuj natychmiast
    let published = false;
    if (config.mode === 'autopilot') {
      const pubRes = await publishFishingPostAction(postId);
      published = pubRes.success;
    }

    return {
      success: true,
      message: published 
        ? '🚀 Wygenerowano i natychmiast opublikowano post na Facebooku!' 
        : '✅ Wygenerowano post wędkarski i dodano do kolejki moderacji.',
      postId,
      published,
    };
  } catch (error) {
    console.error('Error in autopilot cycle:', error);
    return {
      success: false,
      message: 'Błąd cyklu autopilota',
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd',
    };
  }
}
