'use server';

/**
 * AI Deal Description Generator - "The Sales Copywriter"
 * 
 * Generates Polish marketing copy with:
 * - Short description (2 sentences, benefit-focused)
 * - HTML content with bullet points
 * - Marketing title (enhanced version)
 * 
 * Focus: User benefits, not technical specs. No fluff, no spam.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

const DealDescriptionInputSchema = z.object({
  title: z.string().describe('Original product title'),
  rawSpecifications: z.string().optional().describe('Raw specs as JSON or text'),
});

export type DealDescriptionInput = z.infer<typeof DealDescriptionInputSchema>;

const DealDescriptionOutputSchema = z.object({
  marketingTitle: z.string().describe('Enhanced marketing title, Polish - catchy & benefit-focused'),
  shortDescription: z.string().describe('2 sentences, benefit-focused, Polish'),
  htmlContent: z.string().describe('HTML with <ul><li> tags, user benefits - 3-5 points'),
  keywords: z.array(z.string()).describe('5-7 SEO keywords in Polish'),
});

export type DealDescriptionOutput = z.infer<typeof DealDescriptionOutputSchema>;

const dealDescriptionPrompt = ai.definePrompt({
  name: 'dealDescriptionPromptPL',
  input: { schema: DealDescriptionInputSchema },
  output: { schema: DealDescriptionOutputSchema },
  prompt: `Jesteś copywriterem sprzedażowym dla polskiego portalu z okazjami.

Zadanie: Napisz przekonującą treść marketingową w języku polskim.

Produkt: {{{title}}}
{{#if rawSpecifications}}Specyfikacje: {{{rawSpecifications}}}{{/if}}

WYMAGANIA:

**shortDescription** (2 zdania):
- Pierwsza zdanie: główna korzyść/zastosowanie produktu (NIE specyfikacja)
- Druga zdanie: dlaczego warto kupić TERAZ (np. "Idealne rozwiązanie dla...", "Zaoszczędź czas dzięki...")
- Bez wykrzykników, emoji, "MEGA OKAZJA!!!" - naturalny język
- Przykład: "Słuchawki bezprzewodowe z redukcją szumów zapewnią Ci cichy relaks w każdej podróży. Długa bateria (30h) oznacza tydzień słuchania bez ładowania."

**htmlContent** (HTML z listą korzyści):
- Format: <ul><li>korzyść 1</li><li>korzyść 2</li>...</ul>
- 3-5 punktów
- Każdy punkt = korzyść dla użytkownika, NIE sucha specyfikacja
- Zamiast "Bluetooth 5.0" → "Połączenie bezprzewodowe do 10m od telefonu"
- Zamiast "RAM 8GB" → "Płynna praca nawet przy 20 otwartych kartach"
- Jeśli są specyfikacje techniczne, tłumacz je na język korzyści
- Przykład:
<ul>
<li>Redukcja szumów - słuchaj muzyki bez hałasu ulicy</li>
<li>30h baterii - cały tydzień bez ładowania</li>
<li>Szybkie ładowanie - 10 min = 5h muzyki</li>
<li>Wygodne nauszniki - całodniowe noszenie bez dyskomfortu</li>
</ul>

**marketingTitle** (ulepszony tytuł):
- Bazuj na oryginalnym tytule, ale dodaj 1-2 słowa korzyści
- Bez clickbaitu, bez "PROMOCJA!!!", bez emotikonów
- Przykład: "{{{title}}}" → "Słuchawki Sony XM5 z redukcją szumów - 30h baterii"
- Jeśli oryginalny tytuł ma CAPS LOCK, popraw na normalne litery

**keywords** (tablica 5-7 słów kluczowych):
- SEO keywords w języku polskim
- Najważniejsze first
- Mix: główne korzyści + kategoria + typ produktu
- Przykład dla słuchawek: ["słuchawki bezprzewodowe", "redukcja szumów", "długa bateria", "słuchawki Bluetooth", "muzyka podróży", "wygodne słuchawki", "dźwięk HD"]
- BRAK spacji potrójnych, tylko naturalne terminy
- Przydatne dla: wyszukiwania, tagów, SEO

ZAKAZY:
- Bez ogólników ("wysokiej jakości", "najlepszy", "rewelacyjny")
- Bez emotikonów i wykrzykników
- Bez obietnic bez pokrycia (jeśli nie ma w specyfikacjach, nie wymyślaj)
- Bez clickbaitowych fraz ("Nie uwierzysz...", "Eksperci w szoku...")

Jeśli brak specyfikacji, skoncentruj się na kategorii produktu i typowych korzyściach.`,
});

const dealDescriptionFlow = ai.defineFlow(
  {
    name: 'dealDescriptionFlowPL',
    inputSchema: DealDescriptionInputSchema,
    outputSchema: DealDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await dealDescriptionPrompt(input);
    return output!;
  }
);

export async function aiGenerateDealDescriptionPL(
  input: DealDescriptionInput
): Promise<DealDescriptionOutput> {
  logger.debug('AI deal description', { title: input.title });
  
  try {
    const result = await dealDescriptionFlow(input);
    
    logger.info('Deal description completed', {
      title: input.title,
      shortDescLength: result.shortDescription.length,
      htmlContentLength: result.htmlContent.length,
    });
    
    return result;
  } catch (error) {
    logger.error('AI deal description failed', { error, input });
    
    // Fallback: basic text generation
    const title = input.title.trim();
    const marketingTitle = title.replace(/[!]+/g, '').replace(/\s+/g, ' ');
    
    // Try to extract category/type from title
    const isElectronics = /phone|tablet|laptop|słuchawki|ładowarka|powerbank|kabel|elektronika/i.test(title);
    const isFashion = /buty|ubranie|sukienka|koszula|spodnie|but|shoe|dress|shirt/i.test(title);
    const isHome = /meble|lampa|dywan|poduszka|kuchnia|furniture|home/i.test(title);
    
    let shortDescription = `${title}. `;
    let htmlBullets: string[] = [];
    
    if (isElectronics) {
      shortDescription += 'Nowoczesna technologia w przystępnej cenie.';
      htmlBullets = [
        'Nowoczesna technologia w przystępnej cenie',
        'Łatwa obsługa i szybka konfiguracja',
        'Sprawdzona jakość wykonania',
      ];
    } else if (isFashion) {
      shortDescription += 'Wygoda i styl w jednym.';
      htmlBullets = [
        'Wygoda użytkowania na co dzień',
        'Uniwersalny design pasujący do wielu stylizacji',
        'Dobra jakość materiałów',
      ];
    } else if (isHome) {
      shortDescription += 'Funkcjonalne rozwiązanie do Twojego domu.';
      htmlBullets = [
        'Praktyczne zastosowanie w codziennym użytkowaniu',
        'Solidne wykonanie zapewniające długą żywotność',
        'Łatwy montaż i konserwacja',
      ];
    } else {
      shortDescription += 'Sprawdzona jakość w atrakcyjnej cenie.';
      htmlBullets = [
        'Sprawdzona jakość w atrakcyjnej cenie',
        'Proste w użyciu i konserwacji',
        'Dobre opinie użytkowników',
      ];
    }
    
    const htmlContent = '<ul>\n' + htmlBullets.map(b => `<li>${b}</li>`).join('\n') + '\n</ul>';
    
    // Generate basic keywords from title and category
    const keywords = (() => {
      const base = title.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
      if (isElectronics) return [...base, 'elektronika', 'technika', 'gadżet', 'nowoczesne'];
      if (isFashion) return [...base, 'odzież', 'moda', 'wygoda', 'styl'];
      if (isHome) return [...base, 'dom', 'meble', 'wyposażenie', 'poprawa domu'];
      return [...base, 'produkt', 'jakość', 'cena', 'oferta'];
    })().slice(0, 7);
    
    return {
      marketingTitle,
      shortDescription,
      htmlContent,
      keywords,
    };
  }
}
