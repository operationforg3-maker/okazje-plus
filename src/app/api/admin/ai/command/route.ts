import { NextRequest, NextResponse } from 'next/server';
import { fillCategoriesWithProducts } from '@/ai/flows/fillCategoriesWithProducts';
import { fillCategoriesWithDeals } from '@/ai/flows/fillCategoriesWithDeals';
import { logAiCommand } from '@/lib/data';

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json();
    
    let result: string;
    
    // Rozpoznaj polecenie i wywołaj odpowiedni flow
    if (command === 'fillCategoriesWithProducts' || command.includes('wypełnij katalog')) {
      result = await fillCategoriesWithProducts();
      
      // Zaloguj do historii
      await logAiCommand({
        command: 'fillCategoriesWithProducts',
        status: 'success',
        result,
      });
    } else if (command === 'fillCategoriesWithDeals' || command.includes('pobierz deale')) {
      result = await fillCategoriesWithDeals();
      
      // Zaloguj do historii
      await logAiCommand({
        command: 'fillCategoriesWithDeals',
        status: 'success',
        result,
      });
    } else {
      result = 'Nieznane polecenie. Dostępne: fillCategoriesWithProducts, fillCategoriesWithDeals';
    }
    
    return NextResponse.json({ result });
  } catch (error: any) {
    // Zaloguj błąd
    await logAiCommand({
      command: 'unknown',
      status: 'error',
      result: error.message || 'Nieznany błąd',
    });
    
    return NextResponse.json({ 
      result: `Błąd: ${error.message}` 
    }, { status: 500 });
  }
}
