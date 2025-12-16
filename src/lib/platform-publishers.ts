/**
 * Platform Publishers - Server-side integration with social media APIs
 * 
 * Handles actual posting to Facebook, Instagram, Twitter, LinkedIn
 * Each function requires valid platform tokens configured in admin
 */

'use server';

import { SocialPost, SocialConfig } from './types';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Publish to Facebook Page
 * Requires: Page Access Token, Page ID
 */
export async function publishToFacebook(
  post: SocialPost,
  config: SocialConfig
): Promise<PublishResult> {
  try {
    const { accessToken, pageId } = config.credentials;
    
    if (!accessToken || !pageId) {
      throw new Error('Missing Facebook credentials');
    }

    // Facebook Graph API v19.0
    const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    
    const body: any = {
      message: post.content.text,
      link: post.content.linkUrl,
      access_token: accessToken,
    };

    // Add image if present
    if (post.content.imageUrl) {
      body.picture = post.content.imageUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Facebook API error');
    }

    const data = await response.json();
    
    return {
      success: true,
      platformPostId: data.id,
      platformUrl: `https://www.facebook.com/${data.id}`,
    };
  } catch (error: any) {
    console.error('Facebook publish error:', error);
    return {
      success: false,
      error: {
        code: 'FACEBOOK_ERROR',
        message: error.message,
      },
    };
  }
}

/**
 * Publish to Instagram Business Account
 * Requires: Access Token (same as FB), Instagram Business Account ID
 */
export async function publishToInstagram(
  post: SocialPost,
  config: SocialConfig
): Promise<PublishResult> {
  try {
    const { accessToken, pageId: instagramAccountId } = config.credentials;
    
    if (!accessToken || !instagramAccountId) {
      throw new Error('Missing Instagram credentials');
    }

    if (!post.content.imageUrl) {
      throw new Error('Instagram requires an image');
    }

    // Step 1: Create container
    const containerUrl = `https://graph.facebook.com/v19.0/${instagramAccountId}/media`;
    const containerBody = {
      image_url: post.content.imageUrl,
      caption: post.content.text,
      access_token: accessToken,
    };

    const containerResponse = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    });

    if (!containerResponse.ok) {
      const error = await containerResponse.json();
      throw new Error(error.error?.message || 'Instagram container creation failed');
    }

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    // Step 2: Publish container (after short delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const publishUrl = `https://graph.facebook.com/v19.0/${instagramAccountId}/media_publish`;
    const publishBody = {
      creation_id: creationId,
      access_token: accessToken,
    };

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishBody),
    });

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      throw new Error(error.error?.message || 'Instagram publish failed');
    }

    const publishData = await publishResponse.json();
    
    return {
      success: true,
      platformPostId: publishData.id,
      platformUrl: `https://www.instagram.com/p/${publishData.id}`,
    };
  } catch (error: any) {
    console.error('Instagram publish error:', error);
    return {
      success: false,
      error: {
        code: 'INSTAGRAM_ERROR',
        message: error.message,
      },
    };
  }
}

/**
 * Publish to Twitter (X)
 * Requires: Bearer Token or OAuth 2.0 tokens
 */
export async function publishToTwitter(
  post: SocialPost,
  config: SocialConfig
): Promise<PublishResult> {
  try {
    const { accessToken } = config.credentials;
    
    if (!accessToken) {
      throw new Error('Missing Twitter credentials');
    }

    // Twitter API v2
    const url = 'https://api.twitter.com/2/tweets';
    
    const body: any = {
      text: post.content.text,
    };

    // Add media if present (requires separate media upload)
    // Simplified version - in production, upload media first
    if (post.content.imageUrl) {
      // TODO: Implement media upload endpoint
      console.log('Twitter media upload not yet implemented');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Twitter API error');
    }

    const data = await response.json();
    
    return {
      success: true,
      platformPostId: data.data.id,
      platformUrl: `https://twitter.com/i/web/status/${data.data.id}`,
    };
  } catch (error: any) {
    console.error('Twitter publish error:', error);
    return {
      success: false,
      error: {
        code: 'TWITTER_ERROR',
        message: error.message,
      },
    };
  }
}

