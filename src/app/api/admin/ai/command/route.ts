import { NextRequest, NextResponse } from 'next/server';
import { fillCategoriesWithProducts } from '@/ai/flows/fillCategoriesWithProducts';
import { fillCategoriesWithDeals } from '@/ai/flows/fillCategoriesWithDeals';
import { createCategoryStructure } from '@/ai/flows/createCategoryStructure';
import { logAiCommand } from '@/lib/data-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command } = body;
    
    console.log('[AI Command] Received:', command);
    
    if (!command) {
      return NextResponse.json({ 
        error: 'Brak polecenia',
        result: 'Błąd: Nie podano polecenia do wykonania' 
      }, { status: 400 });
    }
    
    let result: string;
    
    // Rozpoznaj polecenie i wywołaj odpowiedni flow
    if (command === 'createCategoryStructure' || command.includes('utwórz kategorie')) {
      console.log('[AI Command] Executing createCategoryStructure...');
      result = await createCategoryStructure();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'createCategoryStructure',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else if (command === 'fillCategoriesWithProducts' || command.includes('wypełnij katalog')) {
      console.log('[AI Command] Executing fillCategoriesWithProducts...');
      result = await fillCategoriesWithProducts();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'fillCategoriesWithProducts',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else if (command === 'fillCategoriesWithDeals' || command.includes('pobierz deale')) {
      console.log('[AI Command] Executing fillCategoriesWithDeals...');
      result = await fillCategoriesWithDeals();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'fillCategoriesWithDeals',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else {
      result = `Nieznane polecenie: "${command}". Dostępne: createCategoryStructure, fillCategoriesWithProducts, fillCategoriesWithDeals`;
      return NextResponse.json({ result }, { status: 400 });
    }
    
    return NextResponse.json({ result, success: true });
  } catch (error: any) {
    console.error('[AI Command] Error:', error);
    
    const errorMessage = error?.message || 'Nieznany błąd';
    const errorStack = error?.stack || '';
    
    // Zaloguj błąd
    try {
      await logAiCommand({
        command: 'error',
        status: 'error',
        result: `${errorMessage}\n\nStack: ${errorStack}`,
      });
    } catch (logError) {
      console.error('[AI Command] Failed to log error:', logError);
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      result: `Błąd: ${errorMessage}`,
      success: false
    }, { status: 500 });
  }
}
