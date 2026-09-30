'use server';

/**
 * social-growth.ts
 * Server Actions dla zaawansowanych funkcji rozwoju społeczności:
 * - Komentarze dyskusyjne AI i Auto-Reply
 * - Pojedynki ofert (A vs B) i posty lifestylowe
 * - Udostępnianie w grupach i crossposting do połączonej grupy
 * - Powiadomienia push na Telegram
 */

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import {
  generateEngagementStarterComment,
  generateAutoReplyToUserComment,
  generateVersusPost,
  generateLifestylePost,
  postFacebookComment,
  fetchFacebookPostComments,
  shareToLinkedFacebookGroup,
  sendTelegramPostAlert,
  SocialNiche,
  TargetGroupItem,
  FbCommentItem,
} from '@/lib/social-growth-engine';
import { getGeneralAutopilotConfig, getGeneralBots } from './general-autopilot';
import { getFishingAutopilotConfig, getFishingBots } from './fishing-autopilot';
import { getBabyAutopilotConfig, getBabyBots } from './baby-autopilot';
import { resolveGeneralAffiliateUrl } from '@/lib/general-utils';
import { resolveFishingAffiliateUrl } from '@/lib/fishing-utils';
import { resolveBabyAffiliateUrl } from '@/lib/baby-utils';

function getNicheCollectionNames(niche: SocialNiche) {
  if (niche === 'fishing') {
    return {
      settingsDoc: 'fishing-autopilot-settings',
      queueColl: 'fishingPostQueue',
      dealsColl: 'fishingDealsCatalog',
      botsColl: 'fishingBotPersonas',
      defaultCampaign: 'Fishing_2',
    };
  } else if (niche === 'baby') {
    return {
      settingsDoc: 'baby-autopilot-settings',
      queueColl: 'babyPostQueue',
      dealsColl: 'babyDealsCatalog',
      botsColl: 'babyBotPersonas',
      defaultCampaign: 'Maluch_1',
    };
  }
  return {
    settingsDoc: 'general-autopilot-settings',
    queueColl: 'generalPostQueue',
    dealsColl: 'generalDealsCatalog',
    botsColl: 'generalBotPersonas',
    defaultCampaign: 'Okazje_1',
  };
}

async function getNicheConfig(niche: SocialNiche) {
  if (niche === 'fishing') {
    const res = await getFishingAutopilotConfig(true);
    return res.config;
  } else if (niche === 'baby') {
    const res = await getBabyAutopilotConfig(true);
    return res.config;
  }
  const res = await getGeneralAutopilotConfig(true);
  return res.config;
}

// ============================================================================
// 1. KOMENTARZE NA FACEBOOKU I AUTO-REPLY AI
// ============================================================================

export async function getFacebookCommentsAction(
  niche: SocialNiche,
  fbPostId: string
): Promise<{ success: boolean; comments: FbCommentItem[]; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, comments: [], error: 'Brak uprawnień administratora' };
    }

    const config = await getNicheConfig(niche);
    const token = config?.fb?.accessToken;
    if (!token) {
      return { success: false, comments: [], error: 'Brak tokena Facebooka w konfiguracji' };
    }

    return await fetchFacebookPostComments(fbPostId, token);
  } catch (err: any) {
    return { success: false, comments: [], error: err.message };
  }
}

