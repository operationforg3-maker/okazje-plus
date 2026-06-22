import { ai } from '../src/ai/genkit';

async function main() {
  const modelName = 'vertexai/gemini-2.0-flash';
  
  // Look up model in registry
  const modelAction = await ai.registry.getAction(`/model/${modelName}`);
  console.log('Action in registry for modelName:', modelAction ? 'Found' : 'Not found');
  if (modelAction) {
    console.log('Action description:', modelAction.description);
    console.log('Action metadata:', modelAction.metadata);
  }
}

main().catch(console.error);
