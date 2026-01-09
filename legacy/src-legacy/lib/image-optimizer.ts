/**
 * Image Processing Utils
 * 
 * Convert to WebP + Generate ALT text
 */

import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

/**
 * Convert image to WebP
 */
export async function convertToWebP(
  buffer: Buffer,
  maxWidth: number = 1200
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxWidth, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Generate Polish ALT text using Gemini Vision
 */
export async function generateAltText(
  imageBuffer: Buffer,
  dealTitle?: string
): Promise<string> {
  try {
    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    // Convert buffer to base64
    const base64 = imageBuffer.toString('base64');
    const mimeType = 'image/webp';

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: `Generate a concise Polish ALT text for this product image (max 100 chars). ${
                dealTitle ? `Product: ${dealTitle}` : ''
              } Focus on what's visible in the image for accessibility.`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 150 },
    });

    const altText =
      response.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Zdjęcie produktu';

    return altText
      .trim()
      .substring(0, 100)
      .replace(/[\r\n]/g, ' ');
  } catch (error) {
    console.error('[ImageOptimizer] Failed to generate ALT text:', error);
    return 'Zdjęcie produktu';
  }
}

/**
 * Check if file is WebP
 */
export function isWebP(filename: string): boolean {
  return filename.toLowerCase().endsWith('.webp');
}