export async function generateAiReplyAction(
  niche: SocialNiche,
  postTitle: string,
  userComment: string,
  affiliateUrl?: string
): Promise<{ success: boolean; replyText?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const reply = await generateAutoReplyToUserComment(niche, postTitle, userComment, affiliateUrl);
    return { success: true, replyText: reply };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function postFacebookReplyAction(
  niche: SocialNiche,
  commentId: string,
  replyText: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const config = await getNicheConfig(niche);
    const token = config?.fb?.accessToken;
    if (!token) {
      return { success: false, error: 'Brak tokena dostępu dla Facebooka' };
    }

    return await postFacebookComment(commentId, replyText, token);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function postEngagementStarterCommentAction(
  niche: SocialNiche,
  queueItemId: string,
  customText?: string
): Promise<{ success: boolean; commentId?: string; message?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const { queueColl } = getNicheCollectionNames(niche);
    const postDoc = await adminDb.collection(queueColl).doc(queueItemId).get();
    if (!postDoc.exists) {
      return { success: false, error: 'Nie znaleziono posta w kolejce' };
    }

    const postData = postDoc.data()!;
    const fbPostId = postData.fbPostId;
    if (!fbPostId) {
      return { success: false, error: 'Post nie posiada ID opublikowanego posta na FB' };
    }

    const config = await getNicheConfig(niche);
    const token = config?.fb?.accessToken;
    if (!token) {
      return { success: false, error: 'Brak tokena dostępu dla Facebooka' };
    }

    const commentText = customText || postData.engagementCommentText || await generateEngagementStarterComment(
      niche,
      postData.title,
      postData.content,
      postData.botName
    );

    const postRes = await postFacebookComment(fbPostId, commentText, token);
    if (!postRes.success) {
      return { success: false, error: postRes.error };
    }

    await adminDb.collection(queueColl).doc(queueItemId).update({
      engagementCommentPosted: true,
      engagementCommentText: commentText,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      commentId: postRes.commentId,
      message: 'Komentarz rozkręcający dyskusję został pomyślnie dodany na Facebooku!',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 2. POJEDYNKI OFERT I POSTY LIFESTYLOWE
// ============================================================================

export async function generateGrowthPostAction(
  niche: SocialNiche,
  input: {
    postType: 'versus' | 'lifestyle';
    dealId1?: string;
    dealId2?: string;
    lifestyleTopic?: string;
    botRole?: string;
  }
): Promise<{
  success: boolean;
  generatedItem?: any;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const { queueColl, dealsColl, defaultCampaign } = getNicheCollectionNames(niche);
    const config = await getNicheConfig(niche);
    const trackingCampaign = config?.tracking?.campaign || defaultCampaign;

    if (input.postType === 'versus') {
      if (!input.dealId1 || !input.dealId2) {
        return { success: false, error: 'Wybierz dwa produkty do pojedynku ofert!' };
      }

      const [dealDoc1, dealDoc2] = await Promise.all([
        adminDb.collection(dealsColl).doc(input.dealId1).get(),
        adminDb.collection(dealsColl).doc(input.dealId2).get(),
      ]);

      if (!dealDoc1.exists || !dealDoc2.exists) {
        return { success: false, error: 'Nie znaleziono jednej lub obu ofert w katalogu!' };
      }

      const d1 = dealDoc1.data()!;
      const d2 = dealDoc2.data()!;

      const resolver = niche === 'fishing'
        ? resolveFishingAffiliateUrl
        : niche === 'baby'
        ? resolveBabyAffiliateUrl
        : resolveGeneralAffiliateUrl;

      const link1 = resolver(d1.rawLink || d1.dealUrl || '', trackingCampaign);
      const link2 = resolver(d2.rawLink || d2.dealUrl || '', trackingCampaign);

      const versusRes = await generateVersusPost(
        niche,
        {
          title: d1.title,
          price: d1.price,
          oldPrice: d1.oldPrice,
          merchant: d1.merchant,
          dealUrl: link1,
          imageUrl: d1.imageUrl,
        },
        {
          title: d2.title,
          price: d2.price,
          oldPrice: d2.oldPrice,
          merchant: d2.merchant,
          dealUrl: link2,
          imageUrl: d2.imageUrl,
        }
      );

      const engagementComment = await generateEngagementStarterComment(
        niche,
        `Pojedynek: ${d1.title} vs ${d2.title}`
      );

      const newItem = {
        botId: 'versus-bot',
        botRole: input.botRole || 'deal_hunter',
        botName: '🥊 Arbiter Okazji',
        status: 'pending',
        postType: 'versus',
        dealId: input.dealId1,
        versusDealId2: input.dealId2,
        versusDealTitle2: d2.title,
        versusDealUrl2: link2,
        title: `🥊 Pojedynek: ${d1.title.slice(0, 40)} vs ${d2.title.slice(0, 40)}`,
        content: versusRes.postText,
        realPrice: `${d1.price} vs ${d2.price}`,
        linkUrl: link1,
        imageUrl: d1.imageUrl || d2.imageUrl || '',
        hashtags: ['#pojedynek', '#okazje', '#wybór'],
        firstComment: versusRes.firstComment,
        engagementCommentText: engagementComment,
        engagementCommentPosted: false,
        targets: {
          facebook: true,
          portal: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await adminDb.collection(queueColl).add(newItem);
      return { success: true, generatedItem: { id: docRef.id, ...newItem } };
    } else {
      // Lifestyle / Porada / Humor
      const lifestyleText = await generateLifestylePost(niche, input.lifestyleTopic);
      const engagementComment = await generateEngagementStarterComment(
        niche,
        input.lifestyleTopic || 'Relacje ze społecznością'
      );

      const newItem = {
        botId: 'lifestyle-bot',
        botRole: input.botRole || 'community_animator',
        botName: '💬 Animator Społeczności',
        status: 'pending',
        postType: 'lifestyle',
        title: `💬 Społeczność: ${input.lifestyleTopic || 'Dzień dobry i plany'}`,
        content: lifestyleText,
        linkUrl: 'https://okazjeplus.pl',
        hashtags: ['#społeczność', '#okazjeplus', '#dyskusja'],
        firstComment: '💬 Piszcie śmiało w komentarzach, czytamy każdą odpowiedź! 😊',
        engagementCommentText: engagementComment,
        engagementCommentPosted: false,
        targets: {
          facebook: true,
          portal: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await adminDb.collection(queueColl).add(newItem);
      return { success: true, generatedItem: { id: docRef.id, ...newItem } };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 3. CROSSPOSTING DO POŁĄCZONEJ GRUPY FACEBOOKA
// ============================================================================

export async function sharePostToLinkedGroupAction(
  niche: SocialNiche,
  queueItemId: string
): Promise<{ success: boolean; groupPostId?: string; message?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const { queueColl } = getNicheCollectionNames(niche);
    const postDoc = await adminDb.collection(queueColl).doc(queueItemId).get();
    if (!postDoc.exists) {
      return { success: false, error: 'Nie znaleziono posta w kolejce' };
    }

    const postData = postDoc.data()!;
    const config = await getNicheConfig(niche);
    const linkedGroupId = config?.fb?.linkedGroupId || config?.fb?.groupId;
    const token = config?.fb?.accessToken;

    if (!linkedGroupId || !token) {
      return {
        success: false,
        error: 'Brak skonfigurowanego ID połączonej grupy (linkedGroupId) lub tokena w Ustawieniach',
      };
    }

    const shareRes = await shareToLinkedFacebookGroup(
      linkedGroupId,
      postData.content,
      postData.fbPostUrl || postData.linkUrl,
      token
    );

    if (!shareRes.success) {
      return { success: false, error: shareRes.error };
    }

    return {
      success: true,
      groupPostId: shareRes.groupPostId,
      message: 'Post został pomyślnie udostępniony na Twojej grupie Facebooka!',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 4. POWIADOMIENIA PUSH NA TELEGRAM
// ============================================================================

export async function sendPostToTelegramAction(
  niche: SocialNiche,
  queueItemId: string
): Promise<{ success: boolean; messageId?: number; message?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const { queueColl } = getNicheCollectionNames(niche);
    const postDoc = await adminDb.collection(queueColl).doc(queueItemId).get();
    if (!postDoc.exists) {
      return { success: false, error: 'Nie znaleziono posta w kolejce' };
    }

    const postData = postDoc.data()!;
    const config = await getNicheConfig(niche);
    const tg = config?.fb?.telegram;

    if (!tg?.botToken || !tg?.chatId) {
      return {
        success: false,
        error: 'Brak skonfigurowanego Telegram Bot Token lub Chat ID w Ustawieniach niszy',
      };
    }

    const res = await sendTelegramPostAlert(tg.botToken, tg.chatId, {
      title: postData.title,
      price: postData.realPrice,
      dealUrl: postData.linkUrl || 'https://okazjeplus.pl',
      photoUrl: postData.imageUrl,
      hashtags: Array.isArray(postData.hashtags) ? postData.hashtags.join(' ') : undefined,
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      messageId: res.messageId,
      message: 'Alert z okazją został pomyślnie wysłany na kanał Telegram!',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testTelegramNotificationAction(
  niche: SocialNiche,
  botToken: string,
  chatId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const res = await sendTelegramPostAlert(botToken, chatId, {
      title: '🎯 [TEST] Okazje Plus Telegram Bot działa prawidłowo!',
      price: '0,00 zł',
      dealUrl: 'https://okazjeplus.pl',
      hashtags: '#test #okazjeplus #autopilot',
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      message: 'Wiadomość testowa została pomyślnie dostarczona na Telegram!',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 5. ZARZĄDZANIE LISTĄ GRUP DOCELOWYCH (TARGET GROUPS)
// ============================================================================

export async function saveTargetGroupsAction(
  niche: SocialNiche,
  targetGroups: TargetGroupItem[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: 'Brak uprawnień administratora' };
    }

    const { settingsDoc } = getNicheCollectionNames(niche);
    await adminDb.collection('appSettings').doc(settingsDoc).set(
      {
        fb: {
          targetGroups,
        },
      },
      { merge: true }
    );

    return { success: true, message: 'Zaktualizowano listę docelowych grup!' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
