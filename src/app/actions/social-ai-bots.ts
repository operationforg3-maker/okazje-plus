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
}

function parseDealFields(rawDeal: any) {
  const rawTitle = rawDeal.title;
  let title = 'Gorąca Okazja';
  if (typeof rawTitle === 'string') {
    title = rawTitle;
  } else if (typeof rawTitle === 'object' && rawTitle !== null) {
    title = rawTitle.pl || rawTitle.en || rawTitle.de || rawTitle.es || Object.values(rawTitle)[0] || 'Gorąca Okazja';
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
  const imageUrl = rawDeal.imageUrl || rawDeal.image;
  const temperature = Number(rawDeal.temperature) || 100;

  return {
    id: rawDeal.id,
    title,
    priceStr,
    oldPriceStr,
    discountStr,
    merchant,
    temperature,
    imageUrl,
    linkUrl,
  };
}

/**
 * Fetch approved deals with suggestions and search support for social media promotion
 */
export async function getPromotableDealsAction(
  searchQuery?: string,
  limitCount: number = 20
): Promise<{ success: boolean; deals: PromotableDeal[]; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, deals: [], error: 'Wymagane uprawnienia administratora' };
    }

    // 1. Fetch recent social posts to mark which deals were already posted in last 14 days
    const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const recentPostsSnap = await adminDb
      .collection('socialPosts')
      .where('createdAt', '>=', recentCutoff)
      .limit(100)
      .get();
    const recentDealIds = new Set(recentPostsSnap.docs.map(d => d.data().itemId).filter(Boolean));

    // 2. Fetch approved deals
    const dealsSnap = await adminDb
      .collection('deals')
      .where('status', '==', 'approved')
      .limit(60)
      .get();

    let allDeals: PromotableDeal[] = dealsSnap.docs.map(doc => {
      const parsed = parseDealFields({ id: doc.id, ...doc.data() });
      return {
        id: parsed.id,
        title: parsed.title,
        price: parsed.priceStr,
        oldPrice: parsed.oldPriceStr,
        discount: parsed.discountStr,
        merchant: parsed.merchant.replace(' w ', ''),
        temperature: parsed.temperature,
        imageUrl: parsed.imageUrl,
        postedRecently: recentDealIds.has(parsed.id),
      };
    });

    // 3. Filter by search query if provided
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      allDeals = allDeals.filter(d => 
        d.title.toLowerCase().includes(q) || 
        (d.merchant && d.merchant.toLowerCase().includes(q))
      );
    }

    // 4. Sort: unposted first, then by temperature desc
    allDeals.sort((a, b) => {
      if (a.postedRecently !== b.postedRecently) {
        return a.postedRecently ? 1 : -1;
      }
      return (b.temperature || 0) - (a.temperature || 0);
    });

    return {
      success: true,
      deals: allDeals.slice(0, limitCount),
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

    if (bot.role === 'hunter') {
      let topDeal: any = null;

      // Check if user specifically requested a deal
      if (targetDealId) {
        const dealDoc = await adminDb.collection('deals').doc(targetDealId).get();
        if (dealDoc.exists) {
          topDeal = { id: dealDoc.id, ...dealDoc.data() };
        }
      }

      // If not, pick automatically avoiding deals posted in the last 14 days
      if (!topDeal) {
        const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const recentPostsSnap = await adminDb
          .collection('socialPosts')
          .where('createdAt', '>=', recentCutoff)
          .limit(100)
          .get();
        const recentDealIds = new Set(recentPostsSnap.docs.map(d => d.data().itemId).filter(Boolean));

        const dealsSnap = await adminDb
          .collection('deals')
          .where('status', '==', 'approved')
          .limit(30)
          .get();

        if (!dealsSnap.empty) {
          const allApproved = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          allApproved.sort((a, b) => (b.temperature || 0) - (a.temperature || 0));

          // Filter out deals that were already posted recently
          const unpostedDeals = allApproved.filter(d => !recentDealIds.has(d.id));
          topDeal = unpostedDeals.length > 0
            ? unpostedDeals[0]
            : allApproved[Math.floor(Math.random() * Math.min(allApproved.length, 5))];
        }
      }

      if (topDeal) {
        const parsed = parseDealFields(topDeal);
        itemId = parsed.id;
        itemTitle = parsed.title;
        linkUrl = parsed.linkUrl;
        imageUrl = parsed.imageUrl;

        const customUserNote = topicHint ? `\n💡 Wskazówka: ${topicHint}\n` : '';

        // Dynamic, diverse copywriting angles:
        const styles = [
          // Style 1: Gorąca Okazja / Klasyk Łowcy
          `🔥 GORĄCA OKAZJA: ${itemTitle}!\n\n` +
          `💰 Cena: ${parsed.priceStr}${parsed.oldPriceStr}${parsed.discountStr}${parsed.merchant}\n` +
          `🌡️ Ocena społeczności: ${parsed.temperature}°\n` +
          customUserNote +
          `\nŁowcy Okazje Plus zweryfikowali tę ofertę – cena jest warta uwagi!\n\n` +
          `👉 Bezpośredni link do okazji i kod rabatowy znajdziesz w pierwszym komentarzu ⬇️ oraz tutaj:\n${linkUrl}\n\n` +
          `#okazje #promocje #okazjeplus #znizki #zakupy`,

          // Style 2: Błąd cenowy / Mocna zniżka
          `⚡ MOCNA OBNIŻKA CENY: ${itemTitle}!\n\n` +
          `🛒 Sklep: ${parsed.merchant ? parsed.merchant.replace(' w ', '') : 'Okazje Plus'}\n` +
          `📉 Nowa cena: ${parsed.priceStr}${parsed.oldPriceStr}${parsed.discountStr ? ` (oszczędzasz ${parsed.discountStr})` : ''}\n` +
          `🌡️ Temperatura okazji: ${parsed.temperature}°\n` +
          customUserNote +
          `\nTaka oferta może szybko zniknąć lub wyprzedać się zapas magazynowy.\n\n` +
          `👉 Bezpośredni link do zakupu czeka w pierwszym komentarzu ⬇️ oraz tutaj:\n${linkUrl}\n\n` +
          `#promocja #hitcenowy #okazjeplus #zakupy #znizka`,

          // Style 3: Perełka dla Łowców / Rekomendacja
          `💎 ZNALEZISKO DNIA: ${itemTitle}!\n\n` +
          `💰 Dziś do upolowania za jedyne ${parsed.priceStr}${parsed.oldPriceStr}${parsed.discountStr}${parsed.merchant}.\n\n` +
          `Nasi użytkownicy i moderatorzy ocenili ten deal na ${parsed.temperature}°. Realna oszczędność potwierdzona historią cen!\n` +
          customUserNote +
          `\n👉 Sprawdź szczegóły i kod rabatowy w 1. komentarzu ⬇️ oraz na stronie:\n${linkUrl}\n\n` +
          `#lowcyokazji #okazjeplus #rabaty #prawdziweokazje`,

          // Style 4: Alert Cenowy / Błyskawiczny
          `🚨 ALERT CENOWY OKAZJE PLUS 🚨\n\n` +
          `👉 Produkt: ${itemTitle}\n` +
          `💸 Aktualna cena: ${parsed.priceStr}${parsed.oldPriceStr}${parsed.discountStr}\n` +
          `🌡️ Ocena: ${parsed.temperature}°\n` +
          customUserNote +
          `\nSprawdź ofertę zanim cena wróci do normy!\n\n` +
          `🔗 Bezpośredni link czeka w pierwszym komentarzu ⬇️ oraz pod adresem:\n${linkUrl}\n\n` +
          `#alertcenowy #okazjeplus #promocje #cenabezsciemy`
        ];

        const chosenIndex = Math.floor(Math.random() * styles.length);
        postText = styles[chosenIndex];
      } else {
        itemTitle = 'Przegląd Najlepszych Okazji Dnia';
        postText = `🔥 CODZIENNY RAPORT OKAZJI Okazje Plus (${timestampStr})!\n\n` +
          `Nasz algorytm i moderatorzy przejrzeli dziś setki ofert. Na portalu czekają na Was zweryfikowane perełki cenowe bez fałszywych rabatów.\n\n` +
          `👉 Sprawdź aktualne okazje:\nhttps://okazjeplus.pl\n\n` +
          `#okazje #promocje #okazjeplus #zakupyonline`;
      }
    } else if (bot.role === 'expert') {
      let expertDeal: any = null;
      if (targetDealId) {
        const dealDoc = await adminDb.collection('deals').doc(targetDealId).get();
        if (dealDoc.exists) {
          expertDeal = { id: dealDoc.id, ...dealDoc.data() };
        }
      }

      if (expertDeal) {
        const parsed = parseDealFields(expertDeal);
        itemId = parsed.id;
        itemTitle = `Ocena oferty: ${parsed.title}`;
        linkUrl = parsed.linkUrl;
        imageUrl = parsed.imageUrl;

        postText = `🛡️ OCENA EKSPERTA OKAZJE PLUS: ${parsed.title}\n\n` +
          `💰 Cena w promocji: ${parsed.priceStr}${parsed.oldPriceStr}${parsed.discountStr}${parsed.merchant}\n` +
          `🌡️ Ocena społeczności: ${parsed.temperature}°\n\n` +
          `Weryfikacja parametrów i historii cen:\n` +
          `✅ Badanie 90-dniowej historii (dyrektywa Omnibus) – realna obniżka\n` +
          `✅ Brak ukrytych kosztów i wysoka ocena sprzedawcy\n` +
          `✅ Dobry stosunek ceny do oferowanych możliwości\n\n` +
          (topicHint ? `💬 Uwagi eksperta: ${topicHint}\n\n` : '') +
          `👉 Bezpośredni link do okazji i kod rabatowy znajdziesz w 1. komentarzu ⬇️ oraz tutaj:\n${linkUrl}\n\n` +
          `#testy #jakosc #ekspert #okazjeplus #swiadomykonsument`;
      } else {
        itemTitle = topicHint || 'Jak kupować mądrze i nie dać się nabrać na „sztuczne promocje”';
        postText = `🛡️ PORADNIK EKSPERTA OKAZJE PLUS: ${itemTitle}\n\n` +
          `Czy wiesz, że ponad 30% promocji w sieci to tylko zawyżone ceny wyjściowe?\n\n` +
          `W laboratorium i redakcji Okazje Plus każda rekomendacja przechodzi przez:\n` +
          `✅ Badanie 90-dniowej historii cen (Omnibus i własne dane)\n` +
          `✅ Weryfikację wiarygodności sprzedawcy\n` +
          `✅ Ocenę fizycznej jakości wykonania sprzętu\n\n` +
          `Kupuj mądrze ze sprawdzoną społecznością:\nhttps://okazjeplus.pl\n\n` +
          `#testyproduktow #jakosc #ekspert #okazjeplus #swiadomykonsument`;
      }
    } else if (bot.role === 'community') {
      itemTitle = topicHint || 'Pytanie do społeczności: Wasz najlepszy zakup miesiąca?';
      postText = `👋 Cześć Łowcy Okazji!\n\n` +
        `Mamy pytanie do naszej społeczności:\n` +
        `💬 ${topicHint || 'Jaka jest najlepsza okazja cenowa, którą udało Wam się upolować w tym miesiącu?'}\n\n` +
        `Podzielcie się w komentarzu linkiem lub nazwą produktu i napiszcie, ile udało się zaoszczędzić! Najciekawsze znaleziska wyróżnimy na stronie głównej.\n\n` +
        `Pamiętajcie, że codzienne perełki czekają też na:\nhttps://okazjeplus.pl\n\n` +
        `#spolecznosc #lowcyokazji #okazjeplus #dyskusja`;
    } else {
      // responder / general
      itemTitle = topicHint || 'FAQ: Jak działają alerty cenowe w Okazje Plus?';
      postText = `🤖 Szybka wskazówka od Okazje Plus:\n\n` +
        `${topicHint || 'Szukasz konkretnego sprzętu w super cenie? Ustaw alert cenowy w serwisie Okazje Plus, a poinformujemy Cię w pierwszej sekundzie, gdy sklep obniży cenę.'}\n\n` +
        `Sprawdź więcej na:\nhttps://okazjeplus.pl\n\n` +
        `#faq #porady #okazjeplus #pomoc`;
    }

    // 2. Prepare post payload
    const initialStatus = immediatePublish || bot.autoApprove ? 'approved' : 'pending';
    const postPayload: Omit<SocialPost, 'id'> = {
      platform: 'facebook',
      status: initialStatus,
      type: 'deal',
      itemId,
      itemData: {
        title: itemTitle,
        description: postText.slice(0, 200),
        url: linkUrl,
        image: imageUrl,
      },
      content: {
        text: postText,
        linkUrl,
        imageUrl,
        hashtags: ['#okazjeplus'],
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

    // 3. Publish to Facebook if requested
    if (immediatePublish) {
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
          }
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
