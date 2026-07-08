import { NextRequest } from 'next/server';
import { getAiCommandHistory } from '@/lib/data';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url!);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const history = await getAiCommandHistory(limit);
    return Response.json({ history });
  } catch (error: any) {
    return Response.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Forbidden') ? 403 : 401 }
    );
  }
}
