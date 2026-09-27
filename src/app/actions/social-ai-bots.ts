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

export async function executeBotRun(
  bot: SocialAIBot,
  immediatePublish: boolean = false,
  topicHint?: string,
  userId?: string
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
      // Find top approved deals
      const dealsSnap = await adminDb
        .collection('deals')
        .where('status', '==', 'approved')
        .limit(10)
        .get();

      if (!dealsSnap.empty) {
        // Pick one with highest temperature or recent
        const deals = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        deals.sort((a, b) => (b.temperature || 0) - (a.temperature || 0));
        const topDeal = deals[0];

        itemId = topDeal.id;
        itemTitle = topDeal.title || 'Gorąca Okazja';
        const priceStr = topDeal.currentPrice ? `${topDeal.currentPrice} zł` : '';
        const oldPriceStr = topDeal.originalPrice ? ` (zamiast ${topDeal.originalPrice} zł)` : '';
        const discountStr = topDeal.discount ? ` -${topDeal.discount}%` : '';
        const merchant = topDeal.merchant ? ` w ${topDeal.merchant}` : '';
        linkUrl = topDeal.slug ? `https://okazjeplus.pl/okazje/${topDeal.slug}` : 'https://okazjeplus.pl';
        imageUrl = topDeal.imageUrl || topDeal.image;

        postText = `🔥 GORĄCA OKAZJA: ${itemTitle}!\n\n` +
          `💰 Cena: ${priceStr}${oldPriceStr}${discountStr}${merchant}\n` +
          `🌡️ Ocena społeczności: ${topDeal.temperature || 100}°\n\n` +
          `Łowcy Okazje Plus sprawdzili tę ofertę – cena jest warta uwagi!\n\n` +
          `👉 Szczegóły i kod rabatowy tutaj:\n${linkUrl}\n\n` +
          `#okazje #promocje #promocja #okazjeplus #znizki #zakupy`;
      } else {
        itemTitle = 'Przegląd Najlepszych Okazji Dnia';
        postText = `🔥 CODZIENNY RAPORT OKAZJI Okazje Plus (${timestampStr})!\n\n` +
          `Nasz algorytm i moderatorzy przejrzeli dziś setki ofert. Na portalu czekają na Was zweryfikowane perełki cenowe bez fałszywych rabatów.\n\n` +
          `👉 Sprawdź aktualne okazje:\nhttps://okazjeplus.pl\n\n` +
          `#okazje #promocje #okazjeplus #zakupyonline`;
      }
    } else if (bot.role === 'expert') {
      itemTitle = topicHint || 'Jak kupować mądrze i nie dać się nabrać na „sztuczne promocje”';
      postText = `🛡️ PORADNIK EKSPERTA OKAZJE PLUS: ${itemTitle}\n\n` +
        `Czy wiesz, że ponad 30% promocji w sieci to tylko zawyżone ceny wyjściowe?\n\n` +
        `W laboratorium i redakcji Okazje Plus każda rekomendacja przechodzi przez:\n` +
        `✅ Badanie 90-dniowej historii cen (Omnibus i własne dane)\n` +
        `✅ Weryfikację wiarygodności sprzedawcy\n` +
        `✅ Ocenę fizycznej jakości wykonania sprzętu\n\n` +
        `Kupuj mądrze ze sprawdzoną społecznością:\nhttps://okazjeplus.pl\n\n` +
        `#testyproduktow #jakosc #ekspert #okazjeplus #swiadomykonsument`;
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
  topicHint?: string
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
    const result = await executeBotRun(bot, immediatePublish, topicHint, session.uid);

    revalidatePath('/[locale]/admin/social-media', 'page');
    return result;
  } catch (error) {
    console.error('Error running AI bot action:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Błąd uruchamiania akcji bota' };
  }
}
