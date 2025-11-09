import { NextResponse } from 'next/server';
import { getHotDeals, getRandomDeals } from '@/lib/data';
import { trendingDealPrediction } from '@/ai/flows/trending-deal-prediction';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Weź gorące okazje, jeśli mało danych dobierz losowe, aby mieć 6 pozycji
    const hot = await getHotDeals(6);
    let deals = hot;
    if (hot.length < 6) {
      const extra = await getRandomDeals(6 - hot.length);
      // unikaj duplikatów
      const hotIds = new Set(hot.map((d) => d.id));
      deals = hot.concat(extra.filter((e) => !hotIds.has(e.id)));
    }

    const predictions = await Promise.all(
      deals.map(async (d) => {
        try {
          const input = {
            dealName: d.title,
            currentRating: 4.0, // brak ratingów na dealach – konserwatywny default
            numberOfRatings: Math.max(d.voteCount ?? 0, d.commentsCount ?? 0),
            temperature: d.temperature ?? 0,
            status: (d.status === 'approved' ? 'active' : d.status) || 'draft',
          };
          const p = await trendingDealPrediction(input);
          return { deal: d, prediction: p };
        } catch (e) {
          return { deal: d, prediction: null };
        }
      })
    );

    return NextResponse.json({ items: predictions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
