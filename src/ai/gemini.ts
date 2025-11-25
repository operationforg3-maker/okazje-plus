import { ai } from '@/ai/genkit';

/**
 * runGeminiCommand(command: string):
 *  - Rozpoznaje intencję polecenia (np. dodaj kategorię, wyszukaj produkt, zaimportuj deale)
 *  - Wywołuje odpowiednie AI flow lub operację na bazie/API
 *  - Zwraca wynik do panelu admina
 */
export async function runGeminiCommand(command: string): Promise<string> {
  // Przykład: prompt do modelu Gemini
  const prompt = `Jesteś asystentem admina platformy okazje-plus. Wykonaj polecenie:
"${command}"
Zwróć wynik w formacie JSON lub czytelnym dla użytkownika. Jeśli polecenie dotyczy bazy lub API, użyj odpowiednich endpointów lub AI flows.`;

  // Wywołanie modelu Gemini (Genkit)
  const response = await ai.generate({
    prompt,
    model: 'googleai/gemini-1.5-flash',
    config: {
      maxOutputTokens: 1024,
      temperature: 0.2,
    }
  });
  return response.text || JSON.stringify(response);
}
