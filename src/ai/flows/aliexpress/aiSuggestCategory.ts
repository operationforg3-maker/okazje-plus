'use server';

/**
 * AI Category Suggestion Flow - "The Librarian"
 * 
 * Suggests 3-level category mapping (main + sub + subsub) for products
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
  subSubCategorySlug: z.string().describe('Sub-sub-category slug (level 3) - REQUIRED'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().optional().describe('Polish explanation'),
});

export type CategorySuggestionOutput = z.infer<typeof CategorySuggestionOutputSchema>;

const categoryPrompt = ai.definePrompt({
  name: 'categorySuggestionPrompt',
  input: { schema: CategorySuggestionInputSchema },
  output: { schema: CategorySuggestionOutputSchema },
  prompt: `Jesteś ekspertem kategoryzacji produktów dla polskiego portalu okazji.

Zadanie: Przypisz produkt do 3-poziomowej kategorii (mainCategorySlug + subCategorySlug + subSubCategorySlug).

Produkt:
- Tytuł: {{{productTitle}}}
{{#if description}}- Opis: {{{description}}}{{/if}}

DOSTĘPNE KATEGORIE 3-POZIOMOWE (użyj DOKŁADNIE tych slugów):

1. **elektronika** (main)
   - **smartfony** (sub): akcesoria-do-smartfonow, case-i-etui, ladowarki-i-kable, powerbanki, uchwyty-samochodowe
   - **tablety** (sub): tablety-android, tablety-ios, akcesoria-do-tabletow
   - **laptopy** (sub): laptopy-osobiste, laptopy-do-gier, ultrabooki, akcesoria-do-laptopow
   - **audio** (sub): sluchawki, glosniki, systemy-audio, akcesoria-audio
   - **fotografia** (sub): aparaty-cyfrowe, obiektywy, statywy, akcesoria-fotograficzne
   - **akcesoria** (sub): przewody-i-kable, zasilacze, adaptery, pamiec-zewnetrzna

2. **dom-i-ogrod** (main)
   - **meble** (sub): meble-do-salonu, meble-do-sypialni, meble-kuchenne, meble-ogrodowe
   - **dekoracje** (sub): obrazy-i-plakaty, swiatla-dekoracyjne, wazony-i-figurki, tekstylia-domowe
   - **ogrod** (sub): narzedzia-ogrodowe, nawadnianie, nasiona-i-rosliny
   - **narzedzia** (sub): narzedzia-reczne, elektronarzedzia, organizery-narzedzi
   - **agd** (sub): agd-male, agd-kuchenne, odkurzacze, agd-do-czyszczenia

3. **moda** (main)
   - **odziez-damska** (sub): sukienki, bluzki, spodnie-damskie, kurtki-damskie, swetry-damskie
   - **odziez-meska** (sub): koszule, spodnie-meskie, kurtki-meskie, swetry-meskie, t-shirty
   - **obuwie** (sub): obuwie-damskie, obuwie-meskie, obuwie-sportowe, obuwie-dzieciece
   - **akcesoria-modowe** (sub): torby-i-torebki, paski, czapki-i-kapelusze, szaliki-i-rekawiczki
   - **bizuteria** (sub): naszyjniki, bransoletki, kolczyki, piercionki, zegarki

4. **sport-i-turystyka** (main)
   - **fitness** (sub): silownia-domowa, akcesoria-fitness, odzywki-sportowe, maty-do-cwiczen
   - **odziez-sportowa** (sub): odziez-do-biegania, odziez-rowerowa, odziez-treningowa, buty-sportowe
   - **turystyka** (sub): namioty, plecaki-turystyczne, spiwory, akcesoria-turystyczne
   - **akcesoria-sportowe** (sub): pilki, rakiety, ochraniacze, gadzety-sportowe

5. **zdrowie-i-uroda** (main)
   - **kosmetyki** (sub): kosmetyki-do-twarzy, kosmetyki-do-ciala, makijaz, perfumy
   - **suplementy** (sub): witaminy, mineraly, suplementy-odchudzajace, suplementy-sportowe
   - **pielegnacja** (sub): pielegnacja-twarzy, pielegnacja-wlosow, pielegnacja-ciala, higiena
   - **sprzet-medyczny** (sub): cisnienomierze, termometry, glukometry, maski-ochronne

6. **motoryzacja** (main)
   - **akcesoria-samochodowe** (sub): organizery, uchwyty, zapachy, pokrowce
   - **czesci** (sub): filtry, paski, zyrowki, akcesoria-do-czesci
   - **elektronika-samochodowa** (sub): kamery-samochodowe, nawigacje, ladowarki-samochodowe
   - **pielegnacja-auta** (sub): kosmetyki-samochodowe, odkurzacze-samochodowe, mycie-i-czyszczenie

7. **zabawki** (main)
   - **zabawki-dla-niemowlat** (sub): grzechotki, mobile, interaktywne-zabawki
   - **zabawki-edukacyjne** (sub): puzzle, ksiazki-dla-dzieci, zestawy-edukacyjne
   - **klocki** (sub): lego, klocki-drewniane, klocki-plastikowe
   - **lalki-i-figurki** (sub): lalki, figurki-akcji, akcesoria-do-lalek
   - **gry-planszowe** (sub): gry-rodzinne, gry-strategiczne, gry-karciane

8. **inne** (main)
   - **pozostale** (sub): niesklasyfikowane, rozne, inne-produkty

ZASADY:
1. MUSISZ zwrócić WSZYSTKIE 3 POZIOMY (main + sub + subsub)
2. Wybierz najbardziej specyficzną subsubkategorię
3. confidence = 1.0 (pewny), 0.8-0.9 (dobry), 0.6-0.7 (ok), <0.6 (niepewny)
4. reasoning w języku polskim - wyjaśnij dlaczego wybrano TEN 3-poziomowy path
5. Używaj TYLKO slugów z listy powyżej (lowercase, z myślnikami)

PRZYKŁADY:
- "iPhone 15 Pro etui skórzane" → main: "elektronika", sub: "smartfony", subsub: "case-i-etui", confidence: 1.0
- "Słuchawki Sony WH-1000XM5" → main: "elektronika", sub: "audio", subsub: "sluchawki", confidence: 1.0
- "Adidas Ultraboost buty do biegania" → main: "sport-i-turystyka", sub: "odziez-sportowa", subsub: "buty-sportowe", confidence: 0.9
- "Krem przeciwzmarszczkowy L'Oreal" → main: "zdrowie-i-uroda", sub: "kosmetyki", subsub: "kosmetyki-do-twarzy", confidence: 0.9
- "Kabel USB-C 2m" → main: "elektronika", sub: "akcesoria", subsub: "przewody-i-kable", confidence: 0.8

Jeśli nie pasuje, użyj: main: "inne", sub: "pozostale", subsub: "niesklasyfikowane", confidence: 0.3

ZWRÓĆ WSZYSTKIE 3 POZIOMY!`,
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
      if (/case|etui|obudowa|futerał/i.test(combined)) {
        return {
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'smartfony',
          subSubCategorySlug: 'case-i-etui',
          confidence: 0.7,
          reasoning: 'Rozpoznano etui do smartfona (fallback)',
        };
      }
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        subSubCategorySlug: 'akcesoria-do-smartfonow',
        confidence: 0.7,
        reasoning: 'Rozpoznano smartfon na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/słuchawki|headphone|earphone|airpods|earbuds/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        subSubCategorySlug: 'sluchawki',
        confidence: 0.7,
        reasoning: 'Rozpoznano słuchawki na podstawie słów kluczowych (fallback)',
      };
    }
    
    if (/głośnik|speaker|audio/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        subSubCategorySlug: 'glosniki',
        confidence: 0.6,
        reasoning: 'Rozpoznano sprzęt audio (fallback)',
      };
    }
    
    if (/laptop|notebook|ultrabook|macbook/i.test(combined)) {
      if (/gaming|gier|gra/i.test(combined)) {
        return {
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'laptopy',
          subSubCategorySlug: 'laptopy-do-gier',
          confidence: 0.7,
          reasoning: 'Rozpoznano laptop do gier (fallback)',
        };
      }
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'laptopy',
        subSubCategorySlug: 'laptopy-osobiste',
        confidence: 0.7,
        reasoning: 'Rozpoznano laptop (fallback)',
      };
    }
    
    if (/tablet|ipad/i.test(combined)) {
      if (/android/i.test(combined)) {
        return {
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'tablety',
          subSubCategorySlug: 'tablety-android',
          confidence: 0.7,
          reasoning: 'Rozpoznano tablet Android (fallback)',
        };
      }
      if (/ipad|ios|apple/i.test(combined)) {
        return {
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'tablety',
          subSubCategorySlug: 'tablety-ios',
          confidence: 0.7,
          reasoning: 'Rozpoznano iPad (fallback)',
        };
      }
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'tablety',
        subSubCategorySlug: 'tablety-android',
        confidence: 0.6,
        reasoning: 'Rozpoznano tablet (fallback)',
      };
    }
    
    if (/aparat|camera|foto/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'fotografia',
        subSubCategorySlug: 'aparaty-cyfrowe',
        confidence: 0.7,
        reasoning: 'Rozpoznano aparat fotograficzny (fallback)',
      };
    }
    
    if (/obiektyw|lens/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'fotografia',
        subSubCategorySlug: 'obiektywy',
        confidence: 0.7,
        reasoning: 'Rozpoznano obiektyw fotograficzny (fallback)',
      };
    }
    
    if (/kabel|cable|przewód|usb-c|lightning/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'akcesoria',
        subSubCategorySlug: 'przewody-i-kable',
        confidence: 0.7,
        reasoning: 'Rozpoznano kable (fallback)',
      };
    }
    
    if (/ładowarka|charger|zasilacz/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'akcesoria',
        subSubCategorySlug: 'zasilacze',
        confidence: 0.7,
        reasoning: 'Rozpoznano ładowarkę/zasilacz (fallback)',
      };
    }
    
    if (/powerbank/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        subSubCategorySlug: 'powerbanki',
        confidence: 0.7,
        reasoning: 'Rozpoznano powerbank (fallback)',
      };
    }
    
    if (/adapter/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'akcesoria',
        subSubCategorySlug: 'adaptery',
        confidence: 0.6,
        reasoning: 'Rozpoznano adapter (fallback)',
      };
    }
    
    // Moda
    if (/buty|but|shoe|sneaker|adidas|nike|puma|obuwie/i.test(combined)) {
      if (/sport|running|training|fitness/i.test(combined)) {
        return {
          mainCategorySlug: 'moda',
          subCategorySlug: 'obuwie',
          subSubCategorySlug: 'obuwie-sportowe',
          confidence: 0.7,
          reasoning: 'Rozpoznano obuwie sportowe (fallback)',
        };
      }
      if (/damsk|women/i.test(combined)) {
        return {
          mainCategorySlug: 'moda',
          subCategorySlug: 'obuwie',
          subSubCategorySlug: 'obuwie-damskie',
          confidence: 0.7,
          reasoning: 'Rozpoznano obuwie damskie (fallback)',
        };
      }
      if (/męsk|men|man/i.test(combined)) {
        return {
          mainCategorySlug: 'moda',
          subCategorySlug: 'obuwie',
          subSubCategorySlug: 'obuwie-meskie',
          confidence: 0.7,
          reasoning: 'Rozpoznano obuwie męskie (fallback)',
        };
      }
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'obuwie',
        subSubCategorySlug: 'obuwie-meskie',
        confidence: 0.6,
        reasoning: 'Rozpoznano obuwie (fallback)',
      };
    }
    
    if (/sukienka|dress/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-damska',
        subSubCategorySlug: 'sukienki',
        confidence: 0.7,
        reasoning: 'Rozpoznano sukienkę (fallback)',
      };
    }
    
    if (/bluzka|damsk/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-damska',
        subSubCategorySlug: 'bluzki',
        confidence: 0.7,
        reasoning: 'Rozpoznano bluzkę damską (fallback)',
      };
    }
    
    if (/koszula|shirt/i.test(combined)) {
      if (/męsk|men/i.test(combined)) {
        return {
          mainCategorySlug: 'moda',
          subCategorySlug: 'odziez-meska',
          subSubCategorySlug: 'koszule',
          confidence: 0.7,
          reasoning: 'Rozpoznano koszulę męską (fallback)',
        };
      }
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-meska',
        subSubCategorySlug: 't-shirty',
        confidence: 0.6,
        reasoning: 'Rozpoznano t-shirt (fallback)',
      };
    }
    
    if (/spodnie|męsk/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-meska',
        subSubCategorySlug: 'spodnie-meskie',
        confidence: 0.7,
        reasoning: 'Rozpoznano spodnie męskie (fallback)',
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
      subSubCategorySlug: 'niesklasyfikowane',
      confidence: 0.3,
      reasoning: 'Nie udało się dopasować do żadnej kategorii - wymaga ręcznej klasyfikacji (fallback)',
    };
  }
}
