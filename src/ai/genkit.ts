import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { googleAI } from '@genkit-ai/googleai';

const googleGenAIKey = process.env.GOOGLE_GENAI_API_KEY || '';

if (process.env.NODE_ENV !== 'production' || process.env.GENKIT_DEBUG) {
  console.log(`✅ AI Registry: Initializing Vertex AI (Primary) and Google AI (Fallback, Key configured: ${Boolean(googleGenAIKey)})`);
}

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'okazje-plus',
      location: 'europe-west4' // GCP region matching hosted environment
    }),
    googleAI({ apiKey: googleGenAIKey }),
  ],
  model: 'vertexai/gemini-2.5-flash',
});

interface ModelMapping {
  primary: string;
  fallback: string;
}

// Map each model alias to a primary Vertex AI model and a fallback Google AI Studio model.
// Google AI Studio (fallback) uses gemini-2.0-flash and gemini-1.5-pro as stable models.
const modelMapping: Record<string, ModelMapping> = {
  'refine-model': {
    primary: 'vertexai/gemini-2.0-flash',
    fallback: 'googleai/gemini-2.0-flash'
  },
  'googleai/gemini-2.5-flash': {
    primary: 'vertexai/gemini-2.5-flash',
    fallback: 'googleai/gemini-2.0-flash'
  },
  'googleai/gemini-2.5-pro': {
    primary: 'vertexai/gemini-2.5-pro',
    fallback: 'googleai/gemini-1.5-pro'
  },
  'vertexai/gemini-2.5-flash': {
    primary: 'vertexai/gemini-2.5-flash',
    fallback: 'googleai/gemini-2.0-flash'
  },
  'vertexai/gemini-2.5-pro': {
    primary: 'vertexai/gemini-2.5-pro',
    fallback: 'googleai/gemini-1.5-pro'
  },
  'vertexai/gemini-2.0-flash-exp': {
    primary: 'vertexai/gemini-2.0-flash-exp',
    fallback: 'googleai/gemini-2.0-flash'
  },
  'vertexai/gemini-2.0-flash': {
    primary: 'vertexai/gemini-2.0-flash',
    fallback: 'googleai/gemini-2.0-flash'
  },
  'vertexai/gemini-1.5-flash': {
    primary: 'vertexai/gemini-1.5-flash',
    fallback: 'googleai/gemini-1.5-flash'
  },
  'vertexai/gemini-1.5-pro': {
    primary: 'vertexai/gemini-1.5-pro',
    fallback: 'googleai/gemini-1.5-pro'
  },
  'gemini-2.0-flash-exp': {
    primary: 'vertexai/gemini-2.0-flash-exp',
    fallback: 'googleai/gemini-2.0-flash'
  },
  'gemini-1.5-flash': {
    primary: 'vertexai/gemini-1.5-flash',
    fallback: 'googleai/gemini-1.5-flash'
  },
  'gemini-1.5-pro': {
    primary: 'vertexai/gemini-1.5-pro',
    fallback: 'googleai/gemini-1.5-pro'
  },
  'gemini-2.0-flash': {
    primary: 'vertexai/gemini-2.0-flash',
    fallback: 'googleai/gemini-2.0-flash'
  },
};

// Define wrapper model aliases that implement the automatic fallback strategy
for (const [alias, target] of Object.entries(modelMapping)) {
  ai.defineModel({
    name: alias,
    label: `Smart Redirect ${alias} (Primary: ${target.primary}, Fallback: ${target.fallback})`
  }, async (input) => {
    const rawInput = input as any;
    
    let retries = 8;
    let delay = 3000;
    let useFallback = false;

    while (true) {
      const selectedModel = useFallback ? target.fallback : target.primary;
      
      if (process.env.NODE_ENV !== 'production' || process.env.GENKIT_DEBUG) {
        console.log(`[GENKIT REDIRECT] Using model: ${selectedModel} (Alias: ${alias}, Fallback Active: ${useFallback})`);
      }

      try {
        const generationConfig = {
          ...rawInput.config,
        };

        // Disable thinking mode for gemini-2.5 by default unless explicitly configured
        if (selectedModel.includes('gemini-2.5')) {
          generationConfig.thinkingConfig = {
            thinkingBudget: 0,
            ...generationConfig.thinkingConfig
          };
        }

        return await ai.generate({
          ...rawInput,
          config: generationConfig,
          model: selectedModel
        } as any);
      } catch (err: any) {
        const errMessage = String(err.message || '');
        const errOriginalMessage = String(err.originalMessage || '');
        const errStr = String(err);

        // Print descriptive warning on Vertex AI failure
        console.warn(`[GENKIT REDIRECT] Error occurred with model ${selectedModel}:`, errMessage || errStr);

        // If Vertex AI (primary) fails, switch immediately to Google AI Studio (fallback)
        if (!useFallback) {
          console.warn(`[GENKIT REDIRECT] Vertex AI call failed. Switching to Google AI Studio fallback (${target.fallback})...`);
          useFallback = true;
          // Short sleep before trying fallback to avoid instant loops
          await new Promise(r => setTimeout(r, 200));
          continue;
        }

        // Standard rate-limiting & network retry logic (mostly for Google AI Studio)
        if (rawInput.config && rawInput.config.googleSearchRetrieval) {
          console.warn(`[GENKIT REDIRECT] Grounding call failed. Retrying WITHOUT Google Search Grounding...`);
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
              retryDelay = Math.ceil(val * 1000) + 1500;
            } else {
              retryDelay = Math.ceil(val) + 500;
            }
          }

          console.warn(`[GENKIT REDIRECT] Rate limited or network error. Retrying in ${retryDelay}ms... (Retries left: ${retries})`);
          await new Promise(r => setTimeout(r, retryDelay));
          retries--;
          delay = Math.min(delay * 2.5, 45000); // Exponential backoff capped at 45s
        } else {
          console.error(`[GENKIT REDIRECT] Error generation failed permanently (no retries left or non-retryable error):`, err);
          throw err;
        }
      }
    }
  });
}
