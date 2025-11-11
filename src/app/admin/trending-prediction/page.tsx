'use client';

export const dynamic = 'force-dynamic';

import PredictionForm from './prediction-form';
import { BrainCircuit } from 'lucide-react';

export default function TrendingPredictionPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <BrainCircuit className="h-10 w-10 text-primary" />
        <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                Predykcja popularności okazji (AI)
            </h1>
            <p className="text-muted-foreground">
                Wprowadź dane okazji, aby oszacować jej potencjalny wskaźnik popularności.
            </p>
        </div>
      </div>
      
      <PredictionForm />
    </div>
  );
}
