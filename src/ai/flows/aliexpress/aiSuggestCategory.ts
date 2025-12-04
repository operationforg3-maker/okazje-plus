'use server';

/**
 * AI Category Suggestion Flow - "The Librarian"
 * 
 * Suggests 2-level category mapping (main + sub) for products
 * using Genkit AI analysis of title and description.
 * 
 * Taxonomy: Elektronika, Dom i Ogród, Moda, Sport i Turystyka, 
 * Zdrowie i Uroda, Motoryzacja, Zabawki, Inne
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

const CategorySuggestionInputSchema = z.object({
  productTitle: z.string().describe('Product title'),
  description: z.string().optional().describe('Product description'),
});

export type CategorySuggestionInput = z.infer<typeof CategorySuggestionInputSchema>;

const CategorySuggestionOutputSchema = z.object({
  mainCategorySlug: z.string().describe('Main category slug (level 1)'),
  subCategorySlug: z.string().describe('Sub-category slug (level 2)'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().optional().describe('Polish explanation'),
});

export type CategorySuggestionOutput = z.infer<typeof CategorySuggestionOutputSchema>;

const categoryPrompt = ai.definePrompt({
  name: 'categorySuggestionPrompt',
  input: { schema: CategorySuggestionInputSchema },
  output: { schema: CategorySuggestionOutputSchema },
  prompt: `Jesteś ekspertem kategoryzacji produktów dla polskiego portalu okazji.

Zadanie: Przypisz produkt do 2-poziomowej kategorii (mainCategorySlug + subCategorySlug).

Produkt:
- Tytuł: {{{productTitle}}}
{{#if description}}- Opis: {{{description}}}{{/if}}

DOSTĘPNE KATEGORIE (użyj DOKŁADNIE tych slugów):

1. **elektronika** (main)
   Sub: smartfony, tablety, laptopy, audio, fotografia, akcesoria

2. **dom-i-ogrod** (main)
   Sub: meble, dekoracje, ogrod, narzedzia, agd

3. **moda** (main)
   Sub: odziez-damska, odziez-meska, obuwie, akcesoria-modowe, bizuteria

4. **sport-i-turystyka** (main)
   Sub: fitness, odziez-sportowa, turystyka, akcesoria-sportowe

5. **zdrowie-i-uroda** (main)
   Sub: kosmetyki, suplementy, pielegnacja, sprzet-medyczny

6. **motoryzacja** (main)
   Sub: akcesoria-samochodowe, czesci, elektronika-samochodowa, pielegnacja-auta

7. **zabawki** (main)
   Sub: zabawki-dla-niemowlat, zabawki-edukacyjne, klocki, lalki-i-figurki, gry-planszowe

8. **inne** (main)
   Sub: pozostale

ZASADY:
1. Wybierz najbardziej specyficzną kategorię pasującą do produktu
2. confidence = 1.0 (pewny), 0.8-0.9 (dobry), 0.6-0.7 (ok), <0.6 (niepewny)
3. reasoning w języku polskim - wyjaśnij w 1 zdaniu dlaczego ta kategoria
4. Używaj TYLKO slugów z listy powyżej (lowercase, z myślnikami)

PRZYKŁADY:
- "iPhone 15 Pro" → main: "elektronika", sub: "smartfony", confidence: 1.0
- "Słuchawki Sony WH-1000XM5" → main: "elektronika", sub: "audio", confidence: 1.0
- "Adidas Ultraboost buty do biegania" → main: "sport-i-turystyka", sub: "odziez-sportowa", confidence: 0.9
- "Krem przeciwzmarszczkowy" → main: "zdrowie-i-uroda", sub: "kosmetyki", confidence: 0.9
- "Kabel USB-C 2m" → main: "elektronika", sub: "akcesoria", confidence: 0.8

Jeśli produkt nie pasuje do żadnej kategorii, użyj: main: "inne", sub: "pozostale", confidence: 0.3`,
});

const categoryFlow = ai.defineFlow(
  {
    name: 'categorySuggestionFlow',
    inputSchema: CategorySuggestionInputSchema,
    outputSchema: CategorySuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await categoryPrompt(input);
    return output!;
  }
);

export async function aiSuggestCategory(
  input: CategorySuggestionInput
): Promise<CategorySuggestionOutput> {
  logger.debug('AI category suggestion', { title: input.productTitle });
  
  try {
    const result = await categoryFlow(input);
    
    logger.info('Category suggestion completed', {
      title: input.productTitle,
      mainCategory: result.mainCategorySlug,
      subCategory: result.subCategorySlug,
      confidence: result.confidence,
    });
    
    return result;
  } catch (error) {
    logger.error('AI category suggestion failed', { error, input });
    
    // Fallback: keyword-based matching
    const titleLower = input.productTitle.toLowerCase();
    const descLower = (input.description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;
    
    // Elektronika
    if (/iphone|samsung galaxy|xiaomi|oppo|realme|smartphone|smartfon|telefon(?!.*sam)/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        confidence: 0.7,
        reasoning: 'Rozpoznano smartfon na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/słuchawki|headphone|earphone|airpods|earbuds|audio/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        confidence: 0.7,
        reasoning: 'Rozpoznano sprzęt audio na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/laptop|notebook|ultrabook|macbook/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'laptopy',
        confidence: 0.7,
        reasoning: 'Rozpoznano laptop na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/tablet|ipad/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'tablety',
        confidence: 0.7,
        reasoning: 'Rozpoznano tablet na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/aparat|camera|obiektyw|lens|foto/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'fotografia',
        confidence: 0.6,
        reasoning: 'Rozpoznano sprzęt fotograficzny (fallback)',
      };
    }
    
    if (/kabel|cable|ładowarka|charger|powerbank|adapter|usb/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'akcesoria',
        confidence: 0.6,
        reasoning: 'Rozpoznano akcesoria elektroniczne (fallback)',
      };
    }
    
    // Moda
    if (/buty|but|shoe|sneaker|adidas|nike|puma|obuwie/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'obuwie',
        confidence: 0.7,
        reasoning: 'Rozpoznano obuwie na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/sukienka|dress|bluzka|damsk/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-damska',
        confidence: 0.7,
        reasoning: 'Rozpoznano odzież damską (fallback)',
      };
    }
    
    if (/koszula|shirt|spodnie|męsk/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-meska',
        confidence: 0.7,
        reasoning: 'Rozpoznano odzież męską (fallback)',
      };
    }
    
    if (/torebka|torba|bag|pasek|belt|czapka|szalik/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'akcesoria-modowe',
        confidence: 0.6,
        reasoning: 'Rozpoznano akcesoria modowe (fallback)',
      };
    }
    
    if (/zegarek|watch|bransoleta|naszyjnik|kolczyki|pierścionek|biżuteria/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'bizuteria',
        confidence: 0.7,
        reasoning: 'Rozpoznano biżuterię (fallback)',
      };
    }
    
    // Sport i Turystyka
    if (/fitness|siłownia|gym|hantel|dumbbell|mata do ćwiczeń/i.test(combined)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'fitness',
        confidence: 0.7,
        reasoning: 'Rozpoznano sprzęt fitness (fallback)',
      };
    }
    
    if (/sport|bieganie|rower|trening|dres|training/i.test(combined)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'odziez-sportowa',
        confidence: 0.6,
        reasoning: 'Rozpoznano odzież sportową (fallback)',
      };
    }
    
    if (/namiot|plecak|śpiwór|camping|turystyka|góry/i.test(combined)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'turystyka',
        confidence: 0.7,
        reasoning: 'Rozpoznano sprzęt turystyczny (fallback)',
      };
    }
    
    // Zdrowie i Uroda
    if (/krem|serum|kosmetyk|cosmetic|makijaż|makeup|perfum/i.test(combined)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'kosmetyki',
        confidence: 0.7,
        reasoning: 'Rozpoznano kosmetyki (fallback)',
      };
    }
    
    if (/witamin|suplement|odżywka|protein|magnez/i.test(combined)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'suplementy',
        confidence: 0.7,
        reasoning: 'Rozpoznano suplementy (fallback)',
      };
    }
    
    if (/pielęgnacja|szampon|żel|mydło/i.test(combined)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'pielegnacja',
        confidence: 0.6,
        reasoning: 'Rozpoznano produkty pielęgnacyjne (fallback)',
      };
    }
    
    // Dom i Ogród
    if (/meble|stół|krzesło|sofa|kanapa|szafa|furniture/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'meble',
        confidence: 0.7,
        reasoning: 'Rozpoznano meble (fallback)',
      };
    }
    
    if (/obraz|wazon|lampka|świeca|dekor/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'dekoracje',
        confidence: 0.6,
        reasoning: 'Rozpoznano dekoracje (fallback)',
      };
    }
    
    if (/odkurzacz|agd|zmywarka|kuchnia/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'agd',
        confidence: 0.7,
        reasoning: 'Rozpoznano AGD (fallback)',
      };
    }
    
    if (/narzędzi|wiertarka|młotek|śrubokręt|tool/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'narzedzia',
        confidence: 0.7,
        reasoning: 'Rozpoznano narzędzia (fallback)',
      };
    }
    
    if (/roślina|nasiona|ogród|kwiat|garden/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'ogrod',
        confidence: 0.7,
        reasoning: 'Rozpoznano produkty ogrodnicze (fallback)',
      };
    }
    
    // Motoryzacja
    if (/samochód|auto|car|samochodow/i.test(combined)) {
      return {
        mainCategorySlug: 'motoryzacja',
        subCategorySlug: 'akcesoria-samochodowe',
        confidence: 0.5,
        reasoning: 'Rozpoznano tematykę motoryzacyjną (fallback)',
      };
    }
    
    // Zabawki
    if (/zabawka|toy|lego|klocki|lalka|doll|gra planszowa/i.test(combined)) {
      return {
        mainCategorySlug: 'zabawki',
        subCategorySlug: 'klocki',
        confidence: 0.6,
        reasoning: 'Rozpoznano zabawki (fallback)',
      };
    }
    
    // Default fallback
    return {
      mainCategorySlug: 'inne',
      subCategorySlug: 'pozostale',
      confidence: 0.3,
      reasoning: 'Nie udało się dopasować do żadnej kategorii - wymaga ręcznej klasyfikacji (fallback)',
    };
  }
}
