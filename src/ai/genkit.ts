import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

if (process.env.NODE_ENV !== 'production' || process.env.GENKIT_DEBUG) {
  console.log(`✅ Google AI initialized with API key (length: ${apiKey.length})`);
}

export const ai = genkit({
  plugins: [
    googleAI({ apiKey })
  ],
  model: 'googleai/gemini-2.5-flash',
});

// Alias model mapping to route Vertex AI model calls to Google AI (using Developer API Key)
// This is necessary because Vertex AI models are unavailable or restricted in europe-west1/us-central1 endpoints,
// whereas the Gemini Developer API is fully functional.
const modelMapping: Record<string, string> = {
  'vertexai/gemini-2.0-flash-exp': 'googleai/gemini-2.5-flash',
  'vertexai/gemini-2.0-flash': 'googleai/gemini-2.5-flash',
  'vertexai/gemini-1.5-flash': 'googleai/gemini-2.5-flash',
  'vertexai/gemini-1.5-pro': 'googleai/gemini-2.5-pro',
  'gemini-2.0-flash-exp': 'googleai/gemini-2.5-flash',
  'gemini-1.5-flash': 'googleai/gemini-2.5-flash',
  'gemini-1.5-pro': 'googleai/gemini-2.5-pro',
  'gemini-2.0-flash': 'googleai/gemini-2.5-flash'
};

for (const [alias, target] of Object.entries(modelMapping)) {
  ai.defineModel({
    name: alias,
    label: `Redirect ${alias} to Google AI ${target}`
  }, async (input) => {
    const rawInput = input as any;
    if (process.env.NODE_ENV !== 'production' || process.env.GENKIT_DEBUG) {
      console.log(`[GENKIT ALIAS REDIRECT] Redirecting ${alias} -> ${target}. Input keys:`, Object.keys(input));
    }
    
    let retries = 8;
    let delay = 3000;
    while (true) {
      try {
        return await ai.generate({
          ...rawInput,
          model: target
        } as any);
      } catch (err: any) {
        const errMessage = String(err.message || '');
        const errOriginalMessage = String(err.originalMessage || '');
        const errStr = String(err);

        if (rawInput.config && rawInput.config.googleSearchRetrieval) {
          console.warn(`[GENKIT ALIAS REDIRECT] Grounding call failed/rate-limited. Retrying WITHOUT Google Search Grounding...`);
          rawInput.config = { ...rawInput.config };
          delete rawInput.config.googleSearchRetrieval;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        
        const isRateLimit = 
          err.status === 'RESOURCE_EXHAUSTED' || 
          err.code === 429 ||
          errMessage.includes('quota') ||
          errMessage.includes('429') ||
          errMessage.includes('RESOURCE_EXHAUSTED') ||
          errOriginalMessage.includes('quota') ||
          errOriginalMessage.includes('429') ||
          errOriginalMessage.includes('RESOURCE_EXHAUSTED') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          errStr.includes('429');

        const isTransientNetwork =
          errMessage.includes('fetch failed') ||
          errMessage.includes('ETIMEDOUT') ||
          errMessage.includes('ECONNRESET') ||
          errMessage.includes('socket hang up') ||
          errMessage.includes('timeout') ||
          errMessage.includes('502') ||
          errMessage.includes('503') ||
          errMessage.includes('504') ||
          errOriginalMessage.includes('fetch failed') ||
          errOriginalMessage.includes('ETIMEDOUT') ||
          errOriginalMessage.includes('ECONNRESET') ||
          errStr.includes('fetch failed') ||
          errStr.includes('ETIMEDOUT') ||
          errStr.includes('ECONNRESET');

        if ((isRateLimit || isTransientNetwork) && retries > 0) {
          let retryDelay = delay;
          const msgToCheck = `${errMessage}\n${errOriginalMessage}\n${errStr}`;
          const retryMatch = msgToCheck.match(/Please retry in ([\d.]+)(ms|s)?/i);
          if (retryMatch) {
            const val = parseFloat(retryMatch[1]);
            const unit = (retryMatch[2] || 's').toLowerCase();
            if (unit === 's') {
              retryDelay = Math.ceil(val * 1000) + 1500; // wait val seconds + 1.5s buffer
            } else {
              retryDelay = Math.ceil(val) + 500; // wait val ms + 500ms buffer
            }
          }

          console.warn(`[GENKIT ALIAS REDIRECT] Rate limited or transient network error. Retrying in ${retryDelay}ms... (Reason: ${isRateLimit ? '429' : 'Network'}, Retries left: ${retries})`);
          await new Promise(r => setTimeout(r, retryDelay));
          retries--;
          delay = Math.min(delay * 2.5, 45000); // Exponential backoff capped at 45s
        } else {
          console.error(`[GENKIT ALIAS REDIRECT] Error generation failed (no retries left or non-retryable error):`, err);
          throw err;
        }
      }
    }
  });
}

