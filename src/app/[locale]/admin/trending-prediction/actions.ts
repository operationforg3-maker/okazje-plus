'use server';

import {
  trendingDealPrediction,
  TrendingDealPredictionInput,
  TrendingDealPredictionOutput,
} from '@/ai/flows/trending-deal-prediction';
import { z } from 'zod';

const FormSchema = z.object({
  dealName: z.string().min(1, 'Nazwa okazji jest wymagana.'),
  currentRating: z.coerce.number().min(0).max(5, 'Ocena musi być między 0 a 5.'),
  numberOfRatings: z.coerce.number().min(0, 'Liczba ocen nie może być ujemna.'),
  temperature: z.coerce.number(),
  status: z.string().min(1, 'Status jest wymagany.'),
});

export type PredictionState = {
  data: TrendingDealPredictionOutput | null;
  error: string | null;
};

export async function handlePrediction(
  prevState: PredictionState,
  formData: FormData
): Promise<PredictionState> {
  const validatedFields = FormSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    return {
      data: null,
      error: validatedFields.error.flatten().fieldErrors.toString(),
    };
  }

  try {
    const input: TrendingDealPredictionInput = validatedFields.data;
    const result = await trendingDealPrediction(input);
    return {
      data: result,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      data: null,
      error: `AI prediction failed: ${errorMessage}`,
    };
  }
}
