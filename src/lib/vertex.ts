/**
 * Vertex AI Helper
 * - Generowanie treści (Gemini 1.5 Flash/Pro)
 * - Embeddingi (text-embedding-004)
 * - Moderacja i safety
 * - Cache dla powtarzalnych promptów
 */

import { VertexAI } from "@google-cloud/vertexai";
import { createHash } from "crypto";
import logger from "./logger";

// ===== Init =====
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.VERTEX_LOCATION || "europe-west1";

if (!project) {
  throw new Error("GOOGLE_CLOUD_PROJECT is not set");
}

const vertex = new VertexAI({ project, location });

// ===== Generowanie treści =====
export async function generateText(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: "gemini-1.5-flash" | "gemini-1.5-pro";
  }
): Promise<string> {
  const model = options?.model || "gemini-1.5-flash";
  const temperature = options?.temperature ?? 0.4;
  const maxTokens = options?.maxTokens ?? 512;

  try {
    const genModel = vertex.preview.getGenerativeModel({ model });
    const response = await genModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH",
        },
      ],
    });

    const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    const finishReason = response.response?.candidates?.[0]?.finishReason;
    const safetyRatings =
      response.response?.candidates?.[0]?.safetyRatings || [];

    // Log dla audytu
    logger.info("Vertex AI text generation", {
      model,
      finishReason,
      safetyRatings,
      tokenLength: text?.length || 0,
    });

    if (!text) {
      throw new Error(`Empty response from ${model}`);
    }

    if (
      finishReason === "SAFETY" ||
      finishReason === "STOP_REASON_UNSPECIFIED"
    ) {
      logger.warn("Text generation stopped due to safety", {
        finishReason,
        safetyRatings,
      });
    }

    return text;
  } catch (error) {
    logger.error("Vertex AI text generation failed", { error, prompt });
    throw error;
  }
}

// ===== Embeddingi =====
export async function embedText(text: string): Promise<number[]> {
  try {
    const embedModel = vertex.preview.getGenerativeModel({
      model: "text-embedding-004",
    });
    const response = await embedModel.embedContent({
      content: { parts: [{ text }] },
    });

    const embedding = response?.embedding?.values || [];

    if (embedding.length === 0) {
      throw new Error("Empty embedding returned");
    }

    // Sprawdzenie długości (oczekiwane ~768)
    if (embedding.length !== 768) {
      logger.warn("Unexpected embedding dimension", {
        dimension: embedding.length,
      });
    }

    return embedding;
  } catch (error) {
    logger.error("Vertex AI embedding failed", { error, textLength: text.length });
    throw error;
  }
}

// ===== Batch embeddings (z cache) =====
const embeddingCache = new Map<string, number[]>();

export async function embedTextBatch(
  texts: string[],
  useCache: boolean = true
): Promise<number[][]> {
  const results: number[][] = [];
  const toEmbed: string[] = [];
  const toEmbedIndices: number[] = [];

  // Check cache
  for (let i = 0; i < texts.length; i++) {
    const hash = hashText(texts[i]);
    if (useCache && embeddingCache.has(hash)) {
      results[i] = embeddingCache.get(hash)!;
    } else {
      toEmbed.push(texts[i]);
      toEmbedIndices.push(i);
    }
  }

  // Embed uncached texts
  for (let i = 0; i < toEmbed.length; i++) {
    const embedding = await embedText(toEmbed[i]);
    const hash = hashText(toEmbed[i]);
    if (useCache) {
      embeddingCache.set(hash, embedding);
    }
    results[toEmbedIndices[i]] = embedding;
  }

  return results;
}

// ===== Helper: Hash tekstu dla cache'u =====
function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// ===== Moderacja (wrapper nad safety settings) =====
export interface TextModerationResult {
  approved: boolean;
  safetyRatings: unknown;
  flags: string[];
  reasoning: string;
}

export async function moderateText(text: string): Promise<TextModerationResult> {
  try {
    const model = vertex.preview.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
      ],
    });

    const finishReason = response.response?.candidates?.[0]?.finishReason;
    const safetyRatings =
      response.response?.candidates?.[0]?.safetyRatings || [];

    const approved = finishReason !== "SAFETY";
    const flags: string[] = [];
    let reasoning = "";

    if (finishReason === "SAFETY") {
      flags.push("blocked_by_safety_policy");
      reasoning = "Content blocked by Vertex AI safety filters";
    }

    logger.info("Text moderation completed", {
      approved,
      finishReason,
      safetyRatings,
      flags,
    });

    return { approved, safetyRatings, flags, reasoning };
  } catch (error) {
    logger.error("Text moderation failed", { error });
    return {
      approved: false,
      safetyRatings: [],
      flags: ["moderation_check_failed"],
      reasoning: "Moderation check failed; defaulting to reject",
    };
  }
}

// ===== Parsowanie JSON z generowanej treści =====
export function parseJsonFromResponse(text: string): Record<string, any> {
  try {
    // Spróbuj parsować JSON bezpośrednio
    return JSON.parse(text);
  } catch {
    // Jeśli nie, szukaj JSON bloku w tekście
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        logger.warn("Failed to parse JSON from markdown block");
        return {};
      }
    }

    // Fallback: zwróć empty object
    logger.warn("Could not extract JSON from response", { text });
    return {};
  }
}

// ===== Clear cache (dla testów/maint) =====
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  logger.info("Embedding cache cleared");
}

export { vertex };
