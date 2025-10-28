'use server';

/**
 * @fileOverview A trending deal prediction AI agent.
 *
 * - trendingDealPrediction - A function that handles the deal trending prediction process.
 * - TrendingDealPredictionInput - The input type for the trendingDealPrediction function.
 * - TrendingDealPredictionOutput - The return type for the trendingDealPrediction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TrendingDealPredictionInputSchema = z.object({
  dealName: z.string().describe('The name of the deal.'),
  currentRating: z.number().describe('The current average rating of the deal (e.g., 4.5).'),
  numberOfRatings: z.number().describe('The number of ratings the deal has received.'),
  temperature: z.number().describe('The temperature of the deal (e.g. 25 degrees).'),
  status: z.string().describe('The current status of the deal (e.g., active, expired).'),
});
export type TrendingDealPredictionInput = z.infer<
  typeof TrendingDealPredictionInputSchema
>;

const TrendingDealPredictionOutputSchema = z.object({
  heatIndex: z
    .number()
    .describe(
      'A numerical heat index (0-100) representing the predicted trending potential of the deal, where 0 is not trending and 100 is extremely trending.'
    ),
  trendingReason: z
    .string()
    .describe(
      'A brief explanation of why the deal is predicted to be trending or not trending.'
    ),
});
export type TrendingDealPredictionOutput = z.infer<
  typeof TrendingDealPredictionOutputSchema
>;

export async function trendingDealPrediction(
  input: TrendingDealPredictionInput
): Promise<TrendingDealPredictionOutput> {
  return trendingDealPredictionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'trendingDealPredictionPrompt',
  input: {schema: TrendingDealPredictionInputSchema},
  output: {schema: TrendingDealPredictionOutputSchema},
  prompt: `You are an expert in predicting the trending potential of online deals.

  Based on the following information about a deal, predict its heat index (0-100) and explain your reasoning.

  Deal Name: {{{dealName}}}
  Current Rating: {{{currentRating}}}
  Number of Ratings: {{{numberOfRatings}}}
  Temperature: {{{temperature}}}
  Status: {{{status}}}

  Consider factors such as the deal's rating, the number of ratings, its temperature, and its current status to determine its trending potential.
`,
});

const trendingDealPredictionFlow = ai.defineFlow(
  {
    name: 'trendingDealPredictionFlow',
    inputSchema: TrendingDealPredictionInputSchema,
    outputSchema: TrendingDealPredictionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
