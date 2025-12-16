'use server';

import type { SocialPlatform } from '@/lib/types';

/**
 * Server action wrapper for AI-powered social content generation
 * Prevents Genkit imports from being bundled in client code
 */
export async function generateAIContentAction(
  platform: SocialPlatform,
  type: 'deal' | 'product' | 'article',
  itemData: any,
  options?: {
    style?: 'clean' | 'minimal' | 'bold' | 'gradient';
    includeEmojis?: boolean;
    includePrice?: boolean;
    includeHashtags?: boolean;
  }
): Promise<{ content: string; imageUrl?: string; hashtags?: string[] }> {
  try {
    // Dynamic import to avoid bundling in client
    const { generateSocialContent } = await import('../../ai/flows/social-content/generateSocialPost');
    
    const aiContent = await generateSocialContent(platform, type, itemData, options || {});

    // Generate optimized image if source image exists
    let finalImageUrl = itemData.imageUrl;
    if (itemData.imageUrl) {
      try {
        const { generateSocialImage } = await import('../../lib/image-generator');
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
          style: options?.style || 'clean',
        });
        finalImageUrl = imageResult.url;
      } catch (imageError) {
        console.error('Failed to generate social image, using original:', imageError);
      }
    }

    // Build final content with title, description, hashtags
    let content = (aiContent as any).title;
    
    // Add emojis if suggested
    if ((aiContent as any).emojiSuggestions && (aiContent as any).emojiSuggestions.length > 0) {
      content = `${(aiContent as any).emojiSuggestions[0]} ${content}`;
    }
    
    // Add description
    if ((aiContent as any).description) {
      content += `\n\n${(aiContent as any).description}`;
    }

    // Add hashtags
    const hashtags = (aiContent as any).hashtags || [];
    if (hashtags.length > 0 && options?.includeHashtags !== false) {
      content += `\n\n${hashtags.join(' ')}`;
    }

    // Add CTA if present
    if ((aiContent as any).callToAction) {
      content += `\n\n${(aiContent as any).callToAction}`;
    }

    return {
      content,
      imageUrl: finalImageUrl,
      hashtags,
    };
  } catch (error) {
    console.error('AI content generation failed:', error);
    
    // Fallback to basic template
    const emoji = type === 'deal' ? '🔥' : type === 'product' ? '🛍️' : '📰';
    const action = type === 'deal' ? 'Sprawdź tę okazję' : type === 'product' ? 'Zobacz produkt' : 'Przeczytaj więcej';
    const content = `${emoji} ${itemData.title}\n\n${action}!`;
    
    return {
      content,
      imageUrl: itemData.imageUrl,
      hashtags: ['okazje', 'polska'],
    };
  }
}
