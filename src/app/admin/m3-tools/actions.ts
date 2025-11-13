'use server';

import { analyzeProductReviews } from '@/ai/flows/review-analysis';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ReviewSummary } from '@/lib/types';

export async function analyzeReviewsAction(productId: string) {
  try {
    // In production, this would fetch real reviews from the product
    // For now, using sample data
    const sampleReviews = [
      {
        text: 'Świetny produkt! Bardzo dobra jakość wykonania i szybka dostawa. Polecam!',
        rating: 5,
        date: new Date().toISOString(),
      },
      {
        text: 'Produkt zgodny z opisem. Bateria trzyma długo, ale plastik trochę tani.',
        rating: 4,
        date: new Date().toISOString(),
      },
      {
        text: 'Niestety rozczarowanie. Nie działa tak jak w opisie. Zwracam.',
        rating: 2,
        date: new Date().toISOString(),
      },
      {
        text: 'Za tę cenę super sprawa! Dobry stosunek jakości do ceny.',
        rating: 4,
        date: new Date().toISOString(),
      },
    ];

    const result = await analyzeProductReviews(productId, sampleReviews);

    const reviewSummary: ReviewSummary = {
      id: productId,
      productId,
      overallSentiment: result.overallSentiment,
      sentimentScore: result.sentimentScore,
      reviewCount: sampleReviews.length,
      pros: result.pros,
      cons: result.cons,
      topicTags: result.topicTags,
      summary: result.summary,
      confidence: result.confidence,
      generatedAt: new Date().toISOString(),
      modelVersion: 'gemini-2.5-flash',
      language: 'pl',
    };

    // Save to Firestore
    const summaryRef = doc(db, 'review_summaries', productId);
    await setDoc(summaryRef, reviewSummary);

    return { success: true, summary: reviewSummary };
  } catch (error: any) {
    console.error('Error analyzing reviews:', error);
    return { success: false, error: error.message };
  }
}
