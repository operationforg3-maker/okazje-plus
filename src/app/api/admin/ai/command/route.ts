import { NextRequest, NextResponse } from 'next/server';
import { runGeminiCommand } from '@/ai/gemini';

export async function POST(req: NextRequest) {
  const { command } = await req.json();
  // Wywołanie Gemini + obsługa API/bazy
  const result = await runGeminiCommand(command);
  return NextResponse.json({ result });
}
