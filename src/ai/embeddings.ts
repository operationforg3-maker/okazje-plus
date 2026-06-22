import { ai } from './genkit';

const cache = new Map<string, number[]>();

/**
 * Generate a 768-dimensional embedding vector for a given text input.
 * Utilizes the Vertex AI text-embedding-004 model with caching and rate-limiting retry backoff.
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  const normalized = (text || '').trim();
  if (!normalized) {
    return new Array(768).fill(0);
  }

  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  let retries = 5;
  let delay = 2000;

  while (true) {
    try {
      const response = await ai.embed({
        embedder: 'vertexai/text-embedding-004',
        content: normalized,
      });

      const vector = response?.[0]?.embedding;

      if (Array.isArray(vector)) {
        cache.set(normalized, vector);
        return vector;
      }

      throw new Error('Invalid embedding response format from Genkit');
    } catch (error: any) {
      const isRateLimit = 
        error.status === 'RESOURCE_EXHAUSTED' || 
        error.code === 429 || 
        String(error).includes('429') ||
        String(error).includes('quota');

      if (isRateLimit && retries > 0) {
        console.warn(`[Embeddings] Rate limited. Retrying in ${delay}ms... (Retries left: ${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        retries--;
        delay *= 2;
        continue;
      }
      console.error('[Embeddings] Embed generation call failed:', error);
      throw error;
    }
  }
}
