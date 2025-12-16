import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc,
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  SocialConfig, 
  SocialPost, 
  SocialPostLog, 
  SocialTemplate, 
  SocialPlatform,
  SocialPostStatus 
} from '@/lib/types';

// ============================================================================
// SOCIAL CONFIG - Platform credentials and settings
// ============================================================================

/**
 * Get configuration for a specific platform
 */
export async function getSocialConfig(platform: SocialPlatform): Promise<SocialConfig | null> {
  const docRef = doc(db, 'socialConfig', platform);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as SocialConfig;
}

/**
 * Get all platform configurations
 */
export async function getAllSocialConfigs(): Promise<SocialConfig[]> {
  const querySnapshot = await getDocs(collection(db, 'socialConfig'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SocialConfig));
}

/**
 * Save or update platform configuration
 */
export async function saveSocialConfig(config: Partial<SocialConfig> & { platform: SocialPlatform }): Promise<void> {
  const docRef = doc(db, 'socialConfig', config.platform);
  const now = new Date().toISOString();
  
  const existing = await getDoc(docRef);
  
  const data = {
    ...config,
    updatedAt: now,
    ...(existing.exists() ? {} : { createdAt: now })
  };
  
  await setDoc(docRef, data, { merge: true });
}

/**
 * Delete platform configuration
 */
export async function deleteSocialConfig(platform: SocialPlatform): Promise<void> {
  await deleteDoc(doc(db, 'socialConfig', platform));
}

// ============================================================================
// SOCIAL TEMPLATES - Post templates with placeholders
// ============================================================================

/**
 * Get all templates for a platform
 */
export async function getSocialTemplates(platform?: SocialPlatform): Promise<SocialTemplate[]> {
  const templatesRef = collection(db, 'socialTemplates');
  const q = platform 
    ? query(templatesRef, where('platform', '==', platform), where('enabled', '==', true))
    : query(templatesRef);
    
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SocialTemplate));
}

/**
 * Create or update a template
 */
export async function saveSocialTemplate(template: Partial<SocialTemplate>): Promise<string> {
  const now = new Date().toISOString();
  
  if (template.id) {
    const docRef = doc(db, 'socialTemplates', template.id);
    await updateDoc(docRef, {
      ...template,
      updatedAt: now
    });
    return template.id;
  } else {
    const docRef = await addDoc(collection(db, 'socialTemplates'), {
      ...template,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }
}

/**
 * Delete a template
 */
export async function deleteSocialTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(db, 'socialTemplates', templateId));
}

// ============================================================================
// SOCIAL POSTS - Queue management
// ============================================================================

/**
 * Create a new social post in queue
 */
export async function createSocialPost(
  platform: SocialPlatform,
  type: 'deal' | 'product',
  itemId: string,
  itemData: SocialPost['itemData'],
  content: SocialPost['content'],
  options?: {
    scheduledFor?: string;
    autoApprove?: boolean;
    createdBy?: string;
  }
): Promise<string> {
  const now = new Date().toISOString();
  
  const post: Omit<SocialPost, 'id'> = {
    platform,
    status: options?.autoApprove ? 'approved' : 'pending',
    type,
    itemId,
    itemData,
    content,
    scheduledFor: options?.scheduledFor,
    attempts: 0,
    metadata: {
      createdBy: options?.createdBy || 'auto',
      ...(options?.autoApprove && {
        manuallyApproved: false
      })
    },
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(collection(db, 'socialPosts'), post);
  
  // Log creation
  await logSocialPostAction(docRef.id, platform, 'created', 'pending', 'Post created', options?.createdBy);
  
  return docRef.id;
}

/**
 * Get posts by status
 */
export async function getSocialPosts(
  status?: SocialPostStatus,
  platform?: SocialPlatform,
  limitCount: number = 50
): Promise<SocialPost[]> {
  const postsRef = collection(db, 'socialPosts');
  
  let q = query(postsRef, orderBy('createdAt', 'desc'), limit(limitCount));
  
  if (status) {
    q = query(postsRef, where('status', '==', status), orderBy('createdAt', 'desc'), limit(limitCount));
  }
  
  if (platform) {
    q = query(postsRef, where('platform', '==', platform), orderBy('createdAt', 'desc'), limit(limitCount));
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SocialPost));
}

/**
 * Get pending posts ready to be posted
 */
