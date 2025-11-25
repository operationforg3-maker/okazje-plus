import { NextRequest } from 'next/server';
import { getAiCommandHistory } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url!);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const history = await getAiCommandHistory(limit);
  return Response.json({ history });
}
