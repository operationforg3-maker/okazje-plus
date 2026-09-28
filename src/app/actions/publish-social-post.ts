/**
 * Server Action: Manual Publishing to Social Platforms
 * Integrates with backend API for controlled post publishing
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { publishToSocialPlatform } from '@/lib/platform-publishers';
import type { SocialPost, SocialConfig } from '@/lib/types';
import { getServerAuthSession } from '@/lib/auth-server';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  postId?: string;
  error?: string | { code: string; message: string };
}

async function addSocialLog(
  postId: string,
  platform: SocialPost['platform'],
  action: 'created' | 'approved' | 'posted' | 'failed' | 'cancelled' | 'retried',
  status: SocialPost['status'],
  message: string,
  userId?: string,
  error?: unknown
) {
  await adminDb.collection('socialPostLogs').add({
    postId,
    platform,
    action,
    status,
    message,
    userId,
    error: error ?? null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Publish a social post manually from admin UI
 * Requires authentication and fetches platform credentials
 */
export async function publishSocialPostAction(
  postId: string
): Promise<PublishResult> {
  try {
    // Verify authentication
    const session = await getServerAuthSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    // Require admin role
    if (session.role !== 'admin') {
      return { success: false, error: 'Forbidden: Admin role required' };
    }

    // Fetch post from Firestore
    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }

    const post = { id: postSnap.id, ...postSnap.data() } as SocialPost;

    // Validate post status
    if (post.status !== 'approved') {
      return {
        success: false,
        error: `Cannot publish post with status: ${post.status}`,
      };
    }

    if (post.postedAt) {
      return {
        success: false,
        error: 'Post already published',
      };
    }

    // Fetch platform configuration
    const configRef = adminDb.collection('socialConfig').doc(post.platform);
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      return {
        success: false,
        error: `Platform configuration not found for ${post.platform}`,
      };
    }

    const config = configSnap.data() as SocialConfig;

    if (!config.enabled) {
      return {
        success: false,
        error: `Platform ${post.platform} is disabled`,
      };
    }

    // Validate credentials
    if (!config.credentials?.accessToken) {
      return {
        success: false,
        error: `Missing access token for ${post.platform}`,
      };
    }

    // Publish to platform
    console.log(`[PublishAction] Publishing post ${postId} to ${post.platform}`);
    const result = await publishToSocialPlatform(post, config);

    if (result.success && result.platformPostId) {
      // Update post in Firestore
      await postRef.update({
        status: 'posted',
        platformPostId: result.platformPostId,
        platformUrl: result.platformUrl || null,
        postedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Log action
      await addSocialLog(
        post.id,
        post.platform,
        'posted',
        'posted',
        `Published to ${post.platform}: ${result.platformPostId}`,
        session.uid
      );

      console.log(
        `[PublishAction] Successfully published to ${post.platform}:`,
        result.platformPostId
      );

      return result;
    } else {
      // Log failure
      const errorMsg = typeof result.error === 'string' ? result.error : result.error?.message || 'Unknown error';
      await addSocialLog(
        post.id,
        post.platform,
        'failed',
        'failed',
        `Failed to publish to ${post.platform}`,
        session.uid,
        { error: errorMsg }
      );

      console.error(
        `[PublishAction] Failed to publish to ${post.platform}:`,
        result.error
      );

      return result;
    }
  } catch (error) {
    console.error('[PublishAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetch analytics for a published post
 */
export async function fetchPostAnalyticsAction(
  postId: string
): Promise<{ success: boolean; analytics?: any; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    // Fetch post
    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }

    const post = { id: postSnap.id, ...postSnap.data() } as SocialPost;

    if (!post.platformPostId) {
      return {
        success: false,
        error: 'Post not published yet (missing platformPostId)',
      };
    }

    // Fetch config
    const configRef = adminDb.collection('socialConfig').doc(post.platform);
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      return { success: false, error: 'Platform config not found' };
    }

    const config = configSnap.data() as SocialConfig;

    // Import fetchPostAnalytics dynamically
    const { fetchPostAnalytics } = await import('@/lib/platform-publishers');
    const analytics = await fetchPostAnalytics(
      post.platformPostId,
      post.platform,
      config
    );

    // Update post with analytics
    await postRef.update({
      analytics,
      analyticsLastFetchedAt: new Date().toISOString(),
    });

    // Log action (use 'posted' since analytics_fetched is not a valid action)
    await addSocialLog(
      post.id,
      post.platform,
      'posted',
      'posted',
      'Analytics fetched successfully',
      session.uid
    );

    return { success: true, analytics };
  } catch (error) {
    console.error('[FetchAnalytics] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Schedule a post for future publishing
 */
export async function schedulePostAction(
  postId: string,
  scheduledFor: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }

    const post = postSnap.data() as SocialPost;

    if (post.status !== 'approved') {
      return {
        success: false,
        error: `Cannot schedule post with status: ${post.status}`,
      };
    }

    // Update schedule
    await postRef.update({
      scheduledFor: scheduledFor.toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Log action (use 'approved' since scheduled is not a valid action)
    await addSocialLog(
      postId,
      post.platform,
      'approved',
      'approved',
      `Scheduled for ${scheduledFor.toISOString()}`,
      session.uid
    );

    return { success: true };
  } catch (error) {
    console.error('[SchedulePost] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel scheduled post (but keep as approved)
 */
export async function cancelScheduleAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();
    
    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }

    const post = postSnap.data() as SocialPost;

    await postRef.update({
      scheduledFor: null,
      updatedAt: new Date().toISOString(),
    });

    await addSocialLog(
      postId,
      post.platform,
      'cancelled',
      'approved',
      'Schedule cancelled',
      session.uid
    );

    return { success: true };
  } catch (error) {
    console.error('[CancelSchedule] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create and publish a dedicated Facebook test post.
 */
export async function createAndPublishFacebookTestPostAction(): Promise<PublishResult> {
  try {
    const session = await getServerAuthSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    if (session.role !== 'admin') {
      return { success: false, error: 'Forbidden: Admin role required' };
    }

    const configRef = adminDb.collection('socialConfig').doc('facebook');
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      return { success: false, error: 'Brak konfiguracji Facebooka. Najpierw zapisz konfigurację.' };
    }

    const config = configSnap.data() as SocialConfig;

    if (!config.enabled) {
      return { success: false, error: 'Facebook jest wyłączony w konfiguracji.' };
    }

    if (!config.credentials?.accessToken) {
      return { success: false, error: 'Brak tokena dostępu Facebook.' };
    }

    if (!config.credentials?.pageId) {
      return { success: false, error: 'Brak Page ID Facebook. Uzupełnij „ID strony”.' };
    }

    const now = new Date();
    const timestamp = now.toLocaleString('pl-PL');

    const postPayload: Omit<SocialPost, 'id'> = {
      platform: 'facebook',
      status: 'approved',
      type: 'deal',
      itemId: `facebook-test-${now.getTime()}`,
      itemData: {
        title: `Test publikacji Facebook (${timestamp})`,
        description: 'Testowy post systemowy z panelu administratora Okazje Plus',
        url: 'https://okazjeplus.pl',
      },
      content: {
        text: `🧪 Test publikacji z panelu admina Okazje Plus\n\nJeśli widzisz ten post, integracja Facebook działa poprawnie.\n\nCzas testu: ${timestamp}`,
        linkUrl: 'https://okazjeplus.pl',
        hashtags: ['#okazjeplus', '#test', '#facebookapi'],
      },
      attempts: 0,
      metadata: {
        createdBy: session.uid,
        manuallyApproved: true,
        approvedBy: session.uid,
        approvedAt: now.toISOString(),
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const postRef = await adminDb.collection('socialPosts').add(postPayload);
    await addSocialLog(postRef.id, 'facebook', 'created', 'approved', 'Utworzono testowy post Facebook', session.uid);

    const post: SocialPost = { id: postRef.id, ...postPayload };
    const publishResult = await publishToSocialPlatform(post, config);

    if (!publishResult.success || !publishResult.platformPostId) {
      const errorMsg = typeof publishResult.error === 'string'
        ? publishResult.error
        : publishResult.error?.message || 'Nieznany błąd publikacji';

      await postRef.update({
        status: 'failed',
        attempts: 1,
        lastAttemptAt: new Date().toISOString(),
        error: {
          code: 'FACEBOOK_TEST_PUBLISH_ERROR',
          message: errorMsg,
        },
        updatedAt: new Date().toISOString(),
      });

      await addSocialLog(
        postRef.id,
        'facebook',
        'failed',
        'failed',
        'Nie udało się opublikować testowego posta Facebook',
        session.uid,
        errorMsg
      );

      return {
        success: false,
        postId: postRef.id,
        error: errorMsg,
      };
    }

    await postRef.update({
      status: 'posted',
      platformPostId: publishResult.platformPostId,
      platformUrl: publishResult.platformUrl || null,
      postedAt: new Date().toISOString(),
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await addSocialLog(
      postRef.id,
      'facebook',
      'posted',
      'posted',
      `Opublikowano testowy post Facebook: ${publishResult.platformPostId}`,
      session.uid
    );

    return {
      success: true,
      postId: postRef.id,
      platformPostId: publishResult.platformPostId,
      platformUrl: publishResult.platformUrl,
    };
  } catch (error) {
    console.error('[CreateFacebookTestPost] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update an existing social post before publishing
 */
export async function updateSocialPostAction(
  postId: string,
  data: {
    title?: string;
    text?: string;
    linkUrl?: string;
    imageUrl?: string;
    hashtags?: string[];
    scheduledFor?: string | null;
    status?: SocialPost['status'];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return { success: false, error: 'Nie znaleziono posta' };
    }

    const currentPost = postSnap.data() as SocialPost;
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updatedAt: now,
    };

    if (data.text !== undefined) {
      updatePayload['content.text'] = data.text;
    }
    if (data.linkUrl !== undefined) {
      updatePayload['content.linkUrl'] = data.linkUrl;
      updatePayload['itemData.url'] = data.linkUrl;
    }
    if (data.imageUrl !== undefined) {
      updatePayload['content.imageUrl'] = data.imageUrl;
      updatePayload['itemData.image'] = data.imageUrl;
    }
    if (data.hashtags !== undefined) {
      updatePayload['content.hashtags'] = data.hashtags;
    }
    if (data.title !== undefined) {
      updatePayload['itemData.title'] = data.title;
    }
    if (data.scheduledFor !== undefined) {
      updatePayload.scheduledFor = data.scheduledFor;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }

    await postRef.update(updatePayload);

    await addSocialLog(
      postId,
      currentPost.platform,
      'approved',
      data.status || currentPost.status,
      'Post zaktualizowany przez administratora',
      session.uid
    );

    return { success: true };
  } catch (error) {
    console.error('[UpdateSocialPost] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Błąd podczas aktualizacji posta',
    };
  }
}

/**
 * Delete a post completely from the queue
 */
export async function deleteSocialPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (postSnap.exists) {
      const postData = postSnap.data() as SocialPost;
      await postRef.delete();
      await addSocialLog(
        postId,
        postData.platform,
        'cancelled',
        'cancelled',
        'Post trwale usunięty z kolejki przez administratora',
        session.uid
      );
    }

    return { success: true };
  } catch (error) {
    console.error('[DeleteSocialPost] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Błąd podczas usuwania posta',
    };
  }
}

/**
 * Save a post's content and structure as a reusable template
 */
export async function savePostAsTemplateAction(
  postId: string,
  name: string,
  contentTemplate?: string,
  hashtagsTemplate?: string
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return { success: false, error: 'Nie znaleziono posta źródłowego' };
    }

    const postData = postSnap.data() as SocialPost;
    const now = new Date().toISOString();

    const templatePayload = {
      name: name.trim(),
      platform: postData.platform || 'facebook',
      type: postData.type || 'deal',
      contentTemplate: contentTemplate || postData.content?.text || '',
      hashtagsTemplate: hashtagsTemplate !== undefined
        ? hashtagsTemplate
        : (Array.isArray(postData.content?.hashtags) ? postData.content.hashtags.join(' ') : ''),
      imageStyle: 'clean',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      metadata: {
        createdFromPostId: postId,
        createdBy: session.uid,
      },
    };

    const templateRef = await adminDb.collection('socialTemplates').add(templatePayload);

    return { success: true, templateId: templateRef.id };
  } catch (error) {
    console.error('[SavePostAsTemplate] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Błąd podczas zapisywania wzorca',
    };
  }
}

/**
 * Seed curated high-converting templates for Okazje Plus
 */
export async function seedCuratedTemplatesAction(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, count: 0, error: 'Wymagane uprawnienia administratora' };
    }

    const curatedTemplates = [
      {
        name: '🔥 Hit Dnia z Komentarzem (Okazja)',
        platform: 'facebook',
        type: 'deal',
        contentTemplate: 
          '🔥 GORĄCA OKAZJA: {title}!\n\n' +
          '💰 Cena: {price} {oldPrice} {discount}\n' +
          '🌡️ Ocena społeczności: {temperature}°\n\n' +
          'Łowcy Okazje Plus zweryfikowali tę ofertę – cena jest warta uwagi!\n\n' +
          '👉 Bezpośredni link i kod rabatowy znajdziesz w pierwszym komentarzu ⬇️ oraz tutaj:\n{url}\n\n' +
          '#okazje #promocje #okazjeplus #znizki #zakupy',
        hashtagsTemplate: '#okazje #promocje #okazjeplus #znizki #zakupy',
        imageStyle: 'clean',
        enabled: true,
      },
      {
        name: '💬 Pytanie Społecznościowe (Wzrost Zasięgów)',
        platform: 'facebook',
        type: 'article',
        contentTemplate:
          '👋 Cześć Łowcy Okazji!\n\n' +
          'Mamy pytanie do naszej społeczności:\n' +
          '💬 Jaki jest Wasz najlepszy zakup tego miesiąca? Co udało Wam się upolować w rekordowo niskiej cenie?\n\n' +
          'Pochwalcie się w komentarzu linkiem lub zdjęciem! Najciekawsze perełki wyróżnimy na stronie głównej 🏆\n\n' +
          'Codzienne sprawdzone okazje:\nhttps://okazjeplus.pl\n\n' +
          '#spolecznosc #lowcyokazji #okazjeplus #dyskusja #zakupyonline',
        hashtagsTemplate: '#spolecznosc #lowcyokazji #okazjeplus #dyskusja',
        imageStyle: 'clean',
        enabled: true,
      },
      {
        name: '🛡️ Poradnik Eksperta (Dyrektywa Omnibus i Jakość)',
        platform: 'facebook',
        type: 'article',
        contentTemplate:
          '🛡️ PORADNIK EKSPERTA OKAZJE PLUS: Jak nie dać się nabrać na „fałszywe promocje”?\n\n' +
          'Czy wiesz, że ponad 30% promocji w sieci to tylko sztucznie zawyżone ceny wyjściowe?\n' +
          'W redakcji Okazje Plus każda rekomendacja przechodzi rygorystyczny test:\n' +
          '✅ Analiza 90-dniowej historii cen (Omnibus + autorskie boty)\n' +
          '✅ Weryfikacja wiarygodności i opinii o sprzedawcy\n' +
          '✅ Ocena realnej relacji jakości do ceny\n\n' +
          'Kupuj mądrze ze sprawdzoną społecznością:\nhttps://okazjeplus.pl\n\n' +
          '#testy #jakosc #ekspert #okazjeplus #swiadomykonsument #poradnik',
        hashtagsTemplate: '#testy #jakosc #ekspert #okazjeplus #swiadomykonsument',
        imageStyle: 'clean',
        enabled: true,
      },
      {
        name: '⚡ Błyskawiczny Flash Deal (Limitowany Czas)',
        platform: 'facebook',
        type: 'deal',
        contentTemplate:
          '⚡ BŁYSKAWICZNA OKAZJA: {title}!\n' +
          '⏳ Uwaga: oferta może wygasnąć w każdej chwili lub zapas ulegnie wyczerpaniu!\n\n' +
          '📉 Tylko teraz: {price} (zamiast {oldPrice}) {discount}\n' +
          '🛒 Sklep: {merchant}\n\n' +
          '👉 Łap okazję zanim zniknie – bezpośredni link czeka w 1. komentarzu ⬇️ oraz tutaj:\n{url}\n\n' +
          '#flashdeal #okazja #okazjeplus #promocja #szybkazmiana',
        hashtagsTemplate: '#flashdeal #okazja #okazjeplus #promocja',
        imageStyle: 'bold',
        enabled: true,
      }
    ];

    const now = new Date().toISOString();
    let count = 0;

    for (const t of curatedTemplates) {
      await adminDb.collection('socialTemplates').add({
        ...t,
        createdAt: now,
        updatedAt: now,
        metadata: {
          curated: true,
          createdBy: session.uid,
        },
      });
      count++;
    }

    return { success: true, count };
  } catch (error) {
    console.error('[SeedCuratedTemplates] Error:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Błąd podczas wgrywania wzorców',
    };
  }
}

