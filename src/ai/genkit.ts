import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Debug: Check if API key is available
// Plugin googleAI() expects: GEMINI_API_KEY (primary) or GOOGLE_API_KEY (fallback)
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('❌ CRITICAL: GEMINI_API_KEY or GOOGLE_API_KEY not found!');
  console.error('   Set GEMINI_API_KEY in .env.local for AI flows to work');
} else {
  console.log(`✅ Genkit API key configured: ${apiKey.slice(0, 20)}...`);
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
