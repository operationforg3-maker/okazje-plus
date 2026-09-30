/**
 * Server Actions: Autopilot dla Społeczności i Fanpage Facebooka
 * "Ogólne Okazje Plus" (Elektronika, Smartfony, AGD, Dom, Hity Dnia)
 *
 * Pobiera okazje (Convertiser, TradeTracker, AliExpress),
 * generuje angażujące posty AI (Genkit Gemini 2.5), zarządza kolejką moderacji
 * oraz publikuje posty bezpośrednio na Facebooku wraz z bezpośrednim linkiem afiliacyjnym w 1. komentarzu.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { ai } from '@/ai/genkit';
import { sanitizeSocialPostText } from '@/lib/social-growth-types';
import type {
  GeneralAutopilotConfig,
  GeneralBotPersona,
  GeneralBotRole,
  GeneralPostQueueItem,
  GeneralDealItem,
} from '@/lib/types';
import {
  CONFIG_DOC_ID,
  DEFAULT_GENERAL_CONFIG,
  DEFAULT_GENERAL_BOTS,
  resolveGeneralAffiliateUrl,
  buildGeneralHashtags,
  formatGeneralPricePLN,
} from '@/lib/general-utils';
import { diversifyDealsList } from '@/lib/deal-diversity';

// ============================================================================
// POBIERANIE I ZAPIS KONFIGURACJI
// ============================================================================

export async function getGeneralAutopilotConfig(
  skipAuth: boolean = false
): Promise<{ success: boolean; config: GeneralAutopilotConfig; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, config: DEFAULT_GENERAL_CONFIG, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const doc = await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).get();
    if (!doc.exists) {
      await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).set(DEFAULT_GENERAL_CONFIG);
      return { success: true, config: DEFAULT_GENERAL_CONFIG };
    }

    const data = doc.data() as Partial<GeneralAutopilotConfig>;
    const merged: GeneralAutopilotConfig = {
      ...DEFAULT_GENERAL_CONFIG,
      ...data,
      fb: { ...DEFAULT_GENERAL_CONFIG.fb, ...(data.fb || {}) },
      portal: { ...DEFAULT_GENERAL_CONFIG.portal, ...(data.portal || {}) },
      schedule: { ...DEFAULT_GENERAL_CONFIG.schedule, ...(data.schedule || {}) },
      filters: { ...DEFAULT_GENERAL_CONFIG.filters, ...(data.filters || {}) },
      partners: { ...DEFAULT_GENERAL_CONFIG.partners, ...(data.partners || {}) },
      tracking: { ...DEFAULT_GENERAL_CONFIG.tracking, ...(data.tracking || {}) },
      stats: { ...DEFAULT_GENERAL_CONFIG.stats, ...(data.stats || {}) },
    };

    return { success: true, config: merged };
  } catch (err: any) {
    console.error('Error fetching general autopilot config:', err);
    return { success: false, config: DEFAULT_GENERAL_CONFIG, error: err.message };
  }
}

export async function getGeneralAutopilotConfigAction(): Promise<{
  success: boolean;
  config?: GeneralAutopilotConfig;
  error?: string;
}> {
  return await getGeneralAutopilotConfig(false);
}

export async function saveGeneralAutopilotConfigAction(
  newConfig: Partial<GeneralAutopilotConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const currentRes = await getGeneralAutopilotConfig(true);
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

    const updated: GeneralAutopilotConfig = {
      ...currentRes.config,
      ...newConfig,
      fb: payloadFb,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).set(updated, { merge: true });
    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    console.error('Error saving general autopilot config:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// ZARZĄDZANIE BOTAMI (PERSONY)
// ============================================================================

export async function getGeneralBots(
  skipAuth: boolean = false
): Promise<{ success: boolean; bots: GeneralBotPersona[]; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, bots: DEFAULT_GENERAL_BOTS, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const snapshot = await adminDb.collection('generalBotPersonas').get();
    if (snapshot.empty) {
      const batch = adminDb.batch();
      for (const bot of DEFAULT_GENERAL_BOTS) {
        batch.set(adminDb.collection('generalBotPersonas').doc(bot.id), bot);
      }
      await batch.commit();
      return { success: true, bots: DEFAULT_GENERAL_BOTS };
    }

    const bots = snapshot.docs.map(doc => doc.data() as GeneralBotPersona);
    return { success: true, bots };
  } catch (err: any) {
    console.error('Error getting general bots:', err);
    return { success: false, bots: DEFAULT_GENERAL_BOTS, error: err.message };
  }
}

export async function getGeneralBotsAction(): Promise<{
  success: boolean;
  bots?: GeneralBotPersona[];
  error?: string;
}> {
  return await getGeneralBots(false);
}

export async function saveGeneralBotAction(
  bot: GeneralBotPersona
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('generalBotPersonas').doc(bot.id).set(bot, { merge: true });
    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    console.error('Error saving general bot:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// WYSZUKIWANIE I POBIERANIE OKAZJI DLA OGÓLNYCH OKAZJI
// ============================================================================

export async function getGeneralDeals(
  options: {
    limit?: number;
    searchQuery?: string;
    partnerFilter?: 'all' | 'aliexpress' | 'convertiser' | 'tradetracker';
    minDiscount?: number;
  } = {},
  skipAuth: boolean = false
): Promise<{ success: boolean; deals: GeneralDealItem[]; totalFound: number; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, deals: [], totalFound: 0, error: 'Wymagane uprawnienia administratora' };
      }
    }

    const configRes = await getGeneralAutopilotConfig(skipAuth);
    const config = configRes.config;
    const trackingCampaign = config.tracking?.campaign || 'Okazje_1';

    const maxLimit = options.limit || 50;
    const partnerFilter = options.partnerFilter || 'all';

    const snapshot = await adminDb
      .collection('deals')
      .where('status', 'in', ['approved', 'poczekalnia', 'pending'])
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const deals: GeneralDealItem[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      // Wyklucz oferty typowo wędkarskie i dziecięce jeśli mają dedykowaną kategorię
      const cat = (data.category || data.mainCategorySlug || '').toLowerCase();
      if (cat.includes('wedk') || cat.includes('dzieck') || cat.includes('zabawk')) {
        return;
      }

      const rawLink = data.link || data.affiliateLink || data.dealUrl || data.sourceUrl || '';
      const partnerSource = (data.source || '').toLowerCase();

      if (partnerFilter !== 'all') {
        if (partnerFilter === 'aliexpress' && !partnerSource.includes('aliexpress') && !rawLink.includes('aliexpress')) return;
        if (partnerFilter === 'convertiser' && !partnerSource.includes('convertiser') && !rawLink.includes('convertiser')) return;
        if (partnerFilter === 'tradetracker' && !partnerSource.includes('tradetracker') && !rawLink.includes('tradetracker')) return;
      }

      const title = typeof data.title === 'string' ? data.title : data.title?.pl || 'Okazja Cenowa';
      const desc = typeof data.description === 'string' ? data.description : data.description?.pl || '';

      if (options.searchQuery) {
        const q = options.searchQuery.toLowerCase();
        if (!title.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) {
          return;
        }
      }

      const discountPercent = data.discountPercent || (data.discount ? parseInt(String(data.discount).replace(/[^0-9]/g, ''), 10) : 0);
      if (options.minDiscount && discountPercent < options.minDiscount) {
        return;
      }

      let priceStr = '';
      if (data.price !== undefined && data.price !== null) {
        priceStr = typeof data.price === 'number' ? formatGeneralPricePLN(data.price) : String(data.price);
      }
      let oldPriceStr = '';
      if (data.originalPrice || data.regularPrice || data.oldPrice) {
        const op = data.originalPrice || data.regularPrice || data.oldPrice;
        oldPriceStr = typeof op === 'number' ? formatGeneralPricePLN(op) : String(op);
      }

      let discountStr = '';
      if (discountPercent > 0) {
        discountStr = `-${discountPercent}%`;
      }

      const directAffiliateUrl = resolveGeneralAffiliateUrl(rawLink, trackingCampaign);

      deals.push({
        id: doc.id,
        title,
        price: priceStr || 'Promocja',
        oldPrice: oldPriceStr,
        discount: discountStr,
        merchant: data.merchant || data.store || 'Okazje Plus',
        imageUrl: data.image || data.imageUrl || data.coverImage || '',
        temperature: typeof data.temperature === 'number' ? data.temperature : 25,
        dealUrl: directAffiliateUrl,
        portalUrl: `https://okazjeplus.pl/pl/deals/${doc.id}`,
        rawLink,
        source: data.source || 'Okazje Plus',
        category: data.category || data.mainCategorySlug || 'Ogólne',
        description: desc,
        specs: data.specs ? (typeof data.specs === 'string' ? data.specs : JSON.stringify(data.specs)) : undefined,
        tags: Array.isArray(data.tags) ? data.tags : [],
      });
    });

    return {
      success: true,
      deals: diversifyDealsList(deals, { niche: 'general' }).slice(0, maxLimit),
      totalFound: deals.length,
    };
  } catch (err: any) {
    console.error('Error fetching general deals:', err);
    return { success: false, deals: [], totalFound: 0, error: err.message };
  }
}

export async function getGeneralDealsAction(options: {
  limit?: number;
  searchQuery?: string;
  partnerFilter?: 'all' | 'aliexpress' | 'convertiser' | 'tradetracker';
  minDiscount?: number;
}): Promise<{ success: boolean; deals?: GeneralDealItem[]; totalFound?: number; error?: string }> {
  return await getGeneralDeals(options, false);
}

// ============================================================================
// KOLEJKA POSTÓW (MODERACJA)
// ============================================================================

export async function getGeneralQueue(
  skipAuth: boolean = false
): Promise<{ success: boolean; items: GeneralPostQueueItem[]; error?: string }> {
  try {
    if (!skipAuth) {
      const session = await getServerAuthSession();
      if (!session || session.role !== 'admin') {
        return { success: false, items: [], error: 'Wymagane uprawnienia administratora' };
      }
    }

    const snapshot = await adminDb
      .collection('generalPostQueue')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as GeneralPostQueueItem[];

    return { success: true, items };
  } catch (err: any) {
    console.error('Error getting general post queue:', err);
    return { success: false, items: [], error: err.message };
  }
}

export async function getGeneralQueueAction(): Promise<{
  success: boolean;
  items?: GeneralPostQueueItem[];
  error?: string;
}> {
  return await getGeneralQueue(false);
}

export async function addGeneralPostToQueueAction(
  item: Omit<GeneralPostQueueItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const docRef = await adminDb.collection('generalPostQueue').add({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error('Error adding general post to queue:', err);
    return { success: false, error: err.message };
  }
}

export async function approveGeneralPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('generalPostQueue').doc(postId).update({
      status: 'approved',
      updatedAt: new Date().toISOString(),
    });

    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    console.error('Error approving general post:', err);
    return { success: false, error: err.message };
  }
}

export async function rejectGeneralPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('generalPostQueue').doc(postId).update({
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    });

    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    console.error('Error rejecting general post:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteGeneralPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('generalPostQueue').doc(postId).delete();
    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting general post:', err);
    return { success: false, error: err.message };
  }
}

export async function updateGeneralQueueItemAction(
  id: string,
  updates: Partial<GeneralPostQueueItem>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    await adminDb.collection('generalPostQueue').doc(id).set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    console.error('Error updating general queue item:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// GENEROWANIE POSTÓW PRZEZ AI
// ============================================================================

export async function generateGeneralPostAction(params: {
  botRole: GeneralBotRole;
  dealId?: string;
  targetDealData?: Partial<GeneralDealItem>;
  customTopic?: string;
  humorLevel?: 'subtle' | 'high' | 'legendary' | 'none';
  target?: 'facebook' | 'portal' | 'both';
}): Promise<{
  success: boolean;
  post?: Partial<GeneralPostQueueItem>;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { botRole, dealId, customTopic, targetDealData } = params;

    const botsRes = await getGeneralBots(true);
    const bot = botsRes.bots.find(b => b.role === botRole) || DEFAULT_GENERAL_BOTS[0];

    const configRes = await getGeneralAutopilotConfig(true);
    const config = configRes.config;
    const trackingCampaign = config.tracking?.campaign || 'Okazje_1';

    let dealInfo: GeneralDealItem | null = null;

    if (targetDealData) {
      dealInfo = {
        id: targetDealData.id || dealId || 'manual_deal',
        title: targetDealData.title || 'Okazja Cenowa',
        price: targetDealData.price || 'Promocja',
        oldPrice: targetDealData.oldPrice,
        discount: targetDealData.discount,
        merchant: targetDealData.merchant || 'Okazje Plus',
        imageUrl: targetDealData.imageUrl || '',
        temperature: targetDealData.temperature || 25,
        dealUrl: targetDealData.dealUrl || '',
        portalUrl: targetDealData.portalUrl || (targetDealData.id ? `https://okazjeplus.pl/pl/deals/${targetDealData.id}` : undefined),
        rawLink: targetDealData.rawLink || targetDealData.dealUrl || '',
        source: targetDealData.source || 'Okazje Plus',
        category: targetDealData.category || 'Ogólne',
        description: targetDealData.description,
        specs: targetDealData.specs,
        tags: targetDealData.tags || [],
      };
    } else if (dealId) {
      const dealDoc = await adminDb.collection('deals').doc(dealId).get();
      if (dealDoc.exists) {
        const d = dealDoc.data()!;
        const rawLink = d.link || d.affiliateLink || d.dealUrl || '';
        const title = typeof d.title === 'string' ? d.title : d.title?.pl || 'Okazja Cenowa';
        const desc = typeof d.description === 'string' ? d.description : d.description?.pl || '';

        const directLink = resolveGeneralAffiliateUrl(rawLink, trackingCampaign);

        let priceStr = '';
        if (d.price !== undefined && d.price !== null) {
          priceStr = typeof d.price === 'number' ? formatGeneralPricePLN(d.price) : String(d.price);
        }
        let oldPriceStr = '';
        if (d.originalPrice || d.regularPrice || d.oldPrice) {
          const op = d.originalPrice || d.regularPrice || d.oldPrice;
          oldPriceStr = typeof op === 'number' ? formatGeneralPricePLN(op) : String(op);
        }

        const disc = d.discountPercent ? `-${d.discountPercent}%` : d.discount || '';

        dealInfo = {
          id: dealDoc.id,
          title,
          price: priceStr || 'Promocja',
          oldPrice: oldPriceStr,
          discount: disc,
          merchant: d.merchant || d.store || 'Okazje Plus',
          imageUrl: d.image || d.imageUrl || '',
          temperature: d.temperature || 25,
          dealUrl: directLink,
          portalUrl: `https://okazjeplus.pl/pl/deals/${dealDoc.id}`,
          rawLink,
          source: d.source || 'Okazje Plus',
          category: d.category || d.mainCategorySlug || 'Elektronika',
          description: desc,
          specs: d.specs ? (typeof d.specs === 'string' ? d.specs : JSON.stringify(d.specs)) : undefined,
          tags: d.tags || [],
        };
      }
    }

    const dynamicHashtags = buildGeneralHashtags(
      dealInfo?.title || customTopic || 'Okazje',
      dealInfo?.category,
      dealInfo?.tags
    );

    let postText = '';
    let proTip = '';
    let aiGenerated = false;

    try {
      const promptText = `
Jesteś profesjonalnym twórcą treści dla społeczności łowców okazji i promocji na portalu "Okazje Plus".
Twoja rola: ${bot.name} (${bot.role}).
Instrukcje bota: ${bot.customInstructions}
Poziom humoru: ${params.humorLevel || bot.humorLevel}.

DANE PRODUKTU I OKAZJI:
- Tytuł/Nazwa produktu: ${dealInfo?.title || customTopic || 'Hit Cenowy'}
- Cena promocyjna: ${dealInfo?.price || 'Świetna okazja'}
- Cena regularna: ${dealInfo?.oldPrice || 'Cena regularna'}
- Zniżka: ${dealInfo?.discount || 'Rabat promocyjny'}
- Sklep: ${dealInfo?.merchant || 'Sklep internetowy'}
- Opis i szczegóły produktu: ${dealInfo?.description || 'Brak opisu'}
${dealInfo?.specs ? `- Parametry techniczne / specyfikacja:\n${dealInfo.specs}` : ''}
- Dodatkowy kontekst/temat: ${customTopic || 'brak'}
- Sugerowane hashtagi: ${dynamicHashtags.join(' ')}

STRUKTURA I WYMOGI POSTA (BARDZO WAŻNE):
Napisz zwięzły, dynamiczny i angażujący post na Facebooka (około 90-150 słów - NIE PISZ TASIEMCÓW ANI ŚCIANY TEKSTU!).
Pisz naturalnie jak prawdziwy pasjonat i łowca okazji, a NIE jak sztuczny chatbot AI!

BEZWZGLĘDNY ZAKAZ UŻYWANIA FORMATOWANIA MARKDOWN (**pogrubienie**, *kursywa*, # nagłówek)!
Facebook NIE interpretuje Markdownu i wyświetla brzydkie gwiazdki '**', co drażni odbiorców.
Jeśli chcesz coś zaakcentować, użyj WIELKICH LITER, czytelnej nowej linii lub emoji (🔥, ⚡, 🛍️, 💡). NIGDY NIE UŻYWAJ ZNAKÓW '**' ANI '*' W TREŚCI!

Elementy posta:
1. 🎯 CHWYTLIWY NAGŁÓWEK Z TYTUŁEM OKAZJI (np. 🔥 MOCNA OKAZJA: ${dealInfo?.title || customTopic} w ${dealInfo?.merchant || 'super cenie'}!)
2. 🚀 KRÓTKI OPIS: Dlaczego ta oferta jest warta uwagi i dla kogo.
3. ⚙️ KLUCZOWE PARAMETRY: 2-3 najważniejsze cechy wypunktowane punktorami '• ' (bez '**').
4. 💰 CENY:
   • Cena promocyjna: ${dealInfo?.price || 'Okazyjna'}
   ${dealInfo?.oldPrice ? `• Cena regularna: ${dealInfo.oldPrice}` : ''}
   ${dealInfo?.discount ? `• Oszczędność: ${dealInfo.discount}` : ''}
   • Sklep: ${dealInfo?.merchant || 'Sklep'}
5. 💡 PRO-TIP BOTA: Krótka, naturalna rada zakupowa lub pytanie do czytelników.
6. 🔗 CALL TO ACTION:
   "👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w PIERWSZYM KOMENTARZU ⬇️!"
7. #️⃣ HASHTAGI NA KOŃCU:
   Zakończ post hashtagami: ${dynamicHashtags.join(' ')}.

Pamiętaj: zero '**', zwięźle, naturalny język!
`;

      const aiResponse = await ai.generate({
        prompt: promptText,
        config: {
          temperature: botRole === 'bargain_hunter' ? 0.7 : 0.4,
          maxOutputTokens: 2500,
        },
      });

      if (aiResponse && aiResponse.text) {
        postText = sanitizeSocialPostText(aiResponse.text);
        aiGenerated = true;
      }
    } catch (aiErr) {
      console.warn('AI generation error for general post, fallback:', aiErr);
    }

    // Gwarancja braku '**' i obecności hashtagów
    if (postText) {
      postText = sanitizeSocialPostText(postText);
      if (!postText.includes('#')) {
        postText = `${postText.trim()}\n\n${dynamicHashtags.join(' ')}`;
      }
    }

    if (!aiGenerated || !postText) {
      const itemTitle = dealInfo?.title || customTopic || 'Nowy Hit Cenowy';
      const priceStr = dealInfo?.price || '99,00 zł';
      const oldPriceStr = dealInfo?.oldPrice ? ` (zamiast ${dealInfo.oldPrice})` : '';
      const discStr = dealInfo?.discount ? ` [Rabat ${dealInfo.discount}]` : '';
      const storeStr = dealInfo?.merchant ? ` w sklepie ${dealInfo.merchant}` : '';

      postText = `🔥 ⚡ [MEGA OKAZJA] ${itemTitle}! 🛍️\n\n` +
        `Łowcy promocji, mamy dla Was solidną obniżkę cenową:\n\n` +
        `💰 CENA I WARUNKI:\n` +
        `• Cena promocyjna: ${priceStr}${oldPriceStr}${discStr}\n` +
        `• Sklep: ${storeStr.replace(' w sklepie ', '') || 'Okazje Plus'}\n\n` +
        `💡 WSKAZÓWKA:\n` +
        `Sprawdzona oferta o wysokiej opłacalności. Pamiętajcie, że okazje flash znikają najszybciej!\n\n` +
        `👉 Bezpośredni link do okazji i kod rabatowy znajdziecie w PIERWSZYM KOMENTARZU ⬇️!\n\n` +
        `${dynamicHashtags.join(' ')}`;
    }

    const directLink = dealInfo?.dealUrl || 'https://okazjeplus.pl';
    const firstComment = `🔗 Bezpośredni link do okazji i kod rabatowy:\n${directLink}`;

    const postItem: Partial<GeneralPostQueueItem> = {
      botId: bot.id,
      botRole: bot.role,
      botName: bot.name,
      dealId: dealInfo?.id,
      title: dealInfo?.title || customTopic || 'Nowy post Okazje Plus',
      content: postText,
      proTip,
      realPrice: dealInfo?.price,
      discountStr: dealInfo?.discount,
      linkUrl: directLink,
      imageUrl: dealInfo?.imageUrl,
      hashtags: dynamicHashtags,
      firstComment,
      targets: {
        facebook: true,
        portal: false,
      },
      status: 'pending',
    };

    return { success: true, post: postItem };
  } catch (err: any) {
    console.error('Error generating general post:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// PUBLIKACJA NA FACEBOOKU
// ============================================================================

export async function publishGeneralPostAction(
  postId: string,
  editedContent?: string
): Promise<{
  success: boolean;
  fbPostId?: string;
  portalDealId?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const docRef = adminDb.collection('generalPostQueue').doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Post nie istnieje w kolejce' };
    }

    const post = snap.data() as GeneralPostQueueItem;
    const configRes = await getGeneralAutopilotConfig(true);
    const config = configRes.config;

    const content = editedContent || post.content;
    const trackingCampaign = config.tracking?.campaign || 'Okazje_1';
    const finalTrackingLink = resolveGeneralAffiliateUrl(post.linkUrl, trackingCampaign);

    let fbPostId: string | undefined;
    let fbPostUrl: string | undefined;
    let publishError: string | undefined;

    const doPublishFb = post.targets?.facebook ?? true;

    if (doPublishFb && config.fb.pageId && config.fb.accessToken) {
      try {
        const pageId = config.fb.pageId;
        const token = config.fb.accessToken;

        if (post.imageUrl && config.fb.includePhoto) {
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
            console.warn('FB photo post fallback to feed:', photoData);
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
        console.error('FB publish error for general post:', fbErr);
        publishError = fbErr.message;
      }
    } else if (doPublishFb && (!config.fb.pageId || !config.fb.accessToken)) {
      publishError = 'Brak skonfigurowanego Page ID lub Access Tokena dla Facebooka w Ustawieniach';
    }

    const isSuccess = Boolean(fbPostId) && !publishError;
    const finalStatus = isSuccess ? 'posted' : 'failed';

    await docRef.update({
      content,
      status: finalStatus,
      fbPostId: fbPostId || null,
      fbPostUrl: fbPostUrl || null,
      errorMessage: publishError || null,
      publishedAt: isSuccess ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });

    if (isSuccess) {
      try {
        await adminDb.collection('appSettings').doc(CONFIG_DOC_ID).set(
          {
            stats: {
              totalPublishedFb: (config.stats?.totalPublishedFb || 0) + 1,
              lastPublishedAt: new Date().toISOString(),
            },
          },
          { merge: true }
        );
      } catch (_) {}
    }

    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}

    return {
      success: isSuccess,
      fbPostId,
      error: publishError,
    };
  } catch (err: any) {
    console.error('Error in publishGeneralPostAction:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// WALIDACJA I TEST FACEBOOKA
// ============================================================================

export async function validateFacebookGeneralCredentialsAction(
  tokenOverride?: string,
  pageIdOverride?: string
): Promise<{
  valid: boolean;
  pageName?: string;
  pageId?: string;
  error?: string;
}> {
  try {
    const configRes = await getGeneralAutopilotConfig(true);
    const activeToken = tokenOverride || configRes.config.fb.accessToken;
    const activePageId = pageIdOverride || configRes.config.fb.pageId;

    if (!activeToken || !activePageId) {
      return { valid: false, error: 'Brak tokena lub Page ID do weryfikacji' };
    }

    const testUrl = `https://graph.facebook.com/v21.0/${activePageId}?fields=name,id,category,link&access_token=${activeToken}`;
    const res = await fetch(testUrl, { cache: 'no-store' });
    const data = await res.json();

    if (res.ok && data.id) {
      return {
        valid: true,
        pageName: data.name,
        pageId: data.id,
      };
    } else {
      return {
        valid: false,
        error: data.error?.message || 'Nieprawidłowy token lub ID strony Facebook',
      };
    }
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export async function publishTestGeneralPostAction(): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  try {
    const configRes = await getGeneralAutopilotConfig(true);
    const config = configRes.config;

    if (!config.fb.pageId || !config.fb.accessToken) {
      return { success: false, error: 'Brak konfiguracji Facebooka w Ustawieniach' };
    }

    const testMessage = `🤖 Test połączenia Okazje Plus z Facebook Graph API!\n\nStatus systemu: ✅ Działa poprawnie.\nCzas: ${new Date().toLocaleString('pl-PL')}\n\n#OkazjePlus #TestAPI`;

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

    if (res.ok && data.id) {
      return { success: true, postId: data.id };
    } else {
      return { success: false, error: data.error?.message || 'Błąd publikacji posta testowego' };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// RĘCZNE DODAWANIE OKAZJI I IMPORT Z URL
// ============================================================================

export async function createManualGeneralDealAndPostAction(params: {
  url: string;
  botRole: GeneralBotRole;
  publishImmediately?: boolean;
}): Promise<{
  success: boolean;
  dealId?: string;
  postId?: string;
  fbPostId?: string;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { url, botRole, publishImmediately } = params;
    if (!url) return { success: false, error: 'Wymagany URL okazji' };

    const configRes = await getGeneralAutopilotConfig(true);
    const config = configRes.config;
    const trackingCampaign = config.tracking?.campaign || 'Okazje_1';

    let title = 'Okazja Promocyjna';
    let price = 99;
    let originalPrice: number | undefined;
    let merchant = 'Sklep Internetowy';
    let imageUrl = '';
    let description = '';

    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OkazjePlusBot/1.0)' },
      });
      const html = await resp.text();

      const ogTitleMatch = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (ogTitleMatch) title = ogTitleMatch[1];
      else if (titleMatch) title = titleMatch[1];

      const ogImageMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i);
      if (ogImageMatch) imageUrl = ogImageMatch[1];

      const ogDescMatch = html.match(/<meta property=["']og:description["'] content=["']([^"']+)["']/i);
      if (ogDescMatch) description = ogDescMatch[1];

      try {
        const u = new URL(url);
        merchant = u.hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch (_) {}
    } catch (fetchErr) {
      console.warn('Could not scrape URL metadata:', fetchErr);
    }

    const cleanAffiliateLink = resolveGeneralAffiliateUrl(url, trackingCampaign);

    const dealDocRef = await adminDb.collection('deals').add({
      title: { pl: title },
      description: { pl: description },
      price,
      legacyPrice: price,
      originalPrice: originalPrice || null,
      link: cleanAffiliateLink,
      image: imageUrl,
      category: 'elektronika',
      mainCategorySlug: 'elektronika',
      merchant,
      temperature: 50,
      voteCount: 1,
      commentsCount: 0,
      status: 'approved',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const genRes = await generateGeneralPostAction({
      botRole,
      dealId: dealDocRef.id,
      target: 'both',
    });

    if (!genRes.success || !genRes.post) {
      return { success: false, error: 'Nie udało się wygenerować posta AI' };
    }

    const queueRes = await addGeneralPostToQueueAction(genRes.post as any);
    if (!queueRes.success || !queueRes.id) {
      return { success: false, error: 'Nie udało się dodać posta do kolejki' };
    }

    let fbPostId: string | undefined;
    if (publishImmediately) {
      const pubRes = await publishGeneralPostAction(queueRes.id);
      fbPostId = pubRes.fbPostId;
    }

    return {
      success: true,
      dealId: dealDocRef.id,
      postId: queueRes.id,
      fbPostId,
    };
  } catch (err: any) {
    console.error('Error in createManualGeneralDealAndPostAction:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// HARVESTER OKAZJI Z FEEDÓW PARTNERSKICH
// ============================================================================

export async function harvestGeneralPartnerOffers(
  options: {
    limitPerSource?: number;
    sources?: ('convertiser' | 'tradetracker' | 'aliexpress')[];
    keywords?: string[];
  } = {}
): Promise<{
  success: boolean;
  importedCount: number;
  bySource: { convertiser: number; tradetracker: number; aliexpress: number };
  error?: string;
}> {
  try {
    const configRes = await getGeneralAutopilotConfig(true);
    const config = configRes.config;
    const trackingCampaign = config.tracking?.campaign || 'Okazje_1';

    const limitPerSource = options.limitPerSource || 10;
    const sources = options.sources || ['convertiser', 'tradetracker', 'aliexpress'];
    const keywords = options.keywords && options.keywords.length > 0
      ? options.keywords
      : (config.filters?.keywords || [
          'smartfon',
          'laptop',
          'telewizor',
          'słuchawki',
          'ekspres do kawy',
          'odkurzacz pionowy',
          'lego',
          'smartwatch',
        ]);

    const resultsBySource = {
      convertiser: 0,
      tradetracker: 0,
      aliexpress: 0,
    };
    let totalImported = 0;

    const existingSnap = await adminDb.collection('deals').orderBy('createdAt', 'desc').limit(500).get();
    const existingLinks = new Set(existingSnap.docs.map(d => d.data().link).filter(Boolean));
    const existingTitles = new Set(
      existingSnap.docs.map(d => (d.data().title?.pl || d.data().title || '').toLowerCase().trim()).filter(Boolean)
    );

    const STRICT_GENERAL_NEGATIVE = [
      'erotyk', 'wibrator', 'narkotyk', 'papierosy', 'tytoń', 'wiatrówka', 'broń',
      ...(config.filters?.negativeKeywords || []).map(k => k.toLowerCase().trim()).filter(Boolean)
    ];

    // 1. CONVERTISER
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
              if (STRICT_GENERAL_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

              const cleanLink = item.url || item.affiliate_url || item.direct_url || '';
              if (!cleanLink || existingLinks.has(cleanLink)) continue;
              if (existingTitles.has(titleLower)) continue;

              const priceVal = typeof item.price === 'number'
                ? item.price
                : parseFloat(String(item.price || item.current_price || '0').replace(',', '.'));
              if (isNaN(priceVal) || priceVal <= 0) continue;

              const oldPriceVal = typeof item.old_price === 'number'
                ? item.old_price
                : (item.old_price ? parseFloat(String(item.old_price).replace(',', '.')) : undefined);

              let discountPercent = 0;
              if (oldPriceVal && oldPriceVal > priceVal) {
                discountPercent = Math.round(((oldPriceVal - priceVal) / oldPriceVal) * 100);
              }

              const affLink = resolveGeneralAffiliateUrl(cleanLink, trackingCampaign);

              await adminDb.collection('deals').add({
                title: { pl: title },
                description: { pl: item.description || `Atrakcyjna oferta na ${title}.` },
                price: priceVal,
                legacyPrice: priceVal,
                originalPrice: oldPriceVal || null,
                discountPercent: discountPercent > 0 ? discountPercent : null,
                link: affLink,
                image: item.image_url || item.image || item.photo || '',
                category: 'elektronika',
                mainCategorySlug: 'elektronika',
                merchant: item.advertiser_name || item.shop || 'Convertiser',
                temperature: 50,
                voteCount: 1,
                commentsCount: 0,
                status: 'approved',
                source: 'convertiser',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              existingLinks.add(cleanLink);
              existingTitles.add(titleLower);
              resultsBySource.convertiser++;
              totalImported++;
              if (resultsBySource.convertiser >= limitPerSource) break;
            }
          } catch (kwErr) {
            console.warn(`[Convertiser] Error searching ${kw}:`, kwErr);
          }
        }
      } catch (cErr) {
        console.warn('Convertiser harvester error:', cErr);
      }
    }

    // 2. TRADETRACKER
    if (sources.includes('tradetracker') && (config.partners?.tradetracker ?? true)) {
      try {
        const { getTradeTrackerClient } = await import('@/lib/integrations/tradetracker-client');
        const ttClient = getTradeTrackerClient({
          customerId: config.partners?.tradeTrackerCustomerId,
          passphrase: config.partners?.tradeTrackerPassphrase,
          affiliateSiteId: config.partners?.tradeTrackerSiteId,
          feedUrl: config.partners?.tradeTrackerFeedUrl,
        });

        if (config.partners?.tradeTrackerFeedUrl) {
          try {
            const feedProducts = await ttClient.fetchAndParseFeed(config.partners.tradeTrackerFeedUrl, 100);

            for (const p of feedProducts) {
              if (resultsBySource.tradetracker >= limitPerSource) break;
              const title = (p.name || '').trim();
              if (!title) continue;
              const titleLower = title.toLowerCase();
              if (STRICT_GENERAL_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

              const cleanLink = p.productURL || '';
              if (!cleanLink || existingLinks.has(cleanLink)) continue;
              if (existingTitles.has(titleLower)) continue;

              const affLink = resolveGeneralAffiliateUrl(cleanLink, trackingCampaign);

              await adminDb.collection('deals').add({
                title: { pl: title },
                description: { pl: p.description || p.shortDescription || `Super oferta w TradeTracker: ${title}` },
                price: p.price || 99,
                legacyPrice: p.price || 99,
                originalPrice: p.fromPrice || null,
                link: affLink,
                affiliateLink: affLink,
                image: p.imageURL || '',
                category: 'elektronika',
                mainCategorySlug: 'elektronika',
                merchant: p.merchantName || 'TradeTracker Partner',
                temperature: 45,
                voteCount: 1,
                commentsCount: 0,
                status: 'approved',
                source: 'tradetracker',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              existingLinks.add(cleanLink);
              existingTitles.add(titleLower);
              resultsBySource.tradetracker++;
              totalImported++;
            }
          } catch (feedErr) {
            console.warn('[TradeTracker] Feed URL parse error:', feedErr);
          }
        }
      } catch (ttErr) {
        console.warn('TradeTracker harvester error:', ttErr);
      }
    }

    // 3. ALIEXPRESS
    if (sources.includes('aliexpress') && (config.partners?.aliexpress ?? true)) {
      try {
        const { createAliExpressClient } = await import('@/integrations/aliexpress/client');
        const aliClient = createAliExpressClient();

        for (const kw of keywords.slice(0, 3)) {
          if (resultsBySource.aliexpress >= limitPerSource) break;
          try {
            const aliResults = await aliClient.searchProducts({
              q: kw,
              limit: Math.min(limitPerSource, 20),
              sort: 'orders',
              targetCurrency: 'PLN',
              targetLanguage: 'PL',
              shipToCountry: 'PL',
            });

            if (aliResults.success && Array.isArray(aliResults.products)) {
              for (const item of aliResults.products) {
                if (resultsBySource.aliexpress >= limitPerSource) break;
                const title = (item.title || '').trim();
                if (!title) continue;
                const titleLower = title.toLowerCase();
                if (STRICT_GENERAL_NEGATIVE.some(neg => titleLower.includes(neg))) continue;

                const currentPrice = (item as any).price?.current ?? (item as any).salePrice ?? 0;
                const priceNum = typeof currentPrice === 'number'
                  ? currentPrice
                  : parseFloat(String(currentPrice || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
                if (isNaN(priceNum) || priceNum < 5) continue;

                const origPrice = (item as any).price?.original ?? (item as any).originalPrice;
                const origPriceNum = typeof origPrice === 'number'
                  ? origPrice
                  : (origPrice ? parseFloat(String(origPrice).replace(/[^0-9.,]/g, '').replace(',', '.')) : undefined);

                const rawLink = (item as any).product_url || (item as any).promotionLink || (item as any).productUrl || `https://www.aliexpress.com/item/${(item as any).item_id || (item as any).productId}.html`;
                const affLink = resolveGeneralAffiliateUrl(rawLink, trackingCampaign);
                if (existingLinks.has(affLink) || existingTitles.has(titleLower)) continue;

                const imageUrl = Array.isArray((item as any).image_urls) && (item as any).image_urls.length > 0
                  ? (item as any).image_urls[0]
                  : ((item as any).imageUrl || '');

                const discPercent = origPriceNum && origPriceNum > priceNum ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100) : null;

                await adminDb.collection('deals').add({
                  title: { pl: title },
                  description: { pl: `Super okazja AliExpress: ${title}. Sprawdzony sprzedawca, szybka wysyłka Choice.` },
                  price: priceNum,
                  legacyPrice: priceNum,
                  originalPrice: origPriceNum || null,
                  discountPercent: discPercent,
                  link: affLink,
                  affiliateLink: affLink,
                  image: imageUrl,
                  category: 'elektronika',
                  mainCategorySlug: 'elektronika',
                  merchant: 'AliExpress Choice',
                  temperature: 60,
                  voteCount: 1,
                  commentsCount: 0,
                  status: 'approved',
                  source: 'aliexpress',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });

                existingLinks.add(affLink);
                existingTitles.add(titleLower);
                resultsBySource.aliexpress++;
                totalImported++;
              }
            }
          } catch (aliErr) {
            console.warn(`[AliExpress] Error searching ${kw}:`, aliErr);
          }
        }
      } catch (aErr) {
        console.warn('AliExpress harvester error:', aErr);
      }
    }

    try {
      revalidatePath('/[locale]/admin/social-media', 'page');
    } catch (_) {}

    return {
      success: true,
      importedCount: totalImported,
      bySource: resultsBySource,
    };
  } catch (err: any) {
    console.error('Error in harvestGeneralPartnerOffers:', err);
    return {
      success: false,
      importedCount: 0,
      bySource: { convertiser: 0, tradetracker: 0, aliexpress: 0 },
      error: err.message,
    };
  }
}

export async function harvestGeneralPartnerOffersAction(options: {
  limitPerSource?: number;
  sources?: ('convertiser' | 'tradetracker' | 'aliexpress')[];
  keywords?: string[];
}): Promise<{
  success: boolean;
  importedCount?: number;
  bySource?: { convertiser: number; tradetracker: number; aliexpress: number };
  error?: string;
}> {
  return await harvestGeneralPartnerOffers(options);
}

// ============================================================================
// CYKL AUTOPILOTA
// ============================================================================

export async function executeGeneralAutopilotCycle(): Promise<{
  success: boolean;
  publishedCount: number;
  generatedCount: number;
  errors: string[];
}> {
  const result = {
    success: true,
    publishedCount: 0,
    generatedCount: 0,
    errors: [] as string[],
  };

  try {
    const configRes = await getGeneralAutopilotConfig(true);
    const config = configRes.config;

    if (!config.enabled) {
      return { ...result, errors: ['General Autopilot jest wyłączony w konfiguracji'] };
    }

    const queueSnap = await adminDb
      .collection('generalPostQueue')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (!queueSnap.empty) {
      const postDoc = queueSnap.docs[0];
      const pubRes = await publishGeneralPostAction(postDoc.id);
      if (pubRes.success) {
        result.publishedCount++;
      } else if (pubRes.error) {
        result.errors.push(`Błąd publikacji ${postDoc.id}: ${pubRes.error}`);
      }
    }

    return result;
  } catch (err: any) {
    console.error('Error executing general autopilot cycle:', err);
    return { ...result, success: false, errors: [err.message] };
  }
}
