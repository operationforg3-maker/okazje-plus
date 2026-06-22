import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
console.log('API Key length:', apiKey.length);

const ai = genkit({
  plugins: [googleAI({ apiKey })],
});

async function main() {
  try {
    // We can list models using fetch or direct call
    const fetch = (await import('node-fetch')).default;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    console.log('Models returned by API:');
    if (data.models) {
      for (const m of data.models) {
        console.log(`- ${m.name} (displayName: ${m.displayName}, supported: ${m.supportedGenerationMethods})`);
      }
    } else {
      console.log('No models returned. Response:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error fetching models:', err);
  }
}

main();
