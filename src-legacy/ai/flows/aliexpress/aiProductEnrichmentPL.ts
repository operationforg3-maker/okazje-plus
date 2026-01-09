'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logger } from '@/lib/logging';

// Dane wejściowe do wzbogacenia produktu
const ProductEnrichmentInputSchema = z.object({
  originalTitle: z.string().min(3),
  rawDescription: z.string().optional(),
  categoryPath: z.array(z.string()).nonempty(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  rating: z.number().optional(),
  orders: z.number().optional(),
  merchant: z.string().optional(),
});
export type ProductEnrichmentInput = z.infer<typeof ProductEnrichmentInputSchema>;

// Dane wyjściowe z AI
const ProductEnrichmentOutputSchema = z.object({
  normalizedName: z.string().describe('Poprawiona nazwa PL (bez spamu, czytelna)'),
  shortDescription: z.string().describe('Krótki opis 1-2 zdania po polsku'),
  longDescription: z.string().describe('Dłuższy opis 3-6 zdań z kluczowymi parametrami'),
  features: z.array(z.string()).describe('Lista cech / parametrów (max 10)'),
  keywords: z.array(z.string()).describe('Frazy kluczowe SEO po polsku (4-8)'),
  keywordsEN: z.array(z.string()).describe('English search keywords for AliExpress API (4-8 terms)'),
});
export type ProductEnrichmentOutput = z.infer<typeof ProductEnrichmentOutputSchema>;

const productEnrichmentPrompt = ai.definePrompt({
  name: 'productEnrichmentPromptPL',
  input: { schema: ProductEnrichmentInputSchema },
  output: { schema: ProductEnrichmentOutputSchema },
  prompt: `Jesteś ekspertem ds. contentu e-commerce w Polsce, specjalizujesz się w tłumaczeniu i normalizacji produktów z AliExpress.

ZADANIE: Przetłumacz i wzbogać treść produktu na polski rynek, generując też angielskie słowa kluczowe dla AliExpress API.

DANE WEJŚCIOWE:
• TYTUŁ ORYGINALNY: {{{originalTitle}}}
• KATEGORIA: {{#each categoryPath}}{{this}}/{{/each}}
{{#if rawDescription}}• OPIS SUROWY: {{{rawDescription}}}{{/if}}
{{#if price}}• CENA: {{{price}}} PLN{{/if}}
{{#if originalPrice}}• CENA ORYGINALNA: {{{originalPrice}}} PLN{{/if}}
{{#if rating}}• OCENA: {{{rating}}}/5{{/if}}
{{#if orders}}• ZAMÓWIEŃ: {{{orders}}}{{/if}}
{{#if merchant}}• SPRZEDAWCA: {{{merchant}}}{{/if}}

INSTRUKCJE SZCZEGÓŁOWE:

1. **normalizedName** (Nazwa po polsku):
   • Przetłumacz z angielskiego/chińskiego na naturalny polski
   • Usuń spam: emoji (🔥), wielkie litery (NEW!!!), marketing (Hot Sale, Free Ship)
   • Zachowaj: marki (Xiaomi, Apple), numery modeli (Mi Band 8), specyfikacje (128GB, 5G, 4K)
   • Polskie odpowiedniki: smartphone→smartfon, laptop→laptop, earbuds→słuchawki douszne
   • Przykład: "2024 NEW Xiaomi Redmi Note 13 5G 128GB!!! 🔥" → "Xiaomi Redmi Note 13 5G 128GB – smartfon"
   • Długość: 50-90 znaków

2. **shortDescription** (Krótki opis 1-2 zdania):
   • Przedstaw główną korzyść i zastosowanie produktu
   • Naturalna polszczyzna (nie tłumaczenie słowo-w-słowo)
   • Wspomnij kluczowy parametr jeśli jest istotny (pojemność, moc, rozmiar)
   • Przykład: "Kompaktowy powerbank o pojemności 20000 mAh z szybkim ładowaniem. Idealny do podróży i codziennego użytku."

3. **longDescription** (Dłuższy opis 4-7 zdań):
   • Rozwiń zastosowanie, główne funkcje, kluczowe parametry
   • Tylko fakty wynikające z tytułu/surowych danych – NIE wymyślaj parametrów
   • Struktura: co to jest → do czego służy → najważniejsze cechy → dla kogo
   • Konkretne dane zamiast ogólników: "bateria 5000 mAh" zamiast "długi czas pracy"
   • Naturalna narracja sprzedażowa bez przesady

4. **features** (Lista cech/parametrów, max 10):
   • Konkretne parametry i cechy produktu
   • Format: "Pojemność: 128 GB", "Ekran: 6.5 cala AMOLED", "Procesor: Snapdragon 8 Gen 2"
   • Krótko i na temat – każda cecha w osobnej linii
   • Tylko to co wiesz z tytułu/opisu – NIE wymyślaj
   • Jeśli brak parametrów, zwróć pustą listę []

5. **keywords** (Frazy SEO PO POLSKU, 5-8 fraz):
   • Naturalne frazy wyszukiwania po polsku: "smartfon xiaomi", "powerbank 20000mah", "słuchawki bluetooth"
   • Małe litery, bez znaków specjalnych, bez powtórzeń
   • Mix ogólnych ("słuchawki bezprzewodowe") i konkretnych ("redmi note 13 5g")
   • Przykłady: "xiaomi mi band 8", "opaska fitness", "smartwatch z pulsometrem"

6. **keywordsEN** (English search keywords for AliExpress API, 4-8 terms):
   • English product type and features: "smartphone xiaomi", "power bank 20000mah", "bluetooth headphones"
   • Lowercase, no special characters, no duplicates
   • Include: product category, brand, main specs
   • Example keywords: "xiaomi redmi note", "portable charger", "wireless earbuds", "fast charging"
   • Used for AliExpress API product search queries – must be in English!

ZASADY OGÓLNE:
✓ Tłumacz na naturalny polski (nie kalka językowa)
✓ Techniczne nazwy/marki po angielsku (USB-C, Bluetooth, WiFi, LED)
✓ Polskie odpowiedniki tam gdzie istnieją: słuchawki (nie earphones), mysz (nie mouse)
✓ Zero marketingowych kłamstw i pustych frazesów
✓ Konkretne dane liczbowe zamiast ogólników
✓ Ton: rzeczowy, profesjonalny, pomocny – nie nachalny
✓ Angielskie keywords muszą być wyszukiwalne na AliExpress

Wygeneruj treść:`,
});

const productEnrichmentFlow = ai.defineFlow({
  name: 'productEnrichmentFlowPL',
  inputSchema: ProductEnrichmentInputSchema,
  outputSchema: ProductEnrichmentOutputSchema,
}, async (input) => {
  const { output } = await productEnrichmentPrompt(input);
  return output!;
});

export async function aiProductEnrichmentPL(input: ProductEnrichmentInput): Promise<ProductEnrichmentOutput> {
  logger.debug('AI product enrichment', { title: input.originalTitle, category: input.categoryPath });
  try {
    return await productEnrichmentFlow(input);
  } catch (error) {
    logger.error('AI product enrichment failed', { error });
    // Bezpieczny fallback – użyj tytułu i surowego opisu przyciętego
    const base = input.originalTitle.replace(/\s+/g, ' ').trim();
    const raw = (input.rawDescription || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    return {
      normalizedName: base,
      shortDescription: raw ? raw.slice(0, 120) : base,
      longDescription: raw || base,
      features: [],
      keywords: [],
      keywordsEN: [base.toLowerCase().split(/\s+/).slice(0, 3).join(' ')], // Fallback: first 3 words from title
    };
  }
}