/**
 * Publish to LinkedIn Organization Page
 * Requires: OAuth 2.0 Access Token, Organization ID
 */
export async function publishToLinkedIn(
  post: SocialPost,
  config: SocialConfig
): Promise<PublishResult> {
  try {
    const { accessToken, organizationId } = config.credentials;
    
    if (!accessToken || !organizationId) {
      throw new Error('Missing LinkedIn credentials');
    }

    // LinkedIn API v2
    const url = 'https://api.linkedin.com/v2/ugcPosts';
    
    const body: any = {
      author: `urn:li:organization:${organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add image if present
    if (post.content.imageUrl) {
      body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      body.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          originalUrl: post.content.imageUrl,
        },
      ];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'LinkedIn API error');
    }

    const data = await response.json();
    const postId = data.id.split(':').pop();
    
    return {
      success: true,
      platformPostId: data.id,
      platformUrl: `https://www.linkedin.com/feed/update/${data.id}`,
    };
  } catch (error: any) {
    console.error('LinkedIn publish error:', error);
    return {
      success: false,
      error: {
        code: 'LINKEDIN_ERROR',
        message: error.message,
      },
    };
  }
}

/**
 * Generic publish function - routes to platform-specific publisher
 */
export async function publishToSocialPlatform(
  post: SocialPost,
  config: SocialConfig
): Promise<PublishResult> {
  switch (post.platform) {
    case 'facebook':
      return publishToFacebook(post, config);
    case 'instagram':
      return publishToInstagram(post, config);
    case 'twitter':
      return publishToTwitter(post, config);
    case 'linkedin':
      return publishToLinkedIn(post, config);
    case 'tiktok':
      return {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'TikTok publishing not yet implemented',
        },
      };
    default:
      return {
        success: false,
        error: {
          code: 'UNKNOWN_PLATFORM',
          message: `Unknown platform: ${post.platform}`,
        },
      };
  }
}

/**
 * Get post analytics from platform
 * Fetch reach, engagement, clicks after post is published
 */
export async function fetchPostAnalytics(
  platformPostId: string,
  platform: string,
  config: SocialConfig
): Promise<{
  reach?: number;
  impressions?: number;
  engagement?: number;
  clicks?: number;
  shares?: number;
  comments?: number;
  likes?: number;
}> {
  try {
    const { accessToken } = config.credentials;

    switch (platform) {
      case 'facebook': {
        // Facebook Insights API
        const url = `https://graph.facebook.com/v19.0/${platformPostId}/insights?metric=post_impressions,post_engaged_users,post_clicks&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        
        return {
          impressions: data.data?.find((m: any) => m.name === 'post_impressions')?.values[0]?.value || 0,
          engagement: data.data?.find((m: any) => m.name === 'post_engaged_users')?.values[0]?.value || 0,
          clicks: data.data?.find((m: any) => m.name === 'post_clicks')?.values[0]?.value || 0,
        };
      }

      case 'instagram': {
        // Instagram Insights API
        const url = `https://graph.facebook.com/v19.0/${platformPostId}/insights?metric=impressions,reach,engagement&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        
        return {
          impressions: data.data?.find((m: any) => m.name === 'impressions')?.values[0]?.value || 0,
          reach: data.data?.find((m: any) => m.name === 'reach')?.values[0]?.value || 0,
          engagement: data.data?.find((m: any) => m.name === 'engagement')?.values[0]?.value || 0,
        };
      }

      case 'twitter': {
        // Twitter Analytics API (requires Elevated access)
        // Simplified - return dummy data for now
        return {
          impressions: 0,
          engagement: 0,
          clicks: 0,
        };
      }

      case 'linkedin': {
        // LinkedIn Analytics API
        const url = `https://api.linkedin.com/v2/socialActions/${platformPostId}/statistics`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        const data = await response.json();
        
        return {
          likes: data.likeCount || 0,
          comments: data.commentCount || 0,
          shares: data.shareCount || 0,
          clicks: data.clickCount || 0,
        };
      }

      default:
        return {};
    }
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return {};
  }
}
