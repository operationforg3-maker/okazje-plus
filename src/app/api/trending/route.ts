import { NextResponse } from 'next/server';
import { searchDealsTypesense } from '@/lib/search';
import { trendingDealPrediction } from '@/ai/flows/trending-deal-prediction';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const deals = await searchDealsTypesense('*', {
      limit: 6,
      sortBy: 'hot',
      statusFilter: 'approved',
    });

    const predictions = await Promise.all(
      deals.map(async (d) => {
        try {
          const dealName = typeof d.title === 'object' 
            ? (d.title.pl || d.title.en || 'Deal')
            : d.title;
          const input = {
            dealName: dealName,
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
