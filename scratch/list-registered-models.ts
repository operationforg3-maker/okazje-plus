import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [
    googleAI({ apiKey: 'AIzaSyTestApiKeyPlaceholder-123456789' })
  ]
});

async function list() {
  const actions = await ai.registry.listActions();
  console.log('Registered actions:', Object.keys(actions));
  console.log('Action names:', Object.values(actions).map((a: any) => a.name));
}

list();
