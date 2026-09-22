export const dynamic = 'force-static';

export async function GET() {
  return new Response('tradetracker-verification-code: 202f5f82cd1c032e\n', {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
