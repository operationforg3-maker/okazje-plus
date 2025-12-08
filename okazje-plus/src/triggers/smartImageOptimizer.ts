/**
 * Firebase Cloud Function: Smart Image Optimizer
 * 
 * Trigger: onFinalize for /deals Storage bucket
 * 
 * Workflow:
 * 1. Detect if original image or already processed
 * 2. Convert to WebP (max 1200px width)
 * 3. Generate Polish ALT text using Gemini Vision
 * 4. Save WebP to Storage
 * 5. Update deal document with imageAlt field
 * 6. Delete original if not needed
 */

import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { convertToWebP, generateAltText, isWebP } from '../../../src/lib/image-optimizer';

const storage = getStorage();
const db = getFirestore();
const targetBucket = process.env.STORAGE_BUCKET;
const bucketConfigured = !!(targetBucket && !targetBucket.includes('{'));

/**
 * Extract deal ID from file path
 * Expected path: deals/{dealId}/{filename}
 */
function extractDealId(filePath: string): string | null {
  const match = filePath.match(/^deals\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Firebase Function: Optimize images on upload to Storage
 */
export const smartImageOptimizer = bucketConfigured
  ? onObjectFinalized(
      {
        bucket: targetBucket,
        region: 'europe-west1',
      },
      async (file: any) => {
        const filePath = file.name;
        const bucket = file.bucket;

        logger.info(`[ImageOptimizer] Processing: ${filePath}`);

        try {
          // Only process deals folder
          if (!filePath.startsWith('deals/')) {
            logger.info(`[ImageOptimizer] Skipping non-deal file: ${filePath}`);
            return;
          }

          // Skip if already WebP (loop prevention)
          if (isWebP(filePath)) {
            logger.info(`[ImageOptimizer] Skipping already-optimized WebP: ${filePath}`);
            return;
          }

          // Skip if file too small (likely thumbnail/metadata)
          if (file.size && file.size < 1000) {
            logger.info(`[ImageOptimizer] Skipping too-small file: ${filePath}`);
            return;
          }

          // Extract deal ID
          const dealId = extractDealId(filePath);
          if (!dealId) {
            logger.warn(`[ImageOptimizer] Could not extract deal ID from: ${filePath}`);
            return;
          }

          // Get the file from Storage
          const storageBucket = storage.bucket(bucket);
          const sourceFile = storageBucket.file(filePath);
          const [buffer] = await sourceFile.download();

          logger.info(`[ImageOptimizer] Downloaded ${filePath} (${buffer.length} bytes)`);

          // Convert to WebP
          logger.info(`[ImageOptimizer] Converting to WebP...`);
          const webpBuffer = await convertToWebP(buffer, 1200);

          // Generate ALT text
          logger.info(`[ImageOptimizer] Generating ALT text with Gemini Vision...`);
          const altText = await generateAltText(webpBuffer);

          // Save WebP to Storage (replace extension)
          const webpPath = filePath.replace(/\.[^.]+$/, '.webp');
          const destFile = storageBucket.file(webpPath);

          await destFile.save(webpBuffer, {
            contentType: 'image/webp',
            metadata: {
              cacheControl: 'public, max-age=31536000', // 1 year
              metadata: {
                altText: altText,
                processedAt: new Date().toISOString(),
                sourceFile: filePath,
              },
            },
          });

          logger.info(
            `[ImageOptimizer] ✓ Saved WebP: ${webpPath} (${webpBuffer.length} bytes)`
          );

          // Update deal document with ALT text and image reference
          const dealRef = db.collection('deals').doc(dealId);
          await dealRef.update({
            imageAlt: altText,
            imageWebP: webpPath,
            imageOptimizedAt: new Date().toISOString(),
          });

          logger.info(
            `[ImageOptimizer] ✓ Updated deal ${dealId} with ALT text: "${altText}"`
          );

          logger.info(`[ImageOptimizer] ✅ Optimization complete for ${dealId}`);

          return {
            success: true,
            dealId,
            webpPath,
            altText,
          };
        } catch (error: any) {
          logger.error(`[ImageOptimizer] Failed to optimize ${filePath}:`, error);
          // Don't throw - we don't want to fail the upload
          return {
            success: false,
            error: error.message,
          };
        }
      }
    )
  : onRequest(async (_req, res) => {
      logger.warn('smartImageOptimizer disabled: missing STORAGE_BUCKET');
      res.status(200).send('smartImageOptimizer disabled');
    });
