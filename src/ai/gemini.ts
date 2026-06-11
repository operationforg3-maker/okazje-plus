import { ai } from '@/ai/genkit';
import { Document } from '@genkit-ai/ai/retriever';

/**
 * runGeminiCommand(command: string):
 *  - Rozpoznaje intencję polecenia (np. dodaj kategorię, wyszukaj produkt, zaimportuj deale)
 *  - Wywołuje odpowiednie AI flow lub operację na bazie/API
 *  - Zwraca wynik do panelu admina
 *  - Ma dostęp do kluczowych plików projektu w celu analizy (Source of Truth, Architektura, etc.)
 */
export async function runGeminiCommand(command: string, contextFiles: { path: string, content: string }[] = []): Promise<string> {
  // Systemowy prompt definiujący rolę, uprawnienia i architekturę projektu.
  const systemPrompt = `Jesteś Gemini Code Assist, światowej klasy asystent kodowania dla platformy e-commerce "okazje-plus".
Twoim zadaniem jest analiza projektu, odpowiadanie na pytania i sugerowanie zmian w kodzie.

### GŁÓWNE UPRAWNIENIA I KONTEKST PROJEKTU:
1.  **Stos technologiczny**: Next.js (App Router), TypeScript, Firebase (Firestore, Auth, Functions), Genkit (AI), Typesense (wyszukiwarka), Tailwind CSS.
2.  **Baza danych (Firestore)**: Główny model danych to M6 (Product-Centric).
    -   **product_cores**: Niemutowalne dane o produktach (tytuł, opisy w 6 językach, specyfikacje 'coreSpecs'). Klucz: \`identityHash\`.
    -   **deals**: Mutowalne oferty od sprzedawców powiązane z \`ProductCore\` przez \`productId\`. Zawierają cenę, link afiliacyjny i status.
3.  **Architektura "Poczekalni"**: Nowe oferty trafiają do stanu \`poczekalnia\`, gdzie są oceniane przez społeczność. Po osiągnięciu progu punktowego (\`score\`) awansują na stronę główną (status: \`approved\`).
4.  **Role użytkowników**: Zwykły Użytkownik, Zweryfikowany Łowca, Administrator (Super User). Administrator ma specjalne uprawnienia do moderacji treści ("Publikuj Natychmiast", "Spal w zarodku").
5.  **Dostępne narzędzia**: Możesz używać narzędzia \`codeInterpreter\` do analizy dostarczonych plików oraz \`googleSearch\` do wyszukiwania zewnętrznych informacji.

### TWOJE ZADANIE:
Przeanalizuj polecenie użytkownika w kontekście dostarczonych plików i ogólnej architektury. Odpowiadaj precyzyjnie, a jeśli to stosowne, sugeruj konkretne zmiany w kodzie.
`;

  // Konwertuj dostarczone pliki na format, którego może użyć model
  const contextDocuments = contextFiles.map(file =>
    Document.fromText(
      `### Kontekst z pliku: ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\`\n`,
      { path: file.path }
    )
  );

  // Wywołanie modelu Vertex AI (Genkit) - model consistency via genkit.ts
  const response = await ai.generate({
    prompt: command,
    system: systemPrompt,
    context: contextDocuments,
    config: {
      maxOutputTokens: 8192, // Zwiększony limit dla Gemini 1.5 Pro
      temperature: 0.2,
    }
  });

  return response.text || JSON.stringify(response);
}
