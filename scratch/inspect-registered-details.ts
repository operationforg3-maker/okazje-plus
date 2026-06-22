import { ai } from '../src/ai/genkit';

async function main() {
  // Let's temporarily overwrite a custom test model to see what input it receives
  ai.defineModel({
    name: 'test-inspect-model',
    label: 'Test'
  }, async (input) => {
    console.log('--- Custom model input ---');
    console.log('JSON:', JSON.stringify(input, null, 2));
    return {
      message: {
        role: 'model',
        content: [{ text: 'MOCKED RESPONSE' }]
      }
    } as any;
  });

  console.log('Calling test-inspect-model...');
  await ai.generate({
    model: 'test-inspect-model',
    prompt: 'hello',
    config: { temperature: 0.7 }
  });
}

main().catch(console.error);
