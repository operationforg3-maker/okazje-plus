import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

/**
 * Simple Vertex AI test endpoint
 * GET /api/test-gemini
 */
export async function GET() {
  try {
    console.log('[test-gemini] Testing Vertex AI (ADC credentials)...');

    // Simple generation test
    const result = await ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: 'Translate to Polish in 3 words: "wireless bluetooth headphones"',
    });

    console.log('[test-gemini] Response received:', result.text);

    return NextResponse.json({
      success: true,
      message: 'Vertex AI is working',
      response: result.text,
      model: 'vertexai/gemini-2.0-flash',
    });
  } catch (error: any) {
    console.error('[test-gemini] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.toString(),
      hint: 'Check Vertex AI quotas, billing, and service account permissions',
    }, { status: 500 });
  }
}
