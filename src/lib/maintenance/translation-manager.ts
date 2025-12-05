/**
 * Translation Manager Helper
 * - Add new language to system
 * - Batch translate existing deals/products
 * - Update all docs with new translations
 */

import { logger } from "../logger";
import { db } from "../firebase";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { generateText } from "./vertex";

export type SupportedLocale = "pl" | "en" | "de" | "fr" | "es";

export const SUPPORTED_LOCALES: Record<SupportedLocale, string> = {
  pl: "Polish",
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
};

export interface TranslationResult {
  locale: string;
  totalDocs: number;
  translated: number;
  failed: number;
  duration: number;
}

// ===== Batch translate text =====
async function batchTranslateTexts(
  texts: string[],
  targetLocale: string,
  sourceLocale: string = "en"
): Promise<string[]> {
  const results: string[] = [];

  for (const text of texts) {
    try {
      const prompt = `Translate this text from ${SUPPORTED_LOCALES[sourceLocale as SupportedLocale]} to ${SUPPORTED_LOCALES[targetLocale as SupportedLocale]}.
Maintain all formatting and meaning. Return ONLY the translated text, no explanations.

Original: ${text}`;

      const translated = await generateText(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      results.push(translated.trim());

      // Rate limiting: small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      logger.warn("Translation failed for text segment", { error });
      results.push(text); // Fallback to original
    }
  }

  return results;
}

// ===== Translate deals =====
export async function translateDeals(
  targetLocale: SupportedLocale,
  sourceLocale: SupportedLocale = "en"
): Promise<TranslationResult> {
  const startTime = Date.now();

  try {
    logger.info("Starting batch translation for deals", {
      targetLocale,
      sourceLocale,
    });

    const dealsCollection = collection(db, "deals");
    const q = query(dealsCollection, where("status", "==", "approved"));
    const snapshot = await getDocs(q);

    const deals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ref: doc.ref,
      ...doc.data(),
    }));

    let translated = 0;
    let failed = 0;

    // Batch size for translation API calls
    const batchSize = 5;

    for (let i = 0; i < deals.length; i += batchSize) {
      const batch = deals.slice(i, i + batchSize);

      const updates = await Promise.all(
        batch.map(async (deal) => {
          try {
            const sourceTitle =
              deal.translations?.[sourceLocale]?.title || deal.title || "";
            const sourceDesc =
              deal.translations?.[sourceLocale]?.description ||
              deal.description ||
              "";

            const [translatedTitle, translatedDesc] = await batchTranslateTexts(
              [sourceTitle, sourceDesc],
              targetLocale,
              sourceLocale
            );

            return {
              dealId: deal.id,
              dealRef: deal.ref,
              success: true,
              translations: {
                [targetLocale]: {
                  title: translatedTitle,
                  description: translatedDesc,
                },
              },
            };
          } catch (error) {
            logger.warn("Translation failed for deal", { dealId: deal.id, error });
            return {
              dealId: deal.id,
              dealRef: deal.ref,
              success: false,
            };
          }
        })
      );

      // Apply updates
      for (const update of updates) {
        if (update.success) {
          try {
            const currentTranslations = deals.find(
              (d) => d.id === update.dealId
            )?.translations || {};
            await updateDoc(update.dealRef, {
              translations: {
                ...currentTranslations,
                ...update.translations,
              },
              translatedAt: new Date().toISOString(),
            });
            translated++;
          } catch (error) {
            logger.error("Failed to update deal with translation", {
              dealId: update.dealId,
              error,
            });
            failed++;
          }
        } else {
          failed++;
        }
      }

      // Progress logging
      if (i % (batchSize * 5) === 0) {
        logger.info("Translation progress", {
          processed: i + batch.length,
          total: deals.length,
          translated,
          failed,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info("Batch translation completed", {
      targetLocale,
      translated,
      failed,
      duration,
    });

    return {
      locale: targetLocale,
      totalDocs: deals.length,
      translated,
      failed,
      duration,
    };
  } catch (error) {
    logger.error("Batch translation failed", { targetLocale, error });
    throw error;
  }
}

// ===== Translate products =====
export async function translateProducts(
  targetLocale: SupportedLocale,
  sourceLocale: SupportedLocale = "en"
): Promise<TranslationResult> {
  const startTime = Date.now();

  try {
    logger.info("Starting batch translation for products", {
      targetLocale,
      sourceLocale,
    });

    const productsCollection = collection(db, "products");
    const snapshot = await getDocs(productsCollection);

    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ref: doc.ref,
      ...doc.data(),
    }));

    let translated = 0;
    let failed = 0;

    const batchSize = 5;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const updates = await Promise.all(
        batch.map(async (product) => {
          try {
            const sourceTitle =
              product.translations?.[sourceLocale]?.title || product.title || "";
            const sourceDesc =
              product.translations?.[sourceLocale]?.description ||
              product.description ||
              "";

            const [translatedTitle, translatedDesc] = await batchTranslateTexts(
              [sourceTitle, sourceDesc],
              targetLocale,
              sourceLocale
            );

            return {
              productId: product.id,
              productRef: product.ref,
              success: true,
              translations: {
                [targetLocale]: {
                  title: translatedTitle,
                  description: translatedDesc,
                },
              },
            };
          } catch (error) {
            logger.warn("Translation failed for product", {
              productId: product.id,
              error,
            });
            return {
              productId: product.id,
              productRef: product.ref,
              success: false,
            };
          }
        })
      );

      // Apply updates
      for (const update of updates) {
        if (update.success) {
          try {
            const currentTranslations = products.find(
              (p) => p.id === update.productId
            )?.translations || {};
            await updateDoc(update.productRef, {
              translations: {
                ...currentTranslations,
                ...update.translations,
              },
              translatedAt: new Date().toISOString(),
            });
            translated++;
          } catch (error) {
            logger.error("Failed to update product with translation", {
              productId: update.productId,
              error,
            });
            failed++;
          }
        } else {
          failed++;
        }
      }

      if (i % (batchSize * 5) === 0) {
        logger.info("Translation progress", {
          processed: i + batch.length,
          total: products.length,
          translated,
          failed,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info("Batch translation completed", {
      targetLocale,
      translated,
      failed,
      duration,
    });

    return {
      locale: targetLocale,
      totalDocs: products.length,
      translated,
      failed,
      duration,
    };
  } catch (error) {
    logger.error("Batch translation for products failed", { targetLocale, error });
    throw error;
  }
}

// ===== Verify locale support =====
export function isLocaleSupported(locale: string): locale is SupportedLocale {
  return locale in SUPPORTED_LOCALES;
}

// ===== Get active locales =====
export function getActiveLo cales(): SupportedLocale[] {
  return Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];
}
