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
  prompt: `You are an expert at categorizing products for AliExpress.\n\nTask: Assign product to 3-level AliExpress category (mainCategorySlug + subCategorySlug + subSubCategorySlug).\n\nProduct:\n- Title: {{{productTitle}}}\n{{#if description}}- Description: {{{description}}}{{/if}}\n\nAVAILABLE 3-LEVEL CATEGORIES (use EXACTLY these slugs from AliExpress API):\n\n1. **electronics** (main)\n   - **smartphones-and-phones** (sub): smartphones, basic-phones, phone-cases, screen-protectors, chargers, power-banks, cables, car-mounts, audio-accessories, hearing-aids\n   - **computers-and-laptops** (sub): laptops, desktop-computers, monitors, mini-pcs, all-in-one, mice-keyboards, webcams, usb-drives, printers\n   - **tablets-and-readers** (sub): android-tablets, ios-tablets, e-readers, tablet-accessories\n   - **audio-and-video** (sub): headphones, speakers, soundbars, microphones, amplifiers, mp3-players\n   - **tvs-and-projectors** (sub): televisions, projectors, tv-mounts, antennas\n   - **photography-and-cameras** (sub): digital-cameras, lenses, tripods, action-cameras, drones, photography-accessories\n   - **computer-accessories** (sub): mice-keyboards, webcams, usb-drives, printers, pc-accessories\n\n2. **home-and-garden** (main)\n   - **furniture** (sub): living-room-furniture, bedroom-furniture, kitchen-furniture, office-furniture, garden-furniture\n   - **lighting** (sub): ceiling-lights, floor-lamps, desk-lamps, led-bulbs, led-strips\n   - **decorations** (sub): wall-stickers, posters, decorative-lights, vases, home-textiles, seasonal-decor\n   - **kitchen-and-dining** (sub): tableware, cutlery, cookware, food-storage, kitchen-accessories\n   - **storage-and-organizers** (sub): baskets, wall-hooks, closet-organizers, food-containers, decorative-boxes\n   - **bedding-and-textiles** (sub): bedding-sets, comforters, pillows, blankets, towels, curtains\n   - **garden** (sub): garden-tools, watering, garden-accessories, grills\n   - **small-appliances** (sub): blenders, toasters, coffee-makers, food-processors, slicers\n   - **cleaning-appliances** (sub): vacuum-cleaners, steam-mops, robot-vacuums, cleaning-accessories\n\n3. **fashion** (main)\n   - **womens-clothing** (sub): dresses, blouses, pants, skirts, sweaters, jackets\n   - **mens-clothing** (sub): shirts, pants, t-shirts, sweaters, jackets, suits\n   - **footwear** (sub): womens-shoes, mens-shoes, sports-shoes, kids-shoes\n   - **bags-and-luggage** (sub): womens-bags, travel-bags, backpacks, school-bags, suitcases, pouches\n   - **jewelry-and-watches** (sub): womens-watches, mens-watches, necklaces, bracelets, earrings, rings\n\n4. **sports-and-outdoors** (main)\n   - **fitness-and-gym** (sub): dumbbells, exercise-mats, resistance-bands, benches, jump-ropes\n   - **sports-clothing** (sub): sports-shirts, sports-shorts, sports-hoodies, thermal-underwear\n   - **camping-and-hiking** (sub): tents, sleeping-bags, sleeping-pads, backpacks, flashlights, camp-stoves\n   - **winter-sports** (sub): skis, ski-boots, goggles, ski-clothing\n   - **bikes-and-scooters** (sub): city-bikes, mountain-bikes, scooters, bike-accessories\n\n5. **health-and-beauty** (main)\n   - **skincare** (sub): face-creams, serums, cleansers, body-creams, masks\n   - **makeup** (sub): foundations, eyeshadows, lipsticks, mascara, brushes\n   - **hair-care** (sub): shampoos, conditioners, styling-products, hair-dye\n   - **health-devices** (sub): blood-pressure-monitors, thermometers, pulse-oximeters, glucose-meters, inhalers\n   - **personal-care** (sub): massagers, epilators, hair-clippers, cellulite-devices\n\n6. **automotive** (main)\n   - **car-accessories** (sub): organizers, phone-mounts, air-fresheners, seat-covers\n   - **car-electronics** (sub): dash-cams, gps-units, car-chargers, car-radios\n   - **car-care** (sub): car-care-products, car-vacuums, pressure-washers\n\n7. **toys** (main)\n   - **baby-toys** (sub): rattles, mobiles, plush-toys, interactive-toys\n   - **building-blocks** (sub): lego, plastic-blocks, wooden-blocks\n   - **dolls-and-figures** (sub): dolls, action-figures, doll-houses\n   - **educational-toys** (sub): puzzles, board-games, learning-kits\n\n8. **other** (main)\n   - **unclassified** (sub): unclassified, miscellaneous, other-products\n\nRULES:\n1. You MUST return ALL 3 LEVELS (main + sub + subsub)\n2. Choose the most specific subsub category\n3. confidence = 1.0 (certain), 0.8-0.9 (good), 0.6-0.7 (ok), <0.6 (uncertain)\n4. reasoning in English - explain why you chose this 3-level path\n5. Use ONLY slugs from the list above (lowercase, with hyphens)\n\nEXAMPLES:\n- "TV Wall Mount Bracket" → main: "electronics", sub: "tvs-and-projectors", subsub: "tv-mounts", confidence: 1.0\n- "Dragon Ball Wall Sticker" → main: "home-and-garden", sub: "decorations", subsub: "wall-stickers", confidence: 0.9\n- "Simpson Key Holder Wall Hook" → main: "home-and-garden", sub: "storage-and-organizers", subsub: "wall-hooks", confidence: 0.9\n- "Tissue Box Container" → main: "home-and-garden", sub: "storage-and-organizers", subsub: "food-containers", confidence: 0.8\n- "Hanging Storage Basket" → main: "home-and-garden", sub: "storage-and-organizers", subsub: "baskets", confidence: 0.9\n- "iPhone 15 Pro Leather Case" → main: "electronics", sub: "smartphones-and-phones", subsub: "phone-cases", confidence: 1.0\n- "Sony WH-1000XM5 Headphones" → main: "electronics", sub: "audio-and-video", subsub: "headphones", confidence: 1.0\n\nIf doesn't fit, use: main: "other", sub: "unclassified", subsub: "unclassified", confidence: 0.3\n\nRETURN ALL 3 LEVELS!`,
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
    // Najpierw specyficzne przypadki
    if (/tv.*mount|tv.*stand|uchwyt.*tv|uchw.*telewiz|bracket.*tv/i.test(combined)) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'telewizory-projektory',
        subSubCategorySlug: 'uchwyty-tv',
        confidence: 0.9,
        reasoning: 'Rozpoznano uchwyt do TV (fallback)',
      };
    }
    
    if (/sticker|naklejka|decal|wall.*art|vinyl/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'dekoracje',
        subSubCategorySlug: 'naklejki-scienne',
        confidence: 0.8,
        reasoning: 'Rozpoznano naklejkę dekoracyjną (fallback)',
      };
    }
    
    if (/key.*holder|wieszak.*klucz|hook.*key/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'organizery-przechowywanie',
        subSubCategorySlug: 'wieszaki-haki',
        confidence: 0.8,
        reasoning: 'Rozpoznano wieszak/haczyk (fallback)',
      };
    }
    
    if (/tissue.*box|pudełko.*chusteczk|kleenex/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'organizery-przechowywanie',
        subSubCategorySlug: 'pojemniki-kuchenne',
        confidence: 0.7,
        reasoning: 'Rozpoznano pudełko na chusteczki (fallback)',
      };
    }
    
    if (/basket|koszyk|storage.*box|organizer|pojemnik/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'organizery-przechowywanie',
        subSubCategorySlug: 'kosze-i-skrzynie',
        confidence: 0.7,
        reasoning: 'Rozpoznano koszyk/organizer (fallback)',
      };
    }
    
    if (/meble|stół|krzesło|sofa|kanapa|szafa|furniture/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'meble',
        subSubCategorySlug: 'meble-do-salonu',
        confidence: 0.7,
        reasoning: 'Rozpoznano meble (fallback)',
      };
    }
    
    if (/obraz|wazon|lampka|świeca|dekor/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'dekoracje',
        subSubCategorySlug: 'obrazy-i-plakaty',
        confidence: 0.6,
        reasoning: 'Rozpoznano dekoracje (fallback)',
      };
    }
    
    if (/odkurzacz|agd|zmywarka|kuchnia/i.test(combined)) {
      return {
        mainCategorySlug: 'dom-ogrod',
        subCategorySlug: 'agd-do-czyszczenia',
        subSubCategorySlug: 'odkurzacze',
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
      mainCategorySlug: 'other',
      subCategorySlug: 'unclassified',
      subSubCategorySlug: 'unclassified',
      confidence: 0.3,
      reasoning: 'Could not match to any category - requires manual review (fallback)',
    };
  }
}
