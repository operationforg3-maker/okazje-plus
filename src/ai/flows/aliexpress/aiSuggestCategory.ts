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
import { z } from 'zod';
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
  prompt: `Jesteś ekspertem kategoryzacji produktów dla polskiego portalu okazji.\n\nZadanie: Przypisz produkt do 3-poziomowej kategorii (mainCategorySlug + subCategorySlug + subSubCategorySlug).\n\nProdukt:\n- Tytuł: {{{productTitle}}}\n{{#if description}}- Opis: {{{description}}}{{/if}}\n\nDOSTĘPNE KATEGORIE 3-POZIOMOWE (użyj DOKŁADNIE tych slugów):\n\n1. **elektronika** (main)\n   - **smartfony** (sub): akcesoria-do-smartfonow, case-i-etui, ladowarki-i-kable, powerbanki, uchwyty-samochodowe\n   - **tablety** (sub): tablety-android, tablety-ios, akcesoria-do-tabletow\n   - **laptopy** (sub): laptopy-osobiste, laptopy-do-gier, ultrabooki, akcesoria-do-laptopow\n   - **audio** (sub): sluchawki, glosniki, systemy-audio, akcesoria-audio\n   - **fotografia** (sub): aparaty-cyfrowe, obiektywy, statywy, akcesoria-fotograficzne\n   - **akcesoria** (sub): przewody-i-kable, zasilacze, adaptery, pamiec-zewnetrzna\n\n2. **dom-i-ogrod** (main)\n   - **meble** (sub): meble-do-salonu, meble-do-sypialni, meble-kuchenne, meble-ogrodowe\n   - **dekoracje** (sub): obrazy-i-plakaty, swiatla-dekoracyjne, wazony-i-figurki, tekstylia-domowe\n   - **ogrod** (sub): narzedzia-ogrodowe, nawadnianie, nasiona-i-rosliny\n   - **narzedzia** (sub): narzedzia-reczne, elektronarzedzia, organizery-narzedzi\n   - **agd** (sub): agd-male, agd-kuchenne, odkurzacze, agd-do-czyszczenia\n\n3. **moda** (main)\n   - **odziez-damska** (sub): sukienki, bluzki, spodnie-damskie, kurtki-damskie, swetry-damskie\n   - **odziez-meska** (sub): koszule, spodnie-meskie, kurtki-meskie, swetry-meskie, t-shirty\n   - **obuwie** (sub): obuwie-damskie, obuwie-meskie, obuwie-sportowe, obuwie-dzieciece\n   - **akcesoria-modowe** (sub): torby-i-torebki, paski, czapki-i-kapelusze, szaliki-i-rekawiczki\n   - **bizuteria** (sub): naszyjniki, bransoletki, kolczyki, piercionki, zegarki\n\n4. **sport-i-turystyka** (main)\n   - **fitness** (sub): silownia-domowa, akcesoria-fitness, odzywki-sportowe, maty-do-cwiczen\n   - **odziez-sportowa** (sub): odziez-do-biegania, odziez-rowerowa, odziez-treningowa, buty-sportowe\n   - **turystyka** (sub): namioty, plecaki-turystyczne, spiwory, akcesoria-turystyczne\n   - **akcesoria-sportowe** (sub): pilki, rakiety, ochraniacze, gadzety-sportowe\n\n5. **zdrowie-i-uroda** (main)\n   - **kosmetyki** (sub): kosmetyki-do-twarzy, kosmetyki-do-ciala, makijaz, perfumy\n   - **suplementy** (sub): witaminy, mineraly, suplementy-odchudzajace, suplementy-sportowe\n   - **pielegnacja** (sub): pielegnacja-twarzy, pielegnacja-wlosow, pielegnacja-ciala, higiena\n   - **sprzet-medyczny** (sub): cisnienomierze, termometry, glukometry, maski-ochronne\n\n6. **motoryzacja** (main)\n   - **akcesoria-samochodowe** (sub): organizery, uchwyty, zapachy, pokrowce\n   - **czesci** (sub): filtry, paski, zyrowki, akcesoria-do-czesci\n   - **elektronika-samochodowa** (sub): kamery-samochodowe, nawigacje, ladowarki-samochodowe\n   - **pielegnacja-auta** (sub): kosmetyki-samochodowe, odkurzacze-samochodowe, mycie-i-czyszczenie\n\n7. **zabawki** (main)\n   - **zabawki-dla-niemowlat** (sub): grzechotki, mobile, interaktywne-zabawki\n   - **zabawki-edukacyjne** (sub): puzzle, ksiazki-dla-dzieci, zestawy-edukacyjne\n   - **klocki** (sub): lego, klocki-drewniane, klocki-plastikowe\n   - **lalki-i-figurki** (sub): lalki, figurki-akcji, akcesoria-do-lalek\n   - **gry-planszowe** (sub): gry-rodzinne, gry-strategiczne, gry-karciane\n\n8. **inne** (main)\n   - **pozostale** (sub): niesklasyfikowane, rozne, inne-produkty\n\nZASADY:\n1. MUSISZ zwrócić WSZYSTKIE 3 POZIOMY (main + sub + subsub)\n2. Wybierz najbardziej specyficzną subsubkategorię\n3. confidence = 1.0 (pewny), 0.8-0.9 (dobry), 0.6-0.7 (ok), <0.6 (niepewny)\n4. reasoning w języku polskim - wyjaśnij dlaczego wybrano TEN 3-poziomowy path\n5. Używaj TYLKO slugów z listy powyżej (lowercase, z myślnikami)\n\nPRZYKŁADY:\n- "iPhone 15 Pro etui skórzane" → main: "elektronika", sub: "smartfony", subsub: "case-i-etui", confidence: 1.0\n- "Słuchawki Sony WH-1000XM5" → main: "elektronika", sub: "audio", subsub: "sluchawki", confidence: 1.0\n- "Adidas Ultraboost buty do biegania" → main: "sport-i-turystyka", sub: "odziez-sportowa", subsub: "buty-sportowe", confidence: 0.9\n- "Krem przeciwzmarszczkowy L'Oreal" → main: "zdrowie-i-uroda", sub: "kosmetyki", subsub: "kosmetyki-do-twarzy", confidence: 0.9\n- "Kabel USB-C 2m" → main: "elektronika", sub: "akcesoria", subsub: "przewody-i-kable", confidence: 0.8\n\nJeśli nie pasuje, użyj: main: "inne", sub: "pozostale", subsub: "niesklasyfikowane", confidence: 0.3\n\nZWRÓĆ WSZYSTKIE 3 POZIOMY!`,
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
        subSubCategorySlug: 'torby-i-torebki',
        confidence: 0.6,
        reasoning: 'Rozpoznano akcesoria modowe (fallback)',
      };
    }
    
    if (/zegarek|watch|bransoleta|naszyjnik|kolczyki|pierścionek|biżuteria/i.test(combined)) {
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'bizuteria',
        subSubCategorySlug: 'zegarki',
        confidence: 0.7,
        reasoning: 'Rozpoznano biżuterię (fallback)',
      };
    }
    
    // Sport i Turystyka
    if (/fitness|siłownia|gym|hantel|dumbbell|mata do ćwiczeń/i.test(combined)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'fitness',
        subSubCategorySlug: 'akcesoria-fitness',
        confidence: 0.7,
        reasoning: 'Rozpoznano sprzęt fitness (fallback)',
      };
    }
    
    if (/sport|bieganie|rower|trening|dres|training/i.test(combined)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'odziez-sportowa',
        subSubCategorySlug: 'odziez-treningowa',
        confidence: 0.6,
        reasoning: 'Rozpoznano odzież sportową (fallback)',
      };
    }
    
    if (/namiot|plecak|śpiwór|camping|turystyka|góry/i.test(combined)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'turystyka',
        subSubCategorySlug: 'akcesoria-turystyczne',
        confidence: 0.7,
        reasoning: 'Rozpoznano sprzęt turystyczny (fallback)',
      };
    }
    
    // Zdrowie i Uroda
    if (/krem|serum|kosmetyk|cosmetic|makijaż|makeup|perfum/i.test(combined)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'kosmetyki',
        subSubCategorySlug: 'kosmetyki-do-twarzy',
        confidence: 0.7,
        reasoning: 'Rozpoznano kosmetyki (fallback)',
      };
    }
    
    if (/witamin|suplement|odżywka|protein|magnez/i.test(combined)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'suplementy',
        subSubCategorySlug: 'witaminy',
        confidence: 0.7,
        reasoning: 'Rozpoznano suplementy (fallback)',
      };
    }
    
    if (/pielęgnacja|szampon|żel|mydło/i.test(combined)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'pielegnacja',
        subSubCategorySlug: 'pielegnacja-ciala',
        confidence: 0.6,
        reasoning: 'Rozpoznano produkty pielęgnacyjne (fallback)',
      };
    }
    
    // Dom i Ogród
    if (/meble|stół|krzesło|sofa|kanapa|szafa|furniture/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'meble',
        subSubCategorySlug: 'meble-do-salonu',
        confidence: 0.7,
        reasoning: 'Rozpoznano meble (fallback)',
      };
    }
    
    if (/obraz|wazon|lampka|świeca|dekor/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'dekoracje',
        subSubCategorySlug: 'tekstylia-domowe',
        confidence: 0.6,
        reasoning: 'Rozpoznano dekoracje (fallback)',
      };
    }
    
    if (/odkurzacz|agd|zmywarka|kuchnia/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'agd',
        subSubCategorySlug: 'agd-do-czyszczenia',
        confidence: 0.7,
        reasoning: 'Rozpoznano AGD (fallback)',
      };
    }
    
    if (/narzędzi|wiertarka|młotek|śrubokręt|tool/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'narzedzia',
        subSubCategorySlug: 'narzedzia-reczne',
        confidence: 0.7,
        reasoning: 'Rozpoznano narzędzia (fallback)',
      };
    }
    
    if (/roślina|nasiona|ogród|kwiat|garden/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'ogrod',
        subSubCategorySlug: 'nasiona-i-rosliny',
        confidence: 0.7,
        reasoning: 'Rozpoznano produkty ogrodnicze (fallback)',
      };
    }
    
    // Motoryzacja
    if (/samochód|auto|car|samochodow/i.test(combined)) {
      return {
        mainCategorySlug: 'motoryzacja',
        subCategorySlug: 'akcesoria-samochodowe',
        subSubCategorySlug: 'uchwyty',
        confidence: 0.5,
        reasoning: 'Rozpoznano tematykę motoryzacyjną (fallback)',
      };
    }
    
    // Zabawki
    if (/zabawka|toy|lego|klocki|lalka|doll|gra planszowa/i.test(combined)) {
      return {
        mainCategorySlug: 'zabawki',
        subCategorySlug: 'klocki',
        subSubCategorySlug: 'klocki-plastikowe',
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
