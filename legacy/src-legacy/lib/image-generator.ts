/**
 * Social Media Image Generation Service
 * 
 * Creates optimized post images for each social platform.
 * Handles resizing, overlays, and platform-specific formatting.
 */

import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { SocialPlatform } from './types';

// Platform-specific image dimensions
export const PLATFORM_IMAGE_SIZES: Record<SocialPlatform, { width: number; height: number }> = {
  facebook: { width: 1200, height: 630 },
  instagram: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 },
  tiktok: { width: 1080, height: 1920 }, // Vertical
};

export interface ImageGenerationOptions {
  platform: SocialPlatform;
  sourceImageUrl: string;
  overlayData?: {
    title?: string;
    price?: number;
    originalPrice?: number;
    discount?: number;
    temperature?: number;
    merchant?: string;
    badge?: string; // e.g., "HOT DEAL", "NOWOŚĆ", "LIMITOWANA"
  };
  style?: 'minimal' | 'bold' | 'gradient' | 'clean';
  brandLogo?: string; // Optional Okazje+ logo overlay
}

/**
 * Generate optimized social media image
 */
export async function generateSocialImage(
  options: ImageGenerationOptions
): Promise<{ url: string; path: string }> {
  const { platform, sourceImageUrl, overlayData, style = 'clean', brandLogo } = options;
  const dimensions = PLATFORM_IMAGE_SIZES[platform];

  try {
    // Download source image
    const sourceBuffer = await fetchImageBuffer(sourceImageUrl);

    // Create base image with proper dimensions
    let image = sharp(sourceBuffer)
      .resize(dimensions.width, dimensions.height, {
        fit: 'cover',
        position: 'center',
      });

    // Apply platform-specific processing
    if (overlayData) {
      image = await applyOverlay(image, overlayData, dimensions, style);
    }

    // Convert to appropriate format
    const processedBuffer = await image
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    // Upload to Firebase Storage
    const timestamp = Date.now();
    const filename = `social-media-images/${platform}/${timestamp}-${Math.random().toString(36).slice(2)}.jpg`;
    const bucket = getStorage().bucket();
    const file = bucket.file(filename);

    await file.save(processedBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          platform,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return {
      url: publicUrl,
      path: filename,
    };
  } catch (error) {
    console.error('Error generating social image:', error);
    // Fallback: return original image (resize only)
    return {
      url: sourceImageUrl,
      path: '',
    };
  }
}

/**
 * Apply overlay with deal/product information
 */
async function applyOverlay(
  image: sharp.Sharp,
  data: NonNullable<ImageGenerationOptions['overlayData']>,
  dimensions: { width: number; height: number },
  style: string
): Promise<sharp.Sharp> {
  // Create SVG overlay
  const svg = generateOverlaySVG(data, dimensions, style);
  const svgBuffer = Buffer.from(svg);

  // Composite overlay on image
  return image.composite([
    {
      input: svgBuffer,
      top: 0,
      left: 0,
    },
  ]);
}

/**
 * Generate SVG overlay with text and badges
 */
function generateOverlaySVG(
  data: NonNullable<ImageGenerationOptions['overlayData']>,
  dimensions: { width: number; height: number },
  style: string
): string {
  const { width, height } = dimensions;
  const { price, originalPrice, discount, temperature, badge, merchant } = data;

  // Color scheme based on style
  const colorSchemes = {
    minimal: { bg: 'rgba(255,255,255,0.95)', text: '#000000', accent: '#FF6B6B' },
    bold: { bg: 'rgba(0,0,0,0.85)', text: '#FFFFFF', accent: '#FFD700' },
    gradient: { bg: 'linear-gradient(135deg, rgba(255,107,107,0.9), rgba(255,193,7,0.9))', text: '#FFFFFF', accent: '#FFFFFF' },
    clean: { bg: 'rgba(255,255,255,0.92)', text: '#1a1a1a', accent: '#FF6B6B' },
  };

  const colors = colorSchemes[style as keyof typeof colorSchemes] || colorSchemes.clean;

  // Calculate positions
  const padding = 30;
  const badgeHeight = 60;
  const priceHeight = 80;
  const bottomBarY = height - priceHeight - padding;

  let svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&amp;display=swap');
          .price-text { font-family: 'Inter', sans-serif; font-weight: 900; }
          .badge-text { font-family: 'Inter', sans-serif; font-weight: 700; }
        </style>
      </defs>
  `;

  // Top badge (HOT DEAL, temperature, etc.)
  if (badge || temperature) {
    const badgeText = badge || (temperature && temperature > 500 ? '🔥 HOT DEAL' : '');
    if (badgeText) {
      svgContent += `
        <rect x="${padding}" y="${padding}" width="${badgeText.length * 20 + 40}" height="${badgeHeight}" 
          fill="${colors.accent}" rx="8" />
        <text x="${padding + 20}" y="${padding + 40}" 
          class="badge-text" font-size="28" fill="white">${badgeText}</text>
      `;
    }
  }

  // Bottom bar with price
  if (price || originalPrice) {
    const barWidth = width - padding * 2;
    svgContent += `
      <rect x="${padding}" y="${bottomBarY}" width="${barWidth}" height="${priceHeight}" 
        fill="${colors.bg}" rx="12" opacity="0.95" />
    `;

    // Price display
    let priceX = padding + 20;
    if (originalPrice && discount) {
      // Show both original and discounted price
      svgContent += `
        <text x="${priceX}" y="${bottomBarY + 35}" 
          class="price-text" font-size="24" fill="${colors.text}" opacity="0.6" 
          text-decoration="line-through">${originalPrice} zł</text>
        <text x="${priceX}" y="${bottomBarY + 65}" 
          class="price-text" font-size="40" fill="${colors.accent}">${price} zł</text>
        <text x="${priceX + 150}" y="${bottomBarY + 65}" 
          class="badge-text" font-size="32" fill="${colors.accent}">-${discount}%</text>
      `;
    } else if (price) {
      // Show only price
      svgContent += `
        <text x="${priceX}" y="${bottomBarY + 50}" 
          class="price-text" font-size="48" fill="${colors.accent}">${price} zł</text>
      `;
    }

    // Merchant logo/name (right side)
    if (merchant) {
      const merchantX = width - padding - 200;
      svgContent += `
        <text x="${merchantX}" y="${bottomBarY + 50}" 
          class="badge-text" font-size="20" fill="${colors.text}" opacity="0.7" 
          text-anchor="end">${merchant}</text>
      `;
    }
  }

  svgContent += '</svg>';
  return svgContent;
}

/**
 * Fetch image from URL and return buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate image with Vertex AI Imagen (optional, requires additional setup)
 * For when source image is not available
 */
export async function generateAIImage(
  prompt: string,
  platform: SocialPlatform
): Promise<{ url: string; path: string }> {
  // TODO: Implement Vertex AI Imagen integration
  // This would require:
  // 1. Enable Vertex AI Imagen API
  // 2. Install @google-cloud/aiplatform
  // 3. Call generateImages endpoint with prompt
  // 4. Upload generated image to Firebase Storage
  
  console.log('AI image generation not yet implemented. Prompt:', prompt);
  throw new Error('AI image generation not implemented. Use generateSocialImage with sourceImageUrl instead.');
}

/**
 * Optimize existing image for social media
 */
export async function optimizeImageForPlatform(
  sourceUrl: string,
  platform: SocialPlatform
): Promise<{ url: string; path: string }> {
  return generateSocialImage({
    platform,
    sourceImageUrl: sourceUrl,
    style: 'clean',
  });
}

/**
 * Batch generate images for all platforms
 */
export async function generateImagesForAllPlatforms(
  sourceImageUrl: string,
  overlayData?: ImageGenerationOptions['overlayData']
): Promise<Record<SocialPlatform, { url: string; path: string }>> {
  const platforms: SocialPlatform[] = ['facebook', 'instagram', 'twitter', 'linkedin'];
  const results: Partial<Record<SocialPlatform, { url: string; path: string }>> = {};

  await Promise.all(
    platforms.map(async (platform) => {
      try {
        results[platform] = await generateSocialImage({
          platform,
          sourceImageUrl,
          overlayData,
          style: 'clean',
        });
      } catch (error) {
        console.error(`Failed to generate image for ${platform}:`, error);
        results[platform] = { url: sourceImageUrl, path: '' };
      }
    })
  );

  return results as Record<SocialPlatform, { url: string; path: string }>;
}