export async function getPendingPosts(platform?: SocialPlatform): Promise<SocialPost[]> {
  const postsRef = collection(db, 'socialPosts');
  const now = new Date().toISOString();
  
  let q = query(
    postsRef,
    where('status', 'in', ['approved', 'pending']),
    orderBy('createdAt', 'asc'),
    limit(10)
  );
  
  if (platform) {
    q = query(
      postsRef,
      where('platform', '==', platform),
      where('status', 'in', ['approved', 'pending']),
      orderBy('createdAt', 'asc'),
      limit(10)
    );
  }
  
  const querySnapshot = await getDocs(q);
  const posts = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SocialPost));
  
  // Filter by scheduledFor
  return posts.filter(post => !post.scheduledFor || post.scheduledFor <= now);
}

/**
 * Update post status
 */
export async function updateSocialPostStatus(
  postId: string,
  status: SocialPostStatus,
  updates?: Partial<SocialPost>,
  userId?: string
): Promise<void> {
  const docRef = doc(db, 'socialPosts', postId);
  const now = new Date().toISOString();
  
  const data: any = {
    status,
    updatedAt: now,
    ...updates
  };
  
  if (status === 'posted') {
    data.postedAt = now;
  } else if (status === 'failed') {
    data.attempts = (updates?.attempts || 0) + 1;
    data.lastAttemptAt = now;
  }
  
  await updateDoc(docRef, data);
  
  // Get platform for logging
  const docSnap = await getDoc(docRef);
  const platform = docSnap.data()?.platform;
  
  // Log action
  const actionMap: Record<SocialPostStatus, SocialPostLog['action']> = {
    pending: 'created',
    approved: 'approved',
    posting: 'created',
    posted: 'posted',
    failed: 'failed',
    cancelled: 'cancelled'
  };
  
  await logSocialPostAction(
    postId, 
    platform, 
    actionMap[status], 
    status, 
    `Status changed to ${status}`,
    userId
  );
}

/**
 * Approve a post manually
 */
export async function approveSocialPost(postId: string, userId: string): Promise<void> {
  const docRef = doc(db, 'socialPosts', postId);
  const now = new Date().toISOString();
  
  await updateDoc(docRef, {
    status: 'approved',
    'metadata.manuallyApproved': true,
    'metadata.approvedBy': userId,
    'metadata.approvedAt': now,
    updatedAt: now
  });
  
  const docSnap = await getDoc(docRef);
  const platform = docSnap.data()?.platform;
  
  await logSocialPostAction(postId, platform, 'approved', 'approved', 'Manually approved by admin', userId);
}

/**
 * Cancel a post
 */
export async function cancelSocialPost(postId: string, userId?: string): Promise<void> {
  await updateSocialPostStatus(postId, 'cancelled', {}, userId);
}

/**
 * Delete a post
 */
export async function deleteSocialPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'socialPosts', postId));
}

/**
 * Retry a failed post
 */
export async function retrySocialPost(postId: string, userId?: string): Promise<void> {
  const docRef = doc(db, 'socialPosts', postId);
  await updateDoc(docRef, {
    status: 'approved',
    error: null,
    updatedAt: new Date().toISOString()
  });
  
  const docSnap = await getDoc(docRef);
  const platform = docSnap.data()?.platform;
  
  await logSocialPostAction(postId, platform, 'retried', 'approved', 'Post retry requested', userId);
}

// ============================================================================
// SOCIAL POST LOGS
// ============================================================================

/**
 * Log an action on a social post
 */
export async function logSocialPostAction(
  postId: string,
  platform: SocialPlatform,
  action: SocialPostLog['action'],
  status: SocialPostStatus,
  message: string,
  userId?: string,
  error?: any
): Promise<void> {
  const log: Omit<SocialPostLog, 'id'> = {
    postId,
    platform,
    action,
    status,
    message,
    error,
    userId,
    timestamp: new Date().toISOString()
  };
  
  await addDoc(collection(db, 'socialPostLogs'), log);
}

/**
 * Get logs for a post
 */
export async function getSocialPostLogs(postId: string): Promise<SocialPostLog[]> {
  const logsRef = collection(db, 'socialPostLogs');
  const q = query(logsRef, where('postId', '==', postId), orderBy('timestamp', 'desc'));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SocialPostLog));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate post content from template (simple placeholder replacement)
 */
