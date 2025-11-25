import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

/**
 * Simple Gemini API test endpoint
 * GET /api/test-gemini
 */
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured',
        message: 'Set GEMINI_API_KEY or GOOGLE_API_KEY in environment variables',
      }, { status: 503 });
    }

    console.log('[test-gemini] Testing Gemini API...');
    console.log('[test-gemini] API key present:', apiKey.slice(0, 10) + '...');

    // Simple generation test
    const result = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: 'Translate to Polish in 3 words: "wireless bluetooth headphones"',
    });

    console.log('[test-gemini] Response received:', result.text);

    return NextResponse.json({
      success: true,
      message: 'Gemini API is working',
      response: result.text,
      model: 'gemini-2.0-flash',
    });
  } catch (error: any) {
    console.error('[test-gemini] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.toString(),
      hint: error.message?.includes('API key') 
        ? 'Check GEMINI_API_KEY or GOOGLE_API_KEY in .env.local'
        : 'Check Gemini API quotas and billing',
    }, { status: 500 });
  }
}
