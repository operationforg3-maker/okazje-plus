import { ai } from './src/ai/genkit.ts';

async function testGemini() {
  try {
    console.log('Testing Gemini API connection...');
    
    // Simple prompt test
    const result = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Przetłumacz na polski: "wireless headphones"',
    });
    
    console.log('✅ Gemini API działa!');
    console.log('Response:', result.text);
    process.exit(0);
  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    if (error.message.includes('API key')) {
      console.error('\nBrak klucza API. Ustaw GEMINI_API_KEY lub GOOGLE_API_KEY w .env.local');
    }
    process.exit(1);
  }
}

testGemini();
