/**
 * AI Flow: Automatyczne łączenie okazji z produktami w bazie
 * 
 * Analizuje tytuł, opis, link i cenę okazji, następnie przeszukuje bazę produktów
 * i zwraca najbardziej pasujące produkty z oceną dopasowania.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Schema wejściowy - dane okazji do dopasowania
const DealToLinkInputSchema = z.object({
  dealTitle: z.string().describe('Tytuł okazji'),
  dealDescription: z.string().optional().describe('Opis okazji'),
  dealUrl: z.string().optional().describe('URL okazji (może zawierać wskazówki o produkcie)'),
  dealPrice: z.number().optional().describe('Cena w okazji'),
  dealMerchant: z.string().optional().describe('Sklep/merchant'),
  
  // Lista produktów do przeszukania (przekazana z backendu po query Firestore)
  availableProducts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    affiliateUrl: z.string().optional(),
    mainCategorySlug: z.string(),
    subCategorySlug: z.string(),
    subSubCategorySlug: z.string().optional(),
  })).describe('Lista produktów w bazie do przeszukania'),
});

// Schema wyjściowy - najlepsze dopasowania
const DealToLinkOutputSchema = z.object({
  matches: z.array(z.object({
    productId: z.string().describe('ID produktu z bazy'),
    productName: z.string().describe('Nazwa produktu'),
    matchScore: z.number().min(0).max(100).describe('Ocena dopasowania 0-100'),
    confidence: z.enum(['high', 'medium', 'low']).describe('Poziom pewności dopasowania'),
    reasoning: z.string().describe('Uzasadnienie dlaczego ten produkt pasuje'),
    matchFactors: z.object({
      titleSimilarity: z.number().min(0).max(100),
      priceSimilarity: z.number().min(0).max(100),
      categorySimilarity: z.number().min(0).max(100),
      urlSimilarity: z.number().min(0).max(100).optional(),
    }).describe('Szczegółowe czynniki dopasowania'),
  })).describe('Lista dopasowanych produktów, posortowana od najbardziej pasujących'),
  
  recommendation: z.enum(['auto-link', 'review', 'no-match']).describe(
    'auto-link: można automatycznie połączyć z pierwszym produktem; review: wymaga przeglądu; no-match: brak dopasowania'
  ),
  
  summary: z.string().describe('Podsumowanie analizy dopasowania'),
});

export type DealToLinkInput = z.infer<typeof DealToLinkInputSchema>;
export type DealToLinkOutput = z.infer<typeof DealToLinkOutputSchema>;

/**
 * AI Flow: Dopasowuje okazję do produktów w bazie
 */
export const aiLinkDealToProduct = ai.defineFlow(
  {
    name: 'aiLinkDealToProduct',
    inputSchema: DealToLinkInputSchema,
    outputSchema: DealToLinkOutputSchema,
  },
  async (input) => {
    const { dealTitle, dealDescription, dealUrl, dealPrice, dealMerchant, availableProducts } = input;
    
    // Fallback: jeśli brak produktów do przeszukania
    if (!availableProducts || availableProducts.length === 0) {
      return {
        matches: [],
        recommendation: 'no-match' as const,
        summary: 'Brak produktów w bazie do dopasowania.',
      };
    }
    
    // Przygotuj kontekst dla AI
    const productsList = availableProducts.slice(0, 50).map((p, idx) => 
      `${idx + 1}. [ID: ${p.id}] ${p.name} - ${p.price} PLN - Kategoria: ${p.mainCategorySlug}/${p.subCategorySlug}${p.subSubCategorySlug ? '/' + p.subSubCategorySlug : ''}`
    ).join('\n');
    
    const prompt = `
# ZADANIE: Dopasuj okazję do produktu w bazie

## OKAZJA DO DOPASOWANIA:
- **Tytuł**: ${dealTitle}
${dealDescription ? `- **Opis**: ${dealDescription}` : ''}
${dealUrl ? `- **URL**: ${dealUrl}` : ''}
${dealPrice ? `- **Cena**: ${dealPrice} PLN` : ''}
${dealMerchant ? `- **Sklep**: ${dealMerchant}` : ''}

## DOSTĘPNE PRODUKTY W BAZIE (${availableProducts.length} produktów):

${productsList}

## INSTRUKCJE:
1. **Przeanalizuj tytuł okazji** i porównaj z nazwami produktów - szukaj podobieństw w markach, modelach, typach produktów
2. **Porównaj ceny** - jeśli okazja dotyczy konkretnego produktu, cena powinna być w podobnym zakresie (±30%)
3. **Sprawdź kategorię** - czy okazja pasuje do kategorii produktu
4. **Analiza URL** - jeśli URL zawiera nazwę produktu lub markę, wykorzystaj to jako silny sygnał
5. **Uwzględnij warianty** - ten sam produkt może być w różnych wersjach (kolory, rozmiary)

## KRYTERIA OCENY (matchScore 0-100):
- **90-100**: Prawie pewne dopasowanie (ta sama marka + model + podobna cena)
- **70-89**: Bardzo prawdopodobne (podobna nazwa + kategoria + cena w zakresie)
- **50-69**: Możliwe dopasowanie (podobny typ produktu + kategoria)
- **30-49**: Słabe dopasowanie (tylko kategoria lub bardzo ogólne podobieństwo)
- **0-29**: Brak wyraźnego dopasowania

## WYTYCZNE REKOMENDACJI:
- **auto-link**: Użyj gdy matchScore >= 85 i confidence = 'high'
- **review**: Użyj gdy matchScore 60-84 lub confidence = 'medium'
- **no-match**: Użyj gdy matchScore < 60 lub wszystkie dopasowania są 'low' confidence

## WAŻNE:
- Zwróć **maksymalnie 5 najlepszych dopasowań**, posortowanych od najlepszego
- Jeśli brak dobrego dopasowania (score < 50), zwróć pustą listę matches
- W reasoning wyjaśnij po polsku dlaczego dany produkt pasuje lub nie pasuje
- Bądź ostrożny z auto-link - lepiej review niż błędne auto-połączenie

Zwróć tylko JSON z dopasowaniami.
`;

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt,
      output: { schema: DealToLinkOutputSchema },
    });
    
    return output!;
  }
);
