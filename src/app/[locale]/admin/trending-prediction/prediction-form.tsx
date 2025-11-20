'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { handlePrediction, PredictionState } from './actions';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Flame, TrendingUp, Zap } from 'lucide-react';

const initialState: PredictionState = {
  data: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <span className="animate-spin mr-2">...</span>
          Analizowanie...
        </>
      ) : (
        <>
          <Zap className="mr-2 h-4 w-4" />
          Przewiduj popularność
        </>
      )}
    </Button>
  );
}

export default function PredictionForm() {
  const [state, formAction] = useFormState(handlePrediction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Błąd predykcji',
        description: state.error,
      });
    }
  }, [state.error, toast]);

  return (
    <div className="grid md:grid-cols-5 gap-8">
      <Card className="md:col-span-3">
        <form action={formAction}>
          <CardContent className="pt-6 grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="dealName">Nazwa okazji</Label>
              <Input
                id="dealName"
                name="dealName"
                placeholder="np. Słuchawki Sony WH-1000XM5"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currentRating">Aktualna ocena (1-5)</Label>
                <Input
                  id="currentRating"
                  name="currentRating"
                  type="number"
                  step="0.1"
                  placeholder="4.8"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfRatings">Liczba ocen</Label>
                <Input
                  id="numberOfRatings"
                  name="numberOfRatings"
                  type="number"
                  placeholder="1250"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatura (°)</Label>
                <Input
                  id="temperature"
                  name="temperature"
                  type="number"
                  placeholder="1250"
                  defaultValue="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue="active">
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Wybierz status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktywna</SelectItem>
                    <SelectItem value="expired">Wygasła</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      
      <div className="md:col-span-2">
        <Card className="sticky top-24">
          <CardHeader>
             <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2"><TrendingUp className="h-5 w-5"/> Wynik predykcji</h3>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center min-h-[200px]">
            {state.data ? (
              <div className="space-y-4">
                 <div className="flex items-center justify-center gap-2 text-6xl font-bold text-destructive">
                    <Flame className="h-14 w-14" />
                    <span>{Math.round(state.data.heatIndex)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Przewidywany wskaźnik popularności</p>
                <p className="text-base pt-4">{state.data.trendingReason}</p>
              </div>
            ) : (
               <div className="text-muted-foreground space-y-2">
                <p>Wyniki pojawią się tutaj po analizie.</p>
               </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
