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

    if (!postSnap.exists()) {
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

    if (!configSnap.exists()) {
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

    if (!postSnap.exists()) {
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

    if (!configSnap.exists()) {
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

    if (!postSnap.exists()) {
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
    
    if (!postSnap.exists()) {
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