export function generatePostContent(
  template: string,
  data: {
    title: string;
    description?: string;
    price?: number;
    url: string;
    merchant?: string;
    temperature?: number;
    category?: string;
  }
): string {
  let content = template;
  
  const replacements: Record<string, string> = {
    '{title}': data.title || '',
    '{description}': data.description || '',
    '{price}': data.price ? `${data.price} zł` : '',
    '{url}': data.url || '',
    '{merchant}': data.merchant || '',
    '{temperature}': data.temperature ? `${Math.round(data.temperature)}°` : '',
    '{category}': data.category || ''
  };
  
  Object.entries(replacements).forEach(([placeholder, value]) => {
    content = content.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return content.trim();
}

/**
 * Generate AI-powered post content with optimized images
 */
export async function generateAIPostContent(
  platform: SocialPlatform,
  type: 'deal' | 'product' | 'article',
  itemData: any,
  template?: SocialTemplate
): Promise<{ content: string; imageUrl?: string; hashtags?: string[] }> {
  try {
    // Use Genkit AI flow to generate content
    const { generateSocialContent } = await import('../ai/flows/social-content/generateSocialPost');
    
    const aiContent = await generateSocialContent(platform, type, itemData, {
      style: template?.imageStyle || 'casual',
      includeEmojis: true,
      includePrice: !!itemData.price,
      includeHashtags: true,
    });

    // Generate optimized image if source image exists
    let finalImageUrl = itemData.imageUrl;
    if (itemData.imageUrl) {
      try {
        const { generateSocialImage } = await import('./image-generator');
        const imageResult = await generateSocialImage({
          platform,
          sourceImageUrl: itemData.imageUrl,
          overlayData: {
            title: itemData.title,
            price: itemData.price,
            originalPrice: itemData.originalPrice,
            discount: itemData.discount,
            temperature: itemData.temperature,
            merchant: itemData.merchant,
            badge: itemData.temperature && itemData.temperature > 500 ? '🔥 HOT DEAL' : undefined,
          },
          style: template?.imageStyle || 'clean',
        });
        finalImageUrl = imageResult.url;
      } catch (imageError) {
        console.error('Failed to generate social image, using original:', imageError);
      }
    }

    // Build final content with title, description, hashtags
    let content = aiContent.title;
    
    // Add emojis if suggested
    if (aiContent.emojiSuggestions && aiContent.emojiSuggestions.length > 0) {
      content = `${aiContent.emojiSuggestions[0]} ${content}`;
    }
    
    content += `\n\n${aiContent.description}`;
    
    // Add CTA
    if (aiContent.callToAction) {
      content += `\n\n${aiContent.callToAction}`;
    }
    
    // Add hashtags at the end
    if (aiContent.hashtags && aiContent.hashtags.length > 0) {
      content += `\n\n${aiContent.hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}`;
    }

    return {
      content,
      imageUrl: finalImageUrl,
      hashtags: aiContent.hashtags,
    };
  } catch (error) {
    console.error('AI content generation failed, using fallback:', error);
    
    // Fallback: basic template
    const { title, description, price, imageUrl } = itemData;
    
    let content = `🔥 ${title}\n\n`;
    if (description) {
      content += `${description.slice(0, 200)}...\n\n`;
    }
    if (price) {
      content += `💰 Cena: ${price} zł\n\n`;
    }
    content += `#okazje #promocje #zakupy`;
    
    return {
      content,
      imageUrl,
    };
  }
}

/**
 * Build UTM tracking URL
 */
export function buildTrackingUrl(
  baseUrl: string,
  platform: SocialPlatform,
  itemId: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'auto_post');
  url.searchParams.set('utm_content', itemId);
  return url.toString();
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: SocialPlatform): string {
  const names: Record<SocialPlatform, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok'
  };
  return names[platform];
}

/**
 * Get platform icon/color
 */
export function getPlatformIcon(platform: SocialPlatform): string {
  const icons: Record<SocialPlatform, string> = {
    facebook: '📘',
    instagram: '📷',
    twitter: '🐦',
    linkedin: '💼',
    tiktok: '🎵'
  };
  return icons[platform];
}

/**
 * Check if platform is configured and enabled
 */
export async function isPlatformReady(platform: SocialPlatform): Promise<boolean> {
  const config = await getSocialConfig(platform);
  return !!(config?.enabled && config?.credentials?.accessToken);
}

/**
 * Get post statistics
 */
export async function getSocialPostStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  posted: number;
  failed: number;
  byPlatform: Record<SocialPlatform, number>;
}> {
  const posts = await getSocialPosts(undefined, undefined, 1000);
  
  const stats = {
    total: posts.length,
    pending: posts.filter(p => p.status === 'pending').length,
    approved: posts.filter(p => p.status === 'approved').length,
    posted: posts.filter(p => p.status === 'posted').length,
    failed: posts.filter(p => p.status === 'failed').length,
    byPlatform: {} as Record<SocialPlatform, number>
  };
  
  posts.forEach(post => {
    stats.byPlatform[post.platform] = (stats.byPlatform[post.platform] || 0) + 1;
  });
  
  return stats;
}

