/**
 * Server Actions: Autopilot dla Społeczności i Fanpage Facebooka
 * "Perełki dla Malucha i Mamy" (ID: 1064354363425282)
 *
 * Pobiera okazje dla dzieci i mam (AliExpress, Convertiser, TradeTracker, Allegro, itp.),
 * generuje angażujące treści AI (Genkit Gemini 2.5), zarządza kolejką moderacji
 * oraz publikuje posty bezpośrednio na Facebooku wraz z linkami afiliacyjnymi w 1. komentarzu.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { ai } from '@/ai/genkit';
import { sanitizeSocialPostText } from '@/lib/social-growth-types';
import type {
  BabyAutopilotConfig,
  BabyBotPersona,
  BabyBotRole,
  BabyPostQueueItem,
  BabyDealItem,
} from '@/lib/types';
import {
  CONFIG_DOC_ID,
  DEFAULT_BABY_CONFIG,
  DEFAULT_BABY_BOTS,
  resolveBabyAffiliateUrl,
  buildBabyHashtags,
} from '@/lib/baby-utils';
import {
  diversifyDealsList,
  detectDealCategory,
  pickDiverseRecommendation,
} from '@/lib/deal-diversity';

// ============================================================================
// POBIERANIE I ZAPIS KONFIGURACJI
// ============================================================================

export async function getBabyAutopilotConfig(
  skipAuth: boolean = false
): Promise<{ success: boolean; config: BabyAutopilotConfig; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, config: DEFAULT_BABY_CONFIG, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const doc = await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).get();
    if (!doc.exists) {
      await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).set(DEFAULT_BABY_CONFIG);
      return { success: true, config: DEFAULT_BABY_CONFIG };
    }

    const data = doc.data() as Partial<BabyAutopilotConfig>;
    const merged: BabyAutopilotConfig = {
      ...DEFAULT_BABY_CONFIG,
      ...data,
      fb: { ...DEFAULT_BABY_CONFIG.fb, ...(data.fb || {}) },
      portal: { ...DEFAULT_BABY_CONFIG.portal, ...(data.portal || {}) },
      schedule: { ...DEFAULT_BABY_CONFIG.schedule, ...(data.schedule || {}) },
      filters: { ...DEFAULT_BABY_CONFIG.filters, ...(data.filters || {}) },
      partners: { ...DEFAULT_BABY_CONFIG.partners, ...(data.partners || {}) },
      tracking: { ...DEFAULT_BABY_CONFIG.tracking, ...(data.tracking || {}) },
      stats: { ...DEFAULT_BABY_CONFIG.stats, ...(data.stats || {}) },
    };

    return { success: true, config: merged };
  } catch (err: any) {
    console.error('Error fetching baby autopilot config:', err);
    return { success: false, config: DEFAULT_BABY_CONFIG, error: err.message };
  }
}

export async function getBabyAutopilotConfigAction(): Promise<{
  success: boolean;
  config?: BabyAutopilotConfig;
  error?: string;
}> {
  const res = await getBabyAutopilotConfig(false);
  return res;
}

export async function saveBabyAutopilotConfigAction(
  newConfig: Partial<BabyAutopilotConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const currentRes = await getBabyAutopilotConfig(true);
    let payloadFb = newConfig.fb ? { ...currentRes.config.fb, ...newConfig.fb } : currentRes.config.fb;

    // Jeśli podano token i pageId, sprawdź czy to User Token i spróbuj automatycznie pobrać Page Token
    if (payloadFb?.accessToken && payloadFb?.pageId) {
      try {
        const pageRes = await fetch(
          `https://graph.facebook.com/v21.0/${payloadFb.pageId}?fields=access_token,name&access_token=${encodeURIComponent(payloadFb.accessToken)}`,
          { cache: 'no-store' }
        );
        const pageData = await pageRes.json();
        if (pageData.access_token) {
          payloadFb = {
            ...payloadFb,
            accessToken: pageData.access_token,
            pageName: pageData.name || payloadFb.pageName,
          };
        }
      } catch (tokenErr) {
        console.warn('Auto-resolution of page access token during save failed:', tokenErr);
      }
    }

    const updated: BabyAutopilotConfig = {
      ...currentRes.config,
      ...newConfig,
      fb: payloadFb,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).set(updated, { merge: true });
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error saving baby autopilot config:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// ZARZĄDZANIE BOTAMI (PERSONY)
// ============================================================================

export async function getBabyBots(
  skipAuth: boolean = false
): Promise<{ success: boolean; bots: BabyBotPersona[]; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, bots: DEFAULT_BABY_BOTS, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const snapshot = await adminDb.collection('babyBotPersonas').get();
    if (snapshot.empty) {
      const batch = adminDb.batch();
      for (const bot of DEFAULT_BABY_BOTS) {
        batch.set(adminDb.collection('babyBotPersonas').doc(bot.id), bot);
      }
      await batch.commit();
      return { success: true, bots: DEFAULT_BABY_BOTS };
    }

    const bots = snapshot.docs.map(doc => doc.data() as BabyBotPersona);
    return { success: true, bots };
  } catch (err: any) {
    console.error('Error getting baby bots:', err);
    return { success: false, bots: DEFAULT_BABY_BOTS, error: err.message };
  }
}

export async function getBabyBotsAction(): Promise<{
  success: boolean;
  bots?: BabyBotPersona[];
  error?: string;
}> {
  const res = await getBabyBots(false);
  return res;
}

export async function saveBabyBotAction(
  bot: BabyBotPersona
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('babyBotPersonas').doc(bot.id).set(bot, { merge: true });
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error saving baby bot:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// WYSZUKIWANIE I HARVESTING OKAZJI DLA MALUCHA I MAMY
// ============================================================================

export async function getBabyDeals(
  options: {
    limit?: number;
    searchQuery?: string;
    partnerFilter?: 'all' | 'aliexpress' | 'convertiser' | 'tradetracker';
    minDiscount?: number;
  } = {},
  skipAuth: boolean = false
): Promise<{ success: boolean; deals: BabyDealItem[]; totalFound: number; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, deals: [], totalFound: 0, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const configRes = await getBabyAutopilotConfig(skipAuth);
    const config = configRes.config;
    const trackingCampaign = config.tracking?.campaign || 'Maluch_1';

    const maxLimit = options.limit || 50;
    const partnerFilter = options.partnerFilter || 'all';

    // 1. Przeszukaj bazę Firestore z kolekcji 'deals'
    const snapshot = await adminDb
      .collection('deals')
      .where('status', 'in', ['approved', 'poczekalnia', 'pending'])
      .orderBy('createdAt', 'desc')
      .limit(250)
      .get();

    const matches: BabyDealItem[] = [];
    const babyKeywords = config.filters.keywords || DEFAULT_BABY_CONFIG.filters.keywords;
    const negativeKeywords = config.filters.negativeKeywords || DEFAULT_BABY_CONFIG.filters.negativeKeywords;

    for (const doc of snapshot.docs) {
      const d = doc.data();
      const rawTitle = typeof d.title === 'string' ? d.title : (d.title?.pl || d.title?.en || Object.values(d.title || {})[0] || '');
      const rawDesc = typeof d.description === 'string' ? d.description : (d.description?.pl || d.description?.en || '');
      const cat = (d.mainCategorySlug || d.category || '').toLowerCase();
      const lowerTitle = rawTitle.toLowerCase();
      const lowerDesc = rawDesc.toLowerCase();

      // Filtr wykluczeń
      if (negativeKeywords.some(neg => lowerTitle.includes(neg.toLowerCase()))) {
        continue;
      }

      // Sprawdź dopasowanie do malucha i mamy
      const isCategoryMatch =
        cat.includes('dziec') ||
        cat.includes('zabaw') ||
        cat.includes('mama') ||
        cat.includes('baby') ||
        cat.includes('kids');

      const isKeywordMatch = babyKeywords.some(kw => {
        const k = kw.toLowerCase().trim();
        return lowerTitle.includes(k) || lowerDesc.includes(k);
      });

      if (!isCategoryMatch && !isKeywordMatch) {
        continue;
      }

      // Sprawdź zapytanie wyszukiwania
      if (options.searchQuery) {
        const q = options.searchQuery.toLowerCase();
        if (!lowerTitle.includes(q) && !lowerDesc.includes(q)) {
          continue;
        }
      }

      // Źródło i partner
      const merchant = d.merchantName || d.merchant || 'Sklep dziecięcy';
      const source = d.source || (merchant.toLowerCase().includes('aliexpress') ? 'aliexpress' : 'convertiser');

      if (partnerFilter !== 'all') {
        if (partnerFilter === 'aliexpress' && !source.includes('aliexpress') && !merchant.toLowerCase().includes('aliexpress')) {
          continue;
        }
        if (partnerFilter === 'convertiser' && !source.includes('convertiser')) {
          continue;
        }
        if (partnerFilter === 'tradetracker' && !source.includes('tradetracker')) {
          continue;
        }
      }

      // Ceny i rabat
      const curPrice = typeof d.price === 'number' ? d.price : d.price?.amount || 0;
      const origPrice = typeof d.originalPrice === 'number' ? d.originalPrice : d.originalPrice?.amount;
      let discountPct = 0;
      let discountStr = '';

      if (origPrice && origPrice > curPrice && curPrice > 0) {
        discountPct = Math.round(((origPrice - curPrice) / origPrice) * 100);
        discountStr = `-${discountPct}%`;
      } else if (d.discount) {
        discountStr = String(d.discount);
      }

      if (options.minDiscount && discountPct < options.minDiscount) {
        continue;
      }

      // Bezpośredni link afiliacyjny
      const directAffiliateUrl = resolveBabyAffiliateUrl({
        id: doc.id,
        ...d,
      }, trackingCampaign);

      const cleanDescription = rawDesc
        ? rawDesc
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
        : '';

      matches.push({
        id: doc.id,
        title: rawTitle,
        price: curPrice ? `${curPrice.toFixed(2)} zł` : 'Super cena',
        oldPrice: origPrice ? `${origPrice.toFixed(2)} zł` : undefined,
        discount: discountStr || undefined,
        merchant,
        imageUrl: d.imageUrl || d.image || '',
        temperature: d.temperature || 0,
        dealUrl: directAffiliateUrl,
        portalUrl: `https://okazjeplus.pl/okazje/${d.slug || doc.id}`,
        rawLink: d.link || d.url || '',
        source,
        category: cat,
        description: cleanDescription,
        tags: Array.isArray(d.tags) ? d.tags : [],
      });

      if (matches.length >= Math.max(150, maxLimit * 3)) break;
    }

    const diversified = diversifyDealsList(matches, { niche: 'baby' }).slice(0, maxLimit);
    return { success: true, deals: diversified, totalFound: matches.length };
  } catch (err: any) {
    console.error('Error getting baby deals:', err);
    return { success: false, deals: [], totalFound: 0, error: err.message };
  }
}

export async function getBabyDealsAction(options?: {
  limit?: number;
  searchQuery?: string;
  partnerFilter?: 'all' | 'aliexpress' | 'convertiser' | 'tradetracker';
  minDiscount?: number;
}): Promise<{
  success: boolean;
  deals?: BabyDealItem[];
  totalFound?: number;
  error?: string;
}> {
  return getBabyDeals(options, false);
}

// ============================================================================
// KOLEJKA POSTÓW I MODERACJA
// ============================================================================

export async function getBabyQueue(
  skipAuth: boolean = false
): Promise<{ success: boolean; items: BabyPostQueueItem[]; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, items: [], error: 'Wymagane uprawnienia administratora' };
      }
    }

    const snapshot = await adminDb
      .collection('babyPostQueue')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BabyPostQueueItem[];

    return { success: true, items };
  } catch (err: any) {
    console.error('Error fetching baby post queue:', err);
    return { success: false, items: [], error: err.message };
  }
}

export async function getBabyQueueAction(): Promise<{
  success: boolean;
  items?: BabyPostQueueItem[];
  error?: string;
}> {
  return getBabyQueue(false);
}

// ============================================================================
// GENEROWANIE POSTA PRZEZ AI (GENKIT GEMINI 2.5)
// ============================================================================

export async function generateBabyPost(
  params: {
    botRole: BabyBotRole;
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
  item?: Partial<BabyPostQueueItem>;
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

    // Pobierz bota
    const botsRes = await getBabyBots(true);
    const bot = botsRes.bots.find(b => b.role === botRole) || DEFAULT_BABY_BOTS[0];

    const configRes = await getBabyAutopilotConfig(skipAuth);
    const trackingCampaign = configRes.config.tracking?.campaign || 'Maluch_1';

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

        const directAffiliateUrl = resolveBabyAffiliateUrl({
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

        // Parametry / specs
        if (d.specs && typeof d.specs === 'object') {
          extractedSpecs = Object.entries(d.specs)
            .map(([k, v]) => `• ${k}: ${v}`)
            .join('\n');
        } else if (Array.isArray(d.tags)) {
          dealTags = d.tags;
        }

        dealInfo = {
          title: dealInfo.title || dTitle,
          price: dealInfo.price || (curPrice ? `${curPrice.toFixed(2)} zł` : ''),
          oldPrice: dealInfo.oldPrice || (origPrice ? `${origPrice.toFixed(2)} zł` : ''),
          discount: dealInfo.discount || (curPrice && origPrice && origPrice > curPrice ? `-${Math.round(((origPrice - curPrice) / origPrice) * 100)}%` : ''),
          merchant: dealInfo.merchant || d.merchantName || d.merchant || 'Sklep dziecięcy',
          imageUrl: dealInfo.imageUrl || d.imageUrl || d.image || '',
          dealUrl: dealInfo.dealUrl || directAffiliateUrl,
          description: rawDescription || dealInfo.description || '',
          specs: extractedSpecs || dealInfo.specs || '',
          tags: dealTags.length > 0 ? dealTags : (dealInfo.tags || []),
        };
      }
    } else if (targetDealData) {
      const rawDesc = targetDealData.description || '';
      rawDescription = typeof rawDesc === 'string'
        ? rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
        : '';
      dealInfo = {
        ...targetDealData,
        description: rawDescription,
        dealUrl: resolveBabyAffiliateUrl(targetDealData.dealUrl || '', trackingCampaign),
      };
    }

    const dynamicHashtags = buildBabyHashtags(
      dealInfo?.title || customTopic || '',
      dealInfo?.merchant,
      botRole
    );

    let generatedTitle = dealInfo?.title || customTopic || 'Perełka dla Malucha i Mamy';
    let postText = '';
    let momTip = '';
    let firstComment = '';
    let aiGenerated = false;

    try {
      const promptText = `
Jesteś profesjonalnym, empatycznym i uwielbianym przez rodziców AI Copywriterem dla fanpage'a i społeczności Facebooka o nazwie "Perełki dla Malucha i Mamy" (oraz portalu Okazje Plus).
Twoja rola: ${bot.name} (${bot.role}).
Instrukcje bota: ${bot.customInstructions}
Poziom humoru: ${params.humorLevel || bot.humorLevel}.

DANE PRODUKTU I OKAZJI:
- Tytuł/Nazwa produktu: ${dealInfo?.title || customTopic || 'Artykuły dla dzieci'}
- Cena promocyjna: ${dealInfo?.price || 'Świetna okazja'}
- Cena regularna: ${dealInfo?.oldPrice || 'Cena regularna'}
- Zniżka: ${dealInfo?.discount || 'Rabat promocyjny'}
- Sklep: ${dealInfo?.merchant || 'Sklep dla dzieci'}
- Opis i szczegóły produktu: ${dealInfo?.description || 'Brak opisu'}
${dealInfo?.specs ? `- Parametry techniczne / atesty:\n${dealInfo.specs}` : ''}
- Dodatkowy kontekst/temat: ${customTopic || 'brak'}
${customTopic ? `\nSPECJALNE INSTRUKCJE / PROMPT OD UŻYTKOWNIKA (UWZGLĘDNIJ BEZWZGLĘDNIE W TREŚCI):\n"${customTopic}"\n(Ściśle dostosuj styl, długość, ton i akcenty posta do powyższych instrukcji!)\n` : ''}
- Sugerowane hashtagi: ${dynamicHashtags.join(' ')}

STRUKTURA I WYMOGI POSTA (BARDZO WAŻNE):
Napisz zwięzły, ciepły, naturalny i angażujący post na Facebooka (około 90-150 słów - NIE PISZ TASIEMCÓW ANI ŚCIANY TEKSTU!).
Pisz jak prawdziwa, życzliwa mama z grupy rodzicielskiej, a NIE jak chatbot AI czy oficjalny komunikat!

BEZWZGLĘDNY ZAKAZ UŻYWANIA FORMATOWANIA MARKDOWN (**pogrubienie**, *kursywa*, # nagłówek)!
Facebook NIE interpretuje Markdownu i wyświetla brzydkie gwiazdki '**', co drażni czytelników.
Jeśli chcesz coś zaakcentować, użyj WIELKICH LITER, nowej linii lub emoji (👶, 🍼, 🛍️, ✨, 🧸, 💖). NIGDY NIE UŻYWAJ ZNAKÓW '**' ANI '*' W TREŚCI!

Elementy posta:
1. 🎯 CHWYTLIWY NAGŁÓWEK Z TYTUŁEM OKAZJI (np. ✨ PEREŁKA DLA MALUCHA: ${dealInfo?.title || customTopic})
2. 👶 DLA KOGO I DLACZEGO WARTO: Wskazanie wieku (niemowlak, roczniak, przedszkolak itp.) i w czym ułatwia życie rodzicom.
3. 🛡️ BEZPIECZEŃSTWO I ZALETY: 2-3 najważniejsze atuty wypunktowane punktorami '• ' (bez '**').
4. 💰 CENY:
   • Cena promocyjna: ${dealInfo?.price || 'Okazyjna'}
   ${dealInfo?.oldPrice ? `• Cena regularna: ${dealInfo.oldPrice}` : ''}
   ${dealInfo?.discount ? `• Oszczędność: ${dealInfo.discount}` : ''}
   • Sklep: ${dealInfo?.merchant || 'Sklep'}
5. 🤱 PERSPEKTYWA MAMY:
${botRole === 'bargain_mom' ? '   Krótka wskazówka ile oszczędzamy w porównaniu do cen w znanych sieciówkach/drogeriach.' : ''}
${botRole === 'safety_expert' ? '   Krótka uwaga o atestach, bezpieczeństwie materiałów bez BPA i delikatności dla skóry.' : ''}
${botRole === 'mom_community' ? '   Ciepłe pytanie do innych mam czy też używają takiego rozwiązania.' : ''}
${botRole === 'montessori_play' ? '   Krótka wzmianka jak ta zabawka rozwija zmysły i kreatywność malucha.' : ''}
6. 🔗 CALL TO ACTION:
   "👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w PIERWSZYM KOMENTARZU ⬇️!"
7. #️⃣ HASHTAGI NA KOŃCU:
   Zakończ post hashtagami: ${dynamicHashtags.join(' ')}.

Pamiętaj: zero '**', zwięźle, ludzki ciepły język!
`;

      const aiResponse = await ai.generate({
        prompt: promptText,
        config: {
          temperature: botRole === 'bargain_mom' || botRole === 'mom_community' ? 0.75 : 0.4,
          maxOutputTokens: 2500,
        },
      });

      if (aiResponse && aiResponse.text) {
        postText = sanitizeSocialPostText(aiResponse.text);
        aiGenerated = true;
      }
    } catch (aiErr) {
      console.warn('AI generation error for baby post, falling back to curated templates:', aiErr);
    }

    // Gwarancja braku '**' i obecności hashtagów
    if (postText) {
      postText = sanitizeSocialPostText(postText);
      if (!postText.includes('#')) {
        postText = `${postText.trim()}\n\n${dynamicHashtags.join(' ')}`;
      }
    }

    // Fallback gdyby AI było offline
    if (!aiGenerated || !postText) {
      const itemTitle = dealInfo?.title || customTopic || 'Akcesoria dla Malucha i Mamy';
      const priceStr = dealInfo?.price || '49,99 zł';
      const oldPriceStr = dealInfo?.oldPrice ? ` (zamiast ${dealInfo.oldPrice})` : '';
      const discStr = dealInfo?.discount ? ` [Rabat ${dealInfo.discount}]` : '';
      const storeStr = dealInfo?.merchant ? ` w sklepie ${dealInfo.merchant}` : '';
      const descSnippet = dealInfo?.description
        ? `\n\n📖 OPIS I ZASTOSOWANIE:\n${dealInfo.description}`
        : '\n\n📖 OPIS I ZASTOSOWANIE:\nNiezbędny element w wyprawce każdego świadomego rodzica. Wysoka jakość wykonania, bezpieczne materiały i wygoda użytkowania każdego dnia.';
      const specsSnippet = dealInfo?.specs
        ? `\n\n🛡️ PARAMETRY I BEZPIECZEŃSTWO:\n${dealInfo.specs}`
        : '\n\n🛡️ PARAMETRY I BEZPIECZEŃSTWO:\n• Certyfikowane, bezpieczne materiały bez BPA\n• Zaprojektowane z myślą o delikatnej skórze dziecka\n• Łatwe w czyszczeniu i codziennej pielęgnacji';

      if (botRole === 'bargain_mom') {
        momTip = '„Sprawdziłam ceny w drogeriach — tutaj wychodzi zdecydowanie najtaniej w przeliczeniu na sztukę!”';
        postText = `🛍️ ✨ [HIT DLA MALUCHA] ${itemTitle}! 👶\n\n` +
          `Kochane Mamuśki, zobaczcie jaką perełkę udało się upolować w świetnej cenie:\n` +
          descSnippet + specsSnippet + `\n\n` +
          `💰 CENA I OSZCZĘDNOŚĆ:\n` +
          `• Cena promocyjna: ${priceStr}${oldPriceStr}${discStr}\n` +
          `• Sklep: ${storeStr.replace(' w sklepie ', '') || 'Dziecięcy'}\n\n` +
          `💡 WSKAZÓWKA OD MAMY:\n` +
          `${momTip}\n\n` +
          `👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w PIERWSZYM KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      } else if (botRole === 'safety_expert') {
        postText = `🩺 🛡️ [ATESTOWANA PEREŁKA] ${itemTitle}! 👶\n\n` +
          `Drodzy Rodzice! Bezpieczeństwo malucha to absolutny priorytet, dlatego bierzemy pod lupę tę okazję:\n` +
          descSnippet + specsSnippet + `\n\n` +
          `💰 CENA I WARUNKI:\n` +
          `• Cena: ${priceStr}${oldPriceStr}${discStr}${storeStr}\n\n` +
          `🩺 OPINIA EKSPERTA:\n` +
          `• Wzorowy dobór atestów i materiałów przyjaznych dziecku.\n` +
          `• Odpowiednia ergonomia i brak małych, niebezpiecznych elementów.\n\n` +
          `👉 Bezpośredni link do sprawdzonego zakupu czeka w PIERWSZYM KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      } else if (botRole === 'montessori_play') {
        postText = `🎨 🧸 [MĄDRA ZABAWA MONTESSORI] ${itemTitle}! ✨\n\n` +
          `Kreatywne Mamuśki! Świetna propozycja wspierająca naturalny rozwój i małą motorykę bez smartfonów:\n` +
          descSnippet + specsSnippet + `\n\n` +
          `💰 CENA PROMOCYJNA:\n` +
          `• Tylko ${priceStr}${oldPriceStr}${discStr}${storeStr}\n\n` +
          `💡 POMYSŁ NA ZABAWĘ W DOMU:\n` +
          `Pozwól dziecku na swobodne odkrywanie faktur i kształtów – to doskonały trening koordynacji ręka-oko i cierpliwości!\n\n` +
          `👉 Link do okazji znajdziecie tradycyjnie w PIERWSZYM KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      } else {
        // mom_community
        postText = `☕ 💬 [KAWIARENKA MAMUSIEK] ${itemTitle}! 👶\n\n` +
          `Dziewczyny, siadamy z ciepłą kawą (o ile maluch pozwoli 😉) i patrzymy na tę ofertę:\n` +
          descSnippet + specsSnippet + `\n\n` +
          `💰 CENA:\n` +
          `• ${priceStr}${oldPriceStr}${discStr}${storeStr}\n\n` +
          `❓ PYTANIE DO WAS:\n` +
          `Jak to wygląda u Was? Używacie już tego typu rozwiązań czy dopiero kompletujecie wyprawkę? Dajcie znać w komentarzach!\n\n` +
          `👉 Bezpośredni link do okazji znajdziecie w PIERWSZYM KOMENTARZU ⬇️!\n\n` +
          `${dynamicHashtags.join(' ')}`;
      }
    }

    // Pierwszy komentarz z bezpośrednim linkiem
    const directUrl = dealInfo?.dealUrl || resolveBabyAffiliateUrl(dealInfo?.dealUrl || '', trackingCampaign);
    firstComment = directUrl
      ? `🔗 Bezpośredni link do okazji i kod rabatowy:\n${directUrl}`
      : '🔗 Link do okazji dostępny w portalu Okazje Plus!';

    const queueItem: Partial<BabyPostQueueItem> = {
      botId: bot.id,
      botRole,
      botName: bot.name,
      status: bot.autoApprove ? 'approved' : 'pending',
      dealId: dealId || undefined,
      title: generatedTitle,
      content: postText,
      momTip: momTip || undefined,
      realPrice: dealInfo?.price || undefined,
      discountStr: dealInfo?.discount || undefined,
      linkUrl: directUrl,
      imageUrl: dealInfo?.imageUrl || undefined,
      hashtags: dynamicHashtags,
      firstComment,
      targets: {
        facebook: true,
        portal: bot.target === 'both' || bot.target === 'portal',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, item: queueItem };
  } catch (err: any) {
    console.error('Error generating baby post:', err);
    return { success: false, error: err.message };
  }
}

export async function generateBabyPostAction(params: {
  botRole: BabyBotRole;
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
}): Promise<{
  success: boolean;
  item?: Partial<BabyPostQueueItem>;
  error?: string;
}> {
  return generateBabyPost(params, false);
}

// ============================================================================
// MODERACJA: DODAWANIE, ZATWIERDZANIE, ODRZUCANIE I USUWANIE
// ============================================================================

export async function addBabyPostToQueueAction(
  item: Omit<BabyPostQueueItem, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const docRef = await adminDb.collection('babyPostQueue').add({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error('Error adding baby post to queue:', err);
    return { success: false, error: err.message };
  }
}

export async function approveBabyPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('babyPostQueue').doc(postId).update({
      status: 'approved',
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error approving baby post:', err);
    return { success: false, error: err.message };
  }
}

export async function rejectBabyPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('babyPostQueue').doc(postId).update({
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error rejecting baby post:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteBabyPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('babyPostQueue').doc(postId).delete();
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting baby post:', err);
    return { success: false, error: err.message };
  }
}

export async function updateBabyQueueItemAction(
  id: string,
  updates: Partial<BabyPostQueueItem>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('babyPostQueue').doc(id).set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating baby queue item:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// PUBLIKACJA NA FACEBOOKU I W PORTALU
// ============================================================================

export async function publishBabyPostAction(
  postId: string,
  editedContent?: string,
  skipAuth: boolean = false
): Promise<{
  success: boolean;
  fbPostId?: string;
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

    const docRef = adminDb.collection('babyPostQueue').doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Post nie istnieje w kolejce' };
    }

    const post = snap.data() as BabyPostQueueItem;
    const configRes = await getBabyAutopilotConfig(true);
    const config = configRes.config;

    const content = editedContent || post.content;
    const trackingCampaign = config.tracking?.campaign || 'Maluch_1';
    const finalTrackingLink = resolveBabyAffiliateUrl(post.linkUrl, trackingCampaign);

    let fbPostId: string | undefined;
    let fbPostUrl: string | undefined;
    let portalDealId: string | undefined;
    let publishError: string | undefined;

    const doPublishFb = post.targets?.facebook ?? true;
    const doPublishPortal = post.targets?.portal ?? false;

    // 1. Publikacja na Facebooku (Strona "Perełki dla Malucha i Mamy")
    if (doPublishFb && config.fb.pageId && config.fb.accessToken) {
      try {
        const pageId = config.fb.pageId;
        const token = config.fb.accessToken;

        if (post.imageUrl && config.fb.includePhoto) {
          // Publikacja ze zdjęciem
          const photoUrl = `https://graph.facebook.com/v21.0/${pageId}/photos`;
          const photoBody = {
            caption: content,
            url: post.imageUrl,
            access_token: token,
          };

          const photoRes = await fetch(photoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(photoBody),
          });
          const photoData = await photoRes.json();

          if (photoRes.ok && (photoData.post_id || photoData.id)) {
            fbPostId = photoData.post_id || photoData.id;
          } else {
            console.warn('FB photo post error, falling back to feed:', photoData);
            // Fallback do posta tekstowego z linkiem
            const feedUrl = `https://graph.facebook.com/v21.0/${pageId}/feed`;
            const feedRes = await fetch(feedUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: content,
                link: finalTrackingLink,
                access_token: token,
              }),
            });
            const feedData = await feedRes.json();
            if (feedRes.ok && feedData.id) {
              fbPostId = feedData.id;
            } else {
              throw new Error(feedData.error?.message || photoData.error?.message || 'Błąd publikacji na FB');
            }
          }
        } else {
          // Publikacja tekstowa / link
          const feedUrl = `https://graph.facebook.com/v21.0/${pageId}/feed`;
          const feedRes = await fetch(feedUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content,
              link: finalTrackingLink,
              access_token: token,
            }),
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

          // Dodaj pierwszy komentarz z bezpośrednim linkiem
          if (config.fb.autoPostFirstComment && finalTrackingLink) {
            try {
              const commentUrl = `https://graph.facebook.com/v21.0/${fbPostId}/comments`;
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
        console.error('FB publish error for baby post:', fbErr);
        publishError = fbErr.message;
      }
    }

    // 2. Publikacja w Portalu Okazje Plus
    if (doPublishPortal && !post.dealId) {
      try {
        const cleanPrice = post.realPrice
          ? parseFloat(post.realPrice.replace(/[^0-9.,]/g, '').replace(',', '.'))
          : 49.99;
        const newDealDoc = {
          title: { pl: post.title },
          description: { pl: content },
          price: cleanPrice,
          legacyPrice: cleanPrice,
          link: post.linkUrl,
          image: post.imageUrl || '',
          imageHint: 'dla dzieci i mamy',
          category: 'dziecko-zabawki',
          mainCategorySlug: 'dziecko-zabawki',
          merchant: 'Perełki dla Malucha',
          status: config.portal.defaultStatus || 'approved',
          temperature: 15,
          voteCount: 1,
          commentsCount: 0,
          source: 'manual',
          dealType: 'sale',
          tags: ['dla dzieci', 'mama i dziecko', 'zabawki', 'wyprawka', 'perełki dla malucha'],
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

    await docRef.set(
      {
        content,
        status: updatedStatus,
        fbPostId: fbPostId || post.fbPostId,
        fbPostUrl: fbPostUrl || post.fbPostUrl,
        portalDealId: portalDealId || post.portalDealId,
        publishedAt: hasSucceeded ? new Date().toISOString() : undefined,
        errorMessage: publishError,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 4. Zaktualizuj statystyki bota i konfiguracji
    if (hasSucceeded) {
      if (post.botId) {
        try {
          const botRef = adminDb.collection('babyBotPersonas').doc(post.botId);
          await botRef.set(
            {
              totalPublished: (post.botRole ? 1 : 0),
            },
            { merge: true }
          );
        } catch (botErr) {
          console.warn('Error updating baby bot stats:', botErr);
        }
      }

      try {
        await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).set(
          {
            stats: {
              ...config.stats,
              totalPublishedFb: config.stats.totalPublishedFb + (fbPostId ? 1 : 0),
              totalPublishedPortal: config.stats.totalPublishedPortal + (portalDealId ? 1 : 0),
              lastPublishedAt: new Date().toISOString(),
            },
          },
          { merge: true }
        );
      } catch (cfgErr) {
        console.warn('Error updating config stats:', cfgErr);
      }
    }

    try {
      revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    } catch (_) {}
    return {
      success: hasSucceeded,
      fbPostId,
      portalDealId,
      error: publishError,
    };
  } catch (err: any) {
    console.error('Error publishing baby post:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// RĘCZNE DODAWANIE OKAZJI DZIECIĘCEJ
// ============================================================================

export async function createManualBabyDealAndPostAction(params: {
  title: string;
  price: number;
  originalPrice?: number;
  dealUrl: string;
  imageUrl?: string;
  merchant?: string;
  description?: string;
  category?: string;
  publishFbNow?: boolean;
  botRole?: BabyBotRole;
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
      merchant = 'Sklep dla Dzieci',
      description = '',
      publishFbNow = false,
      botRole = 'bargain_mom',
    } = params;

    const configRes = await getBabyAutopilotConfig(true);
    const trackingCampaign = configRes.config.tracking?.campaign || 'Maluch_1';
    const directAffiliateUrl = resolveBabyAffiliateUrl(dealUrl, trackingCampaign);

    // 1. Dodaj okazję do bazy deals
    const dealDoc = {
      title: { pl: title },
      description: { pl: description },
      price,
      legacyPrice: price,
      originalPrice: originalPrice || null,
      link: directAffiliateUrl,
      image: imageUrl || '',
      imageHint: 'dla dzieci i mamy',
      category: 'dziecko-zabawki',
      mainCategorySlug: 'dziecko-zabawki',
      merchant,
      status: 'approved',
      temperature: 20,
      voteCount: 1,
      commentsCount: 0,
      source: 'manual',
      dealType: 'sale',
      tags: ['dziecko', 'mama i dziecko', 'zabawki', 'wyprawka', 'perełki dla malucha'],
      postedBy: 'Perełki dla Malucha i Mamy',
      postedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verified: true,
      verifiedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('deals').add(dealDoc);
    const dealId = docRef.id;

    // 2. Wygeneruj post AI
    const genRes = await generateBabyPostAction({
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
        description,
      },
    });

    if (!genRes.success || !genRes.item) {
      return { success: true, dealId };
    }

    // 3. Dodaj do kolejki
    const queueAddRes = await addBabyPostToQueueAction(genRes.item as any);
    const postId = queueAddRes.id;
    let fbPostUrl: string | undefined;

    // 4. Jeśli natychmiastowa publikacja
    if (publishFbNow && postId) {
      const pubRes = await publishBabyPostAction(postId);
      if (pubRes.success && pubRes.fbPostId) {
        fbPostUrl = `https://facebook.com/${pubRes.fbPostId}`;
      }
    }

    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    revalidatePath('/[locale]/deals', 'page');

    return {
      success: true,
      dealId,
      postId,
      fbPostUrl,
    };
  } catch (err: any) {
    console.error('Error creating manual baby deal:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// DIAGNOSTYKA I TEST FACEBOOKA
// ============================================================================

export async function validateFacebookBabyCredentialsAction(
  token?: string,
  pageId?: string
): Promise<{
  valid: boolean;
  pageName?: string;
  pageId?: string;
  category?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { valid: false, error: 'Wymagane uprawnienia administratora' };
    }

    const configRes = await getBabyAutopilotConfig(true);
    const activeToken = token || configRes.config.fb.accessToken;
    const activePageId = pageId || configRes.config.fb.pageId;

    if (!activeToken || !activePageId) {
      return { valid: false, error: 'Brak tokena lub ID strony w konfiguracji' };
    }

    const testUrl = `https://graph.facebook.com/v21.0/${activePageId}?fields=name,id,category,link&access_token=${activeToken}`;
    const res = await fetch(testUrl);
    const data = await res.json();

    if (!res.ok || data.error) {
      return {
        valid: false,
        error: data.error?.message || `Błąd Graph API: ${res.statusText}`,
      };
    }

    return {
      valid: true,
      pageName: data.name,
      pageId: data.id,
      category: data.category,
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export async function publishTestBabyPostAction(): Promise<{
  success: boolean;
  fbPostId?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const configRes = await getBabyAutopilotConfig(true);
    const config = configRes.config;

    if (!config.fb.pageId || !config.fb.accessToken) {
      return { success: false, error: 'Brak skonfigurowanego ID strony lub tokena FB' };
    }

    const testMessage =
      `🍼 Test automatyzacji "Perełki dla Malucha i Mamy" ✨\n\n` +
      `System publikacji i AI Boty działają prawidłowo! Przygotowujemy najlepsze promocje i atestowane perełki dla maluszków i mam.\n\n` +
      `#PerełkiDlaMalucha #MamaIDziecko #OkazjePlus`;

    const feedUrl = `https://graph.facebook.com/v21.0/${config.fb.pageId}/feed`;
    const res = await fetch(feedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        access_token: config.fb.accessToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || 'Błąd publikacji posta testowego' };
    }

    // Dodaj testowy komentarz
    if (config.fb.autoPostFirstComment && data.id) {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${data.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `🔗 Testowy komentarz z bezpośrednim linkiem afiliacyjnym:\nhttps://okazjeplus.pl?subid=Maluch_1`,
            access_token: config.fb.accessToken,
          }),
        });
      } catch (cErr) {
        console.warn('Test comment error:', cErr);
      }
    }

    return { success: true, fbPostId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// POBIERANIE OFERT Z FEEDÓW PARTNERSKICH (CONVERTISER, TRADETRACKER, ALIEXPRESS)
// ============================================================================

export async function harvestBabyPartnerOffers(
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
          error: 'Wymagane uprawnienia administratora',
        };
      }
    }

    const configRes = await getBabyAutopilotConfig(true);
    const config = configRes.config;

    const sources = options?.sources || (['convertiser', 'tradetracker', 'aliexpress'] as const);
    const keywords = options?.keywords || [
      'Pampers pieluchy',
      'wózek spacerowy',
      'fotelik samochodowy isofix',
      'laktator elektryczny',
      'butelka antykolkowa',
      'smoczek uspokajający',
      'zabawki edukacyjne montessori',
      'lego duplo',
      'Kinderkraft wózek',
      'Chicco zabawki',
      'Cybex fotelik',
      'Fisher Price',
      'Canpol babies',
      'Lovi butelka',
      'ubranka niemowlęce body',
      'bujaczek leżaczek',
      'mata edukacyjna',
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
    const existingTitles = new Set(
      existingSnap.docs.map(d => (d.data().title?.pl || d.data().title || '').toLowerCase().trim()).filter(Boolean)
    );

    const STRICT_BABY_NEGATIVE = [
      'pies', 'psa', 'psów', 'psom', 'dla psów', 'suczek', 'suczki', 'dla suczek',
      'kot', 'kota', 'kotów', 'kotom', 'dla kota', 'barry king', 'zwierząt', 'zwierzęta',
      'dla zwierząt', 'gryzoń', 'obroża', 'smycz', 'kuweta', 'żwirek', 'drapak',
      'przerzutka', 'rower', 'stelaż podtynkowy', 'roca', 'uchwyt samochodowy',
      'multimetr', 'wkrętarka', 'lutownica', 'olej silnikowy', 'opona', 'cement',
      'wędka', 'kołowrotek', 'erotyk', 'papierosy', 'alkohol', 'bateria do wkrętarki', 'felga',
      'kurtka narciarska', 'narty', 'joy-con', 'switch', 'ssz 230v', 'eaton', 'satel', 'siemens',
      ...(config.filters?.negativeKeywords || []).map(k => k.toLowerCase().trim()).filter(Boolean)
    ];

    // 1. CONVERTISER FEED & API
    if (sources.includes('convertiser') && (config.partners?.convertiser ?? true)) {
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
              if (STRICT_BABY_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

              const priceNum = typeof item.price === 'number'
                ? item.price
                : parseFloat(String(item.price || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
              if (isNaN(priceNum) || priceNum < 10) continue;

              const rawLink = item.direct_link || item.tracking_link || item.url || `https://convertiser.com/products/${item.id}/`;
              const affiliateLink = resolveBabyAffiliateUrl(rawLink, config.tracking?.campaign || 'Maluch_1');
              if (existingLinks.has(affiliateLink) || existingTitles.has(titleLower)) continue;

              const origPriceNum = item.old_price 
                ? parseFloat(String(item.old_price).replace(/[^0-9.,]/g, '').replace(',', '.')) 
                : undefined;
              const merchant = item.offer || item.merchant || item.brand || 'Sklep dziecięcy';
              const imageUrl = item.images?.default || item.image_link || item.images?.thumb_180 || item.image_url || '';

              let subSubCategorySlug = 'akcesoria-dla-dzieci';
              if (titleLower.includes('pampers') || titleLower.includes('pieluch') || titleLower.includes('chustecz')) {
                subSubCategorySlug = 'higiena-i-pielegnacja';
              } else if (titleLower.includes('wózek') || titleLower.includes('wozek') || titleLower.includes('spacerówk')) {
                subSubCategorySlug = 'wozki-dzieciece';
              } else if (titleLower.includes('fotelik') || titleLower.includes('isofix')) {
                subSubCategorySlug = 'foteliki-samochodowe';
              } else if (titleLower.includes('laktator') || titleLower.includes('butelk') || titleLower.includes('smoczek') || titleLower.includes('karmieni')) {
                subSubCategorySlug = 'karmienie-dziecka';
              } else if (titleLower.includes('zabawk') || titleLower.includes('klocki') || titleLower.includes('lego') || titleLower.includes('montessori')) {
                subSubCategorySlug = 'zabawki';
              } else if (titleLower.includes('ubrank') || titleLower.includes('body') || titleLower.includes('pajacyk')) {
                subSubCategorySlug = 'ubranka-dzieciece';
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
                imageHint: 'dla dzieci i mamy',
                category: 'dziecko-zabawki',
                mainCategorySlug: 'dziecko-zabawki',
                subCategorySlug: subSubCategorySlug,
                subSubCategorySlug,
                merchant,
                merchantName: merchant,
                status: 'approved',
                temperature: Math.floor(Math.random() * 15) + 15,
                voteCount: 1,
                commentsCount: 0,
                source: 'convertiser',
                dealType: 'sale',
                tags: ['dla dzieci', 'mama i dziecko', 'convertiser', 'perełki dla malucha', merchant.toLowerCase()],
                postedBy: `Perełki dla Malucha (${merchant})`,
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
            console.warn('[Convertiser] Baby search failed for:', kw, cErr);
          }
        }
      } catch (convErr) {
        console.error('[Convertiser] Baby harvesting error:', convErr);
      }
    }

    // 2. TRADETRACKER FEED & API
    if (sources.includes('tradetracker') && (config.partners?.tradetracker ?? true)) {
      try {
        const { getTradeTrackerClient } = await import('@/lib/integrations/tradetracker-client');
        const ttClient = getTradeTrackerClient({
          customerId: config.partners?.tradeTrackerCustomerId,
          passphrase: config.partners?.tradeTrackerPassphrase,
          affiliateSiteId: config.partners?.tradeTrackerSiteId,
          feedUrl: config.partners?.tradeTrackerFeedUrl,
        });

        const feedUrl = config.partners?.tradeTrackerFeedUrl;
        if (feedUrl) {
          try {
            const feedItems = await ttClient.fetchAndParseFeed(feedUrl, 100);
            for (const item of feedItems) {
              if (resultsBySource.tradetracker >= limitPerSource) break;
              if (!item.name) continue;
              const titleLower = item.name.toLowerCase();
              if (STRICT_BABY_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

              const priceNum = item.price || 0;
              if (priceNum < 10) continue;

              const rawLink = item.productURL;
              const link = resolveBabyAffiliateUrl(rawLink, config.tracking?.campaign || 'Maluch_1');
              if (existingLinks.has(link) || existingTitles.has(titleLower)) continue;

              const dealDoc = {
                title: { pl: item.name },
                description: { pl: item.description || item.shortDescription || item.name },
                price: priceNum,
                originalPrice: item.fromPrice,
                legacyPrice: priceNum,
                link,
                affiliateLink: link,
                image: item.imageURL || '',
                imageHint: 'dla dzieci i mamy',
                category: 'dziecko-zabawki',
                mainCategorySlug: 'dziecko-zabawki',
                subCategorySlug: 'akcesoria-dla-dzieci',
                merchant: item.merchantName || 'TradeTracker Partner',
                merchantName: item.merchantName || 'TradeTracker Partner',
                status: 'approved',
                temperature: Math.floor(Math.random() * 15) + 15,
                voteCount: 1,
                commentsCount: 0,
                source: 'tradetracker',
                dealType: 'sale',
                tags: ['dla dzieci', 'mama i dziecko', 'tradetracker', 'perełki dla malucha'],
                postedBy: 'Perełki dla Malucha (TradeTracker)',
                postedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                verified: true,
                verifiedAt: new Date().toISOString(),
              };

              await adminDb.collection('deals').add(dealDoc);
              existingLinks.add(link);
              existingTitles.add(titleLower);
              resultsBySource.tradetracker++;
              totalImported++;
            }
          } catch (feedErr) {
            console.warn('[TradeTracker Feed] Error parsing feed:', feedErr);
          }
        }

        // 2b. Wyszukiwanie przez API TradeTracker
        if (resultsBySource.tradetracker < limitPerSource) {
          for (const kw of keywords.slice(0, 5)) {
            if (resultsBySource.tradetracker >= limitPerSource) break;
            try {
              const items = await ttClient.searchProducts({
                query: kw,
                limit: 15,
                feedUrl: config.partners?.tradeTrackerFeedUrl,
                mode: 'products',
              });

              for (const item of items) {
                if (!item.name) continue;
                const titleLower = item.name.toLowerCase();
                if (STRICT_BABY_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

                const priceNum = item.price || 0;
                if (priceNum <= 0) continue;

                const rawLink = item.productURL;
                const link = resolveBabyAffiliateUrl(rawLink, config.tracking?.campaign || 'Maluch_1');
                if (existingLinks.has(link) || existingTitles.has(titleLower)) continue;

                const dealDoc = {
                  title: { pl: item.name },
                  description: { pl: item.description || item.name },
                  price: priceNum,
                  originalPrice: item.fromPrice,
                  legacyPrice: priceNum,
                  link,
                  affiliateLink: link,
                  image: item.imageURL || '',
                  imageHint: 'dla dzieci i mamy',
                  category: 'dziecko-zabawki',
                  mainCategorySlug: 'dziecko-zabawki',
                  subCategorySlug: 'akcesoria-dla-dzieci',
                  merchant: item.merchantName || 'TradeTracker Partner',
                  merchantName: item.merchantName || 'TradeTracker Partner',
                  status: 'approved',
                  temperature: Math.floor(Math.random() * 15) + 15,
                  voteCount: 1,
                  commentsCount: 0,
                  source: 'tradetracker',
                  dealType: 'sale',
                  tags: ['dla dzieci', 'mama i dziecko', 'tradetracker', 'perełki dla malucha'],
                  postedBy: 'Perełki dla Malucha (TradeTracker)',
                  postedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  verified: true,
                  verifiedAt: new Date().toISOString(),
                };

                await adminDb.collection('deals').add(dealDoc);
                existingLinks.add(link);
                existingTitles.add(titleLower);
                resultsBySource.tradetracker++;
                totalImported++;
                if (resultsBySource.tradetracker >= limitPerSource) break;
              }
            } catch (ttErr) {
              console.warn('[TradeTracker] Baby search failed for:', kw, ttErr);
            }
          }
        }
      } catch (ttMainErr) {
        console.error('[TradeTracker] Baby harvesting error:', ttMainErr);
      }
    }

    // 3. ALIEXPRESS FEED & CATALOG
    if (sources.includes('aliexpress') && (config.partners?.aliexpress ?? true)) {
      try {
        const aliKeywords = [
          'baby romper newborn', 'baby pacifier clip', 'baby stroller',
          'montessori wooden toys', 'diaper bag backpack', 'baby silicone bib',
          'baby teether silicone', 'baby feeding set'
        ];

        try {
          const { createAliExpressClient } = await import('@/integrations/aliexpress/client');
          const aliClient = createAliExpressClient();
          for (const kw of aliKeywords) {
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
                  if (STRICT_BABY_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

                  const currentPrice = (p as any).price?.current ?? (p as any).salePrice ?? 0;
                  const priceNum = typeof currentPrice === 'number'
                    ? currentPrice
                    : parseFloat(String(currentPrice || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
                  if (isNaN(priceNum) || priceNum < 5) continue;

                  const origPrice = (p as any).price?.original ?? (p as any).originalPrice;
                  const origPriceNum = typeof origPrice === 'number'
                    ? origPrice
                    : (origPrice ? parseFloat(String(origPrice).replace(/[^0-9.,]/g, '').replace(',', '.')) : undefined);
                  const aliId = String((p as any).product_id || (p as any).item_id || (p as any).productId || '');
                  const rawLink = aliId
                    ? `https://pl.aliexpress.com/item/${aliId}.html`
                    : ((p as any).product_url || (p as any).productUrl || '');
                  const trackedLink = resolveBabyAffiliateUrl(
                    {
                      link: rawLink,
                      source: 'aliexpress',
                      sourceProductId: aliId || undefined,
                    },
                    config.tracking?.campaign || 'Maluch_1'
                  );
                  if (existingLinks.has(trackedLink) || existingTitles.has(titleLower)) continue;

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
                    sourceProductId: aliId || undefined,
                    metadata: {
                      originalId: aliId || undefined,
                      source: 'aliexpress',
                    },
                    image: imageUrl,
                    imageHint: 'dla dzieci i mamy aliexpress',
                    category: 'dziecko-zabawki',
                    mainCategorySlug: 'dziecko-zabawki',
                    subCategorySlug: 'zabawki',
                    merchant: 'AliExpress',
                    merchantName: 'AliExpress',
                    status: 'approved',
                    temperature: 20,
                    voteCount: 1,
                    commentsCount: 0,
                    source: 'aliexpress',
                    dealType: 'sale',
                    tags: ['dla dzieci', 'mama i dziecko', 'aliexpress', 'perełki dla malucha'],
                    postedBy: 'Perełki dla Malucha (AliExpress)',
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
              console.warn('[AliExpress API] Baby search error for kw:', kw, kwErr);
            }
          }
        } catch (apiErr) {
          console.warn('[AliExpress API] Client init error in baby harvest:', apiErr);
        }

        // 3b. Uzupełniająco: przeszukaj istniejące oferty z AliExpress w Firestore i przypisz kategorię
        if (resultsBySource.aliexpress < limitPerSource) {
          const aliSnap = await adminDb
            .collection('deals')
            .where('source', '==', 'aliexpress')
            .where('status', '==', 'approved')
            .limit(300)
            .get();

          const babyTerms = [
            'baby', 'kids', 'infant', 'newborn', 'toddler', 'pacifier', 'diaper',
            'dzieck', 'niemowl', 'maluch', 'smoczek', 'butelka', 'gryzak',
            'montessori', 'zabawk', 'lalka', 'ubrank', 'body', 'pajacyk'
          ];

          for (const doc of aliSnap.docs) {
            if (resultsBySource.aliexpress >= limitPerSource) break;
            const data = doc.data();
            const titlePl = (data.title?.pl || '').toLowerCase();
            const titleEn = (data.title?.en || '').toLowerCase();
            const titleStr = typeof data.title === 'string' ? data.title.toLowerCase() : '';
            const descStr = typeof data.description === 'string' ? data.description.toLowerCase() : (data.description?.pl || '').toLowerCase();

            const fullText = `${titlePl} ${titleEn} ${titleStr} ${descStr}`;
            const matchesBaby = babyTerms.some(term => fullText.includes(term));
            const isNegative = STRICT_BABY_NEGATIVE.some(neg => fullText.includes(neg));

            if (matchesBaby && !isNegative) {
              await doc.ref.set(
                {
                  category: 'dziecko-zabawki',
                  mainCategorySlug: 'dziecko-zabawki',
                  tags: Array.from(new Set([...(data.tags || []), 'dla dzieci', 'mama i dziecko', 'perełki dla malucha'])),
                  updatedAt: new Date().toISOString(),
                },
                { merge: true }
              );
              resultsBySource.aliexpress++;
              totalImported++;
            }
          }
        }
      } catch (aliErr) {
        console.error('[AliExpress] Baby harvesting error:', aliErr);
      }
    }

    try {
      revalidatePath('/[locale]/admin/baby-autopilot', 'page');
      revalidatePath('/[locale]/deals', 'page');
    } catch {
      // Ignoruj gdy wywołane poza kontekstem żądania HTTP Next.js (np. cron lub skrypt)
    }

    const message = `Pobrano łącznie ${totalImported} nowych okazji z feedów (Convertiser: ${resultsBySource.convertiser}, TradeTracker: ${resultsBySource.tradetracker}, AliExpress: ${resultsBySource.aliexpress}).`;

    return {
      success: true,
      importedCount: totalImported,
      resultsBySource,
      message,
    };
  } catch (err: any) {
    console.error('Error harvesting baby partner offers:', err);
    return {
      success: false,
      importedCount: 0,
      resultsBySource: {},
      message: '',
      error: err.message,
    };
  }
}

export async function harvestBabyPartnerOffersAction(options?: {
  sources?: ('convertiser' | 'tradetracker' | 'aliexpress')[];
  keywords?: string[];
  limitPerSource?: number;
}): Promise<{
  success: boolean;
  importedCount?: number;
  resultsBySource?: Record<string, number>;
  message?: string;
  error?: string;
}> {
  return harvestBabyPartnerOffers(options, false);
}

// ============================================================================
// CYKL AUTOPILOTA (DLA CRON)
// ============================================================================

export async function executeBabyAutopilotCycle(): Promise<{
  success: boolean;
  generatedCount: number;
  publishedCount: number;
  logs: string[];
  error?: string;
}> {
  const logs: string[] = [];
  let generatedCount = 0;
  let publishedCount = 0;

  try {
    logs.push('Rozpoczynam cykl autopilota "Perełki dla Malucha i Mamy"');
    const configRes = await getBabyAutopilotConfig(true);
    const config = configRes.config;

    if (!config.enabled) {
      logs.push('Autopilot jest wyłączony w konfiguracji');
      return { success: true, generatedCount: 0, publishedCount: 0, logs };
    }

    // Pobierz boty
    const botsRes = await getBabyBots(true);
    const activeBots = botsRes.bots.filter(b => b.enabled);
    if (activeBots.length === 0) {
      logs.push('Brak aktywnych botów');
      return { success: true, generatedCount: 0, publishedCount: 0, logs };
    }

    // 1. Publikuj zatwierdzone posty z kolejki (lub oczekujące w trybie autopilot)
    const queueRes = await getBabyQueue(true);
    const approvedPosts = queueRes.items.filter(i => 
      i.status === 'approved' || (config.mode === 'autopilot' && i.status === 'pending')
    );

    if (approvedPosts.length > 0) {
      logs.push(`Znaleziono ${approvedPosts.length} postów kwalifikujących się do publikacji`);
      const postToPublish = approvedPosts[0]; // Publikuj 1 na cykl aby nie spamować
      const pubRes = await publishBabyPostAction(postToPublish.id, undefined, true);
      if (pubRes.success) {
        publishedCount++;
        logs.push(`Opublikowano post ${postToPublish.id} na FB: ${pubRes.fbPostId || 'OK'}`);
      } else {
        logs.push(`Błąd publikacji posta ${postToPublish.id}: ${pubRes.error}`);
      }
    }

    // 2. Jeśli kolejka ma mało elementów, pobierz z feeda i wygeneruj nową propozycję
    const pendingCount = queueRes.items.filter(i => i.status === 'pending' || i.status === 'approved').length;
    if (pendingCount < 4) {
      logs.push(`Mało aktywnych postów w kolejce (${pendingCount}), sprawdzam feedy partnerskie i okazje dziecięce...`);

      // Automatyczny harvest z feedów partnerskich
      try {
        const harvestRes = await harvestBabyPartnerOffers(undefined, true);
        logs.push(`Harvester feeda: ${harvestRes.message}`);
      } catch (hErr: any) {
        logs.push(`Błąd pobierania z feeda: ${hErr?.message}`);
      }

      const dealsRes = await getBabyDeals({ limit: 15, minDiscount: config.filters.minDiscountPercent }, true);

      if (dealsRes.deals.length > 0) {
        // Sprawdź kategorie ostatnich 5 postów, aby wykluczyć powtórzenia (np. smoczek po smoczku)
        const recentCategories = queueRes.items.slice(0, 5).map(i =>
          detectDealCategory(i.title || '', i.content || '', 'baby')
        );
        const existingDealIds = queueRes.items.map(q => q.dealId).filter(Boolean) as string[];

        const diverseRec = pickDiverseRecommendation(dealsRes.deals, {
          niche: 'baby',
          recentCategories,
          excludeDealIds: existingDealIds,
        });

        const freshDeal = diverseRec.deal || dealsRes.deals[0];
        logs.push(`Anti-Clustering AI: wybrano kategorię "${diverseRec.categoryLabel}" (${diverseRec.reason})`);

        // Wybierz losowego aktywnego bota
        const chosenBot = activeBots[Math.floor(Math.random() * activeBots.length)];
        logs.push(`Generuję post bota "${chosenBot.name}" dla oferty: ${freshDeal.title}`);

        const genRes = await generateBabyPost(
          {
            botRole: chosenBot.role,
            dealId: freshDeal.id,
            targetDealData: {
              title: freshDeal.title,
              price: freshDeal.price,
              oldPrice: freshDeal.oldPrice,
              discount: freshDeal.discount,
              merchant: freshDeal.merchant,
              imageUrl: freshDeal.imageUrl,
              dealUrl: freshDeal.dealUrl,
              description: freshDeal.description,
            },
          },
          true
        );

        if (genRes.success && genRes.item) {
          const itemStatus = config.mode === 'autopilot' ? 'approved' : genRes.item.status;
          const addRes = await adminDb.collection('babyPostQueue').add({
            ...genRes.item,
            status: itemStatus,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          generatedCount++;
          logs.push(`Utworzono post w kolejce ID: ${addRes.id} (status: ${itemStatus})`);

          // Jeśli w trybie autopilot nic jeszcze nie opublikowano w tym cyklu, opublikuj ten post od razu
          if (config.mode === 'autopilot' && publishedCount === 0) {
            const pubRes = await publishBabyPostAction(addRes.id, undefined, true);
            if (pubRes.success) {
              publishedCount++;
              logs.push(`Opublikowano nowo wygenerowany post ${addRes.id} na FB: ${pubRes.fbPostId || 'OK'}`);
            } else {
              logs.push(`Błąd publikacji nowego posta ${addRes.id}: ${pubRes.error}`);
            }
          }
        }
      } else {
        logs.push('Brak świeżych ofert dziecięcych spełniających kryteria');
      }
    }

    return { success: true, generatedCount, publishedCount, logs };
  } catch (err: any) {
    logs.push(`Błąd krytyczny cyklu: ${err.message}`);
    return { success: false, generatedCount, publishedCount, logs, error: err.message };
  }
}
