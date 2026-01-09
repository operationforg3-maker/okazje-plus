/**
 * Server Action: Manual Publishing to Social Platforms
 * Integrates with backend API for controlled post publishing
 */

'use server';

import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { publishToSocialPlatform } from '@/lib/platform-publishers';
import { logSocialPostAction } from '@/lib/social-automation';
import type { SocialPost, SocialConfig } from '@/lib/types';
import { getServerAuthSession } from '@/lib/auth-server';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string | { code: string; message: string };
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
    const postRef = doc(db, 'socialPosts', postId);
    const postSnap = await getDoc(postRef);

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
    const configRef = doc(db, 'socialConfig', post.platform);
    const configSnap = await getDoc(configRef);

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
      await updateDoc(postRef, {
        status: 'posted',
        platformPostId: result.platformPostId,
        platformUrl: result.platformUrl || null,
        postedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Log action
      await logSocialPostAction(
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
      await logSocialPostAction(
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
    const postRef = doc(db, 'socialPosts', postId);
    const postSnap = await getDoc(postRef);

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
    const configRef = doc(db, 'socialConfig', post.platform);
    const configSnap = await getDoc(configRef);

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
    await updateDoc(postRef, {
      analytics,
      analyticsLastFetchedAt: serverTimestamp(),
    });

    // Log action (use 'posted' since analytics_fetched is not a valid action)
    await logSocialPostAction(
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

    const postRef = doc(db, 'socialPosts', postId);
    const postSnap = await getDoc(postRef);

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
    await updateDoc(postRef, {
      scheduledFor: scheduledFor,
      updatedAt: serverTimestamp(),
    });

    // Log action (use 'approved' since scheduled is not a valid action)
    await logSocialPostAction(
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

    const postRef = doc(db, 'socialPosts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      return { success: false, error: 'Post not found' };
    }

    const post = postSnap.data() as SocialPost;

    await updateDoc(postRef, {
      scheduledFor: null,
      updatedAt: serverTimestamp(),
    });

    await logSocialPostAction(
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