/**
 * Get optimal posting time for a platform based on historical data
 * Returns ISO timestamp for next optimal posting time
 */
export function getOptimalPostingTime(platform: SocialPlatform): Date {
  // Best times based on social media research (Warsaw timezone GMT+1)
  const optimalHours: Record<SocialPlatform, number[]> = {
    facebook: [12, 13, 18, 19], // Lunch and evening
    instagram: [11, 13, 17, 19], // Before lunch, after work
    twitter: [9, 12, 17, 18], // Morning, lunch, commute home
    linkedin: [8, 12, 17], // Business hours
    tiktok: [18, 19, 20, 21], // Evening entertainment hours
  };

  const now = new Date();
  const hours = optimalHours[platform];
  
  // Find next optimal hour
  const currentHour = now.getHours();
  let nextHour = hours.find(h => h > currentHour);
  
  // If no hour found today, use first hour tomorrow
  if (!nextHour) {
    nextHour = hours[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(nextHour, 0, 0, 0);
    return tomorrow;
  }
  
  // Set to next optimal hour today
  const nextTime = new Date(now);
  nextTime.setHours(nextHour, 0, 0, 0);
  return nextTime;
}

/**
 * Bulk create social posts from multiple deals/products
 */
export async function bulkCreatePosts(
  items: Array<{
    id: string;
    type: 'deal' | 'product';
    data: any;
  }>,
  platforms: SocialPlatform[],
  options?: {
    useAI?: boolean;
    autoApprove?: boolean;
    scheduleOptimal?: boolean;
    createdBy?: string;
  }
): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ id: string; error: string }>,
  };

  for (const item of items) {
    for (const platform of platforms) {
      try {
        // Generate content (AI or template-based)
        let content: string;
        let imageUrl: string | undefined;
        let metadata: any = {};

        if (options?.useAI) {
          const aiResult = await generateAIPostContent(
            platform,
            item.type,
            item.data
          );
          content = aiResult.content;
          imageUrl = aiResult.imageUrl;
          metadata.hashtags = aiResult.hashtags;
        } else {
          // Simple template
          content = `🔥 ${item.data.title}\n\n`;
          if (item.data.description) {
            content += `${item.data.description.slice(0, 150)}...\n\n`;
          }
          if (item.data.price) {
            content += `💰 ${item.data.price} zł\n\n`;
          }
          content += `#okazje #promocje`;
          imageUrl = item.data.imageUrl;
        }

        // Schedule for optimal time if requested
        let scheduledFor: string | undefined;
        if (options?.scheduleOptimal) {
          scheduledFor = getOptimalPostingTime(platform).toISOString();
        }

        // Create post
        const postId = await createSocialPost(
          platform,
          item.type,
          item.id,
          item.data,
          content,
          {
            imageUrl,
            scheduledFor,
            metadata,
            createdBy: options?.createdBy,
          }
        );

        // Auto-approve if requested
        if (options?.autoApprove && options?.createdBy) {
          await approveSocialPost(postId, options.createdBy);
        }

        results.success.push(`${platform}-${item.id}`);
      } catch (error: any) {
        console.error(`Failed to create post for ${platform}-${item.id}:`, error);
        results.failed.push({
          id: `${platform}-${item.id}`,
          error: error.message || 'Unknown error',
        });
      }
    }
  }

  return results;
}

/**
 * Auto-queue hot deal to social media
 * Call this after deal is approved
 */
export async function autoQueueHotDeal(
  dealId: string,
  dealData: any,
  threshold: number = 500
): Promise<void> {
  // Only queue if temperature is above threshold
  if (!dealData.temperature || dealData.temperature < threshold) {
    return;
  }

  // Get active platforms
  const configs = await getAllSocialConfigs();
  const activePlatforms = Object.entries(configs)
    .filter(([_, config]) => config.enabled && config.settings?.autoPost)
    .map(([platform]) => platform as SocialPlatform);

  if (activePlatforms.length === 0) {
    console.log('No active platforms with autoPost enabled');
    return;
  }

  // Bulk create posts for all active platforms
  await bulkCreatePosts(
    [{ id: dealId, type: 'deal', data: dealData }],
    activePlatforms,
    {
      useAI: true, // Always use AI for hot deals
      autoApprove: true, // Auto-approve hot deals
      scheduleOptimal: true, // Schedule for best time
      createdBy: 'system',
    }
  );

  console.log(`Auto-queued hot deal ${dealId} to ${activePlatforms.length} platforms`);
}
