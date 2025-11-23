'use server';

/**
 * AI Category Suggestion Flow
 * 
 * Suggests appropriate 3-level category mapping for AliExpress products
 * using Genkit AI analysis of product title, description, and metadata.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for category suggestion
 */
const CategorySuggestionInputSchema = z.object({
  title: z.string().describe('Product title'),
  description: z.string().optional().describe('Product description'),
  aliexpressCategory: z.string().optional().describe('Original AliExpress category'),
  price: z.number().optional().describe('Product price in PLN'),
});

export type CategorySuggestionInput = z.infer<typeof CategorySuggestionInputSchema>;

/**
 * Output schema from category suggestion
 */
const CategorySuggestionOutputSchema = z.object({
  mainCategorySlug: z
    .string()
    .describe('Main category slug (level 1) - REQUIRED'),
  subCategorySlug: z
    .string()
    .describe('Sub-category slug (level 2) - REQUIRED'),
  subSubCategorySlug: z
    .string()
    .describe('Sub-sub-category slug (level 3) - REQUIRED, always provide a value'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score (0-1) for the suggestion'),
  reasoning: z
    .string()
    .optional()
    .describe('Brief explanation of why this 3-level category path was suggested'),
});

export type CategorySuggestionOutput = z.infer<typeof CategorySuggestionOutputSchema>;

/**
 * AI prompt for category suggestion
 */
const categoryPrompt = ai.definePrompt({
  name: 'categorySuggestionPrompt',
  input: { schema: CategorySuggestionInputSchema },
  output: { schema: CategorySuggestionOutputSchema },
  prompt: `You are an expert e-commerce product categorization specialist for a Polish deals platform.

Analyze the product and suggest the best **3-level category mapping** (REQUIRED: all 3 levels must be filled).

**Product Details:**
- Title: {{{title}}}
{{#if description}}- Description: {{{description}}}{{/if}}
{{#if aliexpressCategory}}- AliExpress Category: {{{aliexpressCategory}}}{{/if}}
{{#if price}}- Price: {{{price}}} PLN{{/if}}

**Available Category Tree (Polish marketplace) - YOU MUST USE EXACT SLUGS:**

1. **elektronika** (Level 1)
   - **smartfony** (Level 2)
     - akcesoria-do-smartfonow, case-i-etui, ladowarki-i-kable, powerbanki, uchwyty-samochodowe
   - **tablety** (Level 2)
     - tablety-android, tablety-ios, akcesoria-do-tabletow
   - **laptopy** (Level 2)
     - laptopy-osobiste, laptopy-do-gier, ultrabooki, akcesoria-do-laptopow
   - **audio** (Level 2)
     - sluchawki, glosniki, systemy-audio, akcesoria-audio
   - **fotografia** (Level 2)
     - aparaty-cyfrowe, obiektywy, statywy, akcesoria-fotograficzne
   - **akcesoria** (Level 2)
     - przewody-i-kable, zasilacze, adaptery, pamiec-zewnetrzna

2. **moda** (Level 1)
   - **odziez-damska** (Level 2)
     - sukienki, bluzki, spodnie-damskie, kurtki-damskie, swetry-damskie
   - **odziez-meska** (Level 2)
     - koszule, spodnie-meskie, kurtki-meskie, swetry-meskie, t-shirty
   - **obuwie** (Level 2)
     - obuwie-damskie, obuwie-meskie, obuwie-sportowe, obuwie-dzieciece
   - **akcesoria-modowe** (Level 2)
     - torby-i-torebki, paski, czapki-i-kapelusze, szaliki-i-rekawiczki
   - **bizuteria** (Level 2)
     - naszyjniki, bransoletki, kolczyki, piercionki, zegarki

3. **dom-i-ogrod** (Level 1)
   - **meble** (Level 2)
     - meble-do-salonu, meble-do-sypialni, meble-kuchenne, meble-ogrodowe
   - **dekoracje** (Level 2)
     - obrazy-i-plakaty, swiatla-dekoracyjne, wazony-i-figurki, tekstylia-domowe
   - **ogrod** (Level 2)
     - narzedzia-ogrodowe, nawadnianie, nasiona-i-rosliny, meble-ogrodowe
   - **narzedzia** (Level 2)
     - narzedzia-reczne, elektronarzedzia, organizery-narzedzi
   - **agd** (Level 2)
     - agd-male, agd-kuchenne, odkurzacze, agd-do-czyszczenia

4. **sport-i-turystyka** (Level 1)
   - **fitness** (Level 2)
     - silownia-domowa, akcesoria-fitness, odzywki-sportowe, maty-do-cwiczen
   - **odziez-sportowa** (Level 2)
     - odziez-do-biegania, odziez-rowerowa, odziez-treningowa, buty-sportowe
   - **turystyka** (Level 2)
     - namioty, plecaki-turystyczne, spiwory, akcesoria-turystyczne
   - **akcesoria-sportowe** (Level 2)
     - pilki, rakiety, ochraniacze, gadzety-sportowe

5. **zdrowie-i-uroda** (Level 1)
   - **kosmetyki** (Level 2)
     - kosmetyki-do-twarzy, kosmetyki-do-ciala, makijaz, perfumy
   - **suplementy** (Level 2)
     - witaminy, mineraly, suplementy-odchudzajace, suplementy-sportowe
   - **pielegnacja** (Level 2)
     - pielegnacja-twarzy, pielegnacja-wlosow, pielegnacja-ciala, higiena
   - **sprzet-medyczny** (Level 2)
     - cisnienomierze, termometry, glukometry, maski-ochronne

6. **kultura-i-rozrywka** (Level 1)
   - **ksiazki** (Level 2)
     - literatura-piekna, literatura-faktu, podreczniki, ksiazki-dla-dzieci
   - **filmy** (Level 2)
     - filmy-dvd, filmy-blu-ray, seriale
   - **gry** (Level 2)
     - gry-komputerowe, gry-konsolowe, gry-planszowe, gry-karciane
   - **muzyka** (Level 2)
     - plyty-cd, plyty-winylowe, muzyka-cyfrowa
   - **zabawki** (Level 2)
     - zabawki-dla-niemowlat, zabawki-edukacyjne, klocki, lalki-i-figurki

7. **inne** (Level 1)
   - **pozostale** (Level 2)
     - rozne, niesklasyfikowane, specjalistyczne

**CRITICAL INSTRUCTIONS:**
1. **YOU MUST PROVIDE ALL 3 LEVELS** - mainCategorySlug, subCategorySlug, AND subSubCategorySlug
2. Use EXACT slugs from the tree above (lowercase, with hyphens)
3. Choose the MOST SPECIFIC level 3 category that matches the product
4. If unsure about level 3, use a general subcategory like "akcesoria" or "inne"
5. Confidence score: 1.0 (perfect match all 3 levels), 0.8-0.9 (good match), 0.6-0.7 (acceptable), <0.6 (fallback)
6. Explain reasoning in Polish, mention why you chose this specific 3-level path

**EXAMPLES:**
- iPhone case → mainCategorySlug: "elektronika", subCategorySlug: "smartfony", subSubCategorySlug: "case-i-etui"
- Running shoes → mainCategorySlug: "sport-i-turystyka", subCategorySlug: "odziez-sportowa", subSubCategorySlug: "buty-sportowe"
- USB cable → mainCategorySlug: "elektronika", subCategorySlug: "akcesoria", subSubCategorySlug: "przewody-i-kable"

Output category slugs in Polish with ALL 3 LEVELS REQUIRED.`,
});

/**
 * Genkit flow for category suggestion
 */
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

/**
 * Suggest category for a product using AI
 * 
 * @param input Product information
 * @returns Suggested category mapping
 */
export async function aiSuggestCategory(
  input: CategorySuggestionInput
): Promise<CategorySuggestionOutput> {
  logger.debug('AI category suggestion', { title: input.title });
  
  try {
    const result = await categoryFlow(input);
    
    logger.info('Category suggestion completed', {
      title: input.title,
      mainCategory: result.mainCategorySlug,
      subCategory: result.subCategorySlug,
      confidence: result.confidence,
    });
    
    return result;
  } catch (error) {
    logger.error('AI category suggestion failed', { error, input });
    
    // Fallback: basic keyword matching with 3 levels
    const titleLower = input.title.toLowerCase();
    
    // Elektronika - smartfony
    if (/phone|telefon|smartphone|smartfon|iphone|samsung galaxy|xiaomi|oppo|realme/i.test(titleLower)) {
      if (/case|etui|obudowa|futerał/i.test(titleLower)) {
        return {
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'smartfony',
          subSubCategorySlug: 'case-i-etui',
          confidence: 0.6,
          reasoning: 'AI failed - fallback keyword match (etui do telefonu)',
        };
      }
      if (/charger|ładowarka|kabel|cable|usb/i.test(titleLower)) {
        return {
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'smartfony',
          subSubCategorySlug: 'ladowarki-i-kable',
          confidence: 0.6,
          reasoning: 'AI failed - fallback keyword match (ładowarka/kabel)',
        };
      }
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        subSubCategorySlug: 'akcesoria-do-smartfonow',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (smartfon)',
      };
    }
    
    // Elektronika - słuchawki
    if (/headphone|słuchawki|earphone|airpods|earbuds/i.test(titleLower)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        subSubCategorySlug: 'sluchawki',
        confidence: 0.6,
        reasoning: 'AI failed - fallback keyword match (słuchawki)',
      };
    }
    
    // Elektronika - power bank
    if (/powerbank|power bank|bateria zewnętrzna/i.test(titleLower)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        subSubCategorySlug: 'powerbanki',
        confidence: 0.6,
        reasoning: 'AI failed - fallback keyword match (powerbank)',
      };
    }
    
    // Moda - obuwie
    if (/shoe|shoes|but|buty|sneaker|adidas|nike/i.test(titleLower)) {
      if (/sport|running|training|fitness/i.test(titleLower)) {
        return {
          mainCategorySlug: 'sport-i-turystyka',
          subCategorySlug: 'odziez-sportowa',
          subSubCategorySlug: 'buty-sportowe',
          confidence: 0.6,
          reasoning: 'AI failed - fallback keyword match (buty sportowe)',
        };
      }
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'obuwie',
        subSubCategorySlug: 'obuwie-sportowe',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (buty)',
      };
    }
    
    // Moda - odzież
    if (/dress|sukienka|bluzka|shirt|koszula|t-shirt|hoodie|bluza/i.test(titleLower)) {
      if (/women|damska|damskie|ladies/i.test(titleLower)) {
        return {
          mainCategorySlug: 'moda',
          subCategorySlug: 'odziez-damska',
          subSubCategorySlug: 'bluzki',
          confidence: 0.6,
          reasoning: 'AI failed - fallback keyword match (odzież damska)',
        };
      }
      return {
        mainCategorySlug: 'moda',
        subCategorySlug: 'odziez-meska',
        subSubCategorySlug: 't-shirty',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (odzież)',
      };
    }
    
    // Dom i ogród
    if (/furniture|mebel|stół|krzesło|sofa|kanapa/i.test(titleLower)) {
      return {
        mainCategorySlug: 'dom-i-ogrod',
        subCategorySlug: 'meble',
        subSubCategorySlug: 'meble-do-salonu',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (meble)',
      };
    }
    
    // Sport
    if (/fitness|gym|siłownia|trening|dumbbell|hantel/i.test(titleLower)) {
      return {
        mainCategorySlug: 'sport-i-turystyka',
        subCategorySlug: 'fitness',
        subSubCategorySlug: 'akcesoria-fitness',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (fitness)',
      };
    }
    
    // Zdrowie i uroda
    if (/cosmetic|kosmetyk|cream|krem|serum|perfum/i.test(titleLower)) {
      return {
        mainCategorySlug: 'zdrowie-i-uroda',
        subCategorySlug: 'kosmetyki',
        subSubCategorySlug: 'kosmetyki-do-twarzy',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (kosmetyki)',
      };
    }
    
    // Zabawki
    if (/toy|zabawka|lego|klocki|doll|lalka/i.test(titleLower)) {
      return {
        mainCategorySlug: 'kultura-i-rozrywka',
        subCategorySlug: 'zabawki',
        subSubCategorySlug: 'klocki',
        confidence: 0.5,
        reasoning: 'AI failed - fallback keyword match (zabawki)',
      };
    }
    
    // Default fallback - ALWAYS 3 levels
    return {
      mainCategorySlug: 'inne',
      subCategorySlug: 'pozostale',
      subSubCategorySlug: 'niesklasyfikowane',
      confidence: 0.2,
      reasoning: 'AI failed - fallback to uncategorized (all 3 levels)',
    };
  }
}
